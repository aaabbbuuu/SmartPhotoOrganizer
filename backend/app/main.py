import sys
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .core.database import engine, Base
from .routers import photos, tags, albums
from .core.config import THUMBNAILS_DIR, FRONTEND_ORIGIN

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Photo Organizer API")

# CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(photos.router)
app.include_router(tags.router)
app.include_router(albums.router)

# Mount the thumbnails directory
app.mount("/thumbnails", StaticFiles(directory=str(THUMBNAILS_DIR)), name="thumbnails")


@app.get("/")
async def root():
    return {"message": "Welcome to Smart Photo Organizer API"}

# To run the backend:
# cd SMARTPHOTOORGANIZER/backend
# source venv/bin/activate
# uvicorn app.main:app --reload --host 0.0.0.0 --port 8000