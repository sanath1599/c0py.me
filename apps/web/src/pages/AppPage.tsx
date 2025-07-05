import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { LionsDen } from '../components/LionsDen';
import { ProfileModal } from '../components/ProfileModal';
import { ToastContainer, Toast } from '../components/Toast';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { Peer } from '../types';
import { getRandomColor, getRandomEmoji } from '../utils/colors';
import { LionIcon } from '../components/LionIcon';
import { formatFileSize } from '../utils/format';
import JSZip from 'jszip';

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
  const { transfers, incomingFiles, sendFile, handleSignal, cancelTransfer, acceptIncomingFile, rejectIncomingFile, completedReceived } = useWebRTC(sendSignal, currentUser.id);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<null | typeof completedReceived[0]>(null);
  const prevCompletedCount = useRef(0);
  const shownTransferToasts = useRef(new Set<string>());

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 relative">
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