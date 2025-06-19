from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- Tag Schemas ---
class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: int
    class Config:
        from_attributes = True 

class AddTagRequest(BaseModel):
    tag_name: str

# --- Image Schemas ---
class ImageBase(BaseModel):
    file_path: str
    original_filename: Optional[str] = None
    capture_date: Optional[datetime] = None
    camera_model: Optional[str] = None
    thumbnail_path: Optional[str] = None
    rating: int = 0

class ImageCreate(ImageBase):
    pass
    class Config:
        from_attributes = True

class ImageTagInfo(BaseModel):
    id: int 
    name: str 
    is_ai_generated: bool
    confidence: Optional[float] = None

    class Config:
        from_attributes = True
        
class Image(ImageBase):
    id: int
    date_added: datetime
    associated_tags: List[ImageTagInfo] = [] 

    class Config:
        from_attributes = True


class ScanFolderRequest(BaseModel):
    folder_path: str

class ScanFolderResponse(BaseModel):
    new_images_added: int
    total_images_processed: int
    ai_tags_attempted: int
    ai_tags_succeeded: int
    errors: List[str]

class UpdateRatingRequest(BaseModel):
    rating: int
