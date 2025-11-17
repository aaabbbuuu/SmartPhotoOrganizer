from sqlalchemy.orm import Session, selectinload
from sqlalchemy import and_, or_, func
from . import models, schemas 
from typing import List, Optional
from datetime import datetime

def get_image_by_path(db: Session, file_path: str) -> Optional[models.Image]:
    """Get an image by its file path"""
    return db.query(models.Image).filter(models.Image.file_path == file_path).first()

def create_image(db: Session, image: schemas.ImageCreate) -> models.Image:
    """Create a new image record"""
    db_image_data = image.model_dump()
    db_image = models.Image(**db_image_data)
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image

def get_images_count(
    db: Session,
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    camera_models: Optional[List[str]] = None,
    tag_names: Optional[List[str]] = None, 
    rating_min: Optional[int] = None
) -> int:
    """
    Get total count of images matching the filters.
    Used for pagination metadata.
    """
    query = db.query(func.count(models.Image.id))
    
    # --- Apply Filters ---
    filters = []
    if date_start:
        filters.append(models.Image.capture_date >= date_start)
    if date_end:
        filters.append(models.Image.capture_date <= date_end)
    
    if camera_models:
        if isinstance(camera_models, list) and len(camera_models) > 0:
            filters.append(models.Image.camera_model.in_(camera_models))
    
    if rating_min is not None: 
        if 0 <= rating_min <= 5: 
            filters.append(models.Image.rating >= rating_min)

    if tag_names:
        if isinstance(tag_names, list) and len(tag_names) > 0:
            normalized_tag_names = [name.strip().lower() for name in tag_names]
            query = query.join(models.Image.tags).join(models.ImageTag.tag)\
                         .filter(models.Tag.name.in_(normalized_tag_names))\
                         .group_by(models.Image.id)

    if filters: 
        query = query.filter(and_(*filters))
    
    return query.scalar()

def get_images(
    db: Session, 
    skip: int = 0, 
    limit: int = 50, 
    sort_by: str = "capture_date", 
    sort_order: str = "desc",
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    camera_models: Optional[List[str]] = None,
    tag_names: Optional[List[str]] = None, 
    rating_min: Optional[int] = None
) -> List[models.Image]:
    """
    Get paginated list of images with optional filters and sorting
    """
    query = db.query(models.Image)\
        .options(selectinload(models.Image.tags).selectinload(models.ImageTag.tag))

    # --- Apply Filters ---
    filters = []
    if date_start:
        filters.append(models.Image.capture_date >= date_start)
    if date_end:
        filters.append(models.Image.capture_date <= date_end)
    
    if camera_models:
        if isinstance(camera_models, list) and len(camera_models) > 0:
            filters.append(models.Image.camera_model.in_(camera_models))
    
    if rating_min is not None: 
        if 0 <= rating_min <= 5: 
            filters.append(models.Image.rating >= rating_min)

    if tag_names:
        if isinstance(tag_names, list) and len(tag_names) > 0:
            normalized_tag_names = [name.strip().lower() for name in tag_names]
            query = query.join(models.Image.tags).join(models.ImageTag.tag)\
                         .filter(models.Tag.name.in_(normalized_tag_names))\
                         .group_by(models.Image.id) 

    if filters: 
        query = query.filter(and_(*filters))

    # --- Apply Sorting ---
    sort_column = getattr(models.Image, sort_by, models.Image.capture_date)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc().nullslast())
    else:
        query = query.order_by(sort_column.asc().nullslast())
    
    return query.offset(skip).limit(limit).all()

# --- Tag CRUD Functions ---
def get_tag_by_name(db: Session, name: str) -> Optional[models.Tag]:
    """Get a tag by its name"""
    return db.query(models.Tag).filter(models.Tag.name == name).first()

def create_tag(db: Session, tag: schemas.TagCreate) -> models.Tag:
    """Create a new tag"""
    db_tag = models.Tag(name=tag.name)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def get_or_create_tag(db: Session, tag_name: str) -> models.Tag:
    """Get existing tag or create if it doesn't exist"""
    db_tag = get_tag_by_name(db, name=tag_name)
    if not db_tag:
        db_tag = create_tag(db, tag=schemas.TagCreate(name=tag_name))
    return db_tag

