import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { Peer, FileTransfer } from '../types';
import { formatFileSize, formatSpeed, formatTime } from '../utils/format';
import { Send, X, CheckCircle, AlertCircle, Loader, Download, File } from 'lucide-react';

interface LionsDenProps {
  peers: Peer[];
  currentUser: { id: string; name: string; emoji: string; color: string };
  selectedPeer: Peer | null;
  selectedFiles: File[];
  transfers: FileTransfer[];
  incomingFiles: Array<{
    id: string;
    from: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  }>;
  onPeerClick: (peer: Peer) => void;
  onSendFiles: (files: File[], peer: Peer) => void;
  onCancelTransfer: (transferId: string) => void;
  onClearSelection: () => void;
  onFilesSelected: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onEditProfile: () => void;
  onAcceptIncomingFile: (incomingFileId: string) => void;
  onRejectIncomingFile: (incomingFileId: string) => void;
}

export const LionsDen: React.FC<LionsDenProps> = ({
  peers,
  currentUser,
  selectedPeer,
  selectedFiles,
  transfers,
  incomingFiles,
  onPeerClick,
  onSendFiles,
  onCancelTransfer,
  onClearSelection,
  onFilesSelected,
  onFileRemove,
  onEditProfile,
  onAcceptIncomingFile,
  onRejectIncomingFile
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoveredPeer, setHoveredPeer] = useState<string | null>(null);
  const [denPulse, setDenPulse] = useState(false);
  const otherPeers = peers.filter(peer => peer.id !== currentUser.id);
  const isRoomOwner = currentUser.name.toLowerCase().includes('lion') || currentUser.emoji === '🦁';

  // Pulse animation for the den when transfers are active
  useEffect(() => {
    const hasActiveTransfers = transfers.some(t => t.status === 'transferring');
    setDenPulse(hasActiveTransfers);
  }, [transfers]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    onFilesSelected(files);
  };

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      onFilesSelected(files);
    };
    input.click();
  };

  const handleSend = () => {
    if (selectedPeer && selectedFiles.length > 0) {
      onSendFiles(selectedFiles, selectedPeer);
    }
  };

  const getStatusIcon = (status: FileTransfer['status']) => {
    switch (status) {
      case 'pending':
      case 'connecting':
        return <Loader className="w-4 h-4 animate-spin" />;
      case 'transferring':
        return <Loader className="w-4 h-4 animate-spin text-orange-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
            {/* Row 1: Radar, File Selector, and Target Cub */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Radar - Lion's Den with Cubs */}
        <GlassCard className="p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-6" style={{ zIndex: 50, position: 'relative' }}>
            <h2 className="text-xl font-bold" style={{ color: '#2C1B12' }}>
              {isRoomOwner ? "Big Lion's Den" : "Lion's Den"}
            </h2>
            <div className="flex gap-2" style={{ zIndex: 50, position: 'relative' }}>
              <button
                onClick={onEditProfile}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)', color: '#A6521B' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
 
            </div>
          </div>

          {/* Den Background with Pulse Animation */}
          <motion.div
            className="absolute inset-0 rounded-lg"
            style={{
              background: 'radial-gradient(circle at center, rgba(246, 193, 72, 0.1) 0%, transparent 70%)',
              zIndex: 0
            }}
            animate={denPulse ? {
              scale: [1, 1.05, 1],
              opacity: [0.3, 0.6, 0.3]
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />

          <div className="relative w-64 h-64 mx-auto flex items-center justify-center" style={{ zIndex: 1 }}>
            {/* Den Ring */}
            <motion.div
              className="absolute w-full h-full rounded-full border-4 border-dashed"
              style={{ borderColor: 'rgba(166, 82, 27, 0.3)' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />

            {/* Cubs around the den */}
            {otherPeers.length > 0 ? (
              <div className="absolute w-full h-full flex items-center justify-center">
                <div className="relative w-full h-full" style={{ minWidth: 256, minHeight: 256 }}>
                  {otherPeers.map((peer, idx) => {
                    const angle = (idx / otherPeers.length) * 2 * Math.PI;
                    const radius = 110;
                    const x = Math.cos(angle - Math.PI / 2) * radius + 128 - 32;
                    const y = Math.sin(angle - Math.PI / 2) * radius + 128 - 32;
                    const isSelected = selectedPeer?.id === peer.id;
                    return (
                      <motion.div
                        key={peer.id}
                        className="absolute"
                        style={{ left: x, top: y, zIndex: isSelected ? 20 : 10 }}
                        onMouseEnter={() => setHoveredPeer(peer.id)}
                        onMouseLeave={() => setHoveredPeer(null)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <div className="relative">
                          <Avatar
                            emoji={peer.emoji}
                            color={peer.color}
                            size="lg"
                            onClick={() => onPeerClick(peer)}
                            isOnline={peer.isOnline}
                            className={isSelected ? 'ring-4 ring-orange-400 shadow-lg' : 'hover:ring-2 hover:ring-orange-300 cursor-pointer'}
                          />
                          {/* Cub tooltip */}
                          {hoveredPeer === peer.id && (
                            <motion.div
                              className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black/80 text-white text-xs whitespace-nowrap z-30"
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              {peer.name}
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 1 }}>
                <div className="text-center bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-sm border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
                  <p className="text-sm font-medium" style={{ color: '#2C1B12' }}>No cubs in the jungle</p>
                  <p className="text-xs mt-1" style={{ color: '#A6521B' }}>Waiting for other lions to join</p>
                </div>
              </div>
            )}

            {/* Big Lion in center */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-15 flex flex-col items-center">
              <motion.div
                animate={isRoomOwner ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Avatar
                  emoji={currentUser.emoji}
                  color={currentUser.color}
                  size="xl"
                />
              </motion.div>
              <div className="mt-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
                <span className="text-sm font-medium" style={{ color: '#2C1B12' }}>
                  {isRoomOwner ? 'Big Lion' : 'You'}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* File Selector - Prey Selection */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold mb-6" style={{ color: '#2C1B12' }}>Select Prey (Files)</h2>
          
          <motion.div
            className={`
              relative w-64 h-64 mx-auto rounded-full border-2 border-dashed
              flex items-center justify-center cursor-pointer transition-colors
            `}
            style={{
              borderColor: isDragOver ? '#F6C148' : 'rgba(166, 82, 27, 0.3)',
              backgroundColor: isDragOver ? 'rgba(246, 193, 72, 0.1)' : 'transparent'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="text-center">
              <motion.div
                animate={{ y: isDragOver ? -5 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#A6521B', opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="font-medium mb-2" style={{ color: '#2C1B12', opacity: 0.8 }}>
                  {isDragOver ? 'Drop prey here' : 'Drop files or click to select'}
                </p>
                <p className="text-sm" style={{ color: '#2C1B12', opacity: 0.6 }}>
                  Any file type, any size
                </p>
              </motion.div>
            </div>

            {/* Pulse animation when dragging */}
            {isDragOver && (
              <motion.div
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: '#F6C148' }}
                animate={{ scale: [1, 1.1], opacity: [0.5, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </motion.div>

          {/* Selected files */}
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div
                className="mt-6 space-y-2 max-h-32 overflow-y-auto"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {selectedFiles.map((file, index) => (
                  <motion.div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-3 p-2 bg-white/5 rounded-lg"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <File className="w-4 h-4 flex-shrink-0" style={{ color: '#A6521B', opacity: 0.6 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: '#2C1B12' }}>{file.name}</p>
                      <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.6 }}>{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileRemove(index);
                      }}
                      className="p-1 rounded transition-colors"
                      style={{ color: '#A6521B', opacity: 0.6 }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.opacity = '0.6';
                      }}
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>

        {/* Target Cub */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold mb-6" style={{ color: '#2C1B12' }}>Target Cub</h2>
          
          <AnimatePresence mode="wait">
            {selectedPeer ? (
              <motion.div
                key="selected-peer"
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <motion.div
                  className="mb-4"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Avatar
                    emoji={selectedPeer.emoji}
                    color={selectedPeer.color}
                    size="xl"
                  />
                </motion.div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#2C1B12' }}>{selectedPeer.name}</h3>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className={`w-2 h-2 rounded-full ${selectedPeer.isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-sm" style={{ color: '#A6521B' }}>
                      {selectedPeer.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  
                  {selectedFiles.length > 0 && (
                    <motion.button
                      className="w-full p-3 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                      style={{ backgroundColor: '#F6C148' }}
                      onClick={handleSend}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#A6521B';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#F6C148';
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Send size={18} />
                      Send {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} to {selectedPeer.name}
                    </motion.button>
                  )}
                </div>
                
                <button
                  onClick={onClearSelection}
                  className="text-sm px-3 py-1 rounded transition-colors"
                  style={{ 
                    backgroundColor: 'rgba(166, 82, 27, 0.1)',
                    color: '#A6521B'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                  }}
                >
                  Clear Selection
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="no-peer"
                className="text-center py-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}>
                  <span className="text-3xl">🦁</span>
                </div>
                <p className="text-lg font-medium mb-2" style={{ color: '#2C1B12' }}>No cub selected</p>
                <p className="text-sm" style={{ color: '#A6521B' }}>Click on a cub in the den to select them</p>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>

      {/* Row 2: Transfer Progress */}
      <div className="grid lg:grid-cols-1 gap-6">
        {/* Transfer Progress and Incoming Files */}
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold mb-6" style={{ color: '#2C1B12' }}>Transfer Progress</h2>
          
          <div className="space-y-4">
            {/* Incoming Files Notifications */}
            {incomingFiles.length > 0 && (
              <div className="space-y-3 mb-6">
                <h3 className="text-lg font-semibold" style={{ color: '#2C1B12' }}>Incoming Files</h3>
                {incomingFiles.map(incomingFile => (
                  <motion.div
                    key={incomingFile.id}
                    className="p-4 rounded-lg border"
                    style={{ borderColor: 'rgba(166, 82, 27, 0.15)', backgroundColor: 'rgba(246, 193, 72, 0.05)' }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}>
                        <svg className="w-4 h-4" style={{ color: '#A6521B' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm" style={{ color: '#2C1B12' }}>{incomingFile.fileName}</p>
                        <p className="text-xs" style={{ color: '#A6521B' }}>
                          From: {incomingFile.from} • {formatFileSize(incomingFile.fileSize)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAcceptIncomingFile(incomingFile.id)}
                        className="flex-1 py-2 px-3 text-white rounded-lg font-medium transition-colors"
                        style={{ backgroundColor: '#F6C148' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#A6521B';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#F6C148';
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onRejectIncomingFile(incomingFile.id)}
                        className="flex-1 py-2 px-3 rounded-lg font-medium transition-colors"
                        style={{ 
                          backgroundColor: 'rgba(166, 82, 27, 0.1)',
                          color: '#A6521B'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Active Transfers */}
            {transfers.length > 0 ? (
              transfers.map(transfer => (
                <motion.div
                  key={transfer.id}
                  className="p-4 rounded-lg border"
                  style={{ borderColor: 'rgba(166, 82, 27, 0.15)' }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusIcon(transfer.status)}
                    <div className="flex-1">
                      <p className="font-medium text-sm" style={{ color: '#2C1B12' }}>{transfer.file.name}</p>
                      <p className="text-xs" style={{ color: '#A6521B' }}>To: {transfer.peer.name}</p>
                    </div>
                    {transfer.status === 'transferring' && (
                      <button
                        className="p-1 rounded hover:bg-red-100"
                        onClick={() => onCancelTransfer(transfer.id)}
                        title="Cancel transfer"
                      >
                        <X size={16} className="text-red-500" />
                      </button>
                    )}
                  </div>
                  
                  {/* Fiery Progress Bar */}
                  <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full relative"
                      style={{
                        background: 'linear-gradient(90deg, #FF6B35, #F7931E, #FFD700)',
                        width: `${transfer.progress || 0}%`
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${transfer.progress || 0}%` }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* Fire particles effect */}
                      {transfer.status === 'transferring' && (
                        <motion.div
                          className="absolute inset-0"
                          animate={{
                            background: [
                              'linear-gradient(90deg, #FF6B35, #F7931E, #FFD700)',
                              'linear-gradient(90deg, #FFD700, #FF6B35, #F7931E)',
                              'linear-gradient(90deg, #F7931E, #FFD700, #FF6B35)',
                              'linear-gradient(90deg, #FF6B35, #F7931E, #FFD700)'
                            ]
                          }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                    
                    {/* Fire sparkles */}
                    {transfer.status === 'transferring' && (
                      <motion.div
                        className="absolute inset-0"
                        animate={{
                          background: [
                            'radial-gradient(circle at 20% 50%, rgba(255, 215, 0, 0.8) 0%, transparent 50%)',
                            'radial-gradient(circle at 80% 50%, rgba(255, 215, 0, 0.8) 0%, transparent 50%)',
                            'radial-gradient(circle at 50% 20%, rgba(255, 215, 0, 0.8) 0%, transparent 50%)',
                            'radial-gradient(circle at 20% 50%, rgba(255, 215, 0, 0.8) 0%, transparent 50%)'
                          ]
                        }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                  </div>
                  
                  {/* Progress info */}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs font-medium" style={{ color: '#2C1B12' }}>
                      {Math.round(transfer.progress || 0)}%
                    </span>
                    {transfer.status === 'transferring' && (
                      <div className="text-xs" style={{ color: '#A6521B' }}>
                        {transfer.speed ? `${formatSpeed(transfer.speed)}` : ''}
                        {transfer.timeRemaining ? ` • ${formatTime(transfer.timeRemaining)}` : ''}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}>
                  <svg className="w-8 h-8" style={{ color: '#A6521B', opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: '#2C1B12', opacity: 0.6 }}>No active transfers</p>
                <p className="text-xs mt-1" style={{ color: '#A6521B' }}>Select files and a cub to start</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}; 