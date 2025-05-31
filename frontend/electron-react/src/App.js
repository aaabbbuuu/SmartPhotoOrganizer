import React, { useState, useEffect, useCallback } from 'react'; 
import axios from 'axios'; // Correct import
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000'; // Backend URL

// Define a type for Tag (matching backend schema)
// interface Tag { // Using JSDoc for type hinting in JS
//   id: number;
//   name: string;
// }

// Define a type for Image (matching backend schema)
// interface Photo {
//   id: number;
//   file_path: string;
//   original_filename?: string;
//   capture_date?: string; // Dates will be strings from JSON
//   camera_model?: string;
//   thumbnail_path?: string;
//   date_added: string;
//   associated_tags: Tag[]; // Updated to use Tag interface
// }

function App() {
  const [photos, setPhotos] = useState([]); // No explicit type in JS, but treat as Photo[]
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [sortBy, setSortBy] = useState('capture_date');
  const [sortOrder, setSortOrder] = useState('desc');

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

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

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
            // AI tagging is background, so success here means scan started
            setScanStatus(`Scan initiated: ${response.data.new_images_added} new images queued. ${response.data.total_images_processed} processed. AI tagging runs in background. Errors: ${response.data.errors.length}. Refresh to see tags.`);
            // Fetch photos immediately to show new images without tags yet.
            // Tags will appear on subsequent fetches or refresh.
            fetchPhotos(); 
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
      
      {scanStatus && <div className={`status-message ${error ? 'error-msg' : 'success'}`}>{scanStatus}</div>}
      {error && !scanStatus && <div className="status-message error-msg">{error}</div>} {/* Show general errors if no scanStatus */}
      
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
                {photo.associated_tags && photo.associated_tags.length > 0 && (
                  <p className="tags">
                    <strong>Tags: </strong>
                    {photo.associated_tags.map(tag => tag.name).join(', ')}
                  </p>
                )}
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