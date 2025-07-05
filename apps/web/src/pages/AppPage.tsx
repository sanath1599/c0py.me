import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radar } from '../components/Radar';
import { UploadCircle } from '../components/UploadCircle';
import { FileSharing } from '../components/FileSharing';
import { RoomModal } from '../components/RoomModal';
import { ProfileModal } from '../components/ProfileModal';
import { ToastContainer, Toast } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { Peer } from '../types';
import { getRandomColor, getRandomEmoji } from '../utils/colors';
import { LionIcon } from '../components/LionIcon';

export const AppPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentUser, setCurrentUser] = useState({
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Anonymous',
    emoji: getRandomEmoji(),
    color: getRandomColor()
  });
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const { isConnected, peers, joinRoom, updateProfile, sendSignal, onSignal } = useSocket();
  const { transfers, sendFile, handleSignal, cancelTransfer } = useWebRTC(sendSignal, currentUser.id);

  // Set up signal handling once
  useEffect(() => {
    const cleanup = onSignal(({ from, data }) => {
      handleSignal(from, data);
    });
    
    return cleanup;
  }, [onSignal, handleSignal]);

  // Handle room joining when room code changes
  const handleJoinRoom = (roomCode: string) => {
    setRoomCode(roomCode);
    joinRoom(roomCode, currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
  };

  // Join room when connection is established and we have a room code
  useEffect(() => {
    if (isConnected && roomCode) {
      joinRoom(roomCode, currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
    }
  }, [isConnected, roomCode]); // Removed currentUser and joinRoom from dependencies

  const handlePeerClick = (peer: Peer) => {
    setSelectedPeer(peer);
  };

  const handleSendFiles = async (files: File[], peer: Peer) => {
    try {
      // Send each file individually
      for (const file of files) {
        await sendFile(file, peer);
      }
      addToast('success', `Sending ${files.length} file(s) to ${peer.name}...`);
      setSelectedFiles([]); // Clear selection after sending
    } catch (error) {
      console.error('Failed to send files:', error);
      addToast('error', `Failed to send files to ${peer.name}`);
    }
  };

  const handleCancelTransfer = (transferId: string) => {
    cancelTransfer(transferId);
    addToast('info', 'Transfer cancelled');
  };

  // Monitor transfers for completion
  useEffect(() => {
    transfers.forEach(transfer => {
      if (transfer.status === 'completed') {
        addToast('success', `File transfer completed!`);
      } else if (transfer.status === 'failed') {
        addToast('error', `File transfer failed`);
      }
    });
  }, [transfers]);

  const handleClearSelection = () => {
    setSelectedFiles([]);
    setSelectedPeer(null);
  };

  const handleFileRemove = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const handleProfileUpdate = (profile: { name: string; emoji: string; color: string }) => {
    setCurrentUser(prev => ({ ...prev, ...profile }));
    updateProfile(profile.name, profile.color, profile.emoji);
  };

  // Toast management
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Navbar with animated logo */}
      <motion.header
        className="p-6 border-b"
        style={{ borderColor: 'rgba(166, 82, 27, 0.1)' }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.img
              src="/favicon.gif"
              alt="ShareDrop Lion Logo"
              className="w-10 h-10"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
            <h1 className="text-2xl font-bold" style={{ color: '#2C1B12' }}>
              ShareDrop
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm" style={{ color: '#2C1B12', opacity: 0.8 }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Radar and Upload Circle */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Radar */}
            <Radar
              peers={peers}
              currentUser={currentUser}
              selectedPeer={selectedPeer}
              onPeerClick={handlePeerClick}
              onEditProfile={() => setShowProfileModal(true)}
              onJoinRoom={() => setShowRoomModal(true)}
            />

            {/* Upload Circle */}
            <div className="flex items-start justify-center">
              <UploadCircle
                onFilesSelected={handleFilesSelected}
                selectedFiles={selectedFiles}
                onFileRemove={handleFileRemove}
              />
            </div>
          </div>

          {/* File Sharing - Full Width */}
          <FileSharing
            selectedFiles={selectedFiles}
            selectedPeer={selectedPeer}
            transfers={transfers}
            onSendFiles={handleSendFiles}
            onCancelTransfer={handleCancelTransfer}
            onClearSelection={handleClearSelection}
          />
        </div>
      </main>

      {/* Modals */}
      <RoomModal
        isOpen={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        onJoinRoom={handleJoinRoom}
      />

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentProfile={currentUser}
        onSave={handleProfileUpdate}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};