import React, { useRef } from 'react';
import './UploadCircle.css';

const UploadCircle = ({ onFilesSelected }) => {
  const fileInputRef = useRef();

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    if (onFilesSelected) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  return (
    <div className="lw-upload-radar">
      <div className="lw-radar-circles">
        <div className="lw-radar-circle lw-radar-circle-1"></div>
        <div className="lw-radar-circle lw-radar-circle-2"></div>
        <div className="lw-radar-circle lw-radar-circle-3"></div>
        <div className="lw-radar-circle lw-radar-circle-4"></div>
      </div>
      <div className="lw-upload-center">
        <div className="lw-upload-progress">
          <div className="lw-upload-ring">
            <button className="lw-upload-btn" onClick={handleUploadClick}>
              <span className="lw-upload-label">Upload Files</span>
              <span className="lw-upload-sub">Click Here</span>
            </button>
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>
        </div>
        <button className="lw-upload-folder-btn">
          Upload Folder <span className="lw-arrow">→</span>
        </button>
      </div>
      <div className="lw-user-center">
        <div className="lw-user-avatar">
          <span role="img" aria-label="You">📡</span>
        </div>
        <div className="lw-user-label">You</div>
        <div className="lw-user-status">Online</div>
      </div>
      <div className="lw-desc">
        ShareDrop lets you share files with others. To get started, <b>upload some files</b>.
      </div>
    </div>
  );
};

export default UploadCircle; 