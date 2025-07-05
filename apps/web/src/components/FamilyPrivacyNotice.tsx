import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Users } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface FamilyPrivacyNoticeProps {
  onAccept: () => void;
  onDecline: () => void;
}

export const FamilyPrivacyNotice: React.FC<FamilyPrivacyNoticeProps> = ({ onAccept, onDecline }) => {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[8px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-lg mx-4"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <GlassCard className="p-6 relative">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}>
              <AlertTriangle size={24} style={{ color: '#FF6B35' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#2C1B12' }}>
              Family Network Privacy Notice
            </h2>
            <p className="text-sm" style={{ color: '#A6521B' }}>
              You're about to join a network with other devices on your WiFi
            </p>
          </div>

          {/* Warning content */}
          <div className="space-y-4 mb-6">
            <div className="p-4 rounded-lg border-2 border-yellow-200" style={{ backgroundColor: 'rgba(255, 193, 7, 0.05)' }}>
              <div className="flex items-start gap-3">
                <Shield size={20} style={{ color: '#FF6B35', marginTop: '2px' }} />
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: '#2C1B12' }}>
                    ⚠️ Stranger Cubs Alert
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#2C1B12', opacity: 0.8 }}>
                    Other devices on your WiFi network can join this family room. 
                    <strong> You may not know all the users in this network.</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(166, 82, 27, 0.05)' }}>
              <div className="flex items-start gap-3">
                <Users size={20} style={{ color: '#A6521B', marginTop: '2px' }} />
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: '#2C1B12' }}>
                    🦁 Safe Sharing Guidelines
                  </h3>
                  <ul className="text-sm space-y-1" style={{ color: '#2C1B12', opacity: 0.8 }}>
                    <li>• Only share files with people you know and trust</li>
                    <li>• Avoid sending sensitive or personal information</li>
                    <li>• Be cautious of unknown users in the network</li>
                    <li>• Files are transferred directly between devices</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <motion.button
              onClick={onDecline}
              className="flex-1 py-3 px-4 rounded-xl font-medium transition-colors border-2"
              style={{ 
                borderColor: 'rgba(166, 82, 27, 0.3)',
                color: '#A6521B',
                backgroundColor: 'rgba(166, 82, 27, 0.05)'
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Stay in Jungle
            </motion.button>
            <motion.button
              onClick={onAccept}
              className="flex-1 py-3 px-4 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ backgroundColor: '#F6C148' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Shield size={18} />
              Join Family Network
            </motion.button>
          </div>

          {/* Additional info */}
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(166, 82, 27, 0.05)' }}>
            <p className="text-xs text-center" style={{ color: '#A6521B' }}>
              <strong>Note:</strong> You can switch back to Jungle anytime from the world switcher.
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}; 