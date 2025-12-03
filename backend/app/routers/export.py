from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path
import os
from datetime import datetime

from .. import crud, models, schemas
from ..core.database import get_db
from ..services.export_service import ExportService
from ..core.config import THUMBNAILS_DIR

router = APIRouter(
    prefix="/api/export",
    tags=["export"],
)

# Initialize export service with temp directory
EXPORT_TEMP_DIR = Path(THUMBNAILS_DIR).parent / "exports"
export_service = ExportService(EXPORT_TEMP_DIR)

# In-memory job tracker (in production, use Redis or database)
export_jobs = {}

def process_export_job(
    job_id: str,
    images: list,
    export_format: str,
    quality: str,
    include_metadata: bool,
    destination: str
):
    """Background task to process export"""
    try:
        export_jobs[job_id]["status"] = "processing"
        export_jobs[job_id]["processed_images"] = 0
        
        if export_format == "zip":
            result = export_service.export_to_zip(
                images=images,
                output_path=destination,
                quality=quality,
                include_metadata=include_metadata
            )
        else:
            result = export_service.export_to_folder(
                images=images,
                destination=destination,
                quality=quality,
                include_metadata=include_metadata
            )
        
        if result["success"]:
            export_jobs[job_id]["status"] = "completed"
            export_jobs[job_id]["export_path"] = result["export_path"]
            export_jobs[job_id]["processed_images"] = result["exported"]
            export_jobs[job_id]["completed_at"] = datetime.utcnow()
        else:
            export_jobs[job_id]["status"] = "failed"
            export_jobs[job_id]["error_message"] = result.get("error", "Export failed")
            
    except Exception as e:
        export_jobs[job_id]["status"] = "failed"
        export_jobs[job_id]["error_message"] = str(e)
        print(f"Export job {job_id} failed: {e}")

@router.post("/", response_model=schemas.ExportJobResponse)
async def create_export_job(
    request: schemas.ExportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create an export job for photos"""
    images = []
    
    # Get images from album or image_ids
    if request.album_id:
        album = crud.get_album_by_id(db, request.album_id)
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        images = [ap.image for ap in album.photos]
    elif request.image_ids:
        for img_id in request.image_ids:
            img = db.query(models.Image).filter(models.Image.id == img_id).first()
            if img:
                images.append(img)
    
    if not images:
        raise HTTPException(status_code=400, detail="No images to export")
    
    # Generate job ID
    job_id = export_service.generate_job_id()
    
    # Determine destination path
    if request.destination_path:
        destination = request.destination_path
    else:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        if request.export_format == schemas.ExportFormat.ZIP:
            destination = str(EXPORT_TEMP_DIR / f"export_{timestamp}.zip")
        else:
            destination = str(EXPORT_TEMP_DIR / f"export_{timestamp}")
    
    # Create job entry
    export_jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0,
        "total_images": len(images),
        "processed_images": 0,
        "export_path": None,
        "error_message": None,
        "created_at": datetime.utcnow(),
        "completed_at": None
    }
    
    # Start background processing
    background_tasks.add_task(
        process_export_job,
        job_id,
        images,
        request.export_format.value,
        request.quality.value,
        request.include_metadata,
        destination
    )
    
    return schemas.ExportJobResponse(
        job_id=job_id,
        status=schemas.ExportStatus.PENDING,
        message=f"Export job created with {len(images)} images"
    )

@router.get("/jobs/{job_id}", response_model=schemas.ExportJob)
async def get_export_job_status(job_id: str):
    """Get status of an export job"""
    if job_id not in export_jobs:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    job = export_jobs[job_id]
    
    # Calculate progress
    if job["total_images"] > 0:
        progress = int((job["processed_images"] / job["total_images"]) * 100)
    else:
        progress = 0
    
    return schemas.ExportJob(
        job_id=job["job_id"],
        status=schemas.ExportStatus(job["status"]),
        progress=progress,
        total_images=job["total_images"],
        processed_images=job["processed_images"],
        export_path=job["export_path"],
        error_message=job["error_message"],
        created_at=job["created_at"],
        completed_at=job["completed_at"]
    )

@router.get("/download/{job_id}")
async def download_export(job_id: str):
    """Download completed export file"""
    if job_id not in export_jobs:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    job = export_jobs[job_id]
    
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Export not completed yet")
    
    export_path = job["export_path"]
    if not export_path or not os.path.exists(export_path):
        raise HTTPException(status_code=404, detail="Export file not found")
    
    filename = os.path.basename(export_path)
    
    return FileResponse(
        path=export_path,
        filename=filename,
        media_type='application/zip' if filename.endswith('.zip') else 'application/octet-stream'
    )

@router.delete("/jobs/{job_id}")
async def delete_export_job(job_id: str):
    """Delete an export job and its files"""
    if job_id not in export_jobs:
        raise HTTPException(status_code=404, detail="Export job not found")
    
    job = export_jobs[job_id]
    
    # Delete export file if exists
    if job["export_path"] and os.path.exists(job["export_path"]):
        try:
            if os.path.isfile(job["export_path"]):
                os.remove(job["export_path"])
            elif os.path.isdir(job["export_path"]):
                import shutil
                shutil.rmtree(job["export_path"])
        except Exception as e:
            print(f"Error deleting export file: {e}")
    
    # Remove job from tracker
    del export_jobs[job_id]
    
    return {"message": "Export job deleted"}

@router.post("/cleanup")
async def cleanup_old_exports():
    """Manually trigger cleanup of old export files"""
    try:
        export_service.cleanup_old_exports(max_age_hours=24)
        return {"message": "Cleanup completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")