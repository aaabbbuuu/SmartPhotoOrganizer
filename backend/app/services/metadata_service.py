from PIL import Image as PILImage # Renamed to avoid conflict with models.Image
from PIL.ExifTags import TAGS
from datetime import datetime
import exifread # For more robust EXIF, especially dates
import os

def extract_metadata(file_path: str) -> dict:
    metadata = {"original_filename": os.path.basename(file_path)}
    try:
        # Using exifread for robust date parsing
        with open(file_path, 'rb') as f:
            tags = exifread.process_file(f, stop_tag='EXIF DateTimeOriginal')
            
            dt_original_tag = tags.get('EXIF DateTimeOriginal')
            if dt_original_tag:
                try:
                    # Format is typically 'YYYY:MM:DD HH:MM:SS'
                    metadata["capture_date"] = datetime.strptime(str(dt_original_tag), '%Y:%m:%d %H:%M:%S')
                except ValueError:
                    pass # Could add more parsing attempts or logging

            camera_model_tag = tags.get('Image Model')
            if camera_model_tag:
                metadata["camera_model"] = str(camera_model_tag).strip()

        # Fallback or supplement with Pillow if needed (though exifread is often better for critical tags)
        # img = PILImage.open(file_path)
        # exif_data = img._getexif()
        # if exif_data:
        #     for tag_id, value in exif_data.items():
        #         tag_name = TAGS.get(tag_id, tag_id)
        #         if tag_name == "DateTimeOriginal" and "capture_date" not in metadata:
        #             try:
        #                 metadata["capture_date"] = datetime.strptime(value, '%Y:%m:%d %H:%M:%S')
        #             except (TypeError, ValueError):
        #                 pass # Invalid date format
        #         elif tag_name == "Model" and "camera_model" not in metadata:
        #             metadata["camera_model"] = str(value).strip()
        
        # If no EXIF date, use file modification time as a fallback
        if "capture_date" not in metadata:
             metadata["capture_date"] = datetime.fromtimestamp(os.path.getmtime(file_path))


    except Exception as e:
        print(f"Error extracting metadata for {file_path}: {e}")
    return metadata