import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './App.css';
import UploadCircle from './components/UploadCircle';
import FileSharing from './components/FileSharing';
import Radar from './components/Radar';

const SIGNALING_SERVER = process.env.REACT_APP_SIGNALING_SERVER || 'http://localhost:5000';

function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className="landing-page">
      <div className="landing-logo-container">
        <img src="/favicon.gif" alt="ShareDrop Animated Logo" className="landing-logo" />
      </div>
      <h1 className="landing-title">ShareDrop by c0py.me</h1>
      <p className="landing-desc">
        Secure, open-source, peer-to-peer file sharing.<br />
        No accounts. No server storage. Just fast, encrypted transfers.
      </p>
      <button className="landing-get-started" onClick={() => navigate('/app')}>
        Get Started
      </button>
      <footer className="landing-footer">
        <span>MIT Licensed &middot; Built with modern web technologies</span>
      </footer>
    </div>
  );
}

function MainApp() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [peers, setPeers] = useState([]);
  const [user, setUser] = useState({ id: '', name: 'You' });
  const [room, setRoom] = useState('local');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Generate a unique user ID
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    setUser({ id: userId, name: 'You' });
    // Connect to Socket.IO
    const socket = io(SIGNALING_SERVER);
    socketRef.current = socket;
    socket.emit('join-room', { room, userId, name: 'You' });
    socket.on('peers', (peerList) => {
      setPeers(peerList.filter(p => p.id !== userId));
    });
    socket.on('peer-joined', (peer) => {
      setPeers(prev => [...prev, peer].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i && v.id !== userId));
    });
    socket.on('peer-left', (peerId) => {
      setPeers(prev => prev.filter(p => p.id !== peerId));
    });
    return () => {
      socket.disconnect();
    };
  }, [room]);

  const handleFilesSelected = (files) => {
    setSelectedFiles(files);
  };

  const handlePeerClick = (peer) => {
    setSelectedPeer(peer);
  };

  const handlePlusClick = () => {
    setShowRoomModal(true);
  };

  return (
    <div className="App limewire-theme">
      <header className="lw-header">
        <div className="lw-header-left">
          <img src="/logo.png" alt="ShareDrop Logo" className="lw-logo" />
          <span className="lw-title">ShareDrop</span>
          <span className="lw-by">by</span>
          <span className="lw-limewire">LimeWire</span>
        </div>
      </header>
      <main className="lw-main">
        <Radar user={user} peers={peers} onPeerClick={handlePeerClick} onPlusClick={handlePlusClick} />
        <UploadCircle onFilesSelected={handleFilesSelected} />
        <FileSharing files={selectedFiles} targetPeer={selectedPeer} userId={user.id} />
        {showRoomModal && (
          <div className="room-modal-backdrop">
            <div className="room-modal">
              <h2>Join or Create a Room</h2>
              <input
                type="text"
                placeholder="Enter room code or name"
                value={room}
                onChange={e => setRoom(e.target.value)}
                className="room-input"
              />
              <button onClick={() => setShowRoomModal(false)} className="room-modal-close">Close</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<MainApp />} />
      </Routes>
    </Router>
  );
}

export default App;
