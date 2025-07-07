import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LionsDen } from '../components/LionsDen';
import { ProfileModal } from '../components/ProfileModal';
import { RoomModal } from '../components/RoomModal';
import { FamilyPrivacyNotice } from '../components/FamilyPrivacyNotice';
import { ToastContainer, Toast } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { Peer } from '../types';
import { getRandomColor, getRandomEmoji } from '../utils/colors';
import { generateRandomUsername } from '../utils/names';
import { LionIcon } from '../components/LionIcon';
import { formatFileSize } from '../utils/format';
import JSZip from 'jszip';
import { Globe, Lock, Wifi, Play, FileText } from 'lucide-react';
import { logUserAction, logSystemEvent } from '../utils/eventLogger';

import { DemoModal } from '../components/DemoModal';
import { IncomingFileModal } from '../components/IncomingFileModal';
import { NetworkErrorModal } from '../components/NetworkErrorModal';
import Confetti from 'react-confetti';

const WORLD_OPTIONS = [
  { key: 'jungle', label: 'Jungle', icon: '🌍', desc: 'Open world - share with anyone globally' },
  { key: 'room', label: 'Room', icon: '🔒', desc: 'Private room - secure sharing with room code' },
  { key: 'family', label: 'Local Den', icon: '🏠', desc: 'Share with anyone on your WiFi (Local Den)' },
] as const;
type WorldType = typeof WORLD_OPTIONS[number]['key'];

interface AppPageProps {
  onNavigateToLog: () => void;
}

