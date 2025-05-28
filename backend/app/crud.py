from sqlalchemy.orm import Session
from . import models  # This imports app.models
from . import schemas # This imports app.schemas
from typing import List, Optional


def get_image_by_path(db: Session, file_path: str) -> Optional[models.Image]:
    return db.query(models.Image).filter(models.Image.file_path == file_path).first()

def create_image(db: Session, image: schemas.ImageCreate) -> models.Image:
    db_image = models.Image(**image.dict()) # For Pydantic V1
    # db_image = models.Image(**image.model_dump()) # For Pydantic V2
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image

def get_images(db: Session, skip: int = 0, limit: int = 100, sort_by: str = "capture_date", sort_order: str = "desc") -> List[models.Image]:
    query = db.query(models.Image)
    if hasattr(models.Image, sort_by):
        column_to_sort = getattr(models.Image, sort_by)
        if sort_order == "desc":
            query = query.order_by(column_to_sort.desc().nullslast()) # Ensure None values are last
        else:
            query = query.order_by(column_to_sort.asc().nullslast())
    else: # Default sort if sort_by is invalid
         query = query.order_by(models.Image.capture_date.desc().nullslast())

    return query.offset(skip).limit(limit).all()