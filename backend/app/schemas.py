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
        from_attributes = True # CHANGED

class AddTagRequest(BaseModel):
    tag_name: str

# --- Image Schemas (Updated) ---
class ImageBase(BaseModel):
    file_path: str
    original_filename: Optional[str] = None
    capture_date: Optional[datetime] = None
    camera_model: Optional[str] = None
    thumbnail_path: Optional[str] = None

class ImageCreate(ImageBase): # This schema is used with from_orm
    pass
    class Config: # Add Config here too if ImageCreate is used with from_orm
        from_attributes = True # CHANGED

class ImageTagInfo(BaseModel): # This will represent a tag associated with an image
    id: int # Tag ID
    name: str # Tag name
    is_ai_generated: bool
    confidence: Optional[float] = None

    class Config:
        from_attributes = True # For Pydantic V2
        
class Image(ImageBase):
    id: int
    date_added: datetime
    associated_tags: List[ImageTagInfo] = [] 

    class Config:
        from_attributes = True # CHANGED


class ScanFolderRequest(BaseModel):
    folder_path: str

class ScanFolderResponse(BaseModel):
    new_images_added: int
    total_images_processed: int
    ai_tags_attempted: int
    ai_tags_succeeded: int
    errors: List[str]