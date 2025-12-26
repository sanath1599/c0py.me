import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { formatFileSize } from '../utils/format';

interface LargeFileTransferModalProps {
  isOpen: boolean;
  fileName: string;
  fileSize: number;
  onClose: () => void;
}

export const LargeFileTransferModal: React.FC<LargeFileTransferModalProps> = ({
  isOpen,
  fileName,
  fileSize,
  onClose,
}) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-[8px] z-0"
            onClick={onClose}
          />
          
          {/* Modal Card */}
          <motion.div
            className="w-full max-w-md mx-4 z-10"
            initial={{ scale: 0.96, opacity: 0, y: 32 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 32 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          >
            <GlassCard className="pt-8 pb-6 px-6 relative">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full transition-colors hover:bg-white/20"
                style={{ color: '#A6521B' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Large File Icon */}
              <div className="flex justify-center mb-6">
                <img
                  src="/largeFile.png"
                  alt="Large File"
                  className="w-32 h-32 object-contain"
                />
              </div>

              {/* Content */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-3" style={{ color: '#2C1B12' }}>
                  Large File Transfer
                </h2>
                <p className="text-base mb-4" style={{ color: '#A6521B', opacity: 0.9 }}>
                  {fileName}
                </p>
                <p className="text-sm mb-2" style={{ color: '#A6521B', opacity: 0.8 }}>
                  {formatFileSize(fileSize)}
                </p>
              </div>

              {/* Info Message */}
              <div className="bg-white/30 backdrop-blur-sm rounded-lg p-4 mb-6 border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
                <p className="text-sm leading-relaxed" style={{ color: '#2C1B12' }}>
                  <strong style={{ color: '#A6521B' }}>Large file detected!</strong> We're chunking this file appropriately to ensure a smooth transfer. This process might take a while depending on your connection speed.
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: '#A6521B' }} />
                <span className="text-sm font-medium" style={{ color: '#A6521B' }}>
                  Preparing transfer...
                </span>
              </div>

              {/* Action Button */}
              <button
                onClick={onClose}
                className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-105"
                style={{
                  backgroundColor: '#A6521B',
                  color: '#FFFFFF',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#8B4513';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#A6521B';
                }}
              >
                Got it {countdown > 0 && `(${countdown})`}
              </button>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

