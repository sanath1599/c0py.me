import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { X, AlertTriangle, Monitor, Smartphone } from 'lucide-react';
import { formatFileSize } from '../utils/format';

interface MobileLargeFileWarningModalProps {
  isOpen: boolean;
  fileSize: number;
  fileName?: string;
  onClose: () => void;
  onContinue: () => void;
  autoCloseDelay?: number; // in milliseconds
}

export const MobileLargeFileWarningModal: React.FC<MobileLargeFileWarningModalProps> = ({
  isOpen,
  fileSize,
  fileName,
  onClose,
  onContinue,
  autoCloseDelay = 12000, // 12 seconds default
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
          className="fixed inset-0 z-[60] flex items-center justify-center"
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
            <GlassCard className="pt-8 pb-8 px-6 min-h-[450px] relative flex flex-col items-center">
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
                aria-label="Close"
              >
                <X className="w-5 h-5" style={{ color: '#2C1B12' }} />
              </button>

              {/* Warning Icon */}
              <div className="w-32 h-32 mb-6 rounded-2xl overflow-hidden shadow-2xl border-4 border-red-200/60 bg-red-100/30 backdrop-blur-[12px] flex items-center justify-center">
                <AlertTriangle className="w-16 h-16" style={{ color: '#DC2626' }} />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: '#DC2626' }}>
                Large File Warning
              </h2>

              {/* File Info */}
              {fileName && (
                <p className="text-sm font-medium mb-1 text-center" style={{ color: '#2C1B12', opacity: 0.8 }}>
                  {fileName}
                </p>
              )}
              <p className="text-lg font-bold mb-4" style={{ color: '#DC2626' }}>
                {fileSizeMB} MB
              </p>

              {/* Warning Message */}
              <div className="w-full space-y-3 mb-6">
                {/* Main Warning */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50/60 backdrop-blur-[8px] border-2 border-red-200/60">
                  <AlertTriangle className="w-6 h-6 mt-0.5 flex-shrink-0" style={{ color: '#DC2626' }} />
                  <div>
                    <p className="text-sm font-bold mb-2" style={{ color: '#DC2626' }}>
                      File Size Too Large for Mobile Browser
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: '#2C1B12', opacity: 0.8 }}>
                      This file ({fileSizeMB} MB) is too large for mobile browsers and the transfer might fail. Mobile devices have limited memory and processing power, which can cause issues with very large files.
                    </p>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50/60 backdrop-blur-[8px] border border-orange-200/60">
                  <Monitor className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#F6C148' }} />
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#2C1B12' }}>
                      Recommended: Use Desktop/Laptop
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: '#2C1B12', opacity: 0.7 }}>
                      If the transfer fails, please use a desktop or laptop computer for better reliability with large files.
                    </p>
                  </div>
                </div>

                {/* Mobile Limitation */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/20 backdrop-blur-[8px] border border-white/30">
                  <Smartphone className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#A6521B' }} />
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#2C1B12' }}>
                      Mobile Browser Limitations
                    </p>
                    <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.7 }}>
                      Mobile browsers have stricter memory limits and may not be able to handle files larger than 90MB reliably.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full mt-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-white/40 border border-orange-200 text-orange-900 font-semibold text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all hover:scale-105 backdrop-blur-[8px]"
                >
                  Cancel
                </button>
                <button
                  onClick={onContinue}
                  className="flex-1 py-3 rounded-xl bg-red-500/80 border border-red-400 text-white font-semibold text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-red-400 transition-all hover:scale-105 backdrop-blur-[8px]"
                  style={{ boxShadow: '0 4px 24px 0 rgba(220, 38, 38, 0.3)' }}
                >
                  Continue Anyway
                </button>
              </div>

              {/* Auto-close indicator */}
              <p className="text-xs text-center mt-4" style={{ color: '#2C1B12', opacity: 0.6 }}>
                This warning will auto-close in a few seconds
              </p>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

