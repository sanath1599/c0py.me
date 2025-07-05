import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { File as FileIcon, User } from 'lucide-react';
import { formatFileSize } from '../utils/format';

interface IncomingFileModalProps {
  isOpen: boolean;
  file: {
    id: string;
    from: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  } | null;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingFileModal: React.FC<IncomingFileModalProps> = ({
  isOpen,
  file,
  onAccept,
  onReject,
}) => {
  if (!isOpen || !file) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px] z-0" />
          {/* Modal Card */}
          <motion.div
            className="w-full max-w-md mx-4 z-10"
            initial={{ scale: 0.96, opacity: 0, y: 32 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 32 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          >
            <GlassCard className="pt-10 pb-8 px-6 min-h-[340px] relative flex flex-col items-center">
              {/* Icon */}
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/40 bg-white/20 backdrop-blur-md mb-4">
                <FileIcon size={40} className="text-orange-700" />
              </div>
              {/* Sender */}
              <div className="mb-2 text-center">
                <span className="text-xs font-bold tracking-widest text-orange-700 drop-shadow-sm">Incoming File</span>
                <h2 className="text-xl font-bold mt-1 mb-1" style={{ color: '#2C1B12' }}>{file.fileName}</h2>
                <p className="text-sm text-orange-800 font-medium mb-1">From: {file.from}</p>
                <p className="text-xs text-orange-700/80">{formatFileSize(file.fileSize)}</p>
              </div>
              {/* Actions */}
              <div className="flex gap-4 mt-8 w-full">
                <button
                  onClick={onAccept}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-600 text-white font-bold text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all hover:scale-105"
                >
                  Accept
                </button>
                <button
                  onClick={onReject}
                  className="flex-1 py-3 rounded-xl bg-white/60 border border-orange-200 text-orange-800 font-bold text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all hover:scale-105"
                >
                  Reject
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 