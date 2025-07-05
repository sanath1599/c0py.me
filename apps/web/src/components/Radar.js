import React from 'react';
import './Radar.css';

const COLORS = [
  '#A6521B', // Lion mane
  '#F6C148', // Lion face/body
  '#A463E4', // Purple file
  '#5E339A', // Wi-Fi icon
  '#38B6FF', // Blue file
  '#2083BA', // Blue lines
  '#00C2FF', // Motion lines
  '#2C1B12', // Outline/text
];
const EMOJIS = ['🦁', '📁', '🦊', '🦄', '🐯', '🐻', '🐵', '🐱', '🦉', '🦓', '🦋', '🦜', '🦩', '🦔', '🦦', '🦥', '🦨', '🦫', '🦃', '🦚', '🦢', '🦩', '🦦', '🦥', '🦦'];

function getAvatarColor(id) {
  // Deterministic color based on id
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}
function getAvatarEmoji(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 3) - hash);
  return EMOJIS[Math.abs(hash) % EMOJIS.length];
}
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const Radar = ({ user, peers, onPeerClick, onPlusClick }) => {
  const center = 200;
  const radius = 140;
  const angleStep = (2 * Math.PI) / Math.max(peers.length, 1);

  return (
    <div className="radar-root">
      <svg width={400} height={400} className="radar-svg">
        {/* Radar circles */}
        {[1, 2, 3].map(i => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={i * 50}
            fill="none"
            stroke="#e0e0e0"
            strokeWidth={2}
            opacity={0.5}
          />
        ))}
        {/* Peers */}
        {peers.map((peer, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <g key={peer.id} onClick={() => onPeerClick(peer)} className="radar-peer-avatar" style={{ cursor: 'pointer' }}>
              <circle cx={x} cy={y} r={32} fill={getAvatarColor(peer.id)} stroke="#2C1B12" strokeWidth={2} />
              <text x={x} y={y + 8} textAnchor="middle" fontSize="2rem" fontFamily="sans-serif">
                {getAvatarEmoji(peer.id)}
              </text>
              <text x={x} y={y + 32} textAnchor="middle" fontSize="0.9rem" fontFamily="sans-serif" fill="#2C1B12">
                {getInitials(peer.name)}
              </text>
            </g>
          );
        })}
        {/* User at center */}
        <g>
          <circle cx={center} cy={center} r={38} fill="#F6C148" stroke="#2C1B12" strokeWidth={3} />
          <text x={center} y={center + 10} textAnchor="middle" fontSize="2.2rem" fontFamily="sans-serif">
            🦁
          </text>
          <text x={center} y={center + 38} textAnchor="middle" fontSize="1rem" fontFamily="sans-serif" fill="#2C1B12">
            {getInitials(user.name)}
          </text>
        </g>
        {/* + Button */}
        <g onClick={onPlusClick} className="radar-plus-btn" style={{ cursor: 'pointer' }}>
          <circle cx={center} cy={center - 110} r={24} fill="#A463E4" stroke="#2C1B12" strokeWidth={2} />
          <text x={center} y={center - 104} textAnchor="middle" fontSize="2rem" fontFamily="sans-serif" fill="#fff">+</text>
        </g>
      </svg>
    </div>
  );
};

export default Radar; 