import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Users, Home, Globe, Wifi, WifiOff } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface FamilyPrivacyNoticeProps {
  onAccept: () => void;
  onCreateRoom: () => void;
  onJoinJungle?: () => void;
}

export const FamilyPrivacyNotice: React.FC<FamilyPrivacyNoticeProps> = ({ onAccept, onCreateRoom, onJoinJungle }) => {
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  // Show mobile warning for all users to inform them about the limitation
  useEffect(() => {
    // Always show the warning to inform users about the WiFi requirement
    setShowMobileWarning(true);
  }, []);

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
              You're about to join a network with other devices on your WiFi network
            </p>
            <p className="text-xs mt-1" style={{ color: '#A6521B', opacity: 0.8 }}>
              ⚠️ This only works when connected to WiFi, not on mobile data
            </p>
          </div>

          {/* Warning content */}
          <div className="space-y-4 mb-6">
            {/* Mobile Network Warning */}
            {showMobileWarning && (
              <div className="p-4 rounded-lg border-2 border-blue-200" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                <div className="flex items-start gap-3">
                  <Wifi size={20} style={{ color: '#3B82F6', marginTop: '2px' }} />
                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: '#2C1B12' }}>
                      📶 WiFi Requirement Notice
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#2C1B12', opacity: 0.8 }}>
                      <strong>Family sharing only works on WiFi networks.</strong> If you're on mobile data, this feature won't work.
                    </p>
                    <div className="mt-3 space-y-2">
                      <p className="text-xs" style={{ color: '#3B82F6' }}>
                        💡 Alternative options if you're on mobile data:
                      </p>
                      <div className="flex gap-2">
                        {onJoinJungle && (
                          <button
                            onClick={onJoinJungle}
                            className="px-3 py-1 text-xs rounded-lg bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-200 transition-colors"
                          >
                            🌍 Use Jungle (Global)
                          </button>
                        )}
                        <button
                          onClick={onCreateRoom}
                          className="px-3 py-1 text-xs rounded-lg bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors"
                        >
                          🔒 Create Private Room
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                    <br />
                    <strong>Note:</strong> This feature only works when connected to WiFi, not on mobile data.
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
                    <li>• Only works on WiFi networks, not mobile data</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <motion.button
              onClick={onCreateRoom}
              className="flex-1 py-3 px-4 rounded-xl font-medium transition-colors border-2 bg-white/40 border-orange-200 shadow hover:bg-orange-100/80 focus:bg-orange-200/80 focus:outline-none flex items-center justify-center gap-2"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/30 backdrop-blur-[6px] mr-2 shadow border border-white/30">
                <Home size={18} style={{ color: '#A6521B' }} />
              </span>
              Join Private Room
            </motion.button>
            <motion.button
              onClick={onAccept}
              className="flex-1 py-3 px-4 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
              style={{ backgroundColor: '#F6C148' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Wifi size={18} />
              Join WiFi Family
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