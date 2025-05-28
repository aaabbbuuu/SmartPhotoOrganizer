from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ImageBase(BaseModel):
    file_path: str
    original_filename: Optional[str] = None
    capture_date: Optional[datetime] = None
    camera_model: Optional[str] = None
    thumbnail_path: Optional[str] = None

class ImageCreate(ImageBase):
    pass

class Image(ImageBase):
    id: int
    date_added: datetime

    class Config:
        # orm_mode = True # For Pydantic V1
        from_attributes = True # For Pydantic V2

class ScanFolderRequest(BaseModel):
    folder_path: str

class ScanFolderResponse(BaseModel):
    new_images_added: int
    total_images_processed: int
    errors: List[str]