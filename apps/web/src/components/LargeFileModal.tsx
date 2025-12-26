import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { X, Shield, Clock, Users } from 'lucide-react';
import { formatFileSize } from '../utils/format';

interface LargeFileModalProps {
  isOpen: boolean;
  fileSize: number;
  fileName?: string;
  onClose: () => void;
  autoCloseDelay?: number; // in milliseconds
}

export const LargeFileModal: React.FC<LargeFileModalProps> = ({
  isOpen,
  fileSize,
  fileName,
  onClose,
  autoCloseDelay = 8000, // 8 seconds default
}) => {
  // Auto-close after delay
  useEffect(() => {
    if (isOpen && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

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
            className="absolute inset-0 bg-black/40 backdrop-blur-[8px] z-0"
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
            <GlassCard className="pt-8 pb-8 px-6 min-h-[400px] relative flex flex-col items-center">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
                aria-label="Close"
              >
                <X className="w-5 h-5" style={{ color: '#2C1B12' }} />
              </button>

              {/* Large File Image */}
              <div className="w-32 h-32 mb-6 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/40 bg-white/20 backdrop-blur-[12px] flex items-center justify-center">
                <img 
                  src="/largeFile.png" 
                  alt="Large file transfer" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image doesn't load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><div class="text-6xl">📦</div></div>';
                    }
                  }}
                />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: '#2C1B12' }}>
                Large File Transfer Started
              </h2>

              {/* File Info */}
              {fileName && (
                <p className="text-sm font-medium mb-1 text-center" style={{ color: '#2C1B12', opacity: 0.8 }}>
                  {fileName}
                </p>
              )}
              <p className="text-lg font-bold mb-2" style={{ color: '#F6C148' }}>
                {fileSizeMB} MB
              </p>
              <p className="text-xs text-center mb-6" style={{ color: '#2C1B12', opacity: 0.7 }}>
                Transfer is happening in the background
              </p>

              {/* Info Cards */}
              <div className="w-full space-y-3 mb-6">
                {/* Time Warning */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/20 backdrop-blur-[8px] border border-white/30">
                  <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#F6C148' }} />
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#2C1B12' }}>
                      Transfer May Take A While
                    </p>
                    <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.7 }}>
                      Large files require more time to transfer securely
                    </p>
                  </div>
                </div>

                {/* Integrity Check */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/20 backdrop-blur-[8px] border border-white/30">
                  <Shield className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#F6C148' }} />
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#2C1B12' }}>
                      Integrity Check After Transfer
                    </p>
                    <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.7 }}>
                      We verify file integrity using SHA-256 hashing to ensure perfect transmission
                    </p>
                  </div>
                </div>

                {/* Peer-to-Peer */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/20 backdrop-blur-[8px] border border-white/30">
                  <Users className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#F6C148' }} />
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#2C1B12' }}>
                      Peer-to-Peer Transfer
                    </p>
                    <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.7 }}>
                      Your file is transferred directly between devices and doesn't go through our servers
                    </p>
                  </div>
                </div>
              </div>

              {/* Auto-close indicator */}
              <p className="text-xs text-center mt-2" style={{ color: '#2C1B12', opacity: 0.6 }}>
                This is an informational message. Transfer continues in the background.
              </p>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

