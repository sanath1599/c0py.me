import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { X, Wifi, Lock } from 'lucide-react';

interface FamilyWifiWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: () => void;
}

const FamilyWifiWarningModal: React.FC<FamilyWifiWarningModalProps> = ({ isOpen, onClose, onCreateRoom }) => {
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md z-0" />
          {/* Modal Card */}
          <motion.div
            className="w-full max-w-md mx-4 z-10"
            initial={{ scale: 0.96, opacity: 0, y: 32 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 32 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          >
            <GlassCard className="pt-10 pb-8 px-6 min-h-[340px] relative flex flex-col items-center">
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close warning modal"
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/30 focus:bg-white/40 transition-colors focus:outline-none border border-white/30 shadow focus:ring-2 focus:ring-orange-400"
              >
                <X size={22} />
              </button>
              {/* Icon */}
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/40 bg-white/30 backdrop-blur-[12px] mb-4 relative overflow-hidden">
                <Wifi size={44} className="text-orange-700 z-10" />
              </div>
              {/* Title & Message */}
              <h2 className="text-2xl font-bold mb-2 text-center" style={{ color: '#2C1B12' }}>Family Mode Requires WiFi</h2>
              <p className="mb-6 text-center text-orange-900/90 text-base">
                It looks like you're not on a WiFi connection.<br />
                <span className="font-semibold">Family mode only works when all devices are on the same WiFi network.</span><br />
                For secure sharing, create a private room instead.
              </p>
              {/* Actions */}
              <div className="flex gap-4 mt-8 w-full">
                <button
                  onClick={onCreateRoom}
                  className="flex-1 py-3 rounded-xl bg-orange-400 text-white font-bold text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all hover:scale-105 backdrop-blur-[8px] relative overflow-hidden"
                  style={{ boxShadow: '0 4px 24px 0 #F6C14844' }}
                >
                  <Lock size={20} className="inline-block mr-2 text-white" />
                  Create Private Room
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-white/40 border border-orange-100 text-orange-700 font-bold text-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all hover:scale-105 backdrop-blur-[8px] relative overflow-hidden"
                >
                  Cancel
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FamilyWifiWarningModal; 