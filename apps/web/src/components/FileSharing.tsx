import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, CheckCircle, AlertCircle, Loader, Download } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { FileTransfer, Peer } from '../types';
import { formatFileSize, formatSpeed, formatTime } from '../utils/format';

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

  const getStatusColor = (status: FileTransfer['status']) => {
    switch (status) {
      case 'transferring':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
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
          <motion.button
            className="w-full mb-6 p-4 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            style={{ backgroundColor: '#F6C148' }}
            onClick={handleSend}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#A6521B';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F6C148';
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Send size={18} />
            Send {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
          </motion.button>
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
          <div key={transfer.id} className="p-3 rounded-lg border flex items-center gap-4" style={{ borderColor: 'rgba(166, 82, 27, 0.15)' }}>
            <div className="flex-shrink-0">
              {transfer.status === 'completed' ? <Download className="text-green-500" /> : <Loader className="animate-spin text-yellow-600" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm" style={{ color: '#2C1B12' }}>{transfer.file.name}</span>
                <span className="text-xs text-gray-500">{transfer.status}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div
                  className="bg-yellow-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${transfer.progress || 0}%` }}
                />
              </div>
              {transfer.status === 'transferring' && (
                <div className="text-xs text-gray-500 mt-1">
                  {transfer.speed ? `${transfer.speed} B/s` : ''} {transfer.timeRemaining ? `• ${transfer.timeRemaining}s left` : ''}
                </div>
              )}
            </div>
            {transfer.status === 'transferring' && (
              <button
                className="ml-2 p-1 rounded hover:bg-red-100"
                onClick={() => onCancelTransfer(transfer.id)}
                title="Cancel transfer"
              >
                <X size={16} className="text-red-500" />
              </button>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
};