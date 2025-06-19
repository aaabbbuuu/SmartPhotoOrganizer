from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks 
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
import os

from .. import crud, models, schemas
from ..core.database import get_db
from ..services import metadata_service, thumbnail_service
from ..ai import image_classifier

router = APIRouter(
    prefix="/api/photos",
    tags=["photos"],
)

# --- Helper for AI tagging in background ---
def process_image_tags_background(db: Session, image_id: int, file_path: str):
    """Function to be run in background for AI tagging."""
    print(f"AI Tagging Background: Starting for image_id {image_id}, path {file_path}")
    # Ensure model is loaded if not already (can take time on first run)
    if image_classifier.classifier_model is None or image_classifier.imagenet_labels is None:
        image_classifier.load_model_and_labels() 

    ai_tags_with_confidence = image_classifier.get_tags_for_image(file_path)
    if ai_tags_with_confidence:
        print(f"AI Tagging Background: Found tags for {file_path}: {ai_tags_with_confidence}")
        for tag_name, confidence in ai_tags_with_confidence:
            try:
                crud.add_tag_to_image(db, image_id=image_id, tag_name=tag_name, is_ai=True, confidence=confidence)
            except Exception as e:
                print(f"AI Tagging Background: Error adding tag '{tag_name}' to image {image_id}: {e}")
        # db.commit()
    else:
        print(f"AI Tagging Background: No AI tags found for {file_path}")

@router.post("/images/{image_id}/tags", response_model=schemas.Tag, status_code=201) 
async def add_manual_tag_to_image_endpoint(
    image_id: int, 
    tag_request: schemas.AddTagRequest, 
    db: Session = Depends(get_db)
):
    tag_name = tag_request.tag_name.strip().lower()
    if not tag_name:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")

    image_tag_assoc = crud.add_tag_to_image(db=db, image_id=image_id, tag_name=tag_name, is_ai_generated=False)
    
    if not image_tag_assoc:
        raise HTTPException(status_code=404, detail=f"Image with id {image_id} not found or tag could not be added.")
    
    return image_tag_assoc.tag 

@router.delete("/images/{image_id}/tags/{tag_id}", status_code=204)
async def remove_tag_from_image_endpoint(
    image_id: int, 
    tag_id: int, 
    db: Session = Depends(get_db)
):
    
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail=f"Tag with id {tag_id} not found.")

    success = crud.remove_tag_from_image(db=db, image_id=image_id, tag_id=db_tag.id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Tag not found on image or image not found.")
    return {"detail": "Tag removed successfully"}


@router.post("/scan-folder", response_model=schemas.ScanFolderResponse)
async def scan_folder_for_images(
    request: schemas.ScanFolderRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    folder_path = request.folder_path
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail="Invalid folder path provided.")

    new_images_count = 0
    processed_count = 0
    ai_tags_attempted_count = 0
    ai_tags_succeeded_count = 0
    errors = []
    
    image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp')

    for root, _, files in os.walk(folder_path):
        for filename in files:
            if filename.lower().endswith(image_extensions):
                processed_count += 1
                file_path = os.path.join(root, filename)
                
                db_image_check = crud.get_image_by_path(db, file_path)
                if db_image_check:
                    continue

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
                    db_image = crud.create_image(db=db, image=image_data)
                    new_images_count += 1

                    ai_tags_attempted_count +=1
                    background_tasks.add_task(process_image_tags_background, db, db_image.id, file_path)

                except Exception as e:
                    error_msg = f"Failed to process {file_path}: {str(e)}"
                    print(error_msg)
                    errors.append(error_msg)

    return schemas.ScanFolderResponse(
        new_images_added=new_images_count,
        total_images_processed=processed_count,
        ai_tags_attempted=ai_tags_attempted_count,
        ai_tags_succeeded=0,
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
    db_images = db.query(models.Image)\
        .options(selectinload(models.Image.tags).selectinload(models.ImageTag.tag))\
        .order_by(getattr(models.Image, sort_by).desc().nullslast() if sort_order == "desc" 
                  else getattr(models.Image, sort_by).asc().nullslast())
        # .offset(skip)\
        # .limit(limit)\
        # .all()

    all_db_images_count = db_images.count()

    db_images = db_images.offset(skip).limit(limit).all()

    response_images = []
    for db_image in db_images:
        tags_for_image_schema = []
        if db_image.tags: 
            for image_tag_assoc in db_image.tags:
                if image_tag_assoc.tag: 
                    tags_for_image_schema.append(
                        schemas.ImageTagInfo(
                            id=image_tag_assoc.tag.id,
                            name=image_tag_assoc.tag.name,
                            is_ai_generated=image_tag_assoc.is_ai_generated,
                            confidence=image_tag_assoc.confidence
                    )
                )
        
        image_data_for_response_schema = {
            "id": db_image.id,
            "file_path": db_image.file_path,
            "original_filename": db_image.original_filename,
            "capture_date": db_image.capture_date,
            "camera_model": db_image.camera_model,
            "thumbnail_path": db_image.thumbnail_path,
            "date_added": db_image.date_added,
            "associated_tags": tags_for_image_schema
        }
        response_images.append(schemas.Image(**image_data_for_response_schema))
        
    return response_images

@router.post("/images/{image_id}/rate", response_model=schemas.Image)
async def rate_image_endpoint(
    image_id: int,
    rating_request: schemas.UpdateRatingRequest,
    db: Session = Depends(get_db)
):
    updated_image = crud.update_image_rating(db=db, image_id=image_id, rating=rating_request.rating)
    if not updated_image:
        db_image_check = db.query(models.Image).filter(models.Image.id == image_id).first()
        if not db_image_check:
            raise HTTPException(status_code=404, detail=f"Image with id {image_id} not found.")
        else:
            raise HTTPException(status_code=400, detail="Invalid rating value provided. Must be between 0 and 5.")

    tags_info_for_image = []
    if updated_image.tags:
        for image_tag_assoc in updated_image.tags:
            if image_tag_assoc.tag:
                tags_info_for_image.append(
                    schemas.ImageTagInfo(
                        id=image_tag_assoc.tag.id,
                        name=image_tag_assoc.tag.name,
                        is_ai_generated=image_tag_assoc.is_ai_generated,
                        confidence=image_tag_assoc.confidence
                    )
                )
    
    image_data_for_response_schema = {
        "id": updated_image.id,
        "file_path": updated_image.file_path,
        "original_filename": updated_image.original_filename,
        "capture_date": updated_image.capture_date,
        "camera_model": updated_image.camera_model,
        "thumbnail_path": updated_image.thumbnail_path,
        "date_added": updated_image.date_added,
        "rating": updated_image.rating,
        "associated_tags": tags_info_for_image
    }
    return schemas.Image(**image_data_for_response_schema)