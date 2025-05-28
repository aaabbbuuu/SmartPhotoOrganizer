from PIL import Image as PILImage
import os
from pathlib import Path
from typing import Optional
from ..core.config import THUMBNAILS_DIR # Use absolute path from config

THUMBNAIL_SIZE = (200, 200)

def generate_thumbnail(image_path: str) -> Optional[str]:
    """
    Generates a thumbnail for the given image and saves it to the THUMBNAILS_DIR.
    Returns the relative path of the thumbnail within THUMBNAILS_DIR, or None on failure.
    """
    try:
        img = PILImage.open(image_path)
        img.thumbnail(THUMBNAIL_SIZE)

        # Create a unique filename for the thumbnail to avoid collisions
        base, ext = os.path.splitext(os.path.basename(image_path))
        # Using a simple hash of the full path for more uniqueness
        path_hash = hex(hash(image_path) & 0xffffffff)[2:] # simple short hash
        thumb_filename = f"{base}_{path_hash}_thumb.jpg" # Save as JPG for consistency
        
        # THUMBNAILS_DIR is an absolute Path object
        thumb_save_path = THUMBNAILS_DIR / thumb_filename

        # Ensure the directory exists (though config should do this)
        THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

        if img.mode == 'RGBA' or (img.mode == 'P' and 'transparency' in img.info):
             # If image has alpha, create a white background before saving as JPG
            background = PILImage.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else img.convert('RGBA').split()[3]) # 3 is the alpha channel
            background.save(thumb_save_path, "JPEG", quality=85)
        else:
            img.convert('RGB').save(thumb_save_path, "JPEG", quality=85)

        return thumb_filename # Return only the filename, relative to THUMBNAILS_DIR
    except Exception as e:
        print(f"Error generating thumbnail for {image_path}: {e}")
        return None