export const AppPage: React.FC<AppPageProps> = ({ onNavigateToLog }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [currentUser, setCurrentUser] = useState(() => ({
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: generateRandomUsername(),
    emoji: getRandomEmoji(),
    color: getRandomColor(),
  }));

  // Toast management
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const { 
    isConnected, 
    peers, 
    currentRoom, 
    publicIp, 
    joinRoom, 
    joinDefaultRoom, 
    joinFamilyRoom, 
    updateProfile, 
    sendSignal, 
    onSignal,
    networkStatus,
    connectionMode,
    fallbackStatus,
    manualRetry,
    handleNetworkError,
    restored,
    restoredSpeed,
    restoredRtt,
    clearRestored,
    resetRetryState,
    retryState,
    retryConnection,
    resetRetry,
    cancelRetry
  } = useSocket();
  const { transfers, incomingFiles, sendFile, handleSignal, cancelTransfer, acceptIncomingFile, rejectIncomingFile, completedReceived } = useWebRTC(sendSignal, currentUser.id, addToast, peers, isConnected);

  // Set up signal handling once
  useEffect(() => {
    const cleanup = onSignal((from, data) => {
      handleSignal(from, data);
    });
    
    return cleanup;
  }, [onSignal, handleSignal]);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<null | typeof completedReceived[0]>(null);
  const prevCompletedCount = useRef(0);
  const [shownTransferToasts, setShownTransferToasts] = useState<Set<string>>(new Set());
  const [transferTimes, setTransferTimes] = useState<Record<string, { start: number; end?: number; duration?: number }>>({});

  const [selectedWorld, setSelectedWorld] = useState<WorldType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showFamilyNotice, setShowFamilyNotice] = useState(false);
  const [pendingWorld, setPendingWorld] = useState<WorldType | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Join rooms when connection is established
  useEffect(() => {
    if (isConnected && selectedWorld) {
      if (selectedWorld === 'jungle') {
        joinDefaultRoom(currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
      }
    }
  }, [isConnected, selectedWorld, currentUser, joinDefaultRoom]);

  // Show modal when a new completed transfer is added
  useEffect(() => {
    if (completedReceived.length > prevCompletedCount.current) {
      setActiveTransfer(completedReceived[completedReceived.length - 1]);
      setShowTransferModal(true);
    }
    prevCompletedCount.current = completedReceived.length;
  }, [completedReceived]);

  const handlePeerClick = (peer: Peer) => {
    setSelectedPeer(peer);
    logUserAction.peerSelected(peer.id, peer.name);
  };

  const handleSendFiles = async (files: File[], peer: Peer) => {
    const processName = 'file_transfer';
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const fileTypes = [...new Set(files.map(file => file.type))];
    
    try {
      // Start file transfer process
      logUserAction.processStarted(processName, 'transfer_initiated', { 
        peerId: peer.id, 
        peerName: peer.name,
        fileCount: files.length, 
        totalSize,
        fileTypes 
      });
      
      logUserAction.transferInitiated(peer.id, files.length, totalSize);
      
      // Log each file being sent
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        logUserAction.processStep(processName, `sending_file_${i + 1}`, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileIndex: i + 1,
          totalFiles: files.length
        });
        
        await sendFile(file, peer);
      }
      
      addToast('success', `Sending ${files.length} file(s) to ${peer.name}...`);
      setSelectedFiles([]); // Clear selection after sending
      
      logUserAction.processCompleted(processName, 'transfer_sent', {
        peerId: peer.id,
        peerName: peer.name,
        fileCount: files.length,
        totalSize
      });
      
    } catch (error) {
      console.error('Failed to send files:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addToast('error', `Failed to send files to ${peer.name}`);
      logSystemEvent.error('file_transfer', `Failed to send files to ${peer.name}`, { peerId: peer.id, fileCount: files.length });
      logUserAction.processFailed(processName, 'transfer_failed', errorMessage, {
        peerId: peer.id,
        peerName: peer.name,
        fileCount: files.length,
        totalSize
      });
    }
  };

  const handleCancelTransfer = (transferId: string) => {
    cancelTransfer(transferId);
    addToast('info', 'Transfer cancelled');
  };

  // Track transfer start and end times
  useEffect(() => {
    transfers.forEach(transfer => {
      // Track start time
      if ((transfer.status === 'transferring' || transfer.status === 'pending' || transfer.status === 'connecting') && !transferTimes[transfer.id]) {
        setTransferTimes(prev => ({ ...prev, [transfer.id]: { start: Date.now() } }));
      }
      // Track end time and duration
      if (transfer.status === 'completed' && transferTimes[transfer.id] && !transferTimes[transfer.id].end) {
        const end = Date.now();
        const duration = end - transferTimes[transfer.id].start;
        setTransferTimes(prev => ({ ...prev, [transfer.id]: { ...prev[transfer.id], end, duration } }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfers]);

  // Toast logic: Only show one toast per completed transfer
  useEffect(() => {
    transfers.forEach(transfer => {
      if (transfer.status === 'completed' && !shownTransferToasts.has(transfer.id)) {
        addToast('success', `File transfer completed!`);
        setShownTransferToasts(prev => new Set(prev).add(transfer.id));
        // Show confetti for the first completed transfer
        if (!showConfetti) setShowConfetti(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const fileTypes = [...new Set(files.map(file => file.type))];
    logUserAction.filesSelected(files.length, totalSize, fileTypes);
  };

  const handleProfileUpdate = (profile: { name: string; emoji: string; color: string }) => {
    const processName = 'profile_update';
    const oldName = currentUser.name;
    const oldEmoji = currentUser.emoji;
    const oldColor = currentUser.color;
    
    try {
      logUserAction.processStarted(processName, 'profile_update_initiated', {
        oldName,
        newName: profile.name,
        oldEmoji,
        newEmoji: profile.emoji,
        oldColor,
        newColor: profile.color
      });
      
      setCurrentUser(prev => ({ ...prev, ...profile }));
      
      logUserAction.processStep(processName, 'profile_updated_locally', {
        newName: profile.name,
        newEmoji: profile.emoji,
        newColor: profile.color
      });
      
      updateProfile(profile.name, profile.color, profile.emoji);
      
      logUserAction.processStep(processName, 'profile_synced_to_server', {
        newName: profile.name,
        newEmoji: profile.emoji,
        newColor: profile.color
      });
      
      logUserAction.profileUpdated('name', oldName, profile.name);
      
      logUserAction.processCompleted(processName, 'profile_update_completed', {
        oldName,
        newName: profile.name,
        oldEmoji,
        newEmoji: profile.emoji,
        oldColor,
        newColor: profile.color
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logUserAction.processFailed(processName, 'profile_update_failed', errorMessage, {
        oldName,
        newName: profile.name,
        oldEmoji,
        newEmoji: profile.emoji,
        oldColor,
        newColor: profile.color
      });
    }
  };

  const ZipPreview: React.FC<{ file: File }> = ({ file }) => {
    const [tree, setTree] = useState<Array<{ name: string; dir: boolean; size?: number }>>([]);
    useEffect(() => {
      const loadZip = async () => {
        const zip = await JSZip.loadAsync(file);
        const files: Array<{ name: string; dir: boolean; size?: number }> = [];
        zip.forEach((relativePath, zipEntry) => {
          // JSZip typings do not expose _data, so we cast to any
          const size = (zipEntry as any)._data?.uncompressedSize;
          files.push({
            name: zipEntry.name,
            dir: zipEntry.dir,
            size,
          });
        });
        setTree(files);
      };
      loadZip();
    }, [file]);
    return (
      <div className="w-full max-h-48 overflow-auto bg-gray-50 rounded p-2 mb-4 border text-xs">
        <div className="font-semibold mb-1">ZIP Contents:</div>
        <ul>
          {tree.map((entry, i) => (
            <li key={i} className={entry.dir ? 'font-bold' : ''}>
              {entry.dir ? '📁' : '📄'} {entry.name} {entry.size ? `(${formatFileSize(entry.size)})` : ''}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const TextPreview: React.FC<{ file: File }> = ({ file }) => {
    const [text, setText] = useState('');
    useEffect(() => {
      file.text().then(t => setText(t.slice(0, 2000)));
    }, [file]);
    return (
      <pre className="w-full max-h-48 overflow-auto bg-gray-50 rounded p-2 mb-4 border text-xs whitespace-pre-wrap">{text}</pre>
    );
  };

  const handleWorldSelect = (world: WorldType) => {
    // Start world selection process
    logUserAction.processStarted('world_selection', 'world_clicked', { world });
    logUserAction.worldSelected(world);

    if (world === 'room') {
      logUserAction.processStep('world_selection', 'show_room_modal', { world });
      setShowRoomModal(true);
      setPendingWorld(world);
    } else if (world === 'family') {
      logUserAction.processStep('world_selection', 'show_family_notice', { world });
      setShowFamilyNotice(true);
      setPendingWorld(world);
    } else {
      // Jungle - direct selection
      logUserAction.processStep('world_selection', 'direct_selection', { world });
      setSelectedWorld(world);
      logUserAction.processCompleted('world_selection', 'jungle_selected', { world });
    }
  };

  const handleRoomJoin = (roomId: string) => {
    if (isConnected && pendingWorld === 'room') {
      logUserAction.processStep('world_selection', 'room_join_attempt', { roomId, world: 'room' });
      
      try {
        joinRoom(roomId, currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
        setSelectedWorld('room');
        setPendingWorld(null);
        logUserAction.roomJoined(roomId, 'room');
        logUserAction.processCompleted('world_selection', 'room_joined', { roomId, world: 'room' });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logUserAction.processFailed('world_selection', 'room_join_failed', errorMessage, { roomId, world: 'room' });
      }
    }
  };

  const handleFamilyAccept = () => {
    if (isConnected && pendingWorld === 'family') {
      logUserAction.processStep('world_selection', 'family_accept_attempt', { world: 'family' });
      
      try {
        joinFamilyRoom(currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
        setSelectedWorld('family');
        setPendingWorld(null);
        setShowFamilyNotice(false);
        logUserAction.processCompleted('world_selection', 'family_joined', { world: 'family' });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logUserAction.processFailed('world_selection', 'family_join_failed', errorMessage, { world: 'family' });
      }
    }
  };

  const handleFamilyDecline = () => {
    setPendingWorld(null);
    setShowFamilyNotice(false);
    setShowRoomModal(true);
  };

  // Handle world switching from navbar
  const handleWorldSwitch = () => {
    setSelectedWorld(null);
  };

  const WorldSwitcher: React.FC<{ value: WorldType | null; onChange: (w: WorldType) => void }> = ({ value, onChange }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh]">
    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-orange-100/80 via-amber-100/60 to-white/80" />
    <img
      src="/favicon.gif"
      alt="c0py.me Lion Logo"
      className="w-32 h-32 mb-6 drop-shadow-2xl animate-bounce-slow"
      style={{ filter: 'drop-shadow(0 8px 32px #A6521B66)' }}
    />
    <h2 className="text-4xl font-bold mb-8 tracking-tight" style={{ color: '#A6521B', textShadow: '0 2px 16px #fff8' }}>Welcome to c0py.me</h2>
    <div className="flex flex-wrap gap-8 mb-4 justify-center">
      {WORLD_OPTIONS.map(opt => (
        <button
          key={opt.key}
          className={`relative group flex flex-col items-center px-10 py-8 rounded-3xl shadow-xl border-2 transition-all text-lg font-semibold focus:outline-none backdrop-blur-[16px] bg-white/30 border-white/40 hover:bg-white/50 hover:scale-105 active:scale-100 ${value === opt.key ? 'border-orange-400 ring-4 ring-orange-200/60 scale-105' : ''}`}
          style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.10)' }}
          onClick={() => onChange(opt.key)}
        >
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/30 backdrop-blur-[10px] shadow-lg border border-white/30 mb-3">
            {opt.key === 'jungle' && <Globe size={36} style={{ color: '#A6521B' }} />}
            {opt.key === 'room' && <Lock size={36} style={{ color: '#A6521B' }} />}
            {opt.key === 'family' && <Wifi size={36} style={{ color: '#A6521B' }} />}
          </span>
          <span className="text-xl font-bold mb-1 tracking-tight" style={{ color: value === opt.key ? '#A6521B' : '#2C1B12' }}>{opt.label}</span>
          <span className="text-xs text-center px-2" style={{ color: '#A6521B', opacity: 0.8 }}>{opt.desc}</span>
         
          {value === opt.key && (
            <span className="absolute -top-3 right-4 bg-orange-400 text-white text-xs px-3 py-1 rounded-full shadow-lg animate-pulse">Selected</span>
          )}
          {/* Shine effect */}
          <span className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(120deg,rgba(255,255,255,0.25) 0%,rgba(255,255,255,0.05) 100%)' }} />
        </button>
      ))}
    </div>
    <div className="flex flex-col items-center gap-3 mt-4">
      <span className="px-5 py-2 rounded-full bg-white/60 backdrop-blur-[8px] shadow border border-orange-100/60 text-base font-semibold text-orange-900/90" style={{ letterSpacing: '0.01em' }}>
        Select a world to get started
      </span>
      <a
        href="https://www.linkedin.com/in/sanathswaroop/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 px-4 py-1.5 rounded-full bg-white/40 backdrop-blur-[6px] shadow border border-orange-100/60 text-xs font-medium text-orange-700/90 flex items-center gap-1 hover:bg-orange-100/60 transition"
        style={{ textDecoration: 'none' }}
      >
        Made with <span className="text-red-500 text-base">♥</span> by Sanath
      </a>
    </div>
  </div>
);

// Filter peers based on selected world
const filteredPeers = React.useMemo(() => {
  const otherPeers = peers.filter(p => p.id !== currentUser.id);
  
  if (selectedWorld === 'jungle') {
    return otherPeers.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  } else if (selectedWorld === 'room' || selectedWorld === 'family') {
    // For Room and Family, only show peers in the same room
    return otherPeers.filter(p => p.roomId === currentRoom);
  }
  
  return otherPeers;
}, [peers, currentUser.id, searchQuery, selectedWorld, currentRoom]);

  // Modal open state
  const isAnyModalOpen = !selectedWorld || showRoomModal || showFamilyNotice || showProfileModal || showTransferModal;



  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 relative">
      {showConfetti && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, pointerEvents: 'none' }}>
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={400} />
        </div>
      )}
      {/* Global Modal Overlay */}
      {isAnyModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[12px] transition-all" style={{ WebkitBackdropFilter: 'blur(12px)' }} />
      )}

      {/* World Switcher Overlay */}
      {!selectedWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <WorldSwitcher value={selectedWorld} onChange={handleWorldSelect} />
        </div>
      )}

      {/* Room Modal */}
      <AnimatePresence>
        {showRoomModal && (
          <RoomModal
            isOpen={showRoomModal}
            onClose={() => {
              setShowRoomModal(false);
              setPendingWorld(null);
            }}
            onJoinRoom={handleRoomJoin}
          />
        )}
      </AnimatePresence>

      {/* Family Privacy Notice */}
      <AnimatePresence>
        {showFamilyNotice && (
          <FamilyPrivacyNotice
            onAccept={handleFamilyAccept}
            onCreateRoom={handleFamilyDecline}
            onJoinJungle={() => {
              setSelectedWorld('jungle');
              setShowFamilyNotice(false);
              setPendingWorld(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Navbar with animated logo */}
      <motion.header
        className="p-4 md:p-6 border-b relative"
        style={{ borderColor: 'rgba(166, 82, 27, 0.1)' }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <motion.img
              src="/logo.png"
              alt="c0py.me Lion Logo"
              className="w-12 h-12 md:w-16 md:h-16"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            />
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#2C1B12' }}>
              c0py.me
            </h1>
          </div>

          {/* Navigation - Desktop and Mobile */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Demo Button */}
            <button
              onClick={() => setShowDemo(true)}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
            >
              <Play size={16} className="text-orange-700" />
              <span className="text-xs md:text-sm font-medium hidden sm:inline" style={{ color: '#A6521B' }}>
                Demo
              </span>
            </button>

            {/* Logs Button */}
            <button
              onClick={onNavigateToLog}
              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-full transition-all hover:scale-105"
              style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
            >
              <FileText size={16} className="text-orange-700" />
              <span className="text-xs md:text-sm font-medium hidden sm:inline" style={{ color: '#A6521B' }}>
                Logs
              </span>
            </button>

            {/* World Indicator */}
            {selectedWorld && (
              <motion.button
                onClick={handleWorldSwitch}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 rounded-full transition-all hover:scale-105"
                style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-sm md:text-lg">
                  {selectedWorld === 'jungle' ? '🌍' : selectedWorld === 'room' ? '🔒' : '📶'}
                </span>
                <span className="text-xs md:text-sm font-medium capitalize hidden sm:inline" style={{ color: '#A6521B' }}>
                  {selectedWorld}
                </span>
                {currentRoom && selectedWorld !== 'jungle' && (
                  <span className="text-xs font-mono hidden md:inline" style={{ color: '#A6521B', opacity: 0.7 }}>
                    {currentRoom}
                  </span>
                )}
                <span className="text-xs hidden lg:inline" style={{ color: '#A6521B', opacity: 0.6 }}>
                  (click to switch)
                </span>
              </motion.button>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center gap-1 md:gap-2">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 
                networkStatus.isRetrying ? 'bg-yellow-400' : 
                'bg-red-400'
              }`} />
              <span className="text-xs md:text-sm hidden sm:inline" style={{ color: '#2C1B12', opacity: 0.8 }}>
                {isConnected ? `Connected (${connectionMode})` : 
                 networkStatus.isRetrying ? `Retrying (${networkStatus.retryCount}/5)` :
                 !networkStatus.isOnline ? 'No Internet' :
                 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      {selectedWorld && (
        <main className="p-0 md:p-0 w-full">
          {/* Search Bar */}
          {selectedWorld && (
            <div className="mb-6 flex justify-center px-4 md:px-8">
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
                  selectedWorld === 'jungle' 
                    ? "Search by name or user ID..." 
                    : selectedWorld === 'room'
                    ? "Search room members..."
                    : "Search family members..."
                }
                className="w-full max-w-md px-4 py-2 rounded-xl border border-orange-200 bg-white/60 shadow focus:outline-none focus:ring-2 focus:ring-orange-300 text-lg"
              />
            </div>
          )}

          {/* --- New Three-Row Layout --- */}

          {/* Row 1: Transfer Progress (current transfers only) */}
          {transfers.some(t => t.status === 'transferring' || t.status === 'pending' || t.status === 'connecting') && (
            <div className="w-full px-0 md:px-0 mb-8">
              <LionsDen
                peers={filteredPeers}
                currentUser={currentUser}
                selectedPeer={selectedPeer}
                selectedFiles={selectedFiles}
                transfers={transfers}
                currentWorld={selectedWorld}
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
                mode="progress"
                transferTimes={transferTimes}
              />
            </div>
          )}

          {/* Row 2: 3-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full px-4 md:px-8 mb-8">
            {/* Lion's Den (Radar + No cubs text) */}
            <LionsDen
              peers={filteredPeers}
              currentUser={currentUser}
              selectedPeer={selectedPeer}
              selectedFiles={selectedFiles}
              transfers={transfers}
              currentWorld={selectedWorld}
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
              mode="den"
            />
            {/* Select Prey (Files) */}
            <LionsDen
              peers={filteredPeers}
              currentUser={currentUser}
              selectedPeer={selectedPeer}
              selectedFiles={selectedFiles}
              transfers={transfers}
              currentWorld={selectedWorld}
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
              mode="prey"
            />
            {/* Target Cub */}
            <LionsDen
              peers={filteredPeers}
              currentUser={currentUser}
              selectedPeer={selectedPeer}
              selectedFiles={selectedFiles}
              transfers={transfers}
              currentWorld={selectedWorld}
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
              mode="target"
            />
          </div>

          {/* Row 3: Transfer History Table (completed transfers only) */}
          <div className="w-full px-0 md:px-0 mb-8">
            <LionsDen
              peers={filteredPeers}
              currentUser={currentUser}
              selectedPeer={selectedPeer}
              selectedFiles={selectedFiles}
              transfers={transfers}
              currentWorld={selectedWorld}
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
              mode="history"
              transferTimes={transferTimes}
            />
          </div>

          {/* Incoming File Modal (always visible when needed) */}
          {incomingFiles && incomingFiles.length > 0 && (
            <IncomingFileModal
              isOpen={true}
              file={incomingFiles[0]}
              onAccept={() => acceptIncomingFile(incomingFiles[0].id)}
              onReject={() => rejectIncomingFile(incomingFiles[0].id)}
            />
          )}
        </main>
      )}

      {/* Modals */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentProfile={currentUser}
        onSave={handleProfileUpdate}
      />

      {/* Network Error Modal */}
      <NetworkErrorModal
        isOpen={!!networkStatus.lastError || restored}
        networkStatus={networkStatus}
        onRetry={manualRetry}
        onClose={resetRetryState}
        restored={restored}
        restoredSpeed={restoredSpeed}
        restoredRtt={restoredRtt}
        onClearRestored={clearRestored}
        retryState={retryState}
      />

      {/* Transfer Complete Modal */}
      {showTransferModal && activeTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full relative flex flex-col items-center">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-xl"
              onClick={() => setShowTransferModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#2C1B12' }}>File Received!</h2>
            <p className="mb-4 text-sm text-gray-500">You received a file from <span className="font-semibold">{activeTransfer.peer.name}</span></p>
            {/* Preview if image/video */}
            {activeTransfer.file.type.startsWith('image/') && (
              <img src={activeTransfer.url} alt={activeTransfer.file.name} className="max-w-full max-h-48 rounded mb-4 border" />
            )}
            {activeTransfer.file.type.startsWith('video/') && (
              <video src={activeTransfer.url} controls className="max-w-full max-h-48 rounded mb-4 border" />
            )}
            {activeTransfer.file.type === 'application/pdf' && (
              <iframe src={activeTransfer.url} title={activeTransfer.file.name} className="w-full h-64 rounded mb-4 border" />
            )}
            {activeTransfer.file.type === 'application/zip' && (
              <ZipPreview file={activeTransfer.file} />
            )}
            {activeTransfer.file.type.startsWith('text/') && (
              <TextPreview file={activeTransfer.file} />
            )}
            <div className="w-full mb-2">
              <div className="font-medium text-lg" style={{ color: '#A6521B' }}>{activeTransfer.file.name}</div>
              <div className="text-xs text-gray-500">{activeTransfer.file.type} • {formatFileSize(activeTransfer.file.size)}</div>
            </div>
            <a
              href={activeTransfer.url}
              download={activeTransfer.file.name}
              className="mt-4 w-full py-2 px-4 rounded-lg bg-orange-400 text-white font-semibold text-center hover:bg-orange-500 transition"
            >
              Download
            </a>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      
      {/* Demo Modal */}
      <DemoModal isOpen={showDemo} onClose={() => setShowDemo(false)} />
    </div>
  );
};