import sys
import os
# print("Current Working Directory:", os.getcwd())
# print("Sys.path:", sys.path)

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .core.database import engine, Base
from .routers import photos, tags
from .core.config import THUMBNAILS_DIR, FRONTEND_ORIGIN

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Photo Organizer API")

# CORS (Cross-Origin Resource Sharing)
# Allows the React frontend (running on a different port) to talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:3000"], # Add other origins if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(photos.router)
app.include_router(tags.router)

# Mount the thumbnails directory to be servable
# The path "/thumbnails" will serve files from THUMBNAILS_DIR
# THUMBNAILS_DIR is an absolute path from config.py
app.mount("/thumbnails", StaticFiles(directory=str(THUMBNAILS_DIR)), name="thumbnails")


@app.get("/")
async def root():
    return {"message": "Welcome to Smart Photo Organizer API"}

# To run the backend:
# cd SMARTPHOTOORGANIZER/backend
# source venv/bin/activate
# uvicorn app.main:app --reload --host 0.0.0.0 --port 8000