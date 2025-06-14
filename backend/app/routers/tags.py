from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, schemas
from ..core.database import get_db

router = APIRouter(
    prefix="/api/tags",
    tags=["tags"],
)

@router.get("/", response_model=List[schemas.Tag])
async def read_all_tags(db: Session = Depends(get_db)):
    tags = crud.get_all_tags(db=db)
    return tags