import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Users, Home, Globe, Wifi, Smartphone, Lock } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface FamilyPrivacyNoticeProps {
  onAccept: () => void;
  onCreateRoom: () => void;
}

export const FamilyPrivacyNotice: React.FC<FamilyPrivacyNoticeProps> = ({ onAccept, onCreateRoom }) => {
  const [isOnMobileData, setIsOnMobileData] = useState(false);

  useEffect(() => {
    // Check if user is on mobile data using Network Information API
    const checkNetworkType = () => {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection && connection.type) {
        // If not on WiFi, assume mobile data
        setIsOnMobileData(connection.type !== 'wifi');
      } else {
        // Fallback: check if on mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        setIsOnMobileData(isMobile);
      }
    };

    checkNetworkType();
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
              <Wifi size={24} style={{ color: '#FF6B35' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#2C1B12' }}>
              Family WiFi Network
            </h2>
            <p className="text-sm" style={{ color: '#A6521B' }}>
              Everyone on your WiFi network using c0py.me will be in this room
            </p>
          </div>

          {/* Warning content */}
          <div className="space-y-4 mb-6">
            <div className="p-3 rounded-lg border-2 border-orange-300" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}>
              <div className="flex items-start gap-2">
                <Wifi size={18} style={{ color: '#FF6B35', marginTop: '2px' }} />
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#2C1B12' }}>
                    WiFi Network Sharing
                  </h3>
                  <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.85 }}>
                    Everyone on your WiFi using c0py.me will join this Family room.
                  </p>
                </div>
              </div>
            </div>

            {isOnMobileData && (
              <div className="p-3 rounded-lg border-2 border-red-300" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                <div className="flex items-start gap-2">
                  <Smartphone size={18} style={{ color: '#EF4444', marginTop: '2px' }} />
                  <div>
                    <h3 className="font-semibold mb-1" style={{ color: '#2C1B12' }}>
                      Mobile Data Detected
                    </h3>
                    <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.85 }}>
                      Family mode only works on WiFi. You're on mobile data—use Private Room or Jungle instead.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 rounded-lg border-2 border-yellow-200" style={{ backgroundColor: 'rgba(255, 193, 7, 0.05)' }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} style={{ color: '#FF6B35', marginTop: '2px' }} />
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#2C1B12' }}>
                    Stranger Cubs Alert
                  </h3>
                  <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.85 }}>
                    Anyone on your WiFi can join. You may not know all users.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(166, 82, 27, 0.05)' }}>
              <div className="flex items-start gap-2">
                <Users size={18} style={{ color: '#A6521B', marginTop: '2px' }} />
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#2C1B12' }}>
                    Safe Sharing Guidelines
                  </h3>
                  <p className="text-xs" style={{ color: '#2C1B12', opacity: 0.85 }}>
                    Only share files with people you trust.
                  </p>
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
                <Lock size={18} style={{ color: '#A6521B' }} />
              </span>
              Create Private Room
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