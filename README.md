# 📸 Smart Photo Organizer

A desktop application for photographers and creatives to organize, tag, rate, and explore their local photo libraries with the help of AI.

## ⚙️ Tech Stack

- **Frontend**: Electron + React
- **Backend**: FastAPI (Python)
- **AI Module**: TensorFlow (image classification)
- **Database**: SQLite
- **Architecture**: Modular desktop app (Electron shell, React UI, FastAPI backend)

---

## ✅ Phase 1: Core Features - Completed

- Initialized Electron + React frontend
- Set up FastAPI backend with SQLite
- Implemented image folder selection and scanning
- Extracted metadata (EXIF) and stored in database
- Generated image thumbnails
- Displayed grid view of photos with sorting by date

## ✅ Phase 2: AI Tagging - Completed
- Integrated TensorFlow with MobileNetV2 model
- Background image classification with confidence scores
- Store and display AI-generated tags
- Distinguish between AI and manual tags

## ✅ Phase 3: Advanced Organization - Completed
- Manual tag management (add/remove tags)
- 5-star rating system with click-to-rate
- Advanced filtering UI (date range, camera model, tags, rating)
- Tag autocomplete and suggestions
- Multi-filter support with real-time updates

## ✅ Phase 4: Album Management - Completed
- Create, edit, and delete photo albums
- Album grid view with cover photos
- Album detail view with all photos
- Multi-select photos and add to albums
- Remove photos from albums
- View switcher between Photos and Albums
- Album metadata (name, description, photo count)

## ✅ Phase 5: Export System & Bulk Operations - Completed
- Export photos to ZIP or folder with quality presets
- Export selected photos or entire albums
- Real-time progress tracking with percentage display
- Metadata JSON included in all exports
- Bulk delete multiple photos (up to 100 at once)
- Bulk rate multiple photos with one click
- Bulk tag multiple photos simultaneously
- Select all / Deselect all functionality
- Background processing for non-blocking exports
- Automatic download on export completion
- 24-hour retention with auto-cleanup

## ✅ Performance & Quality Improvements - Completed
- Pagination for large photo libraries (50 photos per page)
- Debounced filter inputs (reduced API calls by 90%)
- Loading indicators for all async operations
- Proper error handling with user-friendly messages
- Fixed database session management for background tasks
- Input validation for all user inputs
- Memory leak prevention

---

## 🚀 Upcoming Features

### Phase 6: Final Polish & Advanced Features
- Advanced search with boolean operators and saved searches
- Keyboard shortcuts for power users
- Drag-and-drop photo organization
- Performance optimization for 10,000+ photos
- Cross-platform packaging (Windows, macOS, Linux)
- Duplicate photo detection
- Photo editing capabilities (crop, rotate, filters)
- Timeline view of photos
- Map view for geotagged photos
- Slideshow mode

---

## 🗄️ Database Schema

### Tables
- **images**: Photo metadata (file path, EXIF data, rating, thumbnails)
- **tags**: Unique tag names
- **image_tags**: Many-to-many relationship (images ↔ tags) with AI confidence
- **albums**: Album metadata (name, description, cover photo)
- **album_photos**: Many-to-many relationship (albums ↔ photos) with display order

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
cd frontend/electron-react
npm install
npm start  # Start React dev server

# In another terminal
npm run electron:dev  # Launch Electron app
```

---

## 📊 Features Overview

### Photo Management
- 📁 Folder scanning with recursive image discovery
- 🖼️ Thumbnail generation for fast grid views
- 📅 EXIF metadata extraction (date, camera model)
- ⭐ 5-star rating system
- 🏷️ Manual and AI-powered tagging
- 🔍 Advanced filtering (date, camera, tags, rating)
- 📄 Pagination for large libraries

### AI Capabilities
- 🤖 Automatic image classification using TensorFlow
- 🎯 Confidence scoring for AI-generated tags
- 🔄 Background processing (non-blocking)
- 🏷️ Smart tag mapping (ImageNet → user-friendly tags)

### Album Management
- 📚 Create unlimited albums
- ✏️ Edit album name and description
- 🖼️ Automatic cover photo selection
- ➕ Multi-select photos to add to albums
- 🗑️ Remove photos from albums
- 📊 Photo count tracking

### Export & Sharing
- 📦 Export to ZIP archive or folder structure
- 🎨 Quality presets (Original, High, Medium, Low)
- 📋 Metadata JSON included in exports
- 📊 Real-time progress tracking
- ⏬ Automatic download on completion
- 🕒 Export entire albums or selected photos

### Bulk Operations
- 🗑️ Delete multiple photos at once (up to 100)
- ⭐ Rate multiple photos simultaneously
- 🏷️ Tag multiple photos in one operation
- ☑️ Select all / Deselect all controls
- ⚡ Fast batch processing

### User Experience
- ⚡ Fast pagination (50 photos per page)
- 🔄 Debounced inputs (smooth filtering)
- ⏳ Loading indicators for all operations
- ❌ Clear error messages
- 💾 Auto-save for all changes
- 🎨 Modern, intuitive UI
- 📊 Real-time progress tracking

---

## 🎯 API Endpoints

### Photos
- `GET /api/photos/` - List photos with pagination and filters
- `POST /api/photos/scan-folder` - Scan folder for images
- `POST /api/photos/images/{id}/rate` - Rate a photo
- `POST /api/photos/images/{id}/tags` - Add tag to photo
- `DELETE /api/photos/images/{id}/tags/{tag_id}` - Remove tag

### Albums
- `GET /api/albums/` - List all albums
- `POST /api/albums/` - Create new album
- `GET /api/albums/{id}` - Get album details
- `PUT /api/albums/{id}` - Update album
- `DELETE /api/albums/{id}` - Delete album
- `POST /api/albums/{id}/photos` - Add photos to album
- `DELETE /api/albums/{id}/photos` - Remove photos from album

### Export
- `POST /api/export/` - Create export job
- `GET /api/export/jobs/{job_id}` - Check export status
- `GET /api/export/download/{job_id}` - Download export
- `DELETE /api/export/jobs/{job_id}` - Delete export

### Bulk Operations
- `POST /api/bulk/delete` - Delete multiple photos
- `POST /api/bulk/tag` - Tag multiple photos
- `POST /api/bulk/rate` - Rate multiple photos

### Tags
- `GET /api/tags/` - List all tags

---

## 🧠 Author

**GitHub**: [aaabbbuuu](https://github.com/aaabbbuuu)

---

## 📝 License

MIT License - Feel free to use this project for personal or commercial purposes.

---

## 🙏 Acknowledgments

- TensorFlow & TensorFlow Hub for AI capabilities
- FastAPI for the excellent Python web framework
- Electron for cross-platform desktop support
- React for the modern UI framework