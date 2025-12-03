import React, { useState, useEffect, useCallback, useMemo } from 'react'; 
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function App() {
  const [currentView, setCurrentView] = useState('photos');
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [sortBy, setSortBy] = useState('capture_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');  
  const [filterCameraModels, setFilterCameraModels] = useState([]);
  const [availableCameraModels, setAvailableCameraModels] = useState([]);
  const [filterTagNames, setFilterTagNames] = useState(''); 
  const [filterRatingMin, setFilterRatingMin] = useState(0); 
  const [allTags, setAllTags] = useState([]);
  const [tagInputs, setTagInputs] = useState({}); 
  const [ratingLoading, setRatingLoading] = useState({});
  const [tagLoading, setTagLoading] = useState({});
  const debouncedTagNames = useDebounce(filterTagNames, 500);

  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumPhotos, setAlbumPhotos] = useState([]);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showEditAlbum, setShowEditAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const [editAlbumData, setEditAlbumData] = useState(null);
  
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);

  // Phase 5: Export and Bulk Operations
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('zip');
  const [exportQuality, setExportQuality] = useState('high');
  const [exportJobId, setExportJobId] = useState(null);
  const [exportProgress, setExportProgress] = useState(null);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const handleTagInputChange = (photoId, value) => {
    setTagInputs(prev => ({ ...prev, [photoId]: value }));
  };

  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const params = {
      page: currentPage,
      page_size: pageSize,
      sort_by: sortBy,
      sort_order: sortOrder,
    };

    if (filterDateStart) {
      try { params.date_start = new Date(filterDateStart).toISOString(); } 
      catch (e) { console.error("Invalid start date"); }
    }
    if (filterDateEnd) {
      try {
        const endDate = new Date(filterDateEnd);
        endDate.setHours(23, 59, 59, 999); 
        params.date_end = endDate.toISOString();
      } catch (e) { console.error("Invalid end date"); }
    }
    if (filterCameraModels.length > 0) params.camera_models = filterCameraModels;
    
    const trimmedTagNames = debouncedTagNames.trim();
    if (trimmedTagNames) {
      params.tag_names = trimmedTagNames.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    
    if (filterRatingMin > 0 && filterRatingMin <= 5) params.rating_min = filterRatingMin;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/photos/`, { params });
      if (response.data.items) {
        setPhotos(response.data.items);
        setTotalPages(response.data.meta.total_pages);
        setTotalItems(response.data.meta.total_items);
      } else {
        setPhotos(response.data);
      }

      if (response.data.items && response.data.items.length > 0) {
        const uniqueCameras = [...new Set(response.data.items.map(p => p.camera_model).filter(Boolean))];
        setAvailableCameraModels(uniqueCameras.sort());
      }
    } catch (err) {
      console.error("Error fetching photos:", err);
      setError(`Failed to load photos. ${err.response?.data?.detail || err.message}`);
      setPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, sortBy, sortOrder, filterDateStart, filterDateEnd, 
      filterCameraModels, debouncedTagNames, filterRatingMin]); 

  const fetchAlbums = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/albums/`);
      setAlbums(response.data.items || response.data);
    } catch (err) {
      console.error("Failed to fetch albums:", err);
    }
  }, []);

  const fetchAlbumDetails = useCallback(async (albumId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/albums/${albumId}`);
      setSelectedAlbum(response.data);
      setAlbumPhotos(response.data.photos || []);
    } catch (err) {
      console.error("Failed to fetch album details:", err);
      setError("Failed to load album details");
    }
  }, []);

  const handleRatePhoto = async (photoId, newRating) => {
    setRatingLoading(prev => ({ ...prev, [photoId]: true }));
    try {
      const response = await axios.post(`${API_BASE_URL}/api/photos/images/${photoId}/rate`, { rating: newRating });
      setPhotos(prevPhotos => prevPhotos.map(p => p.id === photoId ? response.data : p));
      setError(null); 
    } catch (err) {
      setError(`Failed to rate photo: ${err.response?.data?.detail || err.message}`);
    } finally {
      setRatingLoading(prev => ({ ...prev, [photoId]: false }));
    }
  };

  const fetchAllTags = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tags/`);
      setAllTags(response.data);
    } catch (err) {
      console.error("Failed to fetch all tags:", err);
    }
  }, []);

  useEffect(() => {
    if (currentView === 'photos') fetchPhotos();
    else fetchAlbums();
  }, [currentView, fetchPhotos, fetchAlbums]); 

  useEffect(() => {
    fetchAllTags();
  }, [fetchAllTags]);

  const handleSelectFolder = async () => {
    if (window.electronAPI && window.electronAPI.openDirectoryDialog) {
      try {
        const folderPath = await window.electronAPI.openDirectoryDialog();
        if (folderPath) {
          setIsLoading(true);
          setError(null);
          setScanStatus('Scanning folder...');
          try {
            const response = await axios.post(`${API_BASE_URL}/api/photos/scan-folder`, { folder_path: folderPath });
            setScanStatus(`Scan complete: ${response.data.new_images_added} new images added.`);
            setCurrentPage(1);
            fetchPhotos(); 
            fetchAllTags(); 
          } catch (err) {
            setError(`Failed to scan folder: ${err.response?.data?.detail || err.message}`);
            setScanStatus(null);
          } finally {
            setIsLoading(false);
          }
        }
      } catch (err) {
        setError('Could not open folder dialog.');
      }
    }
  };

  const handleAddTag = async (photoId, tagName) => {
    const trimmedTagName = tagName.trim();
    if (!trimmedTagName) return;
    
    setTagLoading(prev => ({ ...prev, [photoId]: true }));
    try {
      await axios.post(`${API_BASE_URL}/api/photos/images/${photoId}/tags`, { tag_name: trimmedTagName });
      fetchPhotos(); 
      fetchAllTags(); 
      setTagInputs(prev => ({ ...prev, [photoId]: '' })); 
      setError(null);
    } catch (err) {
      setError(`Failed to add tag: ${err.response?.data?.detail || err.message}`);
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
      setError(null);
    } catch (err) {
      setError(`Failed to remove tag: ${err.response?.data?.detail || err.message}`);
    } finally {
      setTagLoading(prev => ({ ...prev, [`${photoId}-${tagId}`]: false }));
    }
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) {
      setError("Album name is required");
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/albums/`, { name: newAlbumName, description: newAlbumDescription });
      setNewAlbumName('');
      setNewAlbumDescription('');
      setShowCreateAlbum(false);
      fetchAlbums();
      setError(null);
    } catch (err) {
      setError(`Failed to create album: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleUpdateAlbum = async () => {
    if (!editAlbumData || !editAlbumData.name.trim()) {
      setError("Album name is required");
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/albums/${editAlbumData.id}`, {
        name: editAlbumData.name,
        description: editAlbumData.description
      });
      setShowEditAlbum(false);
      setEditAlbumData(null);
      if (selectedAlbum && selectedAlbum.id === editAlbumData.id) {
        fetchAlbumDetails(editAlbumData.id);
      }
      fetchAlbums();
      setError(null);
    } catch (err) {
      setError(`Failed to update album: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    if (!window.confirm("Delete this album?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/albums/${albumId}`);
      if (selectedAlbum && selectedAlbum.id === albumId) {
        setSelectedAlbum(null);
        setAlbumPhotos([]);
      }
      fetchAlbums();
      setError(null);
    } catch (err) {
      setError(`Failed to delete album: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleAddPhotosToAlbum = async (albumId) => {
    if (selectedPhotoIds.length === 0) return;
    try {
      await axios.post(`${API_BASE_URL}/api/albums/${albumId}/photos`, { image_ids: selectedPhotoIds });
      setSelectedPhotoIds([]);
      setSelectionMode(false);
      setShowAddToAlbumModal(false);
      fetchAlbums();
      if (selectedAlbum && selectedAlbum.id === albumId) fetchAlbumDetails(albumId);
      setError(null);
    } catch (err) {
      setError(`Failed to add photos: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleRemovePhotoFromAlbum = async (albumId, photoId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/albums/${albumId}/photos`, { data: { image_ids: [photoId] } });
      fetchAlbumDetails(albumId);
      fetchAlbums();
      setError(null);
    } catch (err) {
      setError(`Failed to remove photo: ${err.response?.data?.detail || err.message}`);
    }
  };

  // Phase 5: Export Functions
  const handleExport = async () => {
    if (selectedPhotoIds.length === 0 && !selectedAlbum) {
      setError("No photos selected for export");
      return;
    }

    try {
      const exportData = {
        export_format: exportFormat,
        quality: exportQuality,
        include_metadata: true
      };

      if (selectedAlbum) {
        exportData.album_id = selectedAlbum.id;
      } else {
        exportData.image_ids = selectedPhotoIds;
      }

      const response = await axios.post(`${API_BASE_URL}/api/export/`, exportData);
      setExportJobId(response.data.job_id);
      setShowExportModal(false);
      
      // Poll for export status
      pollExportStatus(response.data.job_id);
    } catch (err) {
      setError(`Export failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  const pollExportStatus = async (jobId) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/export/jobs/${jobId}`);
        setExportProgress(response.data);

        if (response.data.status === 'completed') {
          clearInterval(pollInterval);
          // Trigger download
          window.location.href = `${API_BASE_URL}/api/export/download/${jobId}`;
          setTimeout(() => {
            setExportJobId(null);
            setExportProgress(null);
          }, 3000);
        } else if (response.data.status === 'failed') {
          clearInterval(pollInterval);
          setError(`Export failed: ${response.data.error_message}`);
          setExportJobId(null);
          setExportProgress(null);
        }
      } catch (err) {
        clearInterval(pollInterval);
        setError('Failed to check export status');
      }
    }, 1000);
  };

  // Bulk Operations
  const handleBulkDelete = async () => {
    if (selectedPhotoIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedPhotoIds.length} photos? This cannot be undone.`)) return;

    try {
      const response = await axios.post(`${API_BASE_URL}/api/bulk/delete`, { image_ids: selectedPhotoIds });
      setSelectedPhotoIds([]);
      setSelectionMode(false);
      fetchPhotos();
      setError(null);
      setScanStatus(`Deleted ${response.data.deleted_count} photos`);
    } catch (err) {
      setError(`Bulk delete failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleBulkRate = async (rating) => {
    if (selectedPhotoIds.length === 0) return;

    try {
      await axios.post(`${API_BASE_URL}/api/bulk/rate`, {
        image_ids: selectedPhotoIds,
        rating: rating
      });
      fetchPhotos();
      setError(null);
      setScanStatus(`Rated ${selectedPhotoIds.length} photos with ${rating} stars`);
    } catch (err) {
      setError(`Bulk rating failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleBulkTag = async () => {
    if (selectedPhotoIds.length === 0) return;
    const tagNames = prompt("Enter tags (comma-separated):");
    if (!tagNames) return;

    const tags = tagNames.split(',').map(t => t.trim()).filter(t => t);
    if (tags.length === 0) return;

    try {
      const response = await axios.post(`${API_BASE_URL}/api/bulk/tag`, {
        image_ids: selectedPhotoIds,
        tag_names: tags
      });
      fetchPhotos();
      fetchAllTags();
      setError(null);
      setScanStatus(`Added tags to ${response.data.success_count} photos`);
    } catch (err) {
      setError(`Bulk tagging failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  const togglePhotoSelection = (photoId) => {
    setSelectedPhotoIds(prev => 
      prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]
    );
  };

  const selectAllPhotos = () => {
    setSelectedPhotoIds(photos.map(p => p.id));
  };

  const deselectAllPhotos = () => {
    setSelectedPhotoIds([]);
  };

  useEffect(() => {
    const photoIds = new Set(photos.map(p => p.id));
    setTagInputs(prev => {
      const cleaned = {};
      Object.keys(prev).forEach(id => {
        if (photoIds.has(parseInt(id))) cleaned[id] = prev[id];
      });
      return cleaned;
    });
  }, [photos]);

  const StarRating = ({ rating, onRate, photoId, isLoading }) => {
    const stars = [1, 2, 3, 4, 5];
    return (
      <div className="star-rating">
        {stars.map((starValue) => (
          <span
            key={starValue}
            className={`star ${starValue <= rating ? 'filled' : ''} ${isLoading ? 'disabled' : ''}`}
            onClick={() => !isLoading && onRate(photoId, starValue)}
            title={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
          >          
            {starValue <= rating ? '★' : '☆'}
          </span>
        ))}
      </div>
    );
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try { return new Date(dateString).toLocaleString(); } 
    catch (e) { return 'Invalid Date'; }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Smart Photo Organizer</h1>
        <div className="view-switcher">
          <button className={currentView === 'photos' ? 'active' : ''} onClick={() => setCurrentView('photos')}>
            📸 Photos
          </button>
          <button className={currentView === 'albums' ? 'active' : ''} onClick={() => setCurrentView('albums')}>
            📁 Albums
          </button>
        </div>
      </header>

      {currentView === 'photos' && (
        <>
          <div className="controls">
            <button onClick={handleSelectFolder} disabled={isLoading}>
              {isLoading && scanStatus ? 'Processing...' : 'Select Folder'}
            </button>
            <button onClick={() => setSelectionMode(!selectionMode)} className={selectionMode ? 'active' : ''}>
              {selectionMode ? '✓ Selection Mode' : 'Select Photos'}
            </button>
            {selectionMode && (
              <>
                <button onClick={selectAllPhotos}>Select All</button>
                <button onClick={deselectAllPhotos}>Deselect All</button>
                {selectedPhotoIds.length > 0 && (
                  <>
                    <button onClick={() => setShowAddToAlbumModal(true)}>Add to Album</button>
                    <button onClick={() => setShowExportModal(true)}>Export ({selectedPhotoIds.length})</button>
                    <button onClick={() => setShowBulkActions(!showBulkActions)}>Bulk Actions ▼</button>
                  </>
                )}
              </>
            )}
            <div>
              <select value={sortBy} onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}>
                <option value="capture_date">Capture Date</option>
                <option value="date_added">Date Added</option>
                <option value="original_filename">Filename</option>
                <option value="camera_model">Camera</option>
                <option value="rating">Rating</option>
              </select>
              <select value={sortOrder} onChange={e => { setSortOrder(e.target.value); setCurrentPage(1); }}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          {showBulkActions && selectedPhotoIds.length > 0 && (
            <div className="bulk-actions-panel">
              <button onClick={() => handleBulkRate(5)}>⭐ Rate 5 Stars</button>
              <button onClick={() => handleBulkRate(4)}>⭐ Rate 4 Stars</button>
              <button onClick={() => handleBulkRate(3)}>⭐ Rate 3 Stars</button>
              <button onClick={handleBulkTag}>🏷️ Add Tags</button>
              <button onClick={handleBulkDelete} className="danger">🗑️ Delete</button>
            </div>
          )}

          {scanStatus && <div className="status-message success">{scanStatus}</div>}
          {error && <div className="status-message error-msg">{error}</div>}
          
          {exportProgress && (
            <div className="export-progress">
              <h4>Exporting... {exportProgress.progress}%</h4>
              <div className="progress-bar">
                <div className="progress-fill" style={{width: `${exportProgress.progress}%`}}></div>
              </div>
              <p>{exportProgress.processed_images} / {exportProgress.total_images} images</p>
            </div>
          )}

          {isLoading && !photos.length && <p className="loading">Loading photos...</p>}
          
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
              <span>Page {currentPage} of {totalPages} ({totalItems} photos)</span>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
            </div>
          )}
          
          {photos.length > 0 ? (
            <div className="photo-grid">
              {photos.map((photo) => (
                <div key={photo.id} className={`photo-item ${selectedPhotoIds.includes(photo.id) ? 'selected' : ''}`}>
                  {selectionMode && (
                    <div className="selection-checkbox">
                      <input type="checkbox" checked={selectedPhotoIds.includes(photo.id)} 
                        onChange={() => togglePhotoSelection(photo.id)} />
                    </div>
                  )}
                  {photo.thumbnail_path ? (
                    <img src={`${API_BASE_URL}/thumbnails/${photo.thumbnail_path}`} 
                      alt={photo.original_filename || 'Photo'}
                      onClick={() => selectionMode && togglePhotoSelection(photo.id)}
                      style={{ cursor: selectionMode ? 'pointer' : 'default' }} />
                  ) : (
                    <div className="no-thumbnail">No Thumbnail</div>
                  )}
                  <div className="info">
                    <p title={photo.original_filename}>
                      <strong>File:</strong> {photo.original_filename?.substring(0,20) + (photo.original_filename?.length > 20 ? "..." : "") || 'N/A'}
                    </p>
                    <p><strong>Date:</strong> {formatDate(photo.capture_date)}</p>
                    
                    <StarRating photoId={photo.id} rating={photo.rating || 0} 
                      onRate={handleRatePhoto} isLoading={ratingLoading[photo.id]} />
                    
                    {photo.associated_tags && photo.associated_tags.length > 0 && (
                      <div className="tags-display">
                        {photo.associated_tags.map(tagInfo => (
                          <span key={tagInfo.id} 
                            className={`tag-chip ${tagInfo.is_ai_generated ? 'ai-tag' : 'manual-tag'}`}>
                            {tagInfo.name}
                            <button className="remove-tag-btn" 
                              onClick={() => handleRemoveTag(photo.id, tagInfo.id)}
                              disabled={tagLoading[`${photo.id}-${tagInfo.id}`]}>
                              {tagLoading[`${photo.id}-${tagInfo.id}`] ? '...' : '×'}
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="add-tag-section">
                      <input type="text" placeholder="Add tag..." value={tagInputs[photo.id] || ''}
                        onChange={(e) => handleTagInputChange(photo.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.target.value && handleAddTag(photo.id, e.target.value)}
                        list="all-tags-list" disabled={tagLoading[photo.id]} />
                      <button onClick={() => tagInputs[photo.id] && handleAddTag(photo.id, tagInputs[photo.id])}
                        className="add-tag-button" disabled={tagLoading[photo.id]}>
                        {tagLoading[photo.id] ? '...' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading && <p>No photos found.</p>}
        </>
      )}

      {currentView === 'albums' && (
        <>
          {!selectedAlbum ? (
            <>
              <div className="albums-header">
                <h2>My Albums</h2>
                <button onClick={() => setShowCreateAlbum(true)} className="create-album-btn">+ Create Album</button>
              </div>
              {error && <div className="status-message error-msg">{error}</div>}
              <div className="albums-grid">
                {albums.map(album => (
                  <div key={album.id} className="album-card">
                    <div className="album-cover" onClick={() => fetchAlbumDetails(album.id)}>
                      {album.cover_image?.thumbnail_path ? (
                        <img src={`${API_BASE_URL}/thumbnails/${album.cover_image.thumbnail_path}`} alt={album.name} />
                      ) : <div className="no-cover">📁</div>}
                    </div>
                    <div className="album-info">
                      <h3>{album.name}</h3>
                      <p>{album.photo_count} photo{album.photo_count !== 1 ? 's' : ''}</p>
                      {album.description && <p className="album-desc">{album.description}</p>}
                      <div className="album-actions">
                        <button onClick={() => { setEditAlbumData(album); setShowEditAlbum(true); }}>Edit</button>
                        <button onClick={() => {
                          setSelectedAlbum(album);
                          setShowExportModal(true);
                        }}>Export</button>
                        <button onClick={() => handleDeleteAlbum(album.id)} className="delete-btn">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="album-detail-header">
                <button onClick={() => { setSelectedAlbum(null); setAlbumPhotos([]); }}>← Back</button>
                <h2>{selectedAlbum.name}</h2>
                <p>{selectedAlbum.description}</p>
                <p className="photo-count">{albumPhotos.length} photos</p>
                <button onClick={() => setShowExportModal(true)} className="export-album-btn">Export Album</button>
              </div>
              {error && <div className="status-message error-msg">{error}</div>}
              <div className="photo-grid">
                {albumPhotos.map(albumPhoto => (
                  <div key={albumPhoto.image_id} className="photo-item">
                    {albumPhoto.image.thumbnail_path ? (
                      <img src={`${API_BASE_URL}/thumbnails/${albumPhoto.image.thumbnail_path}`}
                        alt={albumPhoto.image.original_filename || 'Photo'} />
                    ) : <div className="no-thumbnail">No Thumbnail</div>}
                    <div className="info">
                      <p><strong>File:</strong> {albumPhoto.image.original_filename || 'N/A'}</p>
                      <button className="remove-from-album-btn"
                        onClick={() => handleRemovePhotoFromAlbum(selectedAlbum.id, albumPhoto.image_id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {showCreateAlbum && (
        <div className="modal-overlay" onClick={() => setShowCreateAlbum(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create Album</h3>
            <input type="text" placeholder="Album Name" value={newAlbumName} 
              onChange={e => setNewAlbumName(e.target.value)} />
            <textarea placeholder="Description" value={newAlbumDescription} 
              onChange={e => setNewAlbumDescription(e.target.value)} />
            <div className="modal-actions">
              <button onClick={handleCreateAlbum}>Create</button>
              <button onClick={() => setShowCreateAlbum(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showEditAlbum && editAlbumData && (
        <div className="modal-overlay" onClick={() => setShowEditAlbum(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Album</h3>
            <input type="text" placeholder="Album Name" value={editAlbumData.name} 
              onChange={e => setEditAlbumData({...editAlbumData, name: e.target.value})} />
            <textarea placeholder="Description" value={editAlbumData.description || ''} 
              onChange={e => setEditAlbumData({...editAlbumData, description: e.target.value})} />
            <div className="modal-actions">
              <button onClick={handleUpdateAlbum}>Update</button>
              <button onClick={() => setShowEditAlbum(false)}>Cancel</button>
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
                <button key={album.id} className="album-list-item" onClick={() => handleAddPhotosToAlbum(album.id)}>
                  {album.name} ({album.photo_count} photos)
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowAddToAlbumModal(false)}>Cancel</button>
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
                Format:
                <select value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
                  <option value="zip">ZIP Archive</option>
                  <option value="folder">Folder</option>
                </select>
              </label>
              <label>
                Quality:
                <select value={exportQuality} onChange={e => setExportQuality(e.target.value)}>
                  <option value="original">Original</option>
                  <option value="high">High (1920x1080)</option>
                  <option value="medium">Medium (1280x720)</option>
                  <option value="low">Low (640x480)</option>
                </select>
              </label>
              <p>
                {selectedAlbum 
                  ? `Exporting album: ${selectedAlbum.name} (${selectedAlbum.photo_count} photos)`
                  : `Exporting ${selectedPhotoIds.length} selected photo(s)`}
              </p>
            </div>
            <div className="modal-actions">
              <button onClick={handleExport}>Export</button>
              <button onClick={() => setShowExportModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {allTags.length > 0 && (
        <datalist id="all-tags-list">
          {allTags.map(tag => <option key={tag.id} value={tag.name} />)}
        </datalist>
      )}
    </div>
  );
}

export default App;