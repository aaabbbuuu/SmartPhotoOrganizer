from sqlalchemy.orm import Session, selectinload
from sqlalchemy import and_, or_, func
from . import models, schemas 
from typing import List, Optional, Union
from datetime import datetime

def get_image_by_path(db: Session, file_path: str) -> Optional[models.Image]:
    return db.query(models.Image).filter(models.Image.file_path == file_path).first()

def create_image(db: Session, image: schemas.ImageCreate) -> models.Image:
    db_image_data = image.model_dump()
    # db_image_data = image.model_dump()
    db_image = models.Image(**db_image_data)
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image

def get_images(
    db: Session, 
    skip: int = 0, 
    limit: int = 100, 
    sort_by: str = "capture_date", 
    sort_order: str = "desc",
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    camera_models: Optional[List[str]] = None,
    tag_names: Optional[List[str]] = None, 
    rating_min: Optional[int] = None
) -> List[models.Image]:
    
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
    sort_column = getattr(models.Image, sort_by, models.Image.capture_date) # Default to capture_date if invalid sort_by
    if sort_order == "desc":
        query = query.order_by(sort_column.desc().nullslast())
    else:
        query = query.order_by(sort_column.asc().nullslast())
    
    return query.offset(skip).limit(limit).all()

# --- Tag CRUD Functions ---
def get_tag_by_name(db: Session, name: str) -> Optional[models.Tag]:
    return db.query(models.Tag).filter(models.Tag.name == name).first()

def create_tag(db: Session, tag: schemas.TagCreate) -> models.Tag:
    db_tag = models.Tag(name=tag.name)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def get_or_create_tag(db: Session, tag_name: str) -> models.Tag:
    db_tag = get_tag_by_name(db, name=tag_name)
    if not db_tag:
        db_tag = create_tag(db, tag=schemas.TagCreate(name=tag_name))
    return db_tag

def add_tag_to_image(db: Session, image_id: int, tag_name: str, is_ai_generated: bool = False, confidence: Optional[float] = None) -> Optional[models.ImageTag]:
    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not db_image:
        print(f"CRUD: Image with id {image_id} not found for adding tag.")
        return None
    
    db_tag = get_or_create_tag(db, tag_name=tag_name.strip().lower()) 
    
    existing_image_tag = db.query(models.ImageTag).filter_by(image_id=image_id, tag_id=db_tag.id).first()
    
    if existing_image_tag:
        if is_ai_generated and confidence is not None:
            if existing_image_tag.confidence is None or confidence > existing_image_tag.confidence:
                existing_image_tag.confidence = confidence
                existing_image_tag.is_ai_generated = True
                db.commit()
                db.refresh(existing_image_tag)
        elif not is_ai_generated and existing_image_tag.is_ai_generated:
            existing_image_tag.is_ai_generated = False
            existing_image_tag.confidence = None 
            db.commit()
            db.refresh(existing_image_tag)
        return existing_image_tag

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
    db_image_tag = db.query(models.ImageTag).filter_by(image_id=image_id, tag_id=tag_id).first()
    if db_image_tag:
        db.delete(db_image_tag)
        db.commit()
        # tag_associations_count = db.query(models.ImageTag).filter_by(tag_id=tag_id).count()
        # if tag_associations_count == 0:
        #     db_tag = db.query(models.Tag).filter_by(id=tag_id).first()
        #     if db_tag:
        #         db.delete(db_tag)
        #         db.commit()
        return True
    return False

def get_all_tags(db: Session) -> List[models.Tag]:
    return db.query(models.Tag).order_by(models.Tag.name).all()

def update_image_rating(db: Session, image_id: int, rating: int) -> Optional[models.Image]:
    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if db_image:
        if 0 <= rating <= 5:
            db_image.rating = rating
            db.commit()
            db.refresh(db_image)
            return db_image
        else:
            print(f"CRUD: Invalid rating value {rating} for image {image_id}.")
            return None 
    return None