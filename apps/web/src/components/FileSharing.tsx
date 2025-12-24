import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { CubProgress } from './CubProgress';
import { FileTransfer, Peer } from '../types';


interface FileSharingProps {
  selectedFiles: File[];
  selectedPeer: Peer | null;
  transfers: FileTransfer[];
  onSendFiles: (files: File[], peer: Peer) => void;
  onCancelTransfer: (transferId: string) => void;
  onClearSelection: () => void;
}

export const FileSharing: React.FC<FileSharingProps> = ({
  selectedFiles,
  selectedPeer,
  transfers,
  onSendFiles,
  onCancelTransfer,
  onClearSelection
}) => {
  const [showToast, setShowToast] = useState<null | { message: string; type: 'success' | 'error' }>();

  // Show toast on transfer complete or error
  useEffect(() => {
    const completed = transfers.find(t => t.status === 'completed');
    const failed = transfers.find(t => t.status === 'failed');
    if (completed) {
      setShowToast({ message: 'File transfer completed!', type: 'success' });
      setTimeout(() => setShowToast(null), 3000);
    } else if (failed) {
      setShowToast({ message: 'File transfer failed.', type: 'error' });
      setTimeout(() => setShowToast(null), 3000);
    }
  }, [transfers]);

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
        return <Loader className="w-4 h-4 animate-spin text-blue-400" />;
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
    <GlassCard className="p-6">
      {/* Toast notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            className={`fixed top-6 right-6 px-4 py-2 rounded shadow-lg z-50 text-white ${showToast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {showToast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: '#2C1B12' }}>File Sharing</h2>
        {selectedPeer && (
          <button
            onClick={onClearSelection}
            className="p-2 rounded-lg transition-colors"
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
            <X size={16} />
          </button>
        )}
      </div>

      {/* Target peer selection */}
      <AnimatePresence mode="wait">
        {selectedPeer ? (
          <motion.div
            key="selected-peer"
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(166, 82, 27, 0.05)' }}>
              <Avatar
                emoji={selectedPeer.emoji}
                color={selectedPeer.color}
                size="sm"
              />
              <div>
                <p className="font-medium" style={{ color: '#2C1B12' }}>Sending to</p>
                <p className="text-sm" style={{ color: '#2C1B12', opacity: 0.6 }}>{selectedPeer.name}</p>
              </div>
            </div>
            {/* Ready to send state */}
            {selectedFiles.length === 0 && (
              <div className="text-center mt-4 text-yellow-700">
                Select files to send
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="no-peer"
            className="mb-6 text-center py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p style={{ color: '#2C1B12', opacity: 0.6 }}>Select a device from the radar to send files</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send button - always visible if peer and files selected */}
      <AnimatePresence>
        {selectedPeer && selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <motion.button
              className="w-full mb-6 p-4 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                : `Send ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}`
              }
            </motion.button>
            {hasActiveTransfer && (
              <motion.p
                className="text-sm text-red-600 text-center mb-4 -mt-4"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                Error: transfer in progress, please wait for current transfer to finish before starting a new transfer
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waiting to receive state */}
      <AnimatePresence>
        {!selectedPeer && transfers.some(t => t.status === 'pending' || t.status === 'connecting' || t.status === 'transferring') && (
          <motion.div
            className="mb-6 text-center py-4 text-blue-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader className="inline-block mr-2 animate-spin" />
            Waiting to receive file...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active transfers with progress bars */}
      <div className="space-y-4 mt-4">
        {transfers.map(transfer => (
          <div key={transfer.id} className="p-4 rounded-lg bg-white/40 border border-orange-100/60 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate" style={{ color: '#2C1B12' }}>
                  {transfer.file.name}
                </h3>
                <p className="text-sm text-orange-700/80">
                  {transfer.status === 'completed' ? 'Completed' : `To: ${transfer.peer.name}`}
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
            
            {/* Cub Progress Bar */}
            <CubProgress 
              progress={transfer.progress || 0}
              className="mb-2"
              speed={transfer.speed}
              timeRemaining={transfer.timeRemaining}
              fileSize={transfer.file.size}
            />
          </div>
        ))}
      </div>
    </GlassCard>
  );
};