import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { CubProgress } from './CubProgress';
import { Peer, FileTransfer } from '../types';
import { formatFileSize } from '../utils/format';
import { Send, X, CheckCircle, AlertCircle, Loader, File, ChevronLeft, ChevronRight, Search, ArrowLeft } from 'lucide-react';
import { logUserAction } from '../utils/eventLogger';

interface MobileAppProps {
  peers: Peer[];
  currentUser: { id: string; name: string; emoji: string; color: string };
  selectedPeer: Peer | null;
  selectedFiles: File[];
  transfers: FileTransfer[];
  currentWorld?: 'jungle' | 'room' | 'family';
  currentRoom?: string;
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
  transferTimes?: Record<string, { start: number; end?: number; duration?: number }>;
}

export const MobileApp: React.FC<MobileAppProps> = ({
  peers,
  currentUser,
  selectedPeer,
  selectedFiles,
  transfers,
  currentWorld,
  currentRoom,
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
  transferTimes,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoveredPeer, setHoveredPeer] = useState<string | null>(null);
  const [denPulse, setDenPulse] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transferProgressRef = useRef<HTMLDivElement>(null);

  // Filter peers based on search query - always scoped to current room
  const filteredPeers = React.useMemo(() => {
    const otherPeers = peers.filter(p => p.id !== currentUser.id);
    
    // Always filter by current room first
    const roomPeers = currentRoom 
      ? otherPeers.filter(p => p.roomId === currentRoom)
      : otherPeers;
    
    // Then apply search query if provided
    if (searchQuery.trim()) {
      return roomPeers.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return roomPeers;
  }, [peers, currentUser.id, searchQuery, currentRoom]);
  
  const otherPeers = filteredPeers;
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

  // Auto-advance to progress when transfer starts (only if not manually navigating)
  const prevHasActiveTransferRef = useRef(false);
  const isManualNavigationRef = useRef(false);
  
  useEffect(() => {
    const hasActiveTransfer = transfers.some(t => 
      t.status === 'transferring' || t.status === 'pending' || t.status === 'connecting'
    );
    
    // Only auto-advance if transfer just started (wasn't active before) AND user isn't manually navigating
    if (hasActiveTransfer && !prevHasActiveTransferRef.current && !isManualNavigationRef.current && currentSlide < 3) {
      setCurrentSlide(3);
    }
    
    prevHasActiveTransferRef.current = hasActiveTransfer;
    // Reset manual navigation flag after a short delay
    if (isManualNavigationRef.current) {
      setTimeout(() => {
        isManualNavigationRef.current = false;
      }, 500);
    }
  }, [transfers, currentSlide]);

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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const fileTypes = [...new Set(files.map(file => file.type))];
      logUserAction.filesSelected(files.length, totalSize, fileTypes);
      onFilesSelected(files);
    }
    e.target.value = '';
  };

  // Check if there's a transfer in progress
  const hasActiveTransfer = transfers.some(t => 
    t.status === 'transferring' || t.status === 'pending' || t.status === 'connecting'
  );
  
  const handleSend = () => {
    if (selectedPeer && selectedFiles.length > 0) {
      if (hasActiveTransfer) {
        return;
      }
      onSendFiles(selectedFiles, selectedPeer);
      // Auto-advance to progress screen after sending
      setCurrentSlide(3);
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

  // Navigation handlers
  const handlePrevious = () => {
    if (currentSlide > 0) {
      isManualNavigationRef.current = true;
      setCurrentSlide(prev => {
        console.log('Previous: moving from', prev, 'to', prev - 1);
        return prev - 1;
      });
    }
  };

  const handleNext = () => {
    if (currentSlide < 3) {
      isManualNavigationRef.current = true;
      setCurrentSlide(prev => {
        console.log('Next: moving from', prev, 'to', prev + 1);
        return prev + 1;
      });
    }
  };

  const handleSendMore = () => {
    onClearSelection();
    setCurrentSlide(0);
  };

  // Determine if user can proceed to next step
  const canProceedToNext = () => {
    switch (currentSlide) {
      case 0: // Lions Den
        return selectedPeer !== null;
      case 1: // Select Prey
        return selectedFiles.length > 0;
      case 2: // Target Cub
        return false; // No next button on this slide
      case 3: // Transfer Progress
        return false; // No next button on this slide
      default:
        return false;
    }
  };

  // Render slide content
  const renderSlide = (slideIndex: number) => {
    switch (slideIndex) {
      case 0: // Lions Den
        return (
          <div className="w-full h-full">
            <GlassCard className="p-4 relative overflow-visible min-h-[500px]">
              <div className="flex items-center justify-between mb-6" style={{ zIndex: 50, position: 'relative' }}>
                <h2 className="text-xl font-bold" style={{ color: '#2C1B12' }}>
                  {isRoomOwner ? "Big Lion's Den" : "Lion's Den"}
                </h2>
              </div>

              {/* Search Bar */}
              <div className="mb-4" style={{ zIndex: 50, position: 'relative' }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A6521B', opacity: 0.6 }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.length > 0) {
                        logUserAction.peerSelected('search', 'search_query');
                      }
                    }}
                    placeholder={
                      currentWorld === 'jungle' 
                        ? "Search by name or user ID..." 
                        : currentWorld === 'room'
                        ? "Search room members..."
                        : currentWorld === 'family'
                        ? "Search family members..."
                        : "Search peers..."
                    }
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-orange-200 bg-white/60 backdrop-blur-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm"
                    style={{ color: '#2C1B12' }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/40 transition-colors"
                      style={{ color: '#A6521B' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Online Statistics */}
              <div className="mb-6 p-4 bg-white/20 backdrop-blur-sm rounded-lg border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)', zIndex: 50, position: 'relative' }}>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: '#2C1B12' }}>
                      {filteredPeers.length + 1}
                    </div>
                    <div className="text-sm" style={{ color: '#A6521B' }}>
                      Total Lions
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: '#2C1B12' }}>
                      {filteredPeers.filter(p => p.isOnline).length + 1}
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

              <div className="relative w-48 h-48 mx-auto flex items-center justify-center pb-8" style={{ zIndex: 1 }}>
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
                    <div className="relative w-full h-full" style={{ minWidth: '192px', minHeight: '192px' }}>
                      {otherPeers.map((peer, idx) => {
                        const angle = (idx / otherPeers.length) * 2 * Math.PI - Math.PI / 2;
                        const radius = 80;
                        const centerX = 96;
                        const centerY = 96;
                        const x = Math.cos(angle) * radius + centerX - 32;
                        const y = Math.sin(angle) * radius + centerY - 32;
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
                  <div className="mt-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border z-30 w-full break-words whitespace-normal flex items-center justify-center gap-2" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
                    <span className="text-sm font-medium" style={{ color: '#2C1B12' }}>
                      You ({currentUser.name})
                    </span>
                    <button
                      onClick={onEditProfile}
                      className="p-1 rounded transition-colors flex-shrink-0"
                      style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)', color: '#A6521B' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
                      title="Edit Profile"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {otherPeers.length === 0 && (
                <div className="w-full flex flex-col items-center mt-4">
                  <div className="text-center bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-sm border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
                    <p className="text-sm font-medium" style={{ color: '#2C1B12' }}>
                      {currentWorld === 'jungle' ? 'No cubs in the jungle' : 
                       currentWorld === 'room' ? 'No cubs in the room' :
                       currentWorld === 'family' ? 'No family members online' : 'No cubs in the den'}
                    </p>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>
        );

      case 1: // Select Prey (File Selection)
        return (
          <div className="w-full h-full">
            <GlassCard className="p-4 min-h-[500px]">
              <h2 className="text-xl font-bold mb-4" style={{ color: '#2C1B12' }}>Select Prey (Files)</h2>
              <div className="mb-4">
                {selectedPeer ? (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-white/20 rounded-lg">
                    <Avatar
                      emoji={selectedPeer.emoji}
                      color={selectedPeer.color}
                      size="md"
                    />
                    <div>
                      <h3 className="font-semibold" style={{ color: '#2C1B12' }}>{selectedPeer.name}</h3>
                      <p className="text-xs" style={{ color: '#A6521B' }}>
                        {selectedPeer.isOnline ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-3 bg-orange-100/50 rounded-lg text-center">
                    <p className="text-sm" style={{ color: '#A6521B' }}>
                      Please select a peer from the den first
                    </p>
                  </div>
                )}
              </div>
              
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
                  relative w-full max-w-md h-48 mx-auto rounded-full border-2 border-dashed
                  flex items-center justify-center cursor-pointer transition-colors
                `}
                style={{
                  borderColor: isDragOver ? '#F6C148' : 'rgba(166, 82, 27, 0.3)',
                  backgroundColor: isDragOver ? 'rgba(246, 193, 72, 0.1)' : 'transparent'
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={selectedPeer ? handleClick : undefined}
                whileHover={selectedPeer ? { scale: 1.02 } : {}}
                whileTap={selectedPeer ? { scale: 0.98 } : {}}
              >
                <div className="text-center">
                  <motion.div
                    animate={{ y: isDragOver ? -5 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-12 h-12 mx-auto mb-4" style={{ color: '#A6521B', opacity: 0.6 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="font-medium mb-2" style={{ color: '#2C1B12', opacity: selectedPeer ? 0.8 : 0.5 }}>
                      {selectedPeer 
                        ? (isDragOver ? 'Drop files here' : 'Drop files or click to select')
                        : 'Select a peer first'
                      }
                    </p>
                    {selectedPeer && (
                      <p className="text-sm" style={{ color: '#2C1B12', opacity: 0.6 }}>
                        Any file type, any size
                      </p>
                    )}
                  </motion.div>
                </div>
                {isDragOver && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: '#F6C148' }}
                    animate={{ scale: [1, 1.1], opacity: [0.5, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </motion.div>
              
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
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          </div>
        );

      case 2: // Target Cub (Send)
        return (
          <div className="w-full h-full">
            <GlassCard className="p-4 min-h-[500px]">
              <h2 className="text-xl font-bold mb-4" style={{ color: '#2C1B12' }}>Target Cub</h2>
              {selectedPeer && selectedFiles.length > 0 ? (
                <div className="text-center mb-6">
                  <Avatar
                    emoji={selectedPeer.emoji}
                    color={selectedPeer.color}
                    size="xl"
                    className="mx-auto mb-4"
                  />
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#2C1B12' }}>{selectedPeer.name}</h3>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className={`w-2 h-2 rounded-full ${selectedPeer.isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-sm" style={{ color: '#A6521B' }}>
                      {selectedPeer.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-sm mb-3" style={{ color: '#2C1B12', opacity: 0.8 }}>
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} ready to send
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-white/20 rounded text-sm">
                          <File className="w-4 h-4 flex-shrink-0" style={{ color: '#A6521B' }} />
                          <span className="truncate flex-1" style={{ color: '#2C1B12' }}>{file.name}</span>
                          <span className="text-xs" style={{ color: '#A6521B', opacity: 0.7 }}>{formatFileSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                    
                    <motion.button
                      className="w-full mt-6 p-4 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ 
                        backgroundColor: hasActiveTransfer ? '#999999' : '#F6C148',
                        cursor: hasActiveTransfer ? 'not-allowed' : 'pointer'
                      }}
                      onClick={handleSend}
                      disabled={hasActiveTransfer}
                      whileHover={hasActiveTransfer ? {} : { scale: 1.02 }}
                      whileTap={hasActiveTransfer ? {} : { scale: 0.98 }}
                    >
                      <Send size={20} />
                      {hasActiveTransfer 
                        ? 'Transfer in progress...' 
                        : `Send ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`
                      }
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}>
                    <span className="text-3xl">🦁</span>
                  </div>
                  <p className="text-lg font-medium mb-2" style={{ color: '#2C1B12' }}>
                    {!selectedPeer ? 'No cub selected' : 'No files selected'}
                  </p>
                  <p className="text-sm" style={{ color: '#A6521B' }}>
                    {!selectedPeer 
                      ? 'Go back and select a peer from the den' 
                      : 'Go back and select files to send'}
                  </p>
                </div>
              )}
            </GlassCard>
          </div>
        );

      case 3: // Transfer Progress
        const completedTransfers = transfers.filter(t => t.status === 'completed');
        const hasCompletedTransfers = completedTransfers.length > 0;
        const hasActiveTransfers = transfers.some(t => t.status === 'transferring' || t.status === 'pending' || t.status === 'connecting');
        const activeTransfers = transfers.filter(t => t.status === 'transferring' || t.status === 'pending' || t.status === 'connecting');
        
        return (
          <div className="w-full h-full" ref={transferProgressRef}>
            <GlassCard className="p-4 min-h-[500px]">
              <h2 className="text-xl font-bold mb-4" style={{ color: '#2C1B12' }}>Transfer Progress</h2>
              {activeTransfers.length === 0 && completedTransfers.length === 0 ? (
                <div className="text-center py-12">
                  <File className="w-12 h-12 mx-auto mb-4 text-orange-400/60" />
                  <p className="text-orange-700/80 mb-4">No active transfers</p>
                  <motion.button
                    onClick={handleSendMore}
                    className="px-6 py-3 rounded-lg font-medium text-white"
                    style={{ backgroundColor: '#F6C148' }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Start New Transfer
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active Transfers */}
                  {activeTransfers.map((transfer) => (
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
                        bytesTransferred={transfer.bytesTransferred}
                        status={transfer.status}
                      />
                    </div>
                  ))}
                  
                  {/* Transfer History */}
                  {completedTransfers.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-orange-200">
                      <h3 className="text-lg font-bold mb-4" style={{ color: '#2C1B12' }}>Transfer History</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {completedTransfers.map((transfer) => {
                          const times = transferTimes?.[transfer.id];
                          const isIncoming = transfer.id.startsWith('receive-');
                          const direction = isIncoming ? 'Received' : 'Sent';
                          return (
                            <div
                              key={transfer.id}
                              className="p-3 rounded-lg bg-white/20 border border-orange-100/40 backdrop-blur-sm"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate text-sm" style={{ color: '#2C1B12' }}>
                                    {transfer.file.name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs" style={{ color: '#A6521B' }}>
                                      {direction} from/to {transfer.peer.name}
                                    </span>
                                    <span className="text-xs" style={{ color: '#2C1B12', opacity: 0.6 }}>
                                      • {formatFileSize(transfer.file.size)}
                                    </span>
                                  </div>
                                  {times?.duration && (
                                    <p className="text-xs mt-1" style={{ color: '#2C1B12', opacity: 0.6 }}>
                                      Duration: {(times.duration / 1000).toFixed(1)}s
                                    </p>
                                  )}
                                </div>
                                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Send More button after transfer completes */}
                  {hasCompletedTransfers && !hasActiveTransfers && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 pt-6 border-t border-orange-200"
                    >
                      <motion.button
                        onClick={handleSendMore}
                        className="w-full p-4 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#F6C148' }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Send size={20} />
                        Send More Files
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              )}
            </GlassCard>
          </div>
        );

      default:
        return null;
    }
  };

  const showNextButton = currentSlide < 2 && canProceedToNext();
  const showBackButton = currentSlide === 2 && selectedPeer && selectedFiles.length > 0;
  const showLeftArrow = currentSlide > 0;
  const showRightArrow = currentSlide < 3 && canProceedToNext();

  return (
    <div 
      className="relative w-full overflow-hidden" 
      style={{ minHeight: '600px', maxWidth: '100vw' }}
    >
      {/* Carousel Container */}
      <motion.div
        className="flex"
        animate={{ x: `-${currentSlide * 25}%` }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{ width: '400%', touchAction: 'pan-x' }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(event, info) => {
          const threshold = 50;
          if (info.offset.x > threshold && currentSlide > 0) {
            isManualNavigationRef.current = true;
            handlePrevious();
          } else if (info.offset.x < -threshold && currentSlide < 3) {
            isManualNavigationRef.current = true;
            handleNext();
          }
        }}
      >
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex-shrink-0" style={{ width: '25%', maxWidth: '100vw', padding: '0 0.75rem', boxSizing: 'border-box' }}>
            <div className="w-full h-full">
              {renderSlide(index)}
            </div>
          </div>
        ))}
      </motion.div>

      {/* Left Arrow */}
      {showLeftArrow && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          onClick={handlePrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-white/40 transition-colors"
          style={{ color: '#2C1B12' }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronLeft size={24} />
        </motion.button>
      )}

      {/* Right Arrow */}
      {showRightArrow && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-white/40 transition-colors"
          style={{ color: '#2C1B12' }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronRight size={24} />
        </motion.button>
      )}

      {/* Next Button */}
      {showNextButton && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <motion.button
            onClick={handleNext}
            className="px-8 py-4 text-white rounded-lg font-semibold text-lg shadow-lg flex items-center gap-2"
            style={{ backgroundColor: '#F6C148' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Next
            <ChevronRight size={20} />
          </motion.button>
        </motion.div>
      )}

      {/* Back Button (on Target Cub slide) */}
      {showBackButton && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <motion.button
            onClick={handlePrevious}
            className="px-8 py-4 text-white rounded-lg font-semibold text-lg shadow-lg flex items-center gap-2"
            style={{ backgroundColor: '#A6521B' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={20} />
            Back
          </motion.button>
        </motion.div>
      )}

      {/* Slide Indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
        {[0, 1, 2, 3].map((index) => (
          <motion.div
            key={index}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentSlide ? 'bg-orange-500' : 'bg-white/40'
            }`}
            animate={{
              scale: index === currentSlide ? 1.2 : 1,
              opacity: index === currentSlide ? 1 : 0.5
            }}
          />
        ))}
      </div>
    </div>
  );
};

