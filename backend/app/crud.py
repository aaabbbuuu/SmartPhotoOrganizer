from sqlalchemy.orm import Session, selectinload
from sqlalchemy import and_, or_, func
from . import models, schemas 
from typing import List, Optional
from datetime import datetime

# ============================================================================
# IMAGE CRUD FUNCTIONS
# ============================================================================

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
    """Get total count of images matching the filters"""
    query = db.query(func.count(models.Image.id))
    
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
    """Get paginated list of images with optional filters and sorting"""
    query = db.query(models.Image)\
        .options(selectinload(models.Image.tags).selectinload(models.ImageTag.tag))

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

    sort_column = getattr(models.Image, sort_by, models.Image.capture_date)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc().nullslast())
    else:
        query = query.order_by(sort_column.asc().nullslast())
    
    return query.offset(skip).limit(limit).all()

# ============================================================================
# TAG CRUD FUNCTIONS
# ============================================================================

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
    """Add a tag to an image"""
    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if not db_image:
        print(f"CRUD: Image with id {image_id} not found for adding tag.")
        return None
    
    normalized_tag_name = tag_name.strip().lower()
    if not normalized_tag_name:
        raise ValueError("Tag name cannot be empty")
    
    db_tag = get_or_create_tag(db, tag_name=normalized_tag_name) 
    
    existing_image_tag = db.query(models.ImageTag).filter_by(
        image_id=image_id, 
        tag_id=db_tag.id
    ).first()
    
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
    """Remove a tag from an image"""
    db_image_tag = db.query(models.ImageTag).filter_by(
        image_id=image_id, 
        tag_id=tag_id
    ).first()
    
    if db_image_tag:
        db.delete(db_image_tag)
        db.commit()
        return True
    return False

def get_all_tags(db: Session) -> List[models.Tag]:
    """Get all tags ordered by name"""
    return db.query(models.Tag).order_by(models.Tag.name).all()

def update_image_rating(db: Session, image_id: int, rating: int) -> Optional[models.Image]:
    """Update the rating of an image"""
    if not (0 <= rating <= 5):
        return None
        
    db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
    if db_image:
        db_image.rating = rating
        db.commit()
        db.refresh(db_image)
        return db_image
    return None

# ============================================================================
# ALBUM CRUD FUNCTIONS
# ============================================================================

def create_album(db: Session, album: schemas.AlbumCreate) -> models.Album:
    """Create a new album"""
    db_album = models.Album(
        name=album.name,
        description=album.description,
        cover_image_id=album.cover_image_id
    )
    db.add(db_album)
    db.commit()
    db.refresh(db_album)
    return db_album

def get_album_by_id(db: Session, album_id: int) -> Optional[models.Album]:
    """Get an album by ID with eager loading of relationships"""
    return db.query(models.Album)\
        .options(
            selectinload(models.Album.photos).selectinload(models.AlbumPhoto.image),
            selectinload(models.Album.cover_image)
        )\
        .filter(models.Album.id == album_id)\
        .first()

def get_albums(
    db: Session,
    skip: int = 0,
    limit: int = 50
) -> List[models.Album]:
    """Get paginated list of albums"""
    return db.query(models.Album)\
        .options(selectinload(models.Album.cover_image))\
        .order_by(models.Album.date_modified.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()

def get_albums_count(db: Session) -> int:
    """Get total count of albums"""
    return db.query(func.count(models.Album.id)).scalar()

def update_album(
    db: Session, 
    album_id: int, 
    album_update: schemas.AlbumUpdate
) -> Optional[models.Album]:
    """Update an album"""
    db_album = db.query(models.Album).filter(models.Album.id == album_id).first()
    if not db_album:
        return None
    
    update_data = album_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_album, field, value)
    
    db_album.date_modified = datetime.utcnow()
    db.commit()
    db.refresh(db_album)
    return db_album

def delete_album(db: Session, album_id: int) -> bool:
    """Delete an album"""
    db_album = db.query(models.Album).filter(models.Album.id == album_id).first()
    if not db_album:
        return False
    
    db.delete(db_album)
    db.commit()
    return True

def add_photos_to_album(
    db: Session, 
    album_id: int, 
    image_ids: List[int]
) -> int:
    """Add multiple photos to an album. Returns count of photos added."""
    db_album = db.query(models.Album).filter(models.Album.id == album_id).first()
    if not db_album:
        return 0
    
    added_count = 0
    for image_id in image_ids:
        # Check if image exists
        db_image = db.query(models.Image).filter(models.Image.id == image_id).first()
        if not db_image:
            continue
        
        # Check if already in album
        existing = db.query(models.AlbumPhoto).filter_by(
            album_id=album_id,
            image_id=image_id
        ).first()
        
        if existing:
            continue
        
        # Add to album
        album_photo = models.AlbumPhoto(
            album_id=album_id,
            image_id=image_id,
            display_order=added_count
        )
        db.add(album_photo)
        added_count += 1
    
    if added_count > 0:
        db_album.date_modified = datetime.utcnow()
        db.commit()
    
    return added_count

def remove_photos_from_album(
    db: Session,
    album_id: int,
    image_ids: List[int]
) -> int:
    """Remove multiple photos from an album. Returns count of photos removed."""
    removed_count = 0
    
    for image_id in image_ids:
        album_photo = db.query(models.AlbumPhoto).filter_by(
            album_id=album_id,
            image_id=image_id
        ).first()
        
        if album_photo:
            db.delete(album_photo)
            removed_count += 1
    
    if removed_count > 0:
        db_album = db.query(models.Album).filter(models.Album.id == album_id).first()
        if db_album:
            db_album.date_modified = datetime.utcnow()
        db.commit()
    
    return removed_count

def get_album_photo_count(db: Session, album_id: int) -> int:
    """Get count of photos in an album"""
    return db.query(func.count(models.AlbumPhoto.image_id))\
        .filter(models.AlbumPhoto.album_id == album_id)\
        .scalar()