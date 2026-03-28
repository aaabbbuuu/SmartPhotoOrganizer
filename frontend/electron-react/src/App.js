import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ============================================
// HOOKS
// ============================================
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'info') => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}

// ============================================
// MAIN APP
// ============================================
function App() {
  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('spo-theme') || 'light');

  // Navigation
  const [currentView, setCurrentView] = useState('photos');

  // Photos state
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState('capture_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterCameraModels, setFilterCameraModels] = useState([]);
  const [availableCameraModels, setAvailableCameraModels] = useState([]);
  const [filterTagNames, setFilterTagNames] = useState('');
  const [filterRatingMin, setFilterRatingMin] = useState(0);
  const debouncedTagNames = useDebounce(filterTagNames, 500);

  // Tags
  const [allTags, setAllTags] = useState([]);
  const [tagInputs, setTagInputs] = useState({});
  const [ratingLoading, setRatingLoading] = useState({});
  const [tagLoading, setTagLoading] = useState({});

  // Albums
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumPhotos, setAlbumPhotos] = useState([]);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showEditAlbum, setShowEditAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const [editAlbumData, setEditAlbumData] = useState(null);

  // Selection
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);

  // Export
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('zip');
  const [exportQuality, setExportQuality] = useState('high');
  const [exportJobId, setExportJobId] = useState(null);
  const [exportProgress, setExportProgress] = useState(null);

  // Stats
  const [stats, setStats] = useState(null);

  // Lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  // Toast
  const { toasts, addToast, dismissToast } = useToast();

  // ============================================
  // THEME
  // ============================================
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spo-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // ============================================
  // DATA FETCHING
  // ============================================
  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    const params = {
      page: currentPage, page_size: pageSize,
      sort_by: sortBy, sort_order: sortOrder,
    };
    if (filterDateStart) {
      try { params.date_start = new Date(filterDateStart).toISOString(); } catch {}
    }
    if (filterDateEnd) {
      try {
        const d = new Date(filterDateEnd);
        d.setHours(23, 59, 59, 999);
        params.date_end = d.toISOString();
      } catch {}
    }
    if (filterCameraModels.length > 0) params.camera_models = filterCameraModels;
    const trimmed = debouncedTagNames.trim();
    if (trimmed) params.tag_names = trimmed.split(',').map(t => t.trim()).filter(Boolean);
    if (filterRatingMin > 0 && filterRatingMin <= 5) params.rating_min = filterRatingMin;

    try {
      const res = await axios.get(`${API_BASE_URL}/api/photos/`, { params });
      if (res.data.items) {
        setPhotos(res.data.items);
        setTotalPages(res.data.meta.total_pages);
        setTotalItems(res.data.meta.total_items);
        const cams = [...new Set(res.data.items.map(p => p.camera_model).filter(Boolean))];
        setAvailableCameraModels(cams.sort());
      } else {
        setPhotos(res.data);
      }
    } catch (err) {
      addToast(`Failed to load photos: ${err.response?.data?.detail || err.message}`, 'error');
      setPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, sortBy, sortOrder, filterDateStart, filterDateEnd,
      filterCameraModels, debouncedTagNames, filterRatingMin, addToast]);

  const fetchAlbums = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/albums/`);
      setAlbums(res.data.items || res.data);
    } catch (err) {
      console.error("Failed to fetch albums:", err);
    }
  }, []);

  const fetchAlbumDetails = useCallback(async (albumId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/albums/${albumId}`);
      setSelectedAlbum(res.data);
      setAlbumPhotos(res.data.photos || []);
    } catch (err) {
      addToast("Failed to load album details", 'error');
    }
  }, [addToast]);

  const fetchAllTags = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tags/`);
      setAllTags(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    if (currentView === 'photos') fetchPhotos();
    else if (currentView === 'albums') fetchAlbums();
    else if (currentView === 'stats') {
      // Fetch stats
      axios.get(`${API_BASE_URL}/api/stats`).then(res => setStats(res.data)).catch(() => {});
      fetchAlbums(); // for album count
    }
  }, [currentView, fetchPhotos, fetchAlbums]);

  useEffect(() => { fetchAllTags(); }, [fetchAllTags]);

  // Clean up tag inputs when photos change
  useEffect(() => {
    const ids = new Set(photos.map(p => p.id));
    setTagInputs(prev => {
      const cleaned = {};
      Object.keys(prev).forEach(id => { if (ids.has(parseInt(id))) cleaned[id] = prev[id]; });
      return cleaned;
    });
  }, [photos]);

  // ============================================
  // PHOTO ACTIONS
  // ============================================
  const handleSelectFolder = async () => {
    if (window.electronAPI?.openDirectoryDialog) {
      try {
        const folderPath = await window.electronAPI.openDirectoryDialog();
        if (folderPath) {
          setIsLoading(true);
          addToast('Scanning folder...', 'info');
          try {
            const res = await axios.post(`${API_BASE_URL}/api/photos/scan-folder`, { folder_path: folderPath });
            addToast(`Scan complete: ${res.data.new_images_added} new images added`, 'success');
            setCurrentPage(1);
            fetchPhotos();
            fetchAllTags();
          } catch (err) {
            addToast(`Scan failed: ${err.response?.data?.detail || err.message}`, 'error');
          } finally {
            setIsLoading(false);
          }
        }
      } catch {
        addToast('Could not open folder dialog', 'error');
      }
    }
  };

  const handleRatePhoto = async (photoId, newRating) => {
    setRatingLoading(prev => ({ ...prev, [photoId]: true }));
    try {
      const res = await axios.post(`${API_BASE_URL}/api/photos/images/${photoId}/rate`, { rating: newRating });
      setPhotos(prev => prev.map(p => p.id === photoId ? res.data : p));
      // Update lightbox if open
      if (lightboxPhoto && lightboxPhoto.id === photoId) setLightboxPhoto(res.data);
    } catch (err) {
      addToast(`Failed to rate photo: ${err.response?.data?.detail || err.message}`, 'error');
    } finally {
      setRatingLoading(prev => ({ ...prev, [photoId]: false }));
    }
  };

  const handleAddTag = async (photoId, tagName) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    setTagLoading(prev => ({ ...prev, [photoId]: true }));
    try {
      await axios.post(`${API_BASE_URL}/api/photos/images/${photoId}/tags`, { tag_name: trimmed });
      fetchPhotos();
      fetchAllTags();
      setTagInputs(prev => ({ ...prev, [photoId]: '' }));
    } catch (err) {
      addToast(`Failed to add tag: ${err.response?.data?.detail || err.message}`, 'error');
    } finally {
      setTagLoading(prev => ({ ...prev, [photoId]: false }));
    }
  };

  const handleRemoveTag = async (photoId, tagId) => {
    setTagLoading(prev => ({ ...prev, [`${photoId}-${tagId}`]: true }));
    try {
      await axios.delete(`${API_BASE_URL}/api/photos/images/${photoId}/tags/${tagId}`);
      fetchPhotos();
      fetchAllTags();
    } catch (err) {
      addToast(`Failed to remove tag: ${err.response?.data?.detail || err.message}`, 'error');
    } finally {
      setTagLoading(prev => ({ ...prev, [`${photoId}-${tagId}`]: false }));
    }
  };

  // ============================================
  // ALBUM ACTIONS
  // ============================================
  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) { addToast("Album name is required", 'error'); return; }
    try {
      await axios.post(`${API_BASE_URL}/api/albums/`, { name: newAlbumName, description: newAlbumDescription });
      setNewAlbumName(''); setNewAlbumDescription('');
      setShowCreateAlbum(false);
      fetchAlbums();
      addToast('Album created', 'success');
    } catch (err) {
      addToast(`Failed to create album: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  const handleUpdateAlbum = async () => {
    if (!editAlbumData?.name?.trim()) { addToast("Album name is required", 'error'); return; }
    try {
      await axios.put(`${API_BASE_URL}/api/albums/${editAlbumData.id}`, {
        name: editAlbumData.name, description: editAlbumData.description
      });
      setShowEditAlbum(false); setEditAlbumData(null);
      if (selectedAlbum?.id === editAlbumData.id) fetchAlbumDetails(editAlbumData.id);
      fetchAlbums();
      addToast('Album updated', 'success');
    } catch (err) {
      addToast(`Failed to update album: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (!window.confirm("Delete this album?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/albums/${albumId}`);
      if (selectedAlbum?.id === albumId) { setSelectedAlbum(null); setAlbumPhotos([]); }
      fetchAlbums();
      addToast('Album deleted', 'success');
    } catch (err) {
      addToast(`Failed to delete album: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  const handleAddPhotosToAlbum = async (albumId) => {
    if (selectedPhotoIds.length === 0) return;
    try {
      await axios.post(`${API_BASE_URL}/api/albums/${albumId}/photos`, { image_ids: selectedPhotoIds });
      setSelectedPhotoIds([]); setSelectionMode(false); setShowAddToAlbumModal(false);
      fetchAlbums();
      if (selectedAlbum?.id === albumId) fetchAlbumDetails(albumId);
      addToast(`Added ${selectedPhotoIds.length} photos to album`, 'success');
    } catch (err) {
      addToast(`Failed to add photos: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  const handleRemovePhotoFromAlbum = async (albumId, photoId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/albums/${albumId}/photos`, { data: { image_ids: [photoId] } });
      fetchAlbumDetails(albumId);
      fetchAlbums();
    } catch (err) {
      addToast(`Failed to remove photo: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  // ============================================
  // EXPORT
  // ============================================
  const handleExport = async () => {
    if (selectedPhotoIds.length === 0 && !selectedAlbum) {
      addToast("No photos selected for export", 'error'); return;
    }
    try {
      const data = { export_format: exportFormat, quality: exportQuality, include_metadata: true };
      if (selectedAlbum) data.album_id = selectedAlbum.id;
      else data.image_ids = selectedPhotoIds;

      const res = await axios.post(`${API_BASE_URL}/api/export/`, data);
      setExportJobId(res.data.job_id);
      setShowExportModal(false);
      addToast('Export started...', 'info');
      pollExportStatus(res.data.job_id);
    } catch (err) {
      addToast(`Export failed: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  const pollExportStatus = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/export/jobs/${jobId}`);
        setExportProgress(res.data);
        if (res.data.status === 'completed') {
          clearInterval(interval);
          window.location.href = `${API_BASE_URL}/api/export/download/${jobId}`;
          addToast('Export complete — downloading', 'success');
          setTimeout(() => { setExportJobId(null); setExportProgress(null); }, 3000);
        } else if (res.data.status === 'failed') {
          clearInterval(interval);
          addToast(`Export failed: ${res.data.error_message}`, 'error');
          setExportJobId(null); setExportProgress(null);
        }
      } catch {
        clearInterval(interval);
        addToast('Failed to check export status', 'error');
      }
    }, 1000);
  };

  // ============================================
  // BULK OPERATIONS
  // ============================================
  const handleBulkDelete = async () => {
    if (selectedPhotoIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedPhotoIds.length} photos? This cannot be undone.`)) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/bulk/delete`, { image_ids: selectedPhotoIds });
      setSelectedPhotoIds([]); setSelectionMode(false);
      fetchPhotos();
      addToast(`Deleted ${res.data.deleted_count} photos`, 'success');
    } catch (err) {
      addToast(`Bulk delete failed: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  const handleBulkRate = async (rating) => {
    if (selectedPhotoIds.length === 0) return;
    try {
      await axios.post(`${API_BASE_URL}/api/bulk/rate`, { image_ids: selectedPhotoIds, rating });
      fetchPhotos();
      addToast(`Rated ${selectedPhotoIds.length} photos with ${rating} stars`, 'success');
    } catch (err) {
      addToast(`Bulk rating failed: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  const handleBulkTag = async () => {
    if (selectedPhotoIds.length === 0) return;
    const tagNames = prompt("Enter tags (comma-separated):");
    if (!tagNames) return;
    const tags = tagNames.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length === 0) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/bulk/tag`, { image_ids: selectedPhotoIds, tag_names: tags });
      fetchPhotos(); fetchAllTags();
      addToast(`Added tags to ${res.data.success_count} photos`, 'success');
    } catch (err) {
      addToast(`Bulk tagging failed: ${err.response?.data?.detail || err.message}`, 'error');
    }
  };

  // ============================================
  // SELECTION
  // ============================================
  const togglePhotoSelection = (photoId) => {
    setSelectedPhotoIds(prev =>
      prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]
    );
  };

  const selectAllPhotos = () => setSelectedPhotoIds(photos.map(p => p.id));
  const deselectAllPhotos = () => setSelectedPhotoIds([]);

  // ============================================
  // LIGHTBOX
  // ============================================
  const openLightbox = (photo, index) => {
    if (selectionMode) { togglePhotoSelection(photo.id); return; }
    setLightboxPhoto(photo);
    setLightboxIndex(index);
  };

  const closeLightbox = () => { setLightboxPhoto(null); setLightboxIndex(-1); };

  const lightboxPrev = () => {
    if (lightboxIndex > 0) {
      const prev = photos[lightboxIndex - 1];
      setLightboxPhoto(prev);
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  const lightboxNext = () => {
    if (lightboxIndex < photos.length - 1) {
      const next = photos[lightboxIndex + 1];
      setLightboxPhoto(next);
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  useEffect(() => {
    const handler = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      // Lightbox navigation
      if (lightboxPhoto) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') lightboxPrev();
        if (e.key === 'ArrowRight') lightboxNext();
        // Rate 1-5 in lightbox
        if (e.key >= '1' && e.key <= '5') handleRatePhoto(lightboxPhoto.id, parseInt(e.key));
        return;
      }

      // Global shortcuts
      if (e.key === 'Escape') {
        if (selectionMode) { setSelectionMode(false); setSelectedPhotoIds([]); }
      }
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) { setSelectionMode(prev => !prev); }
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) { setShowFilters(prev => !prev); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ============================================
  // HELPERS
  // ============================================
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleDateString(); } catch { return 'Invalid'; }
  };

  const clearFilters = () => {
    setFilterDateStart(''); setFilterDateEnd('');
    setFilterCameraModels([]); setFilterTagNames('');
    setFilterRatingMin(0); setCurrentPage(1);
  };

  const hasActiveFilters = filterDateStart || filterDateEnd || filterCameraModels.length > 0 || filterTagNames || filterRatingMin > 0;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="app-layout">
      {/* ---- SIDEBAR ---- */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon">📷</span>
          <span className="logo">Photo Organizer</span>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Library</div>
          <button className={`nav-item ${currentView === 'photos' ? 'active' : ''}`}
            onClick={() => { setCurrentView('photos'); setSelectedAlbum(null); }}>
            <span className="nav-icon">🖼️</span>
            <span>All Photos</span>
            {totalItems > 0 && <span className="nav-badge">{totalItems}</span>}
          </button>
          <button className={`nav-item ${currentView === 'albums' ? 'active' : ''}`}
            onClick={() => { setCurrentView('albums'); setSelectedAlbum(null); }}>
            <span className="nav-icon">📁</span>
            <span>Albums</span>
            {albums.length > 0 && <span className="nav-badge">{albums.length}</span>}
          </button>
          <button className={`nav-item ${currentView === 'stats' ? 'active' : ''}`}
            onClick={() => setCurrentView('stats')}>
            <span className="nav-icon">📊</span>
            <span>Statistics</span>
          </button>

          {allTags.length > 0 && (
            <>
              <div className="sidebar-section-label">Tags</div>
              {allTags.slice(0, 12).map(tag => (
                <button key={tag.id} className="nav-item"
                  onClick={() => { setFilterTagNames(tag.name); setCurrentView('photos'); setCurrentPage(1); }}>
                  <span className="nav-icon">🏷️</span>
                  <span>{tag.name}</span>
                </button>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme}>
            <span className="nav-icon">{theme === 'light' ? '🌙' : '☀️'}</span>
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </div>
      </aside>

      {/* ---- MAIN CONTENT ---- */}
      <div className="main-content">
        {/* Top Bar */}
        <div className="top-bar">
          <span className="top-bar-title">
            {currentView === 'photos' && (selectedAlbum ? selectedAlbum.name : 'All Photos')}
            {currentView === 'albums' && (selectedAlbum ? selectedAlbum.name : 'Albums')}
            {currentView === 'stats' && 'Library Statistics'}
          </span>
          <div className="top-bar-actions">
            {currentView === 'photos' && (
              <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Filter by tags..." value={filterTagNames}
                  onChange={e => { setFilterTagNames(e.target.value); setCurrentPage(1); }} />
              </div>
            )}
          </div>
        </div>

        {/* ---- PHOTOS VIEW ---- */}
        {currentView === 'photos' && (
          <>
            {/* Toolbar */}
            <div className="toolbar">
              <div className="toolbar-group">
                <button className="btn btn-primary" onClick={handleSelectFolder} disabled={isLoading}>
                  📂 {isLoading ? 'Scanning...' : 'Import'}
                </button>
                <button className={`btn ${selectionMode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setSelectionMode(!selectionMode); if (selectionMode) setSelectedPhotoIds([]); }}>
                  {selectionMode ? '✓ Selecting' : '☐ Select'}
                </button>
                <button className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShowFilters(!showFilters)}>
                  🔽 Filters {hasActiveFilters && '•'}
                </button>
              </div>
              <div className="toolbar-spacer" />
              <div className="toolbar-group">
                <select className="select-control" value={sortBy}
                  onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}>
                  <option value="capture_date">Date Captured</option>
                  <option value="date_added">Date Added</option>
                  <option value="original_filename">Filename</option>
                  <option value="camera_model">Camera</option>
                  <option value="rating">Rating</option>
                </select>
                <button className="btn btn-ghost btn-icon"
                  onClick={() => { setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); setCurrentPage(1); }}
                  title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}>
                  {sortOrder === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            {showFilters && (
              <div className="filter-bar">
                <div className="filter-group">
                  <label>From:</label>
                  <input type="date" className="filter-input" value={filterDateStart}
                    onChange={e => { setFilterDateStart(e.target.value); setCurrentPage(1); }} />
                </div>
                <div className="filter-group">
                  <label>To:</label>
                  <input type="date" className="filter-input" value={filterDateEnd}
                    onChange={e => { setFilterDateEnd(e.target.value); setCurrentPage(1); }} />
                </div>
                <div className="filter-group">
                  <label>Camera:</label>
                  <select className="filter-input" value={filterCameraModels[0] || ''}
                    onChange={e => { setFilterCameraModels(e.target.value ? [e.target.value] : []); setCurrentPage(1); }}>
                    <option value="">All</option>
                    {availableCameraModels.map(cam => <option key={cam} value={cam}>{cam}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Min Rating:</label>
                  <select className="filter-input" value={filterRatingMin}
                    onChange={e => { setFilterRatingMin(parseInt(e.target.value)); setCurrentPage(1); }}>
                    <option value={0}>Any</option>
                    {[1,2,3,4,5].map(r => <option key={r} value={r}>{'★'.repeat(r)}</option>)}
                  </select>
                </div>
                {hasActiveFilters && (
                  <button className="filter-clear-btn" onClick={clearFilters}>Clear all</button>
                )}
              </div>
            )}

            {/* Export Progress */}
            {exportProgress && (
              <div style={{ padding: '0 24px', paddingTop: 16 }}>
                <div className="export-progress-bar">
                  <h4>Exporting... {exportProgress.progress}%</h4>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${exportProgress.progress}%` }} />
                  </div>
                  <span className="progress-text">{exportProgress.processed_images} / {exportProgress.total_images} images</span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="content-area">
              {isLoading && photos.length === 0 ? (
                <div className="loading-state">
                  <div className="loading-spinner" />
                  <span>Loading photos...</span>
                </div>
              ) : photos.length > 0 ? (
                <>
                  <div className="photo-grid">
                    {photos.map((photo, idx) => (
                      <div key={photo.id}
                        className={`photo-card ${selectedPhotoIds.includes(photo.id) ? 'selected' : ''}`}
                        onClick={() => openLightbox(photo, idx)}>
                        {selectionMode && (
                          <div className={`card-checkbox ${selectedPhotoIds.includes(photo.id) ? 'checked' : ''}`}
                            onClick={e => { e.stopPropagation(); togglePhotoSelection(photo.id); }} />
                        )}
                        <div className="card-image">
                          {photo.thumbnail_path ? (
                            <img src={`${API_BASE_URL}/thumbnails/${photo.thumbnail_path}`}
                              alt={photo.original_filename || 'Photo'} loading="lazy" />
                          ) : (
                            <div className="no-thumbnail">🖼️</div>
                          )}
                          <div className="card-overlay">
                            <div className="overlay-rating">
                              {[1,2,3,4,5].map(s => (
                                <span key={s}
                                  className={`overlay-star ${s <= (photo.rating || 0) ? 'filled' : ''}`}
                                  onClick={e => { e.stopPropagation(); handleRatePhoto(photo.id, s); }}>★</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="card-body">
                          <div className="card-filename" title={photo.original_filename}>
                            {photo.original_filename || 'Untitled'}
                          </div>
                          <div className="card-meta">{formatDate(photo.capture_date)}</div>
                          {photo.associated_tags?.length > 0 && (
                            <div className="card-tags">
                              {photo.associated_tags.slice(0, 3).map(tag => (
                                <span key={tag.id} className={`tag-chip ${tag.is_ai_generated ? 'ai-tag' : 'manual-tag'}`}>
                                  {tag.name}
                                  <button className="remove-tag-btn"
                                    onClick={e => { e.stopPropagation(); handleRemoveTag(photo.id, tag.id); }}
                                    disabled={tagLoading[`${photo.id}-${tag.id}`]}>×</button>
                                </span>
                              ))}
                              {photo.associated_tags.length > 3 && (
                                <span className="tag-chip manual-tag">+{photo.associated_tags.length - 3}</span>
                              )}
                            </div>
                          )}
                          <div className="add-tag-inline" onClick={e => e.stopPropagation()}>
                            <input type="text" placeholder="Add tag..."
                              value={tagInputs[photo.id] || ''}
                              onChange={e => setTagInputs(prev => ({ ...prev, [photo.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && e.target.value && handleAddTag(photo.id, e.target.value)}
                              list="all-tags-list" disabled={tagLoading[photo.id]} />
                            <button className="btn btn-sm btn-success"
                              onClick={() => tagInputs[photo.id] && handleAddTag(photo.id, tagInputs[photo.id])}
                              disabled={tagLoading[photo.id] || !tagInputs[photo.id]}>+</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}>← Prev</button>
                      <span className="page-info">Page {currentPage} of {totalPages} · {totalItems} photos</span>
                      <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}>Next →</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📷</div>
                  <div className="empty-text">No photos yet</div>
                  <div className="empty-hint">Click Import to scan a folder of images</div>
                </div>
              )}
            </div>

            {/* Bulk Actions Bar */}
            {selectionMode && selectedPhotoIds.length > 0 && (
              <div className="bulk-bar">
                <span className="bulk-count">{selectedPhotoIds.length} selected</span>
                <button className="btn btn-sm btn-secondary" onClick={selectAllPhotos}>Select All</button>
                <button className="btn btn-sm btn-secondary" onClick={deselectAllPhotos}>Deselect</button>
                <div className="toolbar-separator" />
                <button className="btn btn-sm btn-secondary" onClick={() => handleBulkRate(5)}>⭐ 5</button>
                <button className="btn btn-sm btn-secondary" onClick={() => handleBulkRate(4)}>⭐ 4</button>
                <button className="btn btn-sm btn-secondary" onClick={() => handleBulkRate(3)}>⭐ 3</button>
                <button className="btn btn-sm btn-secondary" onClick={handleBulkTag}>🏷️ Tag</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowAddToAlbumModal(true)}>📁 Album</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowExportModal(true)}>📤 Export</button>
                <div className="toolbar-spacer" />
                <button className="btn btn-sm btn-danger" onClick={handleBulkDelete}>🗑️ Delete</button>
              </div>
            )}
          </>
        )}

        {/* ---- ALBUMS VIEW ---- */}
        {currentView === 'albums' && (
          <div className="content-area">
            {!selectedAlbum ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 600 }}>My Albums</h2>
                  <button className="btn btn-primary" onClick={() => setShowCreateAlbum(true)}>+ New Album</button>
                </div>
                {albums.length > 0 ? (
                  <div className="albums-grid">
                    {albums.map(album => (
                      <div key={album.id} className="album-card" onClick={() => fetchAlbumDetails(album.id)}>
                        <div className="album-cover">
                          {album.cover_image?.thumbnail_path ? (
                            <img src={`${API_BASE_URL}/thumbnails/${album.cover_image.thumbnail_path}`} alt={album.name} />
                          ) : <div className="no-cover">📁</div>}
                        </div>
                        <div className="album-body">
                          <div className="album-name">{album.name}</div>
                          <div className="album-count">{album.photo_count} photo{album.photo_count !== 1 ? 's' : ''}</div>
                          {album.description && <div className="album-desc">{album.description}</div>}
                          <div className="album-card-actions" onClick={e => e.stopPropagation()}>
                            <button className="btn btn-sm btn-secondary"
                              onClick={() => { setEditAlbumData(album); setShowEditAlbum(true); }}>Edit</button>
                            <button className="btn btn-sm btn-secondary"
                              onClick={() => { setSelectedAlbum(album); setShowExportModal(true); }}>Export</button>
                            <button className="btn btn-sm btn-danger"
                              onClick={() => handleDeleteAlbum(album.id)}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📁</div>
                    <div className="empty-text">No albums yet</div>
                    <div className="empty-hint">Create an album to organize your photos</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="album-detail-header">
                  <button className="btn btn-secondary" onClick={() => { setSelectedAlbum(null); setAlbumPhotos([]); }}>
                    ← Back
                  </button>
                  <div className="album-detail-info">
                    <h2>{selectedAlbum.name}</h2>
                    <p>{selectedAlbum.description || ''} · {albumPhotos.length} photos</p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => setShowExportModal(true)}>📤 Export</button>
                </div>
                {albumPhotos.length > 0 ? (
                  <div className="photo-grid">
                    {albumPhotos.map(ap => (
                      <div key={ap.image_id} className="photo-card">
                        <div className="card-image">
                          {ap.image.thumbnail_path ? (
                            <img src={`${API_BASE_URL}/thumbnails/${ap.image.thumbnail_path}`}
                              alt={ap.image.original_filename || 'Photo'} />
                          ) : <div className="no-thumbnail">🖼️</div>}
                        </div>
                        <div className="card-body">
                          <div className="card-filename">{ap.image.original_filename || 'Untitled'}</div>
                          <button className="btn btn-sm btn-danger" style={{ width: '100%', marginTop: 6 }}
                            onClick={() => handleRemovePhotoFromAlbum(selectedAlbum.id, ap.image_id)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📷</div>
                    <div className="empty-text">No photos in this album</div>
                    <div className="empty-hint">Select photos and add them to this album</div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ---- STATS VIEW ---- */}
        {currentView === 'stats' && (
          <div className="content-area">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">🖼️</div>
                <div className="stat-value">{stats?.total_photos ?? totalItems}</div>
                <div className="stat-label">Total Photos</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📁</div>
                <div className="stat-value">{stats?.total_albums ?? albums.length}</div>
                <div className="stat-label">Albums</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🏷️</div>
                <div className="stat-value">{stats?.total_tags ?? allTags.length}</div>
                <div className="stat-label">Tags</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📸</div>
                <div className="stat-value">{stats?.total_cameras ?? availableCameraModels.length}</div>
                <div className="stat-label">Cameras</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-value">{stats?.rated_photos ?? 0}</div>
                <div className="stat-label">Rated Photos</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-value">{stats?.average_rating ?? 0}</div>
                <div className="stat-label">Avg Rating</div>
              </div>
            </div>
            {allTags.length > 0 && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>All Tags</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {allTags.map(tag => (
                    <span key={tag.id} className="tag-chip manual-tag" style={{ cursor: 'pointer' }}
                      onClick={() => { setFilterTagNames(tag.name); setCurrentView('photos'); setCurrentPage(1); }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- LIGHTBOX ---- */}
      {lightboxPhoto && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-header">
            <span className="lightbox-title">
              {lightboxIndex + 1} / {photos.length}
            </span>
            <button className="lightbox-close" onClick={closeLightbox}>✕</button>
          </div>
          <div className="lightbox-body" onClick={e => e.stopPropagation()}>
            {lightboxIndex > 0 && (
              <button className="lightbox-nav prev" onClick={lightboxPrev}>‹</button>
            )}
            <img
              src={`${API_BASE_URL}/api/photos/images/${lightboxPhoto.id}/full`}
              alt={lightboxPhoto.original_filename || 'Photo'}
            />
            {lightboxIndex < photos.length - 1 && (
              <button className="lightbox-nav next" onClick={lightboxNext}>›</button>
            )}
          </div>
          <div className="lightbox-footer" onClick={e => e.stopPropagation()}>
            <div className="lightbox-info">
              <div className="lb-filename">{lightboxPhoto.original_filename || 'Untitled'}</div>
              <div className="lb-meta">
                {formatDate(lightboxPhoto.capture_date)}
                {lightboxPhoto.camera_model && ` · ${lightboxPhoto.camera_model}`}
              </div>
            </div>
            <div className="lightbox-rating">
              {[1,2,3,4,5].map(s => (
                <span key={s} className={`lb-star ${s <= (lightboxPhoto.rating || 0) ? 'filled' : ''}`}
                  onClick={() => handleRatePhoto(lightboxPhoto.id, s)}>★</span>
              ))}
            </div>
            {lightboxPhoto.associated_tags?.length > 0 && (
              <div className="lightbox-tags">
                {lightboxPhoto.associated_tags.map(tag => (
                  <span key={tag.id} className={`lb-tag ${tag.is_ai_generated ? 'ai-tag' : 'manual-tag'}`}>
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- MODALS ---- */}
      {showCreateAlbum && (
        <div className="modal-overlay" onClick={() => setShowCreateAlbum(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create Album</h3>
            <input className="modal-input" type="text" placeholder="Album Name"
              value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)}
              autoFocus />
            <textarea className="modal-input" placeholder="Description (optional)"
              value={newAlbumDescription} onChange={e => setNewAlbumDescription(e.target.value)} />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCreateAlbum(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateAlbum}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showEditAlbum && editAlbumData && (
        <div className="modal-overlay" onClick={() => setShowEditAlbum(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Album</h3>
            <input className="modal-input" type="text" placeholder="Album Name"
              value={editAlbumData.name}
              onChange={e => setEditAlbumData({ ...editAlbumData, name: e.target.value })} />
            <textarea className="modal-input" placeholder="Description"
              value={editAlbumData.description || ''}
              onChange={e => setEditAlbumData({ ...editAlbumData, description: e.target.value })} />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowEditAlbum(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateAlbum}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showAddToAlbumModal && (
        <div className="modal-overlay" onClick={() => setShowAddToAlbumModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add {selectedPhotoIds.length} Photos to Album</h3>
            <div className="album-list">
              {albums.map(album => (
                <button key={album.id} className="album-list-item"
                  onClick={() => handleAddPhotosToAlbum(album.id)}>
                  {album.name} ({album.photo_count} photos)
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddToAlbumModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Export Photos</h3>
            <div className="export-options">
              <label>
                Format
                <select value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
                  <option value="zip">ZIP Archive</option>
                  <option value="folder">Folder</option>
                </select>
              </label>
              <label>
                Quality
                <select value={exportQuality} onChange={e => setExportQuality(e.target.value)}>
                  <option value="original">Original</option>
                  <option value="high">High (1920×1080)</option>
                  <option value="medium">Medium (1280×720)</option>
                  <option value="low">Low (640×480)</option>
                </select>
              </label>
              <div className="export-summary">
                {selectedAlbum
                  ? `Album: ${selectedAlbum.name} (${selectedAlbum.photo_count} photos)`
                  : `${selectedPhotoIds.length} selected photo(s)`}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExport}>Export</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- TOASTS ---- */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button className="toast-dismiss" onClick={() => dismissToast(toast.id)}>✕</button>
          </div>
        ))}
      </div>

      {/* Tag datalist for autocomplete */}
      {allTags.length > 0 && (
        <datalist id="all-tags-list">
          {allTags.map(tag => <option key={tag.id} value={tag.name} />)}
        </datalist>
      )}
    </div>
  );
}

export default App;
