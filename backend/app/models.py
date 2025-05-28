from sqlalchemy import Column, Integer, String, DateTime, func
from .core.database import Base

class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, unique=True, index=True, nullable=False)
    original_filename = Column(String)
    capture_date = Column(DateTime, index=True)
    camera_model = Column(String, nullable=True)
    # lens_model = Column(String, nullable=True) # For later phase
    # width = Column(Integer, nullable=True)
    # height = Column(Integer, nullable=True)
    # filesize = Column(Integer, nullable=True)
    # rating = Column(Integer, default=0, index=True) # For later phase
    thumbnail_path = Column(String, nullable=True) # Relative to THUMBNAILS_DIR
    date_added = Column(DateTime, default=func.now())