from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
import math

from .. import crud, models, schemas
from ..core.database import get_db

router = APIRouter(
    prefix="/api/albums",
    tags=["albums"],
)

@router.post("/", response_model=schemas.Album, status_code=201)
async def create_album(
    album: schemas.AlbumCreate,
    db: Session = Depends(get_db)
):
    """Create a new album"""
    try:
        # Verify cover image exists if provided
        if album.cover_image_id:
            cover_image = db.query(models.Image).filter(
                models.Image.id == album.cover_image_id
            ).first()
            if not cover_image:
                raise HTTPException(
                    status_code=404,
                    detail=f"Cover image with id {album.cover_image_id} not found"
                )
        
        db_album = crud.create_album(db=db, album=album)
        
        # Get photo count for response
        photo_count = crud.get_album_photo_count(db, db_album.id)
        
        # Build response
        response_data = {
            "id": db_album.id,
            "name": db_album.name,
            "description": db_album.description,
            "cover_image_id": db_album.cover_image_id,
            "date_created": db_album.date_created,
            "date_modified": db_album.date_modified,
            "photo_count": photo_count,
            "cover_image": None
        }
        
        if db_album.cover_image:
            response_data["cover_image"] = schemas.ImageSimple(
                id=db_album.cover_image.id,
                file_path=db_album.cover_image.file_path,
                original_filename=db_album.cover_image.original_filename,
                thumbnail_path=db_album.cover_image.thumbnail_path,
                rating=db_album.cover_image.rating
            )
        
        return schemas.Album(**response_data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating album: {e}")
        raise HTTPException(status_code=500, detail="Failed to create album")

@router.get("/", response_model=schemas.PaginatedAlbumResponse)
async def get_albums(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """Get paginated list of albums"""
    try:
        skip = (page - 1) * page_size
        total_count = crud.get_albums_count(db)
        db_albums = crud.get_albums(db, skip=skip, limit=page_size)
        
        # Build response albums with photo counts
        albums = []
        for db_album in db_albums:
            photo_count = crud.get_album_photo_count(db, db_album.id)
            
            album_data = {
                "id": db_album.id,
                "name": db_album.name,
                "description": db_album.description,
                "cover_image_id": db_album.cover_image_id,
                "date_created": db_album.date_created,
                "date_modified": db_album.date_modified,
                "photo_count": photo_count,
                "cover_image": None
            }
            
            if db_album.cover_image:
                album_data["cover_image"] = schemas.ImageSimple(
                    id=db_album.cover_image.id,
                    file_path=db_album.cover_image.file_path,
                    original_filename=db_album.cover_image.original_filename,
                    thumbnail_path=db_album.cover_image.thumbnail_path,
                    rating=db_album.cover_image.rating
                )
            
            albums.append(schemas.Album(**album_data))
        
        # Pagination metadata
        total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1
        pagination_meta = schemas.PaginationMeta(
            page=page,
            page_size=page_size,
            total_items=total_count,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
        
        return schemas.PaginatedAlbumResponse(
            items=albums,
            meta=pagination_meta
        )
    except Exception as e:
        print(f"Error fetching albums: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch albums")

@router.get("/{album_id}", response_model=schemas.AlbumDetail)
async def get_album(
    album_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed album with all photos"""
    try:
        db_album = crud.get_album_by_id(db, album_id)
        if not db_album:
            raise HTTPException(status_code=404, detail="Album not found")
        
        # Build photos list
        photos = []
        for album_photo in db_album.photos:
            photo_info = schemas.AlbumPhotoInfo(
                image_id=album_photo.image_id,
                date_added=album_photo.date_added,
                display_order=album_photo.display_order,
                image=schemas.ImageSimple(
                    id=album_photo.image.id,
                    file_path=album_photo.image.file_path,
                    original_filename=album_photo.image.original_filename,
                    thumbnail_path=album_photo.image.thumbnail_path,
                    rating=album_photo.image.rating
                )
            )
            photos.append(photo_info)
        
        # Build album response
        album_data = {
            "id": db_album.id,
            "name": db_album.name,
            "description": db_album.description,
            "cover_image_id": db_album.cover_image_id,
            "date_created": db_album.date_created,
            "date_modified": db_album.date_modified,
            "photo_count": len(photos),
            "cover_image": None,
            "photos": photos
        }
        
        if db_album.cover_image:
            album_data["cover_image"] = schemas.ImageSimple(
                id=db_album.cover_image.id,
                file_path=db_album.cover_image.file_path,
                original_filename=db_album.cover_image.original_filename,
                thumbnail_path=db_album.cover_image.thumbnail_path,
                rating=db_album.cover_image.rating
            )
        
        return schemas.AlbumDetail(**album_data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching album {album_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch album")

@router.put("/{album_id}", response_model=schemas.Album)
async def update_album(
    album_id: int,
    album_update: schemas.AlbumUpdate,
    db: Session = Depends(get_db)
):
    """Update an album"""
    try:
        # Verify cover image exists if being updated
        if album_update.cover_image_id is not None:
            cover_image = db.query(models.Image).filter(
                models.Image.id == album_update.cover_image_id
            ).first()
            if not cover_image:
                raise HTTPException(
                    status_code=404,
                    detail=f"Cover image with id {album_update.cover_image_id} not found"
                )
        
        db_album = crud.update_album(db, album_id, album_update)
        if not db_album:
            raise HTTPException(status_code=404, detail="Album not found")
        
        photo_count = crud.get_album_photo_count(db, db_album.id)
        
        album_data = {
            "id": db_album.id,
            "name": db_album.name,
            "description": db_album.description,
            "cover_image_id": db_album.cover_image_id,
            "date_created": db_album.date_created,
            "date_modified": db_album.date_modified,
            "photo_count": photo_count,
            "cover_image": None
        }
        
        if db_album.cover_image:
            album_data["cover_image"] = schemas.ImageSimple(
                id=db_album.cover_image.id,
                file_path=db_album.cover_image.file_path,
                original_filename=db_album.cover_image.original_filename,
                thumbnail_path=db_album.cover_image.thumbnail_path,
                rating=db_album.cover_image.rating
            )
        
        return schemas.Album(**album_data)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating album {album_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update album")

@router.delete("/{album_id}", status_code=204)
async def delete_album(
    album_id: int,
    db: Session = Depends(get_db)
):
    """Delete an album"""
    try:
        success = crud.delete_album(db, album_id)
        if not success:
            raise HTTPException(status_code=404, detail="Album not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting album {album_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete album")

@router.post("/{album_id}/photos", status_code=200)
async def add_photos_to_album(
    album_id: int,
    request: schemas.AddPhotosToAlbumRequest,
    db: Session = Depends(get_db)
):
    """Add photos to an album"""
    try:
        # Verify album exists
        db_album = db.query(models.Album).filter(models.Album.id == album_id).first()
        if not db_album:
            raise HTTPException(status_code=404, detail="Album not found")
        
        added_count = crud.add_photos_to_album(db, album_id, request.image_ids)
        
        return {
            "album_id": album_id,
            "photos_added": added_count,
            "total_requested": len(request.image_ids)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding photos to album {album_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add photos to album")

@router.delete("/{album_id}/photos", status_code=200)
async def remove_photos_from_album(
    album_id: int,
    request: schemas.RemovePhotosFromAlbumRequest,
    db: Session = Depends(get_db)
):
    """Remove photos from an album"""
    try:
        # Verify album exists
        db_album = db.query(models.Album).filter(models.Album.id == album_id).first()
        if not db_album:
            raise HTTPException(status_code=404, detail="Album not found")
        
        removed_count = crud.remove_photos_from_album(db, album_id, request.image_ids)
        
        return {
            "album_id": album_id,
            "photos_removed": removed_count,
            "total_requested": len(request.image_ids)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error removing photos from album {album_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove photos from album")