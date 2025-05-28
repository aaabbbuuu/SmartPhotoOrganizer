import React, { useState, useEffect, useCallback } from 'react'; 
import axios from 'axios'; // Correct import
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000'; // Backend URL

function App() {
  const [photos, setPhotos] = useState([]);
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
          limit: 200 // Fetch more for initial view, implement pagination later
        }
      });
      setPhotos(response.data);
    } catch (err) {
      console.error("Error fetching photos:", err);
      setError(`Failed to load photos. Ensure the backend is running. (${err.message})`);
      setPhotos([]); // Clear photos on error
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, sortOrder]); // Dependencies for useCallback

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]); // fetchPhotos is now stable due to useCallback

  const handleSelectFolder = async () => {
    if (window.electronAPI && window.electronAPI.openDirectoryDialog) {
      try {
        const folderPath = await window.electronAPI.openDirectoryDialog();
        if (folderPath) {
          console.log('Selected folder:', folderPath);
          setIsLoading(true);
          setError(null);
          setScanStatus(null);
          try {
            const response = await axios.post(`${API_BASE_URL}/api/photos/scan-folder`, {
              folder_path: folderPath,
            });
            setScanStatus(`Scan complete: ${response.data.new_images_added} new images added. ${response.data.total_images_processed} processed. Errors: ${response.data.errors.length}`);
            fetchPhotos(); // Refresh photo list
          } catch (err) {
            console.error("Error scanning folder:", err);
            const errorDetail = err.response?.data?.detail || err.message;
            setError(`Failed to scan folder: ${errorDetail}`);
            setScanStatus(null);
          } finally {
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Error in openDirectoryDialog:', err);
        setError('Could not open folder dialog.');
      }
    } else {
      setError('Folder selection is not available in this environment (web browser or electronAPI not loaded).');
      console.warn("electronAPI or openDirectoryDialog not found on window object.");
    }
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  const handleOrderChange = (e) => {
    setSortOrder(e.target.value);
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>Smart Photo Organizer</h1>
      </header>

      <div className="controls">
        <button onClick={handleSelectFolder} disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Select Photo Folder to Scan'}
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
      
      {scanStatus && <div className="status-message success">{scanStatus}</div>}
      {error && <div className="status-message error-msg">{error}</div>}
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
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isLoading && !error && <p>No photos found. Try scanning a folder.</p>
      )}
    </div>
  );
}

export default App;