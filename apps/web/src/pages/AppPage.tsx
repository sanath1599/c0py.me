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
import { LionIcon } from '../components/LionIcon';
import { formatFileSize } from '../utils/format';
import JSZip from 'jszip';

const WORLD_OPTIONS = [
  { key: 'jungle', label: 'Jungle', icon: '🌍', desc: 'Open space, send to anyone' },
  { key: 'room', label: 'Room', icon: '🏠', desc: 'Private group room' },
  { key: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦', desc: 'Same WiFi group' },
] as const;
type WorldType = typeof WORLD_OPTIONS[number]['key'];

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

  const { isConnected, peers, currentRoom, publicIp, joinRoom, joinDefaultRoom, joinFamilyRoom, updateProfile, sendSignal, onSignal } = useSocket();
  const { transfers, incomingFiles, sendFile, handleSignal, cancelTransfer, acceptIncomingFile, rejectIncomingFile, completedReceived } = useWebRTC(sendSignal, currentUser.id);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<null | typeof completedReceived[0]>(null);
  const prevCompletedCount = useRef(0);
  const shownTransferToasts = useRef(new Set<string>());

  const [selectedWorld, setSelectedWorld] = useState<WorldType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showFamilyNotice, setShowFamilyNotice] = useState(false);
  const [pendingWorld, setPendingWorld] = useState<WorldType | null>(null);

  // Set up signal handling once
  useEffect(() => {
    const cleanup = onSignal((from, data) => {
      handleSignal(from, data);
    });
    
    return cleanup;
  }, [onSignal, handleSignal]);

  // Join default jungle room when connection is established
  useEffect(() => {
    if (isConnected && selectedWorld === 'jungle') {
      joinDefaultRoom(currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
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
      if ((transfer.status === 'completed' || transfer.status === 'failed') && !shownTransferToasts.current.has(transfer.id)) {
        if (transfer.status === 'completed') {
          addToast('success', `File transfer completed!`);
        } else if (transfer.status === 'failed') {
          addToast('error', `File transfer failed`);
        }
        shownTransferToasts.current.add(transfer.id);
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
    if (world === 'room') {
      setShowRoomModal(true);
      setPendingWorld(world);
    } else if (world === 'family') {
      setShowFamilyNotice(true);
      setPendingWorld(world);
    } else {
      // Jungle - direct selection
      setSelectedWorld(world);
    }
  };

  const handleRoomJoin = (roomId: string) => {
    if (isConnected && pendingWorld === 'room') {
      joinRoom(roomId, currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
      setSelectedWorld('room');
      setPendingWorld(null);
    }
  };

  const handleFamilyAccept = () => {
    if (isConnected && pendingWorld === 'family') {
      joinFamilyRoom(currentUser.id, currentUser.name, currentUser.color, currentUser.emoji);
      setSelectedWorld('family');
      setPendingWorld(null);
      setShowFamilyNotice(false);
    }
  };

  const handleFamilyDecline = () => {
    setPendingWorld(null);
    setShowFamilyNotice(false);
  };

  const WorldSwitcher: React.FC<{ value: WorldType | null; onChange: (w: WorldType) => void }> = ({ value, onChange }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh]">
    <div className="absolute inset-0 -z-10 bg-gradient-to-br from-orange-100/80 via-amber-100/60 to-white/80" />
    <img
      src="/favicon.gif"
      alt="ShareDrop Lion Logo"
      className="w-20 h-20 mb-4 drop-shadow-xl animate-bounce-slow"
      style={{ filter: 'drop-shadow(0 4px 24px #A6521B44)' }}
    />
    <h2 className="text-3xl font-bold mb-8 tracking-tight" style={{ color: '#A6521B', textShadow: '0 2px 16px #fff8' }}>Welcome to ShareDrop</h2>
    <div className="flex flex-wrap gap-8 mb-4 justify-center">
      {WORLD_OPTIONS.map(opt => (
        <button
          key={opt.key}
          className={`relative group flex flex-col items-center px-10 py-8 rounded-3xl shadow-xl border-2 transition-all text-lg font-semibold focus:outline-none backdrop-blur-[16px] bg-white/30 border-white/40 hover:bg-white/50 hover:scale-105 active:scale-100 ${value === opt.key ? 'border-orange-400 ring-4 ring-orange-200/60 scale-105' : ''}`}
          style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.10)' }}
          onClick={() => onChange(opt.key)}
        >
          <span className="text-5xl mb-3 drop-shadow-lg transition-transform group-hover:scale-110 group-active:scale-95">
            {opt.icon}
          </span>
          <span className="text-xl font-bold mb-1 tracking-tight" style={{ color: value === opt.key ? '#A6521B' : '#2C1B12' }}>{opt.label}</span>
          <span className="block text-xs font-normal mt-1 text-gray-500 text-center max-w-[10rem]">{opt.desc}</span>
          {value === opt.key && (
            <span className="absolute -top-3 right-4 bg-orange-400 text-white text-xs px-3 py-1 rounded-full shadow-lg animate-pulse">Selected</span>
          )}
          {/* Shine effect */}
          <span className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(120deg,rgba(255,255,255,0.25) 0%,rgba(255,255,255,0.05) 100%)' }} />
        </button>
      ))}
    </div>
    <p className="text-sm text-gray-400 mt-4 backdrop-blur">Select a world to get started</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 relative">
      {/* World Switcher Overlay */}
      {!selectedWorld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-[8px]">
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
            onDecline={handleFamilyDecline}
          />
        )}
      </AnimatePresence>
      {/* Modal Overlay */}
      {(showProfileModal || showTransferModal) && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[8px] transition-all" style={{ WebkitBackdropFilter: 'blur(8px)' }} />
      )}
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
          <div className="flex items-center gap-4">
            {/* World Indicator */}
            {selectedWorld && (
              <motion.button
                onClick={() => setSelectedWorld(null)}
                className="flex items-center gap-2 px-3 py-1 rounded-full transition-all hover:scale-105"
                style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-lg">
                  {selectedWorld === 'jungle' ? '🌍' : selectedWorld === 'room' ? '🏠' : '👨‍👩‍👧‍👦'}
                </span>
                <span className="text-sm font-medium capitalize" style={{ color: '#A6521B' }}>
                  {selectedWorld}
                </span>
                {currentRoom && selectedWorld !== 'jungle' && (
                  <span className="text-xs font-mono" style={{ color: '#A6521B', opacity: 0.7 }}>
                    {currentRoom}
                  </span>
                )}
                <span className="text-xs" style={{ color: '#A6521B', opacity: 0.6 }}>
                  (click to switch)
                </span>
              </motion.button>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-sm" style={{ color: '#2C1B12', opacity: 0.8 }}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      {selectedWorld && (
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            {/* Search Bar */}
            {selectedWorld && (
              <div className="mb-6 flex justify-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
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
            {/* Lions Den - New Layout */}
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
            />
          </div>
        </main>
      )}

      {/* Modals */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentProfile={currentUser}
        onSave={handleProfileUpdate}
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
    </div>
  );
};