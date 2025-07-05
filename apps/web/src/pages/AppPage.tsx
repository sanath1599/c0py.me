import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radar } from '../components/Radar';
import { UploadCircle } from '../components/UploadCircle';
import { FileSharing } from '../components/FileSharing';
import { RoomModal } from '../components/RoomModal';
import { ProfileModal } from '../components/ProfileModal';
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
  const [currentUser, setCurrentUser] = useState({
    id: `user-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
    name: 'You',
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
  const handleJoinRoom = (code: string) => {
    setRoomCode(code);
    // Join room will be called by the socket hook when connected
    if (isConnected) {
      joinRoom(code, currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
    }
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

  const handleSendFiles = (files: File[], peer: Peer) => {
    files.forEach(file => {
      sendFile(file, peer);
    });
    setSelectedFiles([]);
  };

  const handleFileRemove = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearSelection = () => {
    setSelectedPeer(null);
    setSelectedFiles([]);
  };

  const handleProfileUpdate = (profile: { name: string; emoji: string; color: string }) => {
    setCurrentUser(prev => ({ ...prev, ...profile }));
    updateProfile(profile.name, profile.color, profile.emoji);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FEF7E0' }}>
      {/* Header */}
      <motion.header
        className="p-6 border-b"
        style={{ borderColor: 'rgba(166, 82, 27, 0.1)' }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LionIcon className="w-8 h-8" />
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
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Radar */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Radar
                peers={peers}
                currentUser={currentUser}
                onPeerClick={handlePeerClick}
                onEditProfile={() => setShowProfileModal(true)}
                onJoinRoom={() => setShowRoomModal(true)}
              />
            </motion.div>

            {/* Upload Circle */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <UploadCircle
                selectedFiles={selectedFiles}
                onFilesSelected={setSelectedFiles}
                onFileRemove={handleFileRemove}
              />
            </motion.div>

            {/* File Sharing */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <FileSharing
                selectedFiles={selectedFiles}
                selectedPeer={selectedPeer}
                transfers={transfers}
                onSendFiles={handleSendFiles}
                onCancelTransfer={cancelTransfer}
                onClearSelection={handleClearSelection}
              />
            </motion.div>
          </div>
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
    </div>
  );
};