import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { CubProgress } from './CubProgress';
import { Peer, FileTransfer } from '../types';
import { formatFileSize } from '../utils/format';
import { Send, X, CheckCircle, AlertCircle, Loader, File } from 'lucide-react';
import { IncomingFileModal } from './IncomingFileModal';
import { logUserAction } from '../utils/eventLogger';

interface LionsDenProps {
  peers: Peer[];
  currentUser: { id: string; name: string; emoji: string; color: string };
  selectedPeer: Peer | null;
  selectedFiles: File[];
  transfers: FileTransfer[];
  currentWorld?: 'jungle' | 'room' | 'family';
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
  mode?: 'den' | 'prey' | 'target' | 'progress' | 'history';
  transferTimes?: Record<string, { start: number; end?: number; duration?: number }>;
}

export const LionsDen: React.FC<LionsDenProps> = ({
  peers,
  currentUser,
  selectedPeer,
  selectedFiles,
  transfers,
  currentWorld,
  incomingFiles,
  onPeerClick,
  onSendFiles,
  onCancelTransfer,
  onClearSelection,
  onFilesSelected,
  onFileRemove,
  onEditProfile,
  onAcceptIncomingFile,
  onRejectIncomingFile,
  mode = undefined,
  transferTimes
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoveredPeer, setHoveredPeer] = useState<string | null>(null);
  const [denPulse, setDenPulse] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferProgressRef = useRef<HTMLDivElement>(null);
  const prevActiveTransfersRef = useRef(0);
  const otherPeers = peers.filter(peer => peer.id !== currentUser.id);
  const isRoomOwner = currentUser.name.toLowerCase().includes('lion') || currentUser.emoji === '🦁';

  // Pulse animation for the den when transfers are active
  useEffect(() => {
    const hasActiveTransfers = transfers.some(t => t.status === 'transferring');
    setDenPulse(hasActiveTransfers);
  }, [transfers]);

  // Pulse animation when peers are present
  useEffect(() => {
    setDenPulse(otherPeers.length > 0);
  }, [otherPeers.length]);

  // Auto-scroll to transfer progress on mobile when transfer starts
  useEffect(() => {
    const activeTransfers = transfers.filter(t => t.status === 'transferring').length;
    const prevActive = prevActiveTransfersRef.current;
    
    // If a new transfer started (active transfers increased)
    if (activeTransfers > prevActive && transferProgressRef.current) {
      // Check if we're on mobile (screen width < 768px)
      if (window.innerWidth < 768) {
        // Smooth scroll to transfer progress section
        transferProgressRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }
    
    prevActiveTransfersRef.current = activeTransfers;
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
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const fileTypes = [...new Set(files.map(file => file.type))];
    logUserAction.filesSelected(files.length, totalSize, fileTypes);
    onFilesSelected(files);
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const fileTypes = [...new Set(files.map(file => file.type))];
      logUserAction.filesSelected(files.length, totalSize, fileTypes);
      
      // Process files for IndexedDB storage on mobile
      const { shouldUseIndexedDB } = await import('../utils/device');
      const { storeOutgoingFile } = await import('../utils/indexedDB');
      
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          if (shouldUseIndexedDB(file.size)) {
            const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            try {
              await storeOutgoingFile(fileId, file);
              // Create a new File object with metadata
              const fileWithMetadata = Object.assign(file, { 
                fileId, 
                useIndexedDB: true 
              });
              return fileWithMetadata;
            } catch (error) {
              console.error('Failed to store file to IndexedDB:', error);
              // Fallback to in-memory if IndexedDB fails
              return Object.assign(file, { useIndexedDB: false });
            }
          }
          return Object.assign(file, { useIndexedDB: false });
        })
      );
      
      onFilesSelected(processedFiles);
    }
    // Reset the input value so the same file can be selected again
    e.target.value = '';
  };

  // Check if there's a transfer in progress
  const hasActiveTransfer = transfers.some(t => 
    t.status === 'transferring' || t.status === 'pending' || t.status === 'connecting'
  );
  
  const handleSend = () => {
    if (selectedPeer && selectedFiles.length > 0) {
      if (hasActiveTransfer) {
        // This should be prevented by the button being disabled, but just in case
        return;
      }
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

  const hasIncomingFile = incomingFiles.length > 0;
  const currentIncomingFile = hasIncomingFile ? incomingFiles[0] : null;

  // Helper to check if there are active transfers
  const hasActiveTransfers = transfers.some(t => t.status === 'transferring');

  // Transfer Progress Box
  const transferProgressBox = (
    <GlassCard className="p-6 w-full max-w-xl mx-auto z-50">
      <h2 className="text-xl font-bold mb-6" style={{ color: '#2C1B12' }}>
        Transfer Progress
      </h2>
      {transfers.length === 0 ? (
        <div className="text-center py-8">
          <File className="w-12 h-12 mx-auto mb-4 text-orange-400/60" />
          <p className="text-orange-700/80">No active transfers</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transfers.map((transfer) => (
            <div
              key={transfer.id}
              className="p-4 rounded-lg bg-white/40 border border-orange-100/60 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate" style={{ color: '#2C1B12' }}>
                    {transfer.file.name}
                  </h3>
                  <p className="text-sm text-orange-700/80">
                    To: {transfer.peer.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(transfer.status)}
                  {transfer.status === 'transferring' && (
                    <button
                      onClick={() => onCancelTransfer(transfer.id)}
                      className="p-1 rounded-full hover:bg-orange-100 text-orange-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              <CubProgress 
                progress={transfer.progress || 0}
                className="mb-2"
                speed={transfer.speed}
                timeRemaining={transfer.timeRemaining}
                fileSize={transfer.file.size}
                status={transfer.status}
              />
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );

  if (mode === 'den') {
    // Only render Lion's Den (radar, user, no cubs text)
    return (
      <GlassCard className="p-6 relative overflow-hidden min-h-[550px]">
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

        {/* Online Statistics */}
        <div className="mb-6 p-4 bg-white/20 backdrop-blur-sm rounded-lg border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)', zIndex: 50, position: 'relative' }}>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold" style={{ color: '#2C1B12' }}>
                {peers.length}
              </div>
              <div className="text-sm" style={{ color: '#A6521B' }}>
                Total Lions
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold" style={{ color: '#2C1B12' }}>
                {peers.filter(p => p.isOnline).length}
              </div>
              <div className="text-sm" style={{ color: '#A6521B' }}>
                Online Now
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
            <div className="text-xs text-center" style={{ color: '#A6521B' }}>
              {currentWorld === 'jungle' ? '🌍 Global Jungle' : 
               currentWorld === 'room' ? '🔒 Private Room' :
               currentWorld === 'family' ? '🏠 Local Network' : '🦁 Lion\'s Den'}
            </div>
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

        <div className="relative w-64 h-64 mx-auto flex items-center justify-center pb-16" style={{ zIndex: 1 }}>
          {/* Den Ring */}
          <motion.div
            className="absolute w-full h-full rounded-full border-4 border-dashed"
            style={{ borderColor: 'rgba(166, 82, 27, 0.3)' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />

          {/* Cubs around the den */}
          {otherPeers.length > 0 && (
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
          )}

          {/* Big Lion in center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-auto w-40">
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
            <div className="mt-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border z-30 w-full break-words whitespace-normal text-center" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
              <span className="text-sm font-medium" style={{ color: '#2C1B12' }}>
                You ({currentUser.name})
              </span>
            </div>
          </div>
        </div>

        {/* Show 'No cubs' text below the radar if no other cubs */}
        {otherPeers.length === 0 && (
          <div className="w-full flex flex-col items-center mt-4">
            <div className="text-center bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-sm border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
              <p className="text-sm font-medium" style={{ color: '#2C1B12' }}>
                {currentWorld === 'jungle' ? 'No cubs in the jungle' : 
                 currentWorld === 'room' ? 'No cubs in the room' :
                 currentWorld === 'family' ? 'No family members online' : 'No cubs in the den'}
              </p>
              <p className="text-xs mt-1" style={{ color: '#A6521B' }}>
                {currentWorld === 'jungle' ? 'Waiting for other lions to join' :
                 currentWorld === 'room' ? 'Share the room code with others' :
                 currentWorld === 'family' ? 'Other devices on your WiFi can join' : 'Waiting for other lions to join'}
              </p>
            </div>
          </div>
        )}
      </GlassCard>
    );
  }
  if (mode === 'prey') {
    // Only render Select Prey (Files) and file input logic
    return (
      <GlassCard className="p-6 min-h-[550px]">
        <h2 className="text-xl font-bold mb-6" style={{ color: '#2C1B12' }}>Select Prey (Files)</h2>
        {/* File input and drag/drop logic only in prey mode */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          accept="*/*"
        />
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
    );
  }
  if (mode === 'target') {
    // Only render Target Cub
    return (
      <GlassCard className="p-6 min-h-[550px]">
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
                  <div>
                    <motion.button
                      className="w-full p-3 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        backgroundColor: hasActiveTransfer ? '#999999' : '#F6C148',
                        cursor: hasActiveTransfer ? 'not-allowed' : 'pointer'
                      }}
                      onClick={handleSend}
                      disabled={hasActiveTransfer}
                      onMouseEnter={(e) => {
                        if (!hasActiveTransfer) {
                          e.currentTarget.style.backgroundColor = '#A6521B';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!hasActiveTransfer) {
                          e.currentTarget.style.backgroundColor = '#F6C148';
                        }
                      }}
                      whileHover={hasActiveTransfer ? {} : { scale: 1.02 }}
                      whileTap={hasActiveTransfer ? {} : { scale: 0.98 }}
                    >
                      <Send size={18} />
                      {hasActiveTransfer 
                        ? 'Transfer in progress...' 
                        : `Send ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} to ${selectedPeer.name}`
                      }
                    </motion.button>
                    {hasActiveTransfer && (
                      <motion.p
                        className="text-sm text-red-600 text-center mt-2"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        Error: transfer in progress, please wait for current transfer to finish before starting a new transfer
                      </motion.p>
                    )}
                  </div>
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
    );
  }
  if (mode === 'progress') {
    // Only render Transfer Progress (current transfers)
    // Helper to determine if transfer is incoming or outgoing
    const isIncoming = (transfer: FileTransfer) => {
      // Check if transfer ID starts with "receive-" (incoming) or if peer is sending to us
      return transfer.id.startsWith('receive-');
    };

    return (
      <GlassCard className="p-6 w-full">
        <h2 className="text-xl font-bold mb-6" style={{ color: '#2C1B12' }}>
          Transfer Progress
        </h2>
        {transfers.some(t => t.status === 'transferring') ? (
          <div className="space-y-4 mb-0">
            {transfers.filter(t => t.status === 'transferring').map((transfer) => {
              const incoming = isIncoming(transfer);
              const borderColor = incoming ? 'rgba(34, 197, 94, 0.3)' : 'rgba(166, 82, 27, 0.3)'; // green for incoming, orange for outgoing
              const bgColor = incoming ? 'rgba(34, 197, 94, 0.1)' : 'rgba(166, 82, 27, 0.1)';
              const textColor = incoming ? 'rgba(34, 197, 94, 0.8)' : 'rgba(166, 82, 27, 0.8)';
              
              return (
                <div
                  key={transfer.id}
                  className="p-4 rounded-lg backdrop-blur-sm"
                  style={{
                    backgroundColor: bgColor,
                    borderColor: borderColor,
                    borderWidth: '1px',
                    borderStyle: 'solid'
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col items-center mb-2">
                        <span 
                          className="px-3 py-1 rounded-full text-xs font-semibold mb-1"
                          style={{
                            backgroundColor: incoming ? 'rgba(34, 197, 94, 0.2)' : 'rgba(166, 82, 27, 0.2)',
                            color: incoming ? 'rgba(34, 197, 94, 1)' : 'rgba(166, 82, 27, 1)'
                          }}
                        >
                          {incoming ? '⬇️ Receiving File' : '⬆️ Sending File'}
                        </span>
                        <h3 className="font-semibold truncate text-center w-full" style={{ color: '#2C1B12' }}>
                          {transfer.file.name}
                        </h3>
                      </div>
                      <p className="text-sm text-center" style={{ color: textColor }}>
                        {incoming ? `From: ${transfer.peer.name}` : `To: ${transfer.peer.name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(transfer.status)}
                      {transfer.status === 'transferring' && (
                        <button
                          onClick={() => onCancelTransfer(transfer.id)}
                          className="p-1 rounded-full transition-colors"
                          style={{
                            backgroundColor: incoming ? 'rgba(34, 197, 94, 0.2)' : 'rgba(166, 82, 27, 0.2)',
                            color: incoming ? 'rgba(34, 197, 94, 0.8)' : 'rgba(166, 82, 27, 0.8)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = incoming ? 'rgba(34, 197, 94, 0.3)' : 'rgba(166, 82, 27, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = incoming ? 'rgba(34, 197, 94, 0.2)' : 'rgba(166, 82, 27, 0.2)';
                          }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <CubProgress 
                    progress={transfer.progress || 0}
                    className="mb-2"
                    speed={transfer.speed}
                    timeRemaining={transfer.timeRemaining}
                    fileSize={transfer.file.size}
                    status={transfer.status}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <File className="w-12 h-12 mx-auto mb-4 text-orange-400/60" />
            <p className="text-orange-700/80">No active transfers</p>
          </div>
        )}
      </GlassCard>
    );
  }
  if (mode === 'history') {
    // Only render Transfer History Table (glassmorphic card)
    const completedTransfers = transfers.filter(t => t.status === 'completed');
    if (completedTransfers.length === 0) return null;
    return (
      <div className="w-full">
        <div className="p-8 rounded-2xl shadow-xl border border-orange-100/60 bg-white/60 backdrop-blur-xl max-w-6xl mx-auto">
          <h3 className="text-lg font-bold mb-4" style={{ color: '#2C1B12' }}>Transfer History</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-orange-100/60">
                <tr>
                  <th className="px-4 py-2 text-left">File Name</th>
                  <th className="px-4 py-2 text-left">Sender/Receiver</th>
                  <th className="px-4 py-2 text-left">Direction</th>
                  <th className="px-4 py-2 text-left">File Size</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody>
                {completedTransfers.map((t) => {
                  const times = transferTimes?.[t.id];
                  // Determine direction: check if transfer ID starts with "receive-" (incoming)
                  const isIncoming = t.id.startsWith('receive-');
                  const direction = isIncoming ? 'Received' : 'Sent';
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{t.file.name}</td>
                      <td className="px-4 py-2">{t.peer?.name || 'Unknown'}</td>
                      <td className="px-4 py-2">{direction}</td>
                      <td className="px-4 py-2">{formatFileSize(t.file.size)}</td>
                      <td className="px-4 py-2">Completed</td>
                      <td className="px-4 py-2">{times?.end ? new Date(times.end).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      }) : '-'}</td>
                      <td className="px-4 py-2">{times?.duration ? `${(times.duration / 1000).toFixed(1)}s` : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default return (should not reach here)
  return null;
}; 