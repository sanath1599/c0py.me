import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Hash } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  onJoinRoom
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const generateRoomCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    setIsCreating(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      onJoinRoom(roomCode.trim().toUpperCase());
      onClose();
      setRoomCode('');
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <GlassCard className="p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: '#2C1B12' }}>
                <Users size={20} />
                Join Room
              </h2>
              <button
                onClick={onClose}
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
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C1B12', opacity: 0.8 }}>
                  Room Code
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: '#A6521B', opacity: 0.4 }} size={16} />
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none transition-colors"
                    style={{
                      backgroundColor: 'rgba(166, 82, 27, 0.1)',
                      borderColor: 'rgba(166, 82, 27, 0.2)',
                      color: '#2C1B12'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#F6C148';
                      e.currentTarget.style.backgroundColor = 'rgba(246, 193, 72, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(166, 82, 27, 0.2)';
                      e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                    }}
                    maxLength={6}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={generateRoomCode}
                  className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors"
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
                  Create Room
                </button>
                <button
                  type="submit"
                  disabled={!roomCode.trim()}
                  className="flex-1 py-3 px-4 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: !roomCode.trim() ? '#ccc' : '#F6C148'
                  }}
                  onMouseEnter={(e) => {
                    if (roomCode.trim()) {
                      e.currentTarget.style.backgroundColor = '#A6521B';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (roomCode.trim()) {
                      e.currentTarget.style.backgroundColor = '#F6C148';
                    }
                  }}
                >
                  {isCreating ? 'Create' : 'Join'}
                </button>
              </div>
            </form>

            <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'rgba(166, 82, 27, 0.05)' }}>
              <p className="text-sm" style={{ color: '#2C1B12', opacity: 0.6 }}>
                Share the room code with others to connect and transfer files securely.
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};