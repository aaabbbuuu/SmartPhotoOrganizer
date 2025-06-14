// --- START OF FILE App.js ---
import React, { useState, useEffect, useCallback } from 'react'; 
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// JSDoc type hints for better readability (optional but helpful)
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
  
  /** @type {[{id: number, name: string}[], React.Dispatch<React.SetStateAction<{id: number, name: string}[]>>]} */
  const [allTags, setAllTags] = useState([]); // For autocomplete later

  // State to manage the input for adding a new tag for each photo
  // This is a simple way; for many photos, a more complex state management might be better
  const [tagInputs, setTagInputs] = useState({}); // e.g., { photoId1: "new tag text", photoId2: "" }

  const handleTagInputChange = (photoId, value) => {
    setTagInputs(prev => ({ ...prev, [photoId]: value }));
  };

  const fetchPhotos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/photos/`, {
        params: {
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: 200 
        }
      });
      setPhotos(response.data);
    } catch (err) {
      console.error("Error fetching photos:", err);
      setError(`Failed to load photos. (${err.message})`);
      setPhotos([]);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, sortOrder]);

  const fetchAllTags = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tags/`);
      setAllTags(response.data);
    } catch (err) {
      console.error("Failed to fetch all tags:", err);
      // Not setting a global error for this, as it's for autocomplete
    }
  }, []);


  useEffect(() => {
    fetchPhotos();
    fetchAllTags(); // Fetch all tags on initial load and when fetchPhotos dependencies change (or could be separate)
  }, [fetchPhotos, fetchAllTags]); // Added fetchAllTags

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
            fetchAllTags(); // Re-fetch all tags in case new ones were created by AI
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
    // Consider setting a specific loading state for the item being tagged
    // For now, using global isLoading might make the whole UI feel slow.
    // Let's avoid global isLoading for add/remove tag for better UX.
    // setIsLoading(true); 
    try {
      await axios.post(`${API_BASE_URL}/api/photos/images/${photoId}/tags`, {
        tag_name: trimmedTagName
      });
      fetchPhotos(); // Re-fetch photos to show updated tags
      fetchAllTags(); // Re-fetch all tags in case a new one was created
      setTagInputs(prev => ({ ...prev, [photoId]: '' })); // Clear input for this photo
    } catch (err) {
      console.error(`Error adding tag to photo ${photoId}:`, err);
      setError(`Failed to add tag: ${err.response?.data?.detail || err.message}`);
    } finally {
      // setIsLoading(false);
    }
  };

  const handleRemoveTag = async (photoId, tagId) => {
    // setIsLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/photos/images/${photoId}/tags/${tagId}`);
      fetchPhotos(); // Re-fetch photos
      fetchAllTags(); // Re-fetch if a tag might become orphaned and deleted (though our backend doesn't do this yet)
    } catch (err) {
      console.error(`Error removing tag ${tagId} from photo ${photoId}:`, err);
      setError(`Failed to remove tag: ${err.response?.data?.detail || err.message}`);
    } finally {
      // setIsLoading(false);
    }
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
          </select>
          <label htmlFor="sort-order" style={{marginLeft: "10px"}}>Order: </label>
          <select id="sort-order" value={sortOrder} onChange={handleOrderChange} disabled={isLoading}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
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
                
                {/* Display Tags */}
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

                {/* Add Tag Section */}
                <div className="add-tag-section">
                  <input 
                    type="text" 
                    placeholder="Add tag..."
                    value={tagInputs[photo.id] || ''}
                    onChange={(e) => handleTagInputChange(photo.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value) {
                        handleAddTag(photo.id, e.target.value);
                        // Input is cleared by handleAddTag via setTagInputs
                      }
                    }}
                    list="all-tags-list" // For datalist autocomplete
                  />
                  {/* Datalist for basic autocomplete */}
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
                    className="add-tag-button" // Simple button, style as needed
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
// --- END OF FILE App.js ---