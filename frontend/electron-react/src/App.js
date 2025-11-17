import React, { useState, useEffect, useCallback, useMemo } from 'react'; 
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Debounce utility function
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function App() {
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [sortBy, setSortBy] = useState('capture_date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination state
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

  // Loading states for individual operations
  const [ratingLoading, setRatingLoading] = useState({});
  const [tagLoading, setTagLoading] = useState({});

  // Debounce filter inputs
  const debouncedTagNames = useDebounce(filterTagNames, 500);

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
      } catch (e) { 
        console.error("Invalid start date format"); 
      }
    }
    if (filterDateEnd) {
      try {
        const endDate = new Date(filterDateEnd);
        endDate.setHours(23, 59, 59, 999); 
        params.date_end = endDate.toISOString();
      } catch (e) { 
        console.error("Invalid end date format"); 
      }
    }
    if (filterCameraModels.length > 0) {
      params.camera_models = filterCameraModels;
    }
    
    const trimmedTagNames = debouncedTagNames.trim();
    if (trimmedTagNames) {
      params.tag_names = trimmedTagNames.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    
    if (filterRatingMin > 0 && filterRatingMin <= 5) {
      params.rating_min = filterRatingMin;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/photos/`, { params });
      
      // Handle paginated response
      if (response.data.items) {
        setPhotos(response.data.items);
        setTotalPages(response.data.meta.total_pages);
        setTotalItems(response.data.meta.total_items);
      } else {
        // Fallback for non-paginated response (backward compatibility)
        setPhotos(response.data);
      }

      // Extract unique camera models for filter
      if (response.data.items && response.data.items.length > 0) {
        const uniqueCameras = [...new Set(
          response.data.items
            .map(p => p.camera_model)
            .filter(Boolean)
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
  }, [
    currentPage, 
    pageSize, 
    sortBy, 
    sortOrder, 
    filterDateStart, 
    filterDateEnd, 
    filterCameraModels, 
    debouncedTagNames, 
    filterRatingMin
  ]); 

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
    fetchPhotos();
  }, [fetchPhotos]); 

  useEffect(() => {
    fetchAllTags();
  }, []); // Only fetch tags once on mount

  const handleSelectFolder = async () => {
    if (window.electronAPI && window.electronAPI.openDirectoryDialog) {
      try {
        const folderPath = await window.electronAPI.openDirectoryDialog();
        if (folderPath) {
          setIsLoading(true);
          setError(null);
          setScanStatus('Scanning folder and processing images... AI tagging runs in background.');
          try {
            const response = await axios.post(
              `${API_BASE_URL}/api/photos/scan-folder`, 
              { folder_path: folderPath }
            );
            setScanStatus(
              `Scan complete: ${response.data.new_images_added} new images added. ` +
              `${response.data.total_images_processed} files processed. ` +
              `AI tagging in progress. ${response.data.errors.length > 0 ? `Errors: ${response.data.errors.length}` : ''}`
            );
            // Reset to first page and refresh
            setCurrentPage(1);
            fetchPhotos(); 
            fetchAllTags(); 
          } catch (err) {
            const errorDetail = err.response?.data?.detail || err.message;
            setError(`Failed to scan folder: ${errorDetail}`);
            setScanStatus(null);
          } finally {
            setIsLoading(false);
          }
        }
      } catch (err) {
        setError('Could not open folder dialog.');
      }
    } else {
      setError('Folder selection is not available.');
    }
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1); // Reset to first page on sort change
  };

  const handleOrderChange = (e) => {
    setSortOrder(e.target.value);
    setCurrentPage(1); // Reset to first page on order change
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) { 
      return 'Invalid Date'; 
    }
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
      console.error(`Error adding tag to photo ${photoId}:`, err);
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
      console.error(`Error removing tag ${tagId} from photo ${photoId}:`, err);
      setError(`Failed to remove tag: ${err.response?.data?.detail || err.message}`);
    } finally {
      setTagLoading(prev => ({ ...prev, [`${photoId}-${tagId}`]: false }));
    }
  };

  // Cleanup tag inputs for unmounted photos
  useEffect(() => {
    const photoIds = new Set(photos.map(p => p.id));
    setTagInputs(prev => {
      const cleaned = {};
      Object.keys(prev).forEach(id => {
        if (photoIds.has(parseInt(id))) {
          cleaned[id] = prev[id];
        }
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
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleFilterChange = () => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Smart Photo Organizer</h1>
      </header>

      <div className="controls">
        <button onClick={handleSelectFolder} disabled={isLoading}>
          {isLoading && scanStatus ? 'Processing...' : 'Select Photo Folder to Scan'}
        </button>
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

      {/* Filter Controls UI */}
      <div className="filter-controls">
        <h4>Filters:</h4>
        <div className="filter-row">
          <label htmlFor="date-start">Date Start: </label>
          <input 
            id="date-start" 
            type="date" 
            value={filterDateStart} 
            onChange={e => {
              setFilterDateStart(e.target.value);
              handleFilterChange();
            }} 
          />
          <label htmlFor="date-end" style={{marginLeft: "10px"}}> Date End: </label>
          <input 
            id="date-end" 
            type="date" 
            value={filterDateEnd} 
            onChange={e => {
              setFilterDateEnd(e.target.value);
              handleFilterChange();
            }} 
          />
        </div>
        <div className="filter-row">
          <label htmlFor="min-rating">Min Rating: </label>
          <select 
            id="min-rating" 
            value={filterRatingMin} 
            onChange={e => {
              setFilterRatingMin(parseInt(e.target.value, 10));
              handleFilterChange();
            }}
          >
            {[0, 1, 2, 3, 4, 5].map(r => (
              <option key={r} value={r}>
                {r === 0 ? 'Any' : `${r}+ Stars`}
              </option>
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
          <small style={{marginLeft: '10px', color: '#666'}}>
            (Debounced - updates after you stop typing)
          </small>
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
      
      {scanStatus && (
        <div className={`status-message ${error && !isLoading ? 'error-msg' : 'success'}`}>
          {scanStatus}
        </div>
      )}
      {error && !scanStatus && <div className="status-message error-msg">{error}</div>}
      
      {isLoading && !photos.length && <p className="loading">Loading photos...</p>}
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
            onClick={() => handlePageChange(currentPage - 1)} 
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages} ({totalItems} total photos)
          </span>
          <button 
            onClick={() => handlePageChange(currentPage + 1)} 
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
      
      {photos.length > 0 ? (
        <div className="photo-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-item">
              {photo.thumbnail_path ? (
                <img 
                  src={`${API_BASE_URL}/thumbnails/${photo.thumbnail_path}`} 
                  alt={photo.original_filename || 'Photo'} 
                />
              ) : (
                <div className="no-thumbnail">No Thumbnail</div>
              )}
              <div className="info">
                <p title={photo.original_filename}>
                  <strong>File:</strong> {
                    photo.original_filename 
                      ? photo.original_filename.substring(0,20) + 
                        (photo.original_filename.length > 20 ? "..." : "") 
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
                        title={
                          tagInfo.is_ai_generated 
                            ? `AI Tag (Confidence: ${tagInfo.confidence?.toFixed(2) || 'N/A'})` 
                            : 'Manual Tag'
                        }
                      >
                        {tagInfo.name}
                        <button 
                          className="remove-tag-btn" 
                          onClick={() => handleRemoveTag(photo.id, tagInfo.id)}
                          title="Remove tag"
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
                      {allTags.map(tag => (
                        <option key={tag.id} value={tag.name} />
                      ))}
                    </datalist>
                  )}
                  <button 
                    onClick={() => {
                      const tagName = tagInputs[photo.id];
                      if (tagName) {
                        handleAddTag(photo.id, tagName);
                      }
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
        !isLoading && !error && (
          <p>No photos found. Try scanning a folder or check applied filters.</p>
        )
      )}

      {/* Bottom Pagination Controls */}
      {totalPages > 1 && photos.length > 0 && (
        <div className="pagination-controls">
          <button 
            onClick={() => handlePageChange(currentPage - 1)} 
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            onClick={() => handlePageChange(currentPage + 1)} 
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default App;