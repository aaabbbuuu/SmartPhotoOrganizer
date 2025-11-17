from pydantic import BaseModel, Field, validator
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
    tag_name: str = Field(..., min_length=1, max_length=50)
    
    @validator('tag_name')
    def validate_tag_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('Tag name cannot be empty or only whitespace')
        if not all(c.isalnum() or c in ' -_' for c in v):
            raise ValueError('Tag name can only contain letters, numbers, spaces, hyphens, and underscores')
        return v.lower()

# --- Image Schemas ---
class ImageBase(BaseModel):
    file_path: str
    original_filename: Optional[str] = None
    capture_date: Optional[datetime] = None
    camera_model: Optional[str] = None
    thumbnail_path: Optional[str] = None
    rating: int = Field(default=0, ge=0, le=5)

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

class ImageSimple(BaseModel):
    """Simplified image schema for album listings"""
    id: int
    file_path: str
    original_filename: Optional[str] = None
    thumbnail_path: Optional[str] = None
    rating: int = 0
    
    class Config:
        from_attributes = True
        
class Image(ImageBase):
    id: int
    date_added: datetime
    associated_tags: List[ImageTagInfo] = [] 

    class Config:
        from_attributes = True


class ScanFolderRequest(BaseModel):
    folder_path: str = Field(..., min_length=1)

class ScanFolderResponse(BaseModel):
    new_images_added: int
    total_images_processed: int
    ai_tags_attempted: int
    ai_tags_succeeded: int
    errors: List[str]

class UpdateRatingRequest(BaseModel):
    rating: int = Field(..., ge=0, le=5, description="Rating must be between 0 and 5")

# --- Pagination Schemas ---
class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_prev: bool

class PaginatedImageResponse(BaseModel):
    items: List[Image]
    meta: PaginationMeta

# --- Album Schemas ---
class AlbumBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    cover_image_id: Optional[int] = None

class AlbumCreate(AlbumBase):
    pass

class AlbumUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    cover_image_id: Optional[int] = None

class AlbumPhotoInfo(BaseModel):
    """Info about a photo in an album"""
    image_id: int
    date_added: datetime
    display_order: int
    image: ImageSimple
    
    class Config:
        from_attributes = True

class Album(AlbumBase):
    id: int
    date_created: datetime
    date_modified: datetime
    photo_count: int = 0
    cover_image: Optional[ImageSimple] = None
    
    class Config:
        from_attributes = True

class AlbumDetail(Album):
    """Detailed album with photos"""
    photos: List[AlbumPhotoInfo] = []
    
    class Config:
        from_attributes = True

class AddPhotosToAlbumRequest(BaseModel):
    image_ids: List[int] = Field(..., min_items=1)

class RemovePhotosFromAlbumRequest(BaseModel):
    image_ids: List[int] = Field(..., min_items=1)

class PaginatedAlbumResponse(BaseModel):
    items: List[Album]
    meta: PaginationMeta