import React, { useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { Peer } from '../types';

interface RadarProps {
  peers: Peer[];
  currentUser: { id: string; name: string; emoji: string; color: string };
  selectedPeer: Peer | null;
  onPeerClick: (peer: Peer) => void;
  onEditProfile: () => void;
  onJoinRoom: () => void;
}

export const Radar: React.FC<RadarProps> = ({
  peers,
  currentUser,
  selectedPeer,
  onPeerClick,
  onEditProfile,
  onJoinRoom
}) => {
  const [hoveredPeer, setHoveredPeer] = useState<string | null>(null);
  const otherPeers = peers.filter(peer => peer.id !== currentUser.id);

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: '#2C1B12' }}>Nearby Devices</h2>
        <div className="flex gap-2">
          <button
            onClick={onEditProfile}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(166, 82, 27, 0.1)', color: '#A6521B' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)')}
          >
            <Settings size={16} />
          </button>
          <button
            onClick={onJoinRoom}
            className="p-2 rounded-lg text-white transition-colors"
            style={{ backgroundColor: '#F6C148' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#A6521B')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#F6C148')}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
        {/* Ring of peers */}
        {otherPeers.length > 0 ? (
          <div className="absolute w-full h-full flex items-center justify-center">
            <div className="relative w-full h-full" style={{ minWidth: 256, minHeight: 256 }}>
              {otherPeers.map((peer, idx) => {
                const angle = (idx / otherPeers.length) * 2 * Math.PI;
                const radius = 110;
                const x = Math.cos(angle - Math.PI / 2) * radius + 128 - 32; // center + offset - half avatar
                const y = Math.sin(angle - Math.PI / 2) * radius + 128 - 32;
                const isSelected = selectedPeer?.id === peer.id;
                return (
                  <div
                    key={peer.id}
                    className="absolute"
                    style={{ left: x, top: y, zIndex: isSelected ? 20 : 10 }}
                    onMouseEnter={() => setHoveredPeer(peer.id)}
                    onMouseLeave={() => setHoveredPeer(null)}
                  >
                    <div className="relative">
                      <Avatar
                        emoji={peer.emoji}
                        color={peer.color}
                        size="lg"
                        onClick={() => onPeerClick(peer)}
                        isOnline={peer.isOnline}
                        className={isSelected ? 'ring-4 ring-yellow-400' : 'hover:ring-2 hover:ring-yellow-300 cursor-pointer'}
                      />
                      {/* Tooltip */}
                      {hoveredPeer === peer.id && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-black/80 text-white text-xs whitespace-nowrap z-30">
                          {peer.name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-sm border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
              <p className="text-sm font-medium" style={{ color: '#2C1B12' }}>No devices nearby</p>
              <p className="text-xs mt-1" style={{ color: '#A6521B' }}>Join a room to connect</p>
            </div>
          </div>
        )}
        {/* Center user */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
          <Avatar
            emoji={currentUser.emoji}
            color={currentUser.color}
            size="xl"
          />
          <div className="mt-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border" style={{ borderColor: 'rgba(166, 82, 27, 0.2)' }}>
            <span className="text-sm font-medium" style={{ color: '#2C1B12' }}>You</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};