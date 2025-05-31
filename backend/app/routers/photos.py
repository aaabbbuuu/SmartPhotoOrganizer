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
                # Use a new DB session for background tasks or ensure the passed 'db' session is managed correctly.
                # For simplicity here, we're using the passed 'db' session, but for long-running tasks,
                # it's better to create a new session within the background task.
                # However, FastAPI's BackgroundTasks run in the same process/thread pool, so this might be okay.
                crud.add_tag_to_image(db, image_id=image_id, tag_name=tag_name, is_ai=True, confidence=confidence)
            except Exception as e:
                print(f"AI Tagging Background: Error adding tag '{tag_name}' to image {image_id}: {e}")
        # db.commit() # Commit after all tags for an image are processed by add_tag_to_image
    else:
        print(f"AI Tagging Background: No AI tags found for {file_path}")


@router.post("/scan-folder", response_model=schemas.ScanFolderResponse)
async def scan_folder_for_images(
    request: schemas.ScanFolderRequest,
    background_tasks: BackgroundTasks, # Add BackgroundTasks dependency
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
                    # Optionally, re-run AI tagging if not already tagged? For now, skip.
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
                    
                    # Add AI tagging to background tasks
                    ai_tags_attempted_count +=1
                    # Pass db session carefully. BackgroundTasks share context but for true async/ Celery, manage sessions per task.
                    background_tasks.add_task(process_image_tags_background, db, db_image.id, file_path)
                    # Note: ai_tags_succeeded_count would be hard to update accurately here
                    # as it's a background task. We'll simplify the response for now.

                except Exception as e:
                    error_msg = f"Failed to process {file_path}: {str(e)}"
                    print(error_msg)
                    errors.append(error_msg)
                    
    # For ai_tags_succeeded, we can't easily get it from background tasks.
    # Let's set it to a placeholder or omit it from immediate response.
    # A better approach might be a separate status endpoint for AI processing.
    return schemas.ScanFolderResponse(
        new_images_added=new_images_count,
        total_images_processed=processed_count,
        ai_tags_attempted=ai_tags_attempted_count,
        ai_tags_succeeded=0, # Placeholder - actual success is in background
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
    # Eager load associated tags to avoid N+1 problem
    # This uses SQLAlchemy's selectinload to fetch related tags and the tag details in fewer queries.
    db_images = db.query(models.Image)\
        .options(selectinload(models.Image.tags).selectinload(models.ImageTag.tag))\
        .order_by(getattr(models.Image, sort_by).desc().nullslast() if sort_order == "desc" 
                  else getattr(models.Image, sort_by).asc().nullslast())
        # .offset(skip)\
        # .limit(limit)\
        # .all()

    # For debugging, let's see the count without offset/limit first
    all_db_images_count = db_images.count()

    # Now apply offset and limit
    db_images = db_images.offset(skip).limit(limit).all()

    response_images = []
    for db_image in db_images:
        tags_for_image_schema = []
        if db_image.tags: 
            for image_tag_assoc in db_image.tags:
                if image_tag_assoc.tag: # image_tag_assoc.tag is a Tag model instance
                    tags_for_image_schema.append(schemas.Tag.from_orm(image_tag_assoc.tag))
        
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