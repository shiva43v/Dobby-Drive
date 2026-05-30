import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { formatSize } from '../utils';

// Premium SVG Icons
const IconFolder = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#fbbf24' }}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const IconImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#60a5fa' }}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const IconLogout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const IconUpload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const IconCloud = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3b82f6' }}>
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
  </svg>
);

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folders, setFolders] = useState([]);
  const [images, setImages] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Storage Tracker State
  const [totalStorageUsed, setTotalStorageUsed] = useState(0);
  const STORAGE_LIMIT = 50 * 1024 * 1024; // 50 MB simulated user storage limit

  // Modal control states
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Form input states
  const [newFolderName, setNewFolderName] = useState('');
  const [imageName, setImageName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Fetch the drive contents
  const fetchContents = async (folderId) => {
    setLoading(true);
    setError('');
    try {
      const parentQuery = folderId || 'null';
      const response = await axios.get('/folders', {
        params: { parent: parentQuery },
      });

      if (response.data.success) {
        setFolders(response.data.data.folders);
        setImages(response.data.data.images);
        setBreadcrumbs(response.data.data.breadcrumbs || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load drive contents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch total storage usage (calculated by fetching root contents)
  const fetchTotalStorage = async () => {
    try {
      const response = await axios.get('/folders', {
        params: { parent: 'null' },
      });
      if (response.data.success) {
        const rootFolders = response.data.data.folders;
        const rootImages = response.data.data.images;

        const foldersSize = rootFolders.reduce((sum, f) => sum + (f.size || 0), 0);
        const imagesSize = rootImages.reduce((sum, img) => sum + (img.size || 0), 0);

        setTotalStorageUsed(foldersSize + imagesSize);
      }
    } catch (err) {
      console.error('Failed to fetch storage calculation:', err.message);
    }
  };

  useEffect(() => {
    fetchContents(currentFolderId);
    fetchTotalStorage();
  }, [currentFolderId]);

  // Handle folder double click navigation
  const handleFolderDoubleClick = (folderId) => {
    setCurrentFolderId(folderId);
  };

  // Handle breadcrumb click navigation
  const handleBreadcrumbClick = (folderId) => {
    setCurrentFolderId(folderId);
  };

  // Handle folder creation form submission
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setFormSubmitting(true);
    try {
      const response = await axios.post('/folders', {
        name: newFolderName,
        parent: currentFolderId,
      });

      if (response.data.success) {
        setNewFolderName('');
        setShowFolderModal(false);
        fetchContents(currentFolderId);
        fetchTotalStorage();
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to create folder.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle file select change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Auto-fill image name with file name (without extension) if empty
      if (!imageName) {
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setImageName(baseName);
      }
    }
  };

  // Handle image upload submission
  const handleUploadImage = async (e) => {
    e.preventDefault();
    if (!imageName.trim() || !selectedFile) return;

    setFormSubmitting(true);
    const formData = new FormData();
    formData.append('name', imageName);
    formData.append('image', selectedFile);
    if (currentFolderId) {
      formData.append('folder', currentFolderId);
    }

    try {
      const response = await axios.post('/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setImageName('');
        setSelectedFile(null);
        setShowUploadModal(false);
        fetchContents(currentFolderId);
        fetchTotalStorage();
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to upload image.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle folder delete
  const handleDeleteFolder = async (folderId, e) => {
    e.stopPropagation(); // Avoid navigating into folder on delete button click
    if (!confirm('Are you sure you want to delete this folder and all its contents recursively?')) return;

    try {
      const response = await axios.delete(`/folders/${folderId}`);
      if (response.data.success) {
        fetchContents(currentFolderId);
        fetchTotalStorage();
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to delete folder.');
    }
  };

  // Handle image delete
  const handleDeleteImage = async (imageId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      const response = await axios.delete(`/images/${imageId}`);
      if (response.data.success) {
        fetchContents(currentFolderId);
        fetchTotalStorage();
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to delete image.');
    }
  };

  // Calculate storage usage percentage
  const storagePercentage = Math.min((totalStorageUsed / STORAGE_LIMIT) * 100, 100);

  return (
    <div className="dashboard-container">
      {/* Sidebar for Desktop */}
      <aside className="sidebar glass-panel">
        <div>
          <div className="brand-section">
            <IconCloud />
            <span className="brand-logo glow-text">DobbyDrive</span>
          </div>

          <div className="user-profile">
            <span className="user-name">{user?.username}</span>
            <span className="user-email">{user?.email}</span>
          </div>
        </div>

        <div>
          <div className="storage-widget">
            <h4 className="storage-title">Storage Used</h4>
            <div className="storage-bar-bg">
              <div 
                className="storage-bar-fill" 
                style={{ width: `${storagePercentage}%` }}
              ></div>
            </div>
            <div className="storage-text">
              <span>{formatSize(totalStorageUsed)}</span>
              <span style={{ color: 'var(--text-muted)' }}>of {formatSize(STORAGE_LIMIT)}</span>
            </div>
          </div>

          <button 
            onClick={logout} 
            className="btn btn-secondary btn-danger" 
            style={{ width: '100%', marginTop: '24px', display: 'flex', gap: '8px' }}
          >
            <IconLogout />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Drive Area */}
      <main className="main-content">
        {/* Mobile Header section */}
        <div className="mobile-user-section glass-panel">
          <div className="brand-section" style={{ margin: 0 }}>
            <IconCloud />
            <span className="brand-logo glow-text" style={{ fontSize: '1.4rem' }}>DobbyDrive</span>
          </div>
          <button onClick={logout} className="action-btn" title="Logout">
            <IconLogout />
          </button>
        </div>

        {/* Drive Operations Header */}
        <header className="drive-header">
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : 'My Drive'}
            </h2>
          </div>

          <div className="drive-actions">
            <button 
              onClick={() => setShowFolderModal(true)} 
              className="btn btn-secondary"
            >
              <IconPlus />
              New Folder
            </button>
            <button 
              onClick={() => setShowUploadModal(true)} 
              className="btn btn-primary"
            >
              <IconUpload />
              Upload Image
            </button>
          </div>
        </header>

        {/* Dynamic Breadcrumbs */}
        <div className="breadcrumbs-bar">
          <span 
            className={`breadcrumb-item ${currentFolderId === null ? 'active' : ''}`}
            onClick={() => handleBreadcrumbClick(null)}
          >
            My Drive
          </span>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <span className="breadcrumb-separator">/</span>
              <span 
                className={`breadcrumb-item ${idx === breadcrumbs.length - 1 ? 'active' : ''}`}
                onClick={() => idx !== breadcrumbs.length - 1 && handleBreadcrumbClick(crumb.id)}
              >
                {crumb.name}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Directory View Area */}
        <div className="drive-view">
          {error && <div className="alert alert-error">{error}</div>}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
              <div style={{
                border: '4px solid rgba(255, 255, 255, 0.1)',
                borderTop: '4px solid var(--accent-blue)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                animation: 'spin 1s linear infinite'
              }}></div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <>
              {/* Folders Section */}
              <div className="section-container">
                <h3 className="section-title">
                  Folders 
                  <span className="item-count">({folders.length})</span>
                </h3>
                {folders.length > 0 ? (
                  <div className="folder-grid">
                    {folders.map((folder) => (
                      <div 
                        key={folder._id} 
                        className="folder-card glass-panel"
                        onDoubleClick={() => handleFolderDoubleClick(folder._id)}
                        title="Double click to open folder"
                      >
                        <div className="folder-info">
                          <div className="folder-icon">
                            <IconFolder />
                          </div>
                          <div className="folder-details">
                            <span className="folder-name">{folder.name}</span>
                            <span className="folder-size-text">{formatSize(folder.size)}</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteFolder(folder._id, e)} 
                          className="action-btn"
                          title="Delete folder"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No folders in this directory.</p>
                )}
              </div>

              {/* Images Section */}
              <div className="section-container">
                <h3 className="section-title">
                  Images 
                  <span className="item-count">({images.length})</span>
                </h3>
                {images.length > 0 ? (
                  <div className="image-grid">
                    {images.map((image) => (
                      <div 
                        key={image._id} 
                        className="image-card glass-panel"
                        onClick={() => setPreviewImage(image)}
                        style={{ cursor: 'pointer' }}
                        title="Click to view image"
                      >
                        <div className="image-preview-container">
                          <img 
                            src={image.url} 
                            alt={image.name} 
                            className="image-preview" 
                            loading="lazy"
                            onError={(e) => {
                              // If image url fails to resolve (e.g. host differences), fallback to static path relative to current domain
                              e.target.src = `http://localhost:5000/uploads/${image.filename}`;
                            }}
                          />
                        </div>
                        <div className="image-card-details">
                          <div className="image-meta">
                            <span className="image-title">{image.name}</span>
                            <span className="image-size">{formatSize(image.size)}</span>
                          </div>
                          <button 
                            onClick={(e) => handleDeleteImage(image._id, e)} 
                            className="action-btn"
                            title="Delete image"
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <IconImage />
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No images here</h4>
                      <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Upload your first image using the button above.</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* CREATE FOLDER MODAL */}
      {showFolderModal && (
        <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowFolderModal(false)}>×</button>
            <h3 className="modal-title">Create Folder</h3>
            
            <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="input-group">
                <label className="input-label" htmlFor="folderName">Folder Name</label>
                <input
                  type="text"
                  id="folderName"
                  className="input-control"
                  placeholder="e.g. Campaigns"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowFolderModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD IMAGE MODAL */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            <h3 className="modal-title">Upload Image</h3>
            
            <form onSubmit={handleUploadImage} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="input-group">
                <label className="input-label" htmlFor="uploadFile">Select File</label>
                <input
                  type="file"
                  id="uploadFile"
                  className="input-control"
                  accept="image/*"
                  onChange={handleFileChange}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="imageName">Image Name</label>
                <input
                  type="text"
                  id="imageName"
                  className="input-control"
                  placeholder="e.g. Campaign Banner"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={formSubmitting || !selectedFile}
                >
                  {formSubmitting ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal-content glass-panel modal-image-view" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setPreviewImage(null)}>×</button>
            <img 
              src={previewImage.url} 
              alt={previewImage.name} 
              onError={(e) => {
                e.target.src = `http://localhost:5000/uploads/${previewImage.filename}`;
              }}
            />
            <span className="modal-image-caption">
              {previewImage.name} ({formatSize(previewImage.size)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
