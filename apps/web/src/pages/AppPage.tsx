import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LionsDen } from '../components/LionsDen';
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentUser, setCurrentUser] = useState({
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Anonymous',
    emoji: getRandomEmoji(),
    color: getRandomColor()
  });

  const { isConnected, peers, joinDefaultRoom, updateProfile, sendSignal, onSignal } = useSocket();
  const { transfers, incomingFiles, sendFile, handleSignal, cancelTransfer, acceptIncomingFile, rejectIncomingFile } = useWebRTC(sendSignal, currentUser.id);

  // Set up signal handling once
  useEffect(() => {
    const cleanup = onSignal((from, data) => {
      handleSignal(from, data);
    });
    
    return cleanup;
  }, [onSignal, handleSignal]);

  // Join default jungle room when connection is established
  useEffect(() => {
    if (isConnected) {
      joinDefaultRoom(currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
    }
  }, [isConnected, currentUser, joinDefaultRoom]);

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
        <div className="max-w-7xl mx-auto">
          {/* Lions Den - New Layout */}
          <LionsDen
            peers={peers}
            currentUser={currentUser}
            selectedPeer={selectedPeer}
            selectedFiles={selectedFiles}
            transfers={transfers}
            incomingFiles={incomingFiles}
            onPeerClick={handlePeerClick}
            onSendFiles={handleSendFiles}
            onCancelTransfer={handleCancelTransfer}
            onClearSelection={handleClearSelection}
            onFilesSelected={handleFilesSelected}
            onFileRemove={handleFileRemove}
            onEditProfile={() => setShowProfileModal(true)}
            onAcceptIncomingFile={acceptIncomingFile}
            onRejectIncomingFile={rejectIncomingFile}
          />
        </div>
      </main>

      {/* Modals */}
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