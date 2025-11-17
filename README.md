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

### Phase 5: Social Integration & Export
- OAuth integration with Instagram/Flickr
- Export album flow
- Share albums with external services
- Batch export functionality

### Phase 6: Final Polish
- Performance optimization for 10,000+ photos
- Advanced search with boolean operators
- Keyboard shortcuts and accessibility improvements
- Cross-platform packaging (Windows, macOS, Linux)
- Drag-and-drop photo organization
- Bulk operations (delete, move, tag multiple photos)

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

### User Experience
- ⚡ Fast pagination (50 photos per page)
- 🔄 Debounced inputs (smooth filtering)
- ⏳ Loading indicators for all operations
- ❌ Clear error messages
- 💾 Auto-save for all changes
- 🎨 Modern, intuitive UI

---

## 🧠 Author

**GitHub**: [aaabbbuuu](https://github.com/aaabbbuuu)

---

## 📝 License

MIT License - Feel free to use this project for personal or commercial purposes.