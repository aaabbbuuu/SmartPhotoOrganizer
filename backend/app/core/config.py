import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file in the backend directory
# Adjust the path if your .env file is elsewhere relative to this config.py
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../database/photos.db")
# Absolute path for thumbnail storage
THUMBNAILS_DIR = Path(os.getenv("THUMBNAILS_DIR", "../assets/thumbnails")).resolve()
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

# Ensure thumbnails directory exists
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)