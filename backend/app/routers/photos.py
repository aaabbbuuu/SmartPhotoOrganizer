from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from .. import crud, models, schemas
from ..core.database import get_db
from ..services import metadata_service, thumbnail_service

router = APIRouter(
    prefix="/api/photos",
    tags=["photos"],
)

@router.post("/scan-folder", response_model=schemas.ScanFolderResponse)
async def scan_folder_for_images(
    request: schemas.ScanFolderRequest,
    db: Session = Depends(get_db)
):
    folder_path = request.folder_path
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail="Invalid folder path provided.")

    new_images_count = 0
    processed_count = 0
    errors = []
    
    image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp') # Add more if needed

    for root, _, files in os.walk(folder_path):
        for filename in files:
            if filename.lower().endswith(image_extensions):
                processed_count += 1
                file_path = os.path.join(root, filename)
                
                # Check if image already exists
                db_image = crud.get_image_by_path(db, file_path)
                if db_image:
                    continue # Skip if already processed

                try:
                    metadata = metadata_service.extract_metadata(file_path)
                    thumb_rel_path = thumbnail_service.generate_thumbnail(file_path)

                    image_data = schemas.ImageCreate(
                        file_path=file_path,
                        original_filename=metadata.get("original_filename"),
                        capture_date=metadata.get("capture_date"),
                        camera_model=metadata.get("camera_model"),
                        thumbnail_path=thumb_rel_path
                    )
                    crud.create_image(db=db, image=image_data)
                    new_images_count += 1
                except Exception as e:
                    error_msg = f"Failed to process {file_path}: {str(e)}"
                    print(error_msg)
                    errors.append(error_msg)
                    
    return schemas.ScanFolderResponse(
        new_images_added=new_images_count,
        total_images_processed=processed_count,
        errors=errors
    )

@router.get("/", response_model=List[schemas.Image])
async def read_images(
    skip: int = 0, 
    limit: int = 100, 
    sort_by: str = Query("capture_date", enum=["capture_date", "date_added", "original_filename", "camera_model"]),
    sort_order: str = Query("desc", enum=["asc", "desc"]),
    db: Session = Depends(get_db)
):
    images = crud.get_images(db, skip=skip, limit=limit, sort_by=sort_by, sort_order=sort_order)
    return images