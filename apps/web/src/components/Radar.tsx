import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Settings } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { Peer } from '../types';

interface RadarProps {
  peers: Peer[];
  currentUser: { name: string; emoji: string; color: string };
  onPeerClick: (peer: Peer) => void;
  onEditProfile: () => void;
  onJoinRoom: () => void;
}

export const Radar: React.FC<RadarProps> = ({
  peers,
  currentUser,
  onPeerClick,
  onEditProfile,
  onJoinRoom
}) => {
  const [hoveredPeer, setHoveredPeer] = useState<string | null>(null);

  const getRadarPosition = (index: number, total: number) => {
    const angle = (index * 2 * Math.PI) / total;
    const radius = 80;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y };
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: '#2C1B12' }}>Nearby Devices</h2>
        <div className="flex gap-2">
          <button
            onClick={onEditProfile}
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
            <Settings size={16} />
          </button>
          <button
            onClick={onJoinRoom}
            className="p-2 rounded-lg text-white transition-colors"
            style={{ backgroundColor: '#F6C148' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#A6521B';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#F6C148';
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="relative w-64 h-64 mx-auto">
        {/* Radar circles */}
        <div className="absolute inset-0 rounded-full border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }} />
        <div className="absolute inset-4 rounded-full border" style={{ borderColor: 'rgba(166, 82, 27, 0.1)' }} />
        <div className="absolute inset-8 rounded-full border" style={{ borderColor: 'rgba(166, 82, 27, 0.05)' }} />

        {/* Current user in center */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <Avatar
            emoji={currentUser.emoji}
            color={currentUser.color}
            size="lg"
          />
          <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
              <span className="text-sm font-medium" style={{ color: '#2C1B12' }}>You</span>
            </div>
          </div>
        </div>

        {/* Peers around the circle */}
        <AnimatePresence>
          {peers.map((peer, index) => {
            const { x, y } = getRadarPosition(index, peers.length);
            return (
              <motion.div
                key={peer.id}
                className="absolute top-1/2 left-1/2"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                onHoverStart={() => setHoveredPeer(peer.id)}
                onHoverEnd={() => setHoveredPeer(null)}
              >
                <Avatar
                  emoji={peer.emoji}
                  color={peer.color}
                  size="md"
                  onClick={() => onPeerClick(peer)}
                  isOnline={peer.isOnline}
                />
                
                {/* Peer name tooltip */}
                <AnimatePresence>
                  {hoveredPeer === peer.id && (
                    <motion.div
                      className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                    >
                      <div className="text-xs px-2 py-1 rounded text-white" style={{ backgroundColor: 'rgba(44, 27, 18, 0.8)' }}>
                        {peer.name}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pulse animation for online peers */}
                {peer.isOnline && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: 'rgba(246, 193, 72, 0.3)' }}
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* No peers message */}
        {peers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-sm border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
              <p className="text-sm font-medium" style={{ color: '#2C1B12' }}>No devices nearby</p>
              <p className="text-xs mt-1" style={{ color: '#A6521B' }}>Join a room to connect</p>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
};