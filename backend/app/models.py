from sqlalchemy import Column, Integer, String, DateTime, func, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from .core.database import Base

class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, unique=True, index=True, nullable=False)
    original_filename = Column(String)
    capture_date = Column(DateTime, index=True)
    camera_model = Column(String, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    date_added = Column(DateTime, default=func.now())
    rating = Column(Integer, default=0, index=True, nullable=False)

    # Relationship to image_tags
    tags = relationship("ImageTag", back_populates="image")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

    # Relationship to image_tags
    images = relationship("ImageTag", back_populates="tag")


class ImageTag(Base): # Association Table
    __tablename__ = "image_tags"

    image_id = Column(Integer, ForeignKey("images.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)
    
    is_ai_generated = Column(Boolean, default=False)
    confidence = Column(Float, nullable=True) # For AI tags

    # Relationships
    image = relationship("Image", back_populates="tags")
    tag = relationship("Tag", back_populates="images")
