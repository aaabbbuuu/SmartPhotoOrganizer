from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks 
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from datetime import datetime
import os
import math

from .. import crud, models, schemas
from ..core.database import get_db, SessionLocal
from ..services import metadata_service, thumbnail_service
from ..ai import image_classifier

router = APIRouter(
    prefix="/api/photos",
    tags=["photos"],
)

# --- Helper for AI tagging in background ---
def process_image_tags_background(image_id: int, file_path: str):
    """
    Function to be run in background for AI tagging.
    Creates its own database session to avoid session conflicts.
    """
    print(f"AI Tagging Background: Starting for image_id {image_id}, path {file_path}")
    
    # Create a new session for this background task
    db = SessionLocal()
    try:
        # Ensure model is loaded if not already (can take time on first run)
        if image_classifier.classifier_model is None or image_classifier.imagenet_labels is None:
            image_classifier.load_model_and_labels() 

        ai_tags_with_confidence = image_classifier.get_tags_for_image(file_path)
        if ai_tags_with_confidence:
            print(f"AI Tagging Background: Found tags for {file_path}: {ai_tags_with_confidence}")
            for tag_name, confidence in ai_tags_with_confidence:
                try:
                    crud.add_tag_to_image(db, image_id=image_id, tag_name=tag_name, is_ai_generated=True, confidence=confidence)
                except Exception as e:
                    print(f"AI Tagging Background: Error adding tag '{tag_name}' to image {image_id}: {e}")
                    # Continue processing other tags even if one fails
        else:
            print(f"AI Tagging Background: No AI tags found for {file_path}")
    except Exception as e:
        print(f"AI Tagging Background: Critical error processing image {image_id}: {e}")
    finally:
        db.close()

@router.post("/images/{image_id}/tags", response_model=schemas.Tag, status_code=201) 
async def add_manual_tag_to_image_endpoint(
    image_id: int, 
    tag_request: schemas.AddTagRequest, 
    db: Session = Depends(get_db)
):
    """Add a manual tag to an image"""
    try:
        image_tag_assoc = crud.add_tag_to_image(
            db=db, 
            image_id=image_id, 
            tag_name=tag_request.tag_name, 
            is_ai_generated=False
        )
        
        if not image_tag_assoc:
            raise HTTPException(
                status_code=404, 
                detail=f"Image with id {image_id} not found or tag could not be added."
            )
        
        return image_tag_assoc.tag
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error adding tag to image {image_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add tag to image")

@router.delete("/images/{image_id}/tags/{tag_id}", status_code=204)
async def remove_tag_from_image_endpoint(
    image_id: int, 
    tag_id: int, 
    db: Session = Depends(get_db)
):
    """Remove a tag from an image"""
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail=f"Tag with id {tag_id} not found.")

    success = crud.remove_tag_from_image(db=db, image_id=image_id, tag_id=db_tag.id)
    if not success:
        raise HTTPException(
            status_code=404, 
            detail=f"Tag not found on image or image not found."
        )
    return None


