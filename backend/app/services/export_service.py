import os
import shutil
import zipfile
from pathlib import Path
from typing import List, Optional, Dict
from PIL import Image as PILImage
import json
from datetime import datetime
import uuid

from .. import models

class ExportService:
    """Service for exporting photos and albums"""
    
    QUALITY_SETTINGS = {
        "original": None,  # No resize
        "high": (1920, 1080),
        "medium": (1280, 720),
        "low": (640, 480)
    }
    
    def __init__(self, temp_dir: Path):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_job_id(self) -> str:
        """Generate unique job ID"""
        return str(uuid.uuid4())
    
    def resize_image(self, image_path: str, output_path: str, quality: str) -> bool:
        """Resize image based on quality setting"""
        try:
            if quality == "original":
                # Just copy the original
                shutil.copy2(image_path, output_path)
                return True
            
            max_size = self.QUALITY_SETTINGS.get(quality)
            if not max_size:
                return False
            
            img = PILImage.open(image_path)
            img.thumbnail(max_size, PILImage.Resampling.LANCZOS)
            
            # Save with appropriate format
            if img.mode == 'RGBA':
                img = img.convert('RGB')
            
            img.save(output_path, "JPEG", quality=85, optimize=True)
            return True
        except Exception as e:
            print(f"Error resizing image {image_path}: {e}")
            return False
    
    def create_metadata_file(
        self, 
        images: List[models.Image], 
        output_path: str
    ) -> bool:
        """Create JSON metadata file for exported images"""
        try:
            metadata = {
                "export_date": datetime.utcnow().isoformat(),
                "total_images": len(images),
                "images": []
            }
            
            for img in images:
                img_meta = {
                    "filename": img.original_filename or os.path.basename(img.file_path),
                    "capture_date": img.capture_date.isoformat() if img.capture_date else None,
                    "camera_model": img.camera_model,
                    "rating": img.rating,
                    "tags": [tag.tag.name for tag in img.tags] if img.tags else []
                }
                metadata["images"].append(img_meta)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception as e:
            print(f"Error creating metadata file: {e}")
            return False
    
    def export_to_folder(
        self,
        images: List[models.Image],
        destination: str,
        quality: str = "high",
        include_metadata: bool = True
    ) -> Dict:
        """Export images to a folder"""
        dest_path = Path(destination)
        dest_path.mkdir(parents=True, exist_ok=True)
        
        result = {
            "success": True,
            "total": len(images),
            "exported": 0,
            "failed": 0,
            "export_path": str(dest_path)
        }
        
        for img in images:
            try:
                if not os.path.exists(img.file_path):
                    result["failed"] += 1
                    continue
                
                # Generate output filename
                filename = img.original_filename or os.path.basename(img.file_path)
                output_path = dest_path / filename
                
                # Handle duplicate filenames
                counter = 1
                while output_path.exists():
                    name, ext = os.path.splitext(filename)
                    output_path = dest_path / f"{name}_{counter}{ext}"
                    counter += 1
                
                # Resize and save
                if self.resize_image(img.file_path, str(output_path), quality):
                    result["exported"] += 1
                else:
                    result["failed"] += 1
                    
            except Exception as e:
                print(f"Error exporting image {img.file_path}: {e}")
                result["failed"] += 1
        
        # Create metadata file
        if include_metadata and result["exported"] > 0:
            metadata_path = dest_path / "metadata.json"
            self.create_metadata_file(images, str(metadata_path))
        
        return result
    
    def export_to_zip(
        self,
        images: List[models.Image],
        output_path: str,
        quality: str = "high",
        include_metadata: bool = True
    ) -> Dict:
        """Export images to a ZIP file"""
        result = {
            "success": True,
            "total": len(images),
            "exported": 0,
            "failed": 0,
            "export_path": output_path
        }
        
        # Create temporary directory for processing
        temp_export_dir = self.temp_dir / f"export_{uuid.uuid4().hex[:8]}"
        temp_export_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # Export to temp folder first
            for img in images:
                try:
                    if not os.path.exists(img.file_path):
                        result["failed"] += 1
                        continue
                    
                    filename = img.original_filename or os.path.basename(img.file_path)
                    output_file = temp_export_dir / filename
                    
                    # Handle duplicates
                    counter = 1
                    while output_file.exists():
                        name, ext = os.path.splitext(filename)
                        output_file = temp_export_dir / f"{name}_{counter}{ext}"
                        counter += 1
                    
                    if self.resize_image(img.file_path, str(output_file), quality):
                        result["exported"] += 1
                    else:
                        result["failed"] += 1
                        
                except Exception as e:
                    print(f"Error processing image {img.file_path}: {e}")
                    result["failed"] += 1
            
            # Create metadata
            if include_metadata and result["exported"] > 0:
                metadata_path = temp_export_dir / "metadata.json"
                self.create_metadata_file(images, str(metadata_path))
            
            # Create ZIP file
            with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in temp_export_dir.rglob('*'):
                    if file_path.is_file():
                        arcname = file_path.relative_to(temp_export_dir)
                        zipf.write(file_path, arcname)
            
            result["success"] = True
            
        except Exception as e:
            print(f"Error creating ZIP file: {e}")
            result["success"] = False
            result["error"] = str(e)
        
        finally:
            # Cleanup temp directory
            if temp_export_dir.exists():
                shutil.rmtree(temp_export_dir, ignore_errors=True)
        
        return result
    
    def cleanup_old_exports(self, max_age_hours: int = 24):
        """Clean up old temporary export files"""
        try:
            current_time = datetime.utcnow()
            for item in self.temp_dir.iterdir():
                if item.is_file() and item.suffix == '.zip':
                    # Check file age
                    file_time = datetime.fromtimestamp(item.stat().st_mtime)
                    age_hours = (current_time - file_time).total_seconds() / 3600
                    
                    if age_hours > max_age_hours:
                        item.unlink()
                        print(f"Cleaned up old export: {item.name}")
        except Exception as e:
            print(f"Error during cleanup: {e}")