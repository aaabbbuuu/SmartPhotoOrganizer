// --- START OF FILE App.js ---
import React, { useState, useEffect, useCallback } from 'react'; 
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * @typedef {object} TagInfo
 * @property {number} id
 * @property {string} name
 * @property {boolean} is_ai_generated
 * @property {number|null} [confidence]
 */

/**
 * @typedef {object} Photo
 * @property {number} id
 * @property {string} file_path
 * @property {string|null} [original_filename]
 * @property {string|null} [capture_date]
 * @property {string|null} [camera_model]
 * @property {string|null} [thumbnail_path]
 * @property {string} date_added
 * @property {number} rating
 * @property {TagInfo[]} associated_tags
 */

function App() {
  /** @type {[Photo[], React.Dispatch<React.SetStateAction<Photo[]>>]} */
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [sortBy, setSortBy] = useState('capture_date');
  const [sortOrder, setSortOrder] = useState('desc');

  // --- Filter States ---
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');  
  const [filterCameraModels, setFilterCameraModels] = useState([]);
  const [availableCameraModels, setAvailableCameraModels] = useState([]);
  const [filterTagNames, setFilterTagNames] = useState(''); 
  const [filterRatingMin, setFilterRatingMin] = useState(0); 
  
  /** @type {[{id: number, name: string}[], React.Dispatch<React.SetStateAction<{id: number, name: string}[]>>]} */
  const [allTags, setAllTags] = useState([]);
  const [tagInputs, setTagInputs] = useState({}); 

  const handleTagInputChange = (photoId, value) => {
    setTagInputs(prev => ({ ...prev, [photoId]: value }));
  };

  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const params = {
      sort_by: sortBy,
      sort_order: sortOrder,
      limit: 200, // Or a smaller number + pagination later
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
    const trimmedTagNames = filterTagNames.trim();
    if (trimmedTagNames) {
        params.tag_names = trimmedTagNames.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    if (filterRatingMin > 0 && filterRatingMin <=5) params.rating_min = filterRatingMin;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/photos/`, { params });
      setPhotos(response.data);

      if (response.data.length > 0) {
          const uniqueCameras = [...new Set(response.data.map(p => p.camera_model).filter(Boolean))];
          if (uniqueCameras.length !== availableCameraModels.length || !uniqueCameras.every(cam => availableCameraModels.includes(cam))) {
            setAvailableCameraModels(uniqueCameras.sort());
          }
      } else if (Object.keys(params).length === 3) { 
          setAvailableCameraModels([]); 
      }

    } catch (err) {
      console.error("Error fetching photos:", err);
      setError(`Failed to load photos. (${err.response?.data?.detail || err.message})`);
      setPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, sortOrder, filterDateStart, filterDateEnd, filterCameraModels, filterTagNames, filterRatingMin, availableCameraModels]); 

  const handleRatePhoto = async (photoId, newRating) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/photos/images/${photoId}/rate`, {
        rating: newRating
      });
      setPhotos(prevPhotos => 
        prevPhotos.map(p => p.id === photoId ? response.data : p)
      );
      setError(null); 
    } catch (err) {
      console.error(`Error rating photo ${photoId}:`, err);
      setError(`Failed to rate photo: ${err.response?.data?.detail || err.message}`);
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
    fetchAllTags(); 
  }, [fetchPhotos, fetchAllTags]); 

  const handleSelectFolder = async () => {
    if (window.electronAPI && window.electronAPI.openDirectoryDialog) {
      try {
        const folderPath = await window.electronAPI.openDirectoryDialog();
        if (folderPath) {
          setIsLoading(true);
          setError(null);
          setScanStatus('Scanning folder and processing images... this may take a while for AI tagging.');
          try {
            const response = await axios.post(`${API_BASE_URL}/api/photos/scan-folder`, {
              folder_path: folderPath,
            });
            setScanStatus(`Scan initiated: ${response.data.new_images_added} new images queued. ${response.data.total_images_processed} processed. AI tagging runs in background. Errors: ${response.data.errors.length}. Refresh to see tags.`);
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

  const handleSortChange = (e) => setSortBy(e.target.value);
  const handleOrderChange = (e) => setSortOrder(e.target.value);
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) { return 'Invalid Date'; }
  };

  const handleAddTag = async (photoId, tagName) => {
    const trimmedTagName = tagName.trim();
    if (!trimmedTagName) return;
    try {
      await axios.post(`${API_BASE_URL}/api/photos/images/${photoId}/tags`, {
        tag_name: trimmedTagName
      });
      fetchPhotos(); 
      fetchAllTags(); 
      setTagInputs(prev => ({ ...prev, [photoId]: '' })); 
    } catch (err) {
      console.error(`Error adding tag to photo ${photoId}:`, err);
      setError(`Failed to add tag: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleRemoveTag = async (photoId, tagId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/photos/images/${photoId}/tags/${tagId}`);
      fetchPhotos(); 
      fetchAllTags(); 
    } catch (err) {
      console.error(`Error removing tag ${tagId} from photo ${photoId}:`, err);
      setError(`Failed to remove tag: ${err.response?.data?.detail || err.message}`);
    }
  };

  const StarRating = ({ rating, onRate, photoId }) => {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="star-rating">
      {stars.map((starValue) => (
        <span
          key={starValue}
          className={`star ${starValue <= rating ? 'filled' : ''}`}
          onClick={() => onRate(photoId, starValue)}
          title={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
        >          
          {starValue <= rating ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
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
            <option value="rating">Rating</option> {/* Added rating sort */}
          </select>
          <label htmlFor="sort-order" style={{marginLeft: "10px"}}>Order: </label>
          <select id="sort-order" value={sortOrder} onChange={handleOrderChange} disabled={isLoading}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* --- Filter Controls UI --- */}
      <div className="filter-controls">
        <h4>Filters:</h4>
        <div className="filter-row">
          <label htmlFor="date-start">Date Start: </label>
          <input id="date-start" type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} />
          <label htmlFor="date-end" style={{marginLeft: "10px"}}> Date End: </label>
          <input id="date-end" type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} />
        </div>
        <div className="filter-row">
          <label htmlFor="min-rating">Min Rating: </label>
          <select id="min-rating" value={filterRatingMin} onChange={e => setFilterRatingMin(parseInt(e.target.value, 10))}>
            {[0, 1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r === 0 ? 'Any' : `${r}+ Stars`}</option>)}
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
                    }}
                  /> {model}
                </label>
              ))}
            </div>
          </div>
        )}        
      </div>
      
      {scanStatus && <div className={`status-message ${error && !isLoading ? 'error-msg' : 'success'}`}>{scanStatus}</div>}
      {error && !scanStatus && <div className="status-message error-msg">{error}</div>}
      
      {isLoading && !photos.length && <p className="loading">Loading photos...</p>}
      
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
                <div style={{width: '100%', height: '150px', background: '#eee', display:'flex', alignItems:'center', justifyContent:'center'}}>No Thumbnail</div>
              )}
              <div className="info">
                <p title={photo.original_filename}><strong>File:</strong> {photo.original_filename ? photo.original_filename.substring(0,20) + (photo.original_filename.length > 20 ? "..." : "") : 'N/A'}</p>
                <p><strong>Date:</strong> {formatDate(photo.capture_date)}</p>
                <p><strong>Camera:</strong> {photo.camera_model || 'N/A'}</p>
                
                <StarRating 
                  photoId={photo.id} 
                  rating={photo.rating || 0} 
                  onRate={handleRatePhoto} 
                />
                
                {photo.associated_tags && photo.associated_tags.length > 0 && (
                  <div className="tags-display">
                    <strong>Tags: </strong>
                    {photo.associated_tags.map(tagInfo => (
                      <span 
                        key={tagInfo.id} 
                        className={`tag-chip ${tagInfo.is_ai_generated ? 'ai-tag' : 'manual-tag'}`}
                        title={tagInfo.is_ai_generated ? `AI Tag (Confidence: ${tagInfo.confidence?.toFixed(2) || 'N/A'})` : 'Manual Tag'}
                      >
                        {tagInfo.name}
                        <button 
                          className="remove-tag-btn" 
                          onClick={() => handleRemoveTag(photo.id, tagInfo.id)}
                          title="Remove tag"
                        >
                          ×
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
                  />
                  {allTags.length > 0 && (
                    <datalist id="all-tags-list">
                      {allTags.map(tag => <option key={tag.id} value={tag.name} />)}
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
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isLoading && !error && <p>No photos found. Try scanning a folder or check applied filters.</p>
      )}
    </div>
  );
}

export default App;