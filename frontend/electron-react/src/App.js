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
  // View state
  const [currentView, setCurrentView] = useState('photos'); // 'photos' or 'albums'
  
  // Photos state
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

  // Filter States
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

  // Albums state
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumPhotos, setAlbumPhotos] = useState([]);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showEditAlbum, setShowEditAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const [editAlbumData, setEditAlbumData] = useState(null);
  
  // Selection state for adding to albums
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);

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
      try {
        params.date_start = new Date(filterDateStart).toISOString();
      } catch (e) { console.error("Invalid start date format"); }
    }
    if (filterDateEnd) {
      try {
        const endDate = new Date(filterDateEnd);
        endDate.setHours(23, 59, 59, 999); 
        params.date_end = endDate.toISOString();
      } catch (e) { console.error("Invalid end date format"); }
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
        const uniqueCameras = [...new Set(
          response.data.items.map(p => p.camera_model).filter(Boolean)
        )];
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
      setError("Failed to load albums");
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
      const response = await axios.post(
        `${API_BASE_URL}/api/photos/images/${photoId}/rate`, 
        { rating: newRating }
      );
      setPhotos(prevPhotos => 
        prevPhotos.map(p => p.id === photoId ? response.data : p)
      );
      setError(null); 
    } catch (err) {
      console.error(`Error rating photo ${photoId}:`, err);
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
    if (currentView === 'photos') {
      fetchPhotos();
    } else {
      fetchAlbums();
    }
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
          setScanStatus('Scanning folder... AI tagging runs in background.');
          try {
            const response = await axios.post(
              `${API_BASE_URL}/api/photos/scan-folder`, 
              { folder_path: folderPath }
            );
            setScanStatus(
              `Scan complete: ${response.data.new_images_added} new images added.`
            );
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

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  const handleOrderChange = (e) => {
    setSortOrder(e.target.value);
    setCurrentPage(1);
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) { return 'Invalid Date'; }
  };

  const handleAddTag = async (photoId, tagName) => {
    const trimmedTagName = tagName.trim();
    if (!trimmedTagName) return;
    
    setTagLoading(prev => ({ ...prev, [photoId]: true }));
    try {
      await axios.post(
        `${API_BASE_URL}/api/photos/images/${photoId}/tags`, 
        { tag_name: trimmedTagName }
      );
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
      await axios.post(`${API_BASE_URL}/api/albums/`, {
        name: newAlbumName,
        description: newAlbumDescription
      });
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
    if (!window.confirm("Are you sure you want to delete this album?")) return;

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
      await axios.post(`${API_BASE_URL}/api/albums/${albumId}/photos`, {
        image_ids: selectedPhotoIds
      });
      setSelectedPhotoIds([]);
      setSelectionMode(false);
      setShowAddToAlbumModal(false);
      fetchAlbums();
      if (selectedAlbum && selectedAlbum.id === albumId) {
        fetchAlbumDetails(albumId);
      }
      setError(null);
    } catch (err) {
      setError(`Failed to add photos: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleRemovePhotoFromAlbum = async (albumId, photoId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/albums/${albumId}/photos`, {
        data: { image_ids: [photoId] }
      });
      fetchAlbumDetails(albumId);
      fetchAlbums();
      setError(null);
    } catch (err) {
      setError(`Failed to remove photo: ${err.response?.data?.detail || err.message}`);
    }
  };

  const togglePhotoSelection = (photoId) => {
    setSelectedPhotoIds(prev => 
      prev.includes(photoId) 
        ? prev.filter(id => id !== photoId)
        : [...prev, photoId]
    );
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

  const handleFilterChange = () => setCurrentPage(1);

  return (
    <div className="App">
      <header className="app-header">
        <h1>Smart Photo Organizer</h1>
        <div className="view-switcher">
          <button 
            className={currentView === 'photos' ? 'active' : ''}
            onClick={() => setCurrentView('photos')}
          >
            📸 Photos
          </button>
          <button 
            className={currentView === 'albums' ? 'active' : ''}
            onClick={() => setCurrentView('albums')}
          >
            📁 Albums
          </button>
        </div>
      </header>

      {/* Photos View */}
      {currentView === 'photos' && (
        <>
          <div className="controls">
            <button onClick={handleSelectFolder} disabled={isLoading}>
              {isLoading && scanStatus ? 'Processing...' : 'Select Photo Folder to Scan'}
            </button>
            <button 
              onClick={() => setSelectionMode(!selectionMode)}
              className={selectionMode ? 'active' : ''}
            >
              {selectionMode ? '✓ Selection Mode' : 'Select Photos'}
            </button>
            {selectionMode && selectedPhotoIds.length > 0 && (
              <button onClick={() => setShowAddToAlbumModal(true)}>
                Add {selectedPhotoIds.length} to Album
              </button>
            )}
            <div>
              <label htmlFor="sort-by">Sort By: </label>
              <select id="sort-by" value={sortBy} onChange={handleSortChange} disabled={isLoading}>
                <option value="capture_date">Capture Date</option>
                <option value="date_added">Date Added</option>
                <option value="original_filename">Filename</option>
                <option value="camera_model">Camera Model</option>
                <option value="rating">Rating</option>
              </select>
              <label htmlFor="sort-order" style={{marginLeft: "10px"}}>Order: </label>
              <select id="sort-order" value={sortOrder} onChange={handleOrderChange} disabled={isLoading}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          <div className="filter-controls">
            <h4>Filters:</h4>
            <div className="filter-row">
              <label htmlFor="date-start">Date Start: </label>
              <input 
                id="date-start" 
                type="date" 
                value={filterDateStart} 
                onChange={e => { setFilterDateStart(e.target.value); handleFilterChange(); }} 
              />
              <label htmlFor="date-end" style={{marginLeft: "10px"}}> Date End: </label>
              <input 
                id="date-end" 
                type="date" 
                value={filterDateEnd} 
                onChange={e => { setFilterDateEnd(e.target.value); handleFilterChange(); }} 
              />
            </div>
            <div className="filter-row">
              <label htmlFor="min-rating">Min Rating: </label>
              <select 
                id="min-rating" 
                value={filterRatingMin} 
                onChange={e => { setFilterRatingMin(parseInt(e.target.value, 10)); handleFilterChange(); }}
              >
                {[0, 1, 2, 3, 4, 5].map(r => (
                  <option key={r} value={r}>{r === 0 ? 'Any' : `${r}+ Stars`}</option>
                ))}
              </select>
            </div>
            <div className="filter-row">
              <label htmlFor="filter-tags">Tags (comma-sep): </label>
              <input 
                id="filter-tags"
                type="text" 
                placeholder="e.g., beach, person" 
                value={filterTagNames} 
                onChange={e => setFilterTagNames(e.target.value)}
                list="all-tags-list" 
              />
            </div>
            {availableCameraModels.length > 0 && (
              <div className="filter-row">
                <label>Camera Model(s): </label>
                <div className="checkbox-group">
                  {availableCameraModels.map(model => (
                    <label key={model} className="checkbox-label">
                      <input 
                        type="checkbox" 
                        value={model}
                        checked={filterCameraModels.includes(model)}
                        onChange={e => {
                          const { value, checked } = e.target;
                          setFilterCameraModels(prev => 
                            checked ? [...prev, value] : prev.filter(m => m !== value)
                          );
                          handleFilterChange();
                        }}
                      /> {model}
                    </label>
                  ))}
                </div>
              </div>
            )}        
          </div>
          
          {scanStatus && <div className="status-message success">{scanStatus}</div>}
          {error && <div className="status-message error-msg">{error}</div>}
          
          {isLoading && !photos.length && <p className="loading">Loading photos...</p>}
          
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                Previous
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages} ({totalItems} total photos)
              </span>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                Next
              </button>
            </div>
          )}
          
          {photos.length > 0 ? (
            <div className="photo-grid">
              {photos.map((photo) => (
                <div key={photo.id} className={`photo-item ${selectedPhotoIds.includes(photo.id) ? 'selected' : ''}`}>
                  {selectionMode && (
                    <div className="selection-checkbox">
                      <input 
                        type="checkbox"
                        checked={selectedPhotoIds.includes(photo.id)}
                        onChange={() => togglePhotoSelection(photo.id)}
                      />
                    </div>
                  )}
                  {photo.thumbnail_path ? (
                    <img 
                      src={`${API_BASE_URL}/thumbnails/${photo.thumbnail_path}`} 
                      alt={photo.original_filename || 'Photo'} 
                      onClick={() => selectionMode && togglePhotoSelection(photo.id)}
                      style={{ cursor: selectionMode ? 'pointer' : 'default' }}
                    />
                  ) : (
                    <div className="no-thumbnail">No Thumbnail</div>
                  )}
                  <div className="info">
                    <p title={photo.original_filename}>
                      <strong>File:</strong> {
                        photo.original_filename 
                          ? photo.original_filename.substring(0,20) + (photo.original_filename.length > 20 ? "..." : "") 
                          : 'N/A'
                      }
                    </p>
                    <p><strong>Date:</strong> {formatDate(photo.capture_date)}</p>
                    <p><strong>Camera:</strong> {photo.camera_model || 'N/A'}</p>
                    
                    <StarRating 
                      photoId={photo.id} 
                      rating={photo.rating || 0} 
                      onRate={handleRatePhoto} 
                      isLoading={ratingLoading[photo.id]}
                    />
                    
                    {photo.associated_tags && photo.associated_tags.length > 0 && (
                      <div className="tags-display">
                        <strong>Tags: </strong>
                        {photo.associated_tags.map(tagInfo => (
                          <span 
                            key={tagInfo.id} 
                            className={`tag-chip ${tagInfo.is_ai_generated ? 'ai-tag' : 'manual-tag'}`}
                            title={tagInfo.is_ai_generated ? `AI Tag (${tagInfo.confidence?.toFixed(2)})` : 'Manual Tag'}
                          >
                            {tagInfo.name}
                            <button 
                              className="remove-tag-btn" 
                              onClick={() => handleRemoveTag(photo.id, tagInfo.id)}
                              disabled={tagLoading[`${photo.id}-${tagInfo.id}`]}
                            >
                              {tagLoading[`${photo.id}-${tagInfo.id}`] ? '...' : '×'}
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="add-tag-section">
                      <input 
                        type="text" 
                        placeholder="Add tag..."
                        value={tagInputs[photo.id] || ''}
                        onChange={(e) => handleTagInputChange(photo.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value) {
                            handleAddTag(photo.id, e.target.value);
                          }
                        }}
                        list="all-tags-list"
                        disabled={tagLoading[photo.id]}
                      />
                      {allTags.length > 0 && (
                        <datalist id="all-tags-list">
                          {allTags.map(tag => <option key={tag.id} value={tag.name} />)}
                        </datalist>
                      )}
                      <button 
                        onClick={() => {
                          const tagName = tagInputs[photo.id];
                          if (tagName) handleAddTag(photo.id, tagName);
                        }}
                        className="add-tag-button"
                        disabled={tagLoading[photo.id]}
                      >
                        {tagLoading[photo.id] ? '...' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !isLoading && <p>No photos found.</p>
          )}

          {totalPages > 1 && photos.length > 0 && (
            <div className="pagination-controls">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                Previous
              </button>
              <span className="page-info">Page {currentPage} of {totalPages}</span>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Albums View */}
      {currentView === 'albums' && (
        <>
          {!selectedAlbum ? (
            <>
              <div className="albums-header">
                <h2>My Albums</h2>
                <button onClick={() => setShowCreateAlbum(true)} className="create-album-btn">
                  + Create Album
                </button>
              </div>

              {error && <div className="status-message error-msg">{error}</div>}

              <div className="albums-grid">
                {albums.map(album => (
                  <div key={album.id} className="album-card">
                    <div 
                      className="album-cover"
                      onClick={() => fetchAlbumDetails(album.id)}
                    >
                      {album.cover_image && album.cover_image.thumbnail_path ? (
                        <img 
                          src={`${API_BASE_URL}/thumbnails/${album.cover_image.thumbnail_path}`}
                          alt={album.name}
                        />
                      ) : (
                        <div className="no-cover">📁</div>
                      )}
                    </div>
                    <div className="album-info">
                      <h3>{album.name}</h3>
                      <p>{album.photo_count} photo{album.photo_count !== 1 ? 's' : ''}</p>
                      {album.description && <p className="album-desc">{album.description}</p>}
                      <div className="album-actions">
                        <button onClick={() => {
                          setEditAlbumData(album);
                          setShowEditAlbum(true);
                        }}>Edit</button>
                        <button onClick={() => handleDeleteAlbum(album.id)} className="delete-btn">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="album-detail-header">
                <button onClick={() => { setSelectedAlbum(null); setAlbumPhotos([]); }}>
                  ← Back to Albums
                </button>
                <h2>{selectedAlbum.name}</h2>
                <p>{selectedAlbum.description}</p>
                <p className="photo-count">{albumPhotos.length} photos</p>
              </div>

              {error && <div className="status-message error-msg">{error}</div>}

              <div className="photo-grid">
                {albumPhotos.map(albumPhoto => (
                  <div key={albumPhoto.image_id} className="photo-item">
                    {albumPhoto.image.thumbnail_path ? (
                      <img 
                        src={`${API_BASE_URL}/thumbnails/${albumPhoto.image.thumbnail_path}`}
                        alt={albumPhoto.image.original_filename || 'Photo'}
                      />
                    ) : (
                      <div className="no-thumbnail">No Thumbnail</div>
                    )}
                    <div className="info">
                      <p><strong>File:</strong> {albumPhoto.image.original_filename || 'N/A'}</p>
                      <button 
                        className="remove-from-album-btn"
                        onClick={() => handleRemovePhotoFromAlbum(selectedAlbum.id, albumPhoto.image_id)}
                      >
                        Remove from Album
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Create Album Modal */}
      {showCreateAlbum && (
        <div className="modal-overlay" onClick={() => setShowCreateAlbum(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create New Album</h3>
            <input 
              type="text"
              placeholder="Album Name"
              value={newAlbumName}
              onChange={e => setNewAlbumName(e.target.value)}
            />
            <textarea 
              placeholder="Description (optional)"
              value={newAlbumDescription}
              onChange={e => setNewAlbumDescription(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={handleCreateAlbum}>Create</button>
              <button onClick={() => setShowCreateAlbum(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Album Modal */}
      {showEditAlbum && editAlbumData && (
        <div className="modal-overlay" onClick={() => setShowEditAlbum(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Edit Album</h3>
            <input 
              type="text"
              placeholder="Album Name"
              value={editAlbumData.name}
              onChange={e => setEditAlbumData({...editAlbumData, name: e.target.value})}
            />
            <textarea 
              placeholder="Description (optional)"
              value={editAlbumData.description || ''}
              onChange={e => setEditAlbumData({...editAlbumData, description: e.target.value})}
            />
            <div className="modal-actions">
              <button onClick={handleUpdateAlbum}>Update</button>
              <button onClick={() => setShowEditAlbum(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Album Modal */}
      {showAddToAlbumModal && (
        <div className="modal-overlay" onClick={() => setShowAddToAlbumModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add {selectedPhotoIds.length} Photos to Album</h3>
            <div className="album-list">
              {albums.map(album => (
                <button 
                  key={album.id}
                  className="album-list-item"
                  onClick={() => handleAddPhotosToAlbum(album.id)}
                >
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
    </div>
  );
}

export default App;