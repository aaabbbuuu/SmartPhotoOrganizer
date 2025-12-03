from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import os

from .. import crud, models, schemas
from ..core.database import get_db

router = APIRouter(
    prefix="/api/bulk",
    tags=["bulk operations"],
)

@router.post("/delete", response_model=schemas.BulkDeleteResponse)
async def bulk_delete_images(
    request: schemas.BulkDeleteRequest,
    db: Session = Depends(get_db)
):
    """Delete multiple images at once"""
    deleted_count = 0
    failed_count = 0
    failed_ids = []
    errors = []
    
    for image_id in request.image_ids:
        try:
            db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
            if not db_image:
                failed_count += 1
                failed_ids.append(image_id)
                errors.append(f"Image {image_id} not found")
                continue
            
            # Delete associated tags
            db.query(models.ImageTag).filter(models.ImageTag.image_id == image_id).delete()
            
            # Delete from albums
            db.query(models.AlbumPhoto).filter(models.AlbumPhoto.image_id == image_id).delete()
            
            # Delete image record
            db.delete(db_image)
            db.commit()
            deleted_count += 1
            
        except Exception as e:
            failed_count += 1
            failed_ids.append(image_id)
            errors.append(f"Error deleting image {image_id}: {str(e)}")
            db.rollback()
    
    return schemas.BulkDeleteResponse(
        deleted_count=deleted_count,
        failed_count=failed_count,
        failed_ids=failed_ids,
        errors=errors
    )

@router.post("/tag", response_model=schemas.BulkTagResponse)
async def bulk_tag_images(
    request: schemas.BulkTagRequest,
    db: Session = Depends(get_db)
):
    """Add tags to multiple images at once"""
    success_count = 0
    failed_count = 0
    tags_added = 0
    
    for image_id in request.image_ids:
        try:
            db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
            if not db_image:
                failed_count += 1
                continue
            
            image_success = True
            for tag_name in request.tag_names:
                try:
                    result = crud.add_tag_to_image(
                        db=db,
                        image_id=image_id,
                        tag_name=tag_name,
                        is_ai_generated=False
                    )
                    if result:
                        tags_added += 1
                except Exception as e:
                    print(f"Error adding tag '{tag_name}' to image {image_id}: {e}")
                    image_success = False
            
            if image_success:
                success_count += 1
            else:
                failed_count += 1
                
        except Exception as e:
            print(f"Error processing image {image_id}: {e}")
            failed_count += 1
    
    return schemas.BulkTagResponse(
        success_count=success_count,
        failed_count=failed_count,
        tags_added=tags_added
    )

@router.post("/rate", response_model=schemas.BulkRatingResponse)
async def bulk_rate_images(
    request: schemas.BulkRatingRequest,
    db: Session = Depends(get_db)
):
    """Set rating for multiple images at once"""
    updated_count = 0
    failed_count = 0
    
    for image_id in request.image_ids:
        try:
            result = crud.update_image_rating(
                db=db,
                image_id=image_id,
                rating=request.rating
            )
            if result:
                updated_count += 1
            else:
                failed_count += 1
        except Exception as e:
            print(f"Error rating image {image_id}: {e}")
            failed_count += 1
    
    return schemas.BulkRatingResponse(
        updated_count=updated_count,
        failed_count=failed_count
    )