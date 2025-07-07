import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Users, Home, Globe, Wifi } from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[8px] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md mx-auto max-h-[90vh] overflow-hidden"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <GlassCard className="p-4 relative flex flex-col h-full">
          {/* Header */}
          <div className="text-center mb-4 flex-shrink-0">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}>
              <Home size={20} style={{ color: '#FF6B35' }} />
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: '#2C1B12' }}>
              Local Den
            </h2>
            <p className="text-xs" style={{ color: '#A6521B' }}>
              Share files with anyone on your WiFi network (Local Den)
            </p>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 text-xs" style={{color:'#2C1B12'}}>
            {/* How it works */}
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 flex items-start gap-2">
              <Home size={16} style={{ color: '#3B82F6', marginTop: '1px' }} />
              <div>
                <span className="font-semibold">How it works:</span> When you join Local Den, your device becomes visible to anyone connected to the same WiFi network. This makes sharing files with trusted people at home easy and fast.
              </div>
            </div>

            {/* Privacy Reminder */}
            <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 flex items-start gap-2">
              <Shield size={16} style={{ color: '#FF6B35', marginTop: '1px' }} />
              <div>
                <span className="font-semibold">Privacy Reminder:</span>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>Anyone on your WiFi can see your device and send you files.</li>
                  <li>You may not recognize every device on your network (e.g., guests, neighbors, or public/shared WiFi).</li>
                  <li><b>Do not use Local Den on public or untrusted WiFi networks.</b></li>
                </ul>
              </div>
            </div>

            {/* Safety Tips */}
            <div className="p-3 rounded-lg bg-orange-50 flex items-start gap-2 border border-orange-200">
              <Users size={16} style={{ color: '#A6521B', marginTop: '1px' }} />
              <div>
                <span className="font-semibold">Safety Tips:</span>
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>Only accept files from people you know and trust.</li>
                  <li>Never share sensitive or personal information.</li>
                  <li>You can always switch back to Jungle (global) or create a Private Room for more control.</li>
                </ul>
              </div>
            </div>

            {/* WiFi Only */}
            <div className="p-3 rounded-lg border border-blue-100 bg-blue-50 flex items-start gap-2">
              <Wifi size={16} style={{ color: '#3B82F6', marginTop: '1px' }} />
              <div>
                <span className="font-semibold">WiFi Only:</span> Local Den only works when you are connected to WiFi. It will not work on mobile data.
                <div className="mt-2 space-x-2">
                  <button
                    onClick={onCreateRoom}
                    className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors"
                  >
                    🔒 Create Private Room
                  </button>
                  {onJoinJungle && (
                    <button
                      onClick={onJoinJungle}
                      className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-800 border border-orange-200 hover:bg-orange-200 transition-colors"
                    >
                      🌍 Use Jungle (Global)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <motion.button
              onClick={onCreateRoom}
              className="flex-1 py-2.5 px-3 rounded-lg font-medium transition-colors border border-orange-200 bg-white/40 hover:bg-orange-100/80 focus:outline-none flex items-center justify-center gap-1.5 text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Home size={16} style={{ color: '#A6521B' }} />
              Private Room
            </motion.button>
            <motion.button
              onClick={onAccept}
              className="flex-1 py-2.5 px-3 text-white rounded-lg font-medium flex items-center justify-center gap-1.5 transition-colors text-sm"
              style={{ backgroundColor: '#F6C148' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Wifi size={16} />
              Join Local Den
            </motion.button>
          </div>

          {/* Footer note */}
          <div className="mt-3 text-center flex-shrink-0">
            <p className="text-xs" style={{ color: '#A6521B', opacity: 0.8 }}>
              You can switch back to Jungle anytime
            </p>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}; 