@router.post("/scan-folder", response_model=schemas.ScanFolderResponse)
async def scan_folder_for_images(
    request: schemas.ScanFolderRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Scan a folder for images and add them to the database"""
    folder_path = request.folder_path
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail="Invalid folder path provided.")

    new_images_count = 0
    processed_count = 0
    ai_tags_attempted_count = 0
    errors = []
    
    image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp')

    for root, _, files in os.walk(folder_path):
        for filename in files:
            if filename.lower().endswith(image_extensions):
                processed_count += 1
                file_path = os.path.join(root, filename)
                
                # Check if image already exists
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

                    # Queue AI tagging in background
                    ai_tags_attempted_count += 1
                    background_tasks.add_task(
                        process_image_tags_background, 
                        db_image.id, 
                        file_path
                    )

                except Exception as e:
                    error_msg = f"Failed to process {file_path}: {str(e)}"
                    print(error_msg)
                    errors.append(error_msg)

    return schemas.ScanFolderResponse(
        new_images_added=new_images_count,
        total_images_processed=processed_count,
        ai_tags_attempted=ai_tags_attempted_count,
        ai_tags_succeeded=0,  # Updated in background
        errors=errors
    )

@router.get("/", response_model=schemas.PaginatedImageResponse)
async def read_images(
    page: int = Query(1, ge=1, description="Page number (starts at 1)"),
    page_size: int = Query(50, ge=1, le=200, description="Number of items per page"),
    sort_by: str = Query(
        "capture_date", 
        enum=["capture_date", "date_added", "original_filename", "camera_model", "rating"]
    ),
    sort_order: str = Query("desc", enum=["asc", "desc"]),
    date_start: Optional[datetime] = Query(
        None, 
        description="Filter by capture date (start) YYYY-MM-DDTHH:MM:SS"
    ),
    date_end: Optional[datetime] = Query(
        None, 
        description="Filter by capture date (end) YYYY-MM-DDTHH:MM:SS"
    ),
    camera_models: Optional[List[str]] = Query(
        None, 
        description="List of camera models to filter by"
    ),
    tag_names: Optional[List[str]] = Query(
        None, 
        description="List of tag names (photo must have at least one)"
    ),
    rating_min: Optional[int] = Query(
        None, 
        ge=0, 
        le=5, 
        description="Minimum rating (0-5)"
    ),
    db: Session = Depends(get_db)
):
    """Get paginated list of images with optional filters"""
    try:
        # Calculate skip value for pagination
        skip = (page - 1) * page_size
        
        # Get total count for pagination metadata
        total_count = crud.get_images_count(
            db=db,
            date_start=date_start,
            date_end=date_end,
            camera_models=camera_models,
            tag_names=tag_names,
            rating_min=rating_min
        )
        
        # Get paginated images
        db_images_list = crud.get_images( 
            db=db, 
            skip=skip, 
            limit=page_size, 
            sort_by=sort_by, 
            sort_order=sort_order,
            date_start=date_start,
            date_end=date_end,
            camera_models=camera_models,
            tag_names=tag_names,
            rating_min=rating_min
        )

        # Transform to response schema
        response_images = []
        for db_image_item in db_images_list: 
            tags_for_image_schema = []
            if db_image_item.tags: 
                for image_tag_assoc in db_image_item.tags:
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
                "id": db_image_item.id,
                "file_path": db_image_item.file_path,
                "original_filename": db_image_item.original_filename,
                "capture_date": db_image_item.capture_date,
                "camera_model": db_image_item.camera_model,
                "thumbnail_path": db_image_item.thumbnail_path,
                "date_added": db_image_item.date_added,
                "rating": db_image_item.rating,
                "associated_tags": tags_for_image_schema
            }
            response_images.append(schemas.Image(**image_data_for_response_schema))
        
        # Calculate pagination metadata
        total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1
        
        pagination_meta = schemas.PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total_count,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
        return schemas.PaginatedImageResponse(
            items=response_images,
            meta=pagination_meta
        )
    except Exception as e:
        print(f"Error fetching images: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch images")

@router.post("/images/{image_id}/rate", response_model=schemas.Image)
async def rate_image_endpoint(
    image_id: int,
    rating_request: schemas.UpdateRatingRequest,
    db: Session = Depends(get_db)
):
    """Update the rating of an image"""
    try:
        updated_image = crud.update_image_rating(
            db=db, 
            image_id=image_id, 
            rating=rating_request.rating
        )
        
        if not updated_image:
            # Check if image exists
            db_image_check = db.query(models.Image).filter(models.Image.id == image_id).first()
            if not db_image_check:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Image with id {image_id} not found."
                )
            else:
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid rating value provided. Must be between 0 and 5."
                )

        # Transform to response schema
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error rating image {image_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to rate image")