def add_tag_to_image(
    db: Session, 
    image_id: int, 
    tag_name: str, 
    is_ai_generated: bool = False, 
    confidence: Optional[float] = None
) -> Optional[models.ImageTag]:
    """
    Add a tag to an image. 
    If tag already exists on image, update it based on confidence or manual override.
    """
    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not db_image:
        print(f"CRUD: Image with id {image_id} not found for adding tag.")
        return None
    
    # Normalize tag name
    normalized_tag_name = tag_name.strip().lower()
    if not normalized_tag_name:
        raise ValueError("Tag name cannot be empty")
    
    db_tag = get_or_create_tag(db, tag_name=normalized_tag_name) 
    
    # Check if this tag is already on this image
    existing_image_tag = db.query(models.ImageTag).filter_by(
        image_id=image_id, 
        tag_id=db_tag.id
    ).first()
    
    if existing_image_tag:
        # Update logic: 
        # - If new tag is AI with higher confidence, update
        # - If new tag is manual, override AI tag
        if is_ai_generated and confidence is not None:
            if existing_image_tag.confidence is None or confidence > existing_image_tag.confidence:
                existing_image_tag.confidence = confidence
                existing_image_tag.is_ai_generated = True
                db.commit()
                db.refresh(existing_image_tag)
                print(f"CRUD: Updated AI tag '{tag_name}' confidence on image {image_id}")
        elif not is_ai_generated and existing_image_tag.is_ai_generated:
            # Manual tag overrides AI tag
            existing_image_tag.is_ai_generated = False
            existing_image_tag.confidence = None 
            db.commit()
            db.refresh(existing_image_tag)
            print(f"CRUD: Converted AI tag to manual tag '{tag_name}' on image {image_id}")
        return existing_image_tag

    # Create new image-tag association
    db_image_tag = models.ImageTag(
        image_id=image_id, 
        tag_id=db_tag.id, 
        is_ai_generated=is_ai_generated, 
        confidence=confidence if is_ai_generated else None 
    )
    db.add(db_image_tag)
    db.commit()
    db.refresh(db_image_tag)
    print(f"CRUD: Added tag '{tag_name}' to image {image_id}, AI: {is_ai_generated}")
    return db_image_tag

def remove_tag_from_image(db: Session, image_id: int, tag_id: int) -> bool:
    """
    Remove a tag from an image.
    Returns True if successful, False if tag was not found on image.
    """
    db_image_tag = db.query(models.ImageTag).filter_by(
        image_id=image_id, 
        tag_id=tag_id
    ).first()
    
    if db_image_tag:
        db.delete(db_image_tag)
        db.commit()
        print(f"CRUD: Removed tag {tag_id} from image {image_id}")
        
        # Optional: Clean up orphaned tags (tags not used by any image)
        # Uncomment if you want automatic cleanup
        # tag_associations_count = db.query(models.ImageTag).filter_by(tag_id=tag_id).count()
        # if tag_associations_count == 0:
        #     db_tag = db.query(models.Tag).filter_by(id=tag_id).first()
        #     if db_tag:
        #         db.delete(db_tag)
        #         db.commit()
        #         print(f"CRUD: Deleted orphaned tag {tag_id}")
        
        return True
    return False

def get_all_tags(db: Session) -> List[models.Tag]:
    """Get all tags ordered by name"""
    return db.query(models.Tag).order_by(models.Tag.name).all()

def update_image_rating(db: Session, image_id: int, rating: int) -> Optional[models.Image]:
    """
    Update the rating of an image.
    Returns the updated image or None if invalid.
    """
    if not (0 <= rating <= 5):
        print(f"CRUD: Invalid rating value {rating} for image {image_id}.")
        return None
        
    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if db_image:
        db_image.rating = rating
        db.commit()
        db.refresh(db_image)
        print(f"CRUD: Updated rating to {rating} for image {image_id}")
        return db_image
    return None