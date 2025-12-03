from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

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

# --- Export Schemas (Phase 5) ---
class ExportFormat(str, Enum):
    ZIP = "zip"
    FOLDER = "folder"

class ImageQuality(str, Enum):
    ORIGINAL = "original"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class ExportRequest(BaseModel):
    album_id: Optional[int] = None
    image_ids: Optional[List[int]] = Field(None, min_items=1)
    export_format: ExportFormat = ExportFormat.ZIP
    quality: ImageQuality = ImageQuality.HIGH
    include_metadata: bool = True
    destination_path: Optional[str] = None
    
    @validator('image_ids', 'album_id')
    def validate_export_source(cls, v, values):
        # At least one of album_id or image_ids must be provided
        if 'album_id' in values and not values.get('album_id') and not v:
            raise ValueError('Either album_id or image_ids must be provided')
        return v

class ExportStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ExportJob(BaseModel):
    job_id: str
    status: ExportStatus
    progress: int = 0  # 0-100
    total_images: int
    processed_images: int = 0
    export_path: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

class ExportJobResponse(BaseModel):
    job_id: str
    status: ExportStatus
    message: str

class BulkDeleteRequest(BaseModel):
    image_ids: List[int] = Field(..., min_items=1, max_items=100)
    
class BulkDeleteResponse(BaseModel):
    deleted_count: int
    failed_count: int
    failed_ids: List[int] = []
    errors: List[str] = []

class BulkTagRequest(BaseModel):
    image_ids: List[int] = Field(..., min_items=1, max_items=100)
    tag_names: List[str] = Field(..., min_items=1, max_items=10)

class BulkTagResponse(BaseModel):
    success_count: int
    failed_count: int
    tags_added: int

class BulkRatingRequest(BaseModel):
    image_ids: List[int] = Field(..., min_items=1, max_items=100)
    rating: int = Field(..., ge=0, le=5)

class BulkRatingResponse(BaseModel):
    updated_count: int
    failed_count: int