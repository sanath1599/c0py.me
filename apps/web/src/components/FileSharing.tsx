import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';
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
  const handleSend = () => {
    if (selectedFiles.length > 0 && selectedPeer) {
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

      {/* Send button */}
      <AnimatePresence>
        {selectedFiles.length > 0 && selectedPeer && (
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

      {/* Active transfers */}
      <div className="space-y-3">
        <AnimatePresence>
          {transfers.map((transfer) => (
            <motion.div
              key={transfer.id}
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'rgba(166, 82, 27, 0.05)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              layout
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(transfer.status)}
                  <span className="font-medium truncate" style={{ color: '#2C1B12' }}>
                    {transfer.file.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar
                    emoji={transfer.peer.emoji}
                    color={transfer.peer.color}
                    size="sm"
                  />
                  {transfer.status === 'transferring' && (
                    <button
                      onClick={() => onCancelTransfer(transfer.id)}
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
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="w-full rounded-full h-2" style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)' }}>
                  <motion.div
                    className={`h-2 rounded-full ${getStatusColor(transfer.status)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${transfer.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Transfer details */}
              <div className="flex justify-between text-xs" style={{ color: '#2C1B12', opacity: 0.6 }}>
                <span>{formatFileSize(transfer.file.size)}</span>
                <div className="flex gap-4">
                  {transfer.speed && (
                    <span>{formatSpeed(transfer.speed)}</span>
                  )}
                  {transfer.timeRemaining && transfer.status === 'transferring' && (
                    <span>{formatTime(transfer.timeRemaining)} remaining</span>
                  )}
                  <span className="capitalize">{transfer.status}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {transfers.length === 0 && (
          <div className="text-center py-8 text-white/60">
            <p style={{ color: '#2C1B12', opacity: 0.6 }}>No active transfers</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
};