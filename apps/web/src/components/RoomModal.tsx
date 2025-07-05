import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Lock, Globe } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (roomId: string) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim().length >= 5 && roomId.trim().length <= 10) {
      onJoinRoom(roomId.trim());
      onClose();
    }
  };

  const generateRoomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setRoomId(result);
    setIsCreating(true);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    generateRoomId();
  };

  const handleJoinExisting = () => {
    setIsCreating(false);
    setRoomId('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Dimmed, blurred background */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[12px]" style={{ zIndex: 0 }} />

          {/* Modal Card */}
          <motion.div
            className="w-full max-w-md mx-4 z-10"
            initial={{ scale: 0.96, opacity: 0, y: 32 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 32 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
          >
            <div
              className="relative p-0 pt-12 pb-8 px-7 overflow-visible"
              style={{
                borderRadius: 32,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.18) 100%)',
                boxShadow: '0 8px 48px 0 rgba(31, 38, 135, 0.18), 0 1.5px 8px 0 #A6521B22',
                border: '1.5px solid rgba(255,255,255,0.32)',
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
              }}
            >
              {/* Lion GIF with glassy glow */}
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/40 bg-white/20 backdrop-blur-[10px] relative">
                  <motion.img
                    src="/favicon.gif"
                    alt="ShareDrop Lion Logo"
                    className="w-16 h-16 rounded-full"
                    style={{ filter: 'drop-shadow(0 4px 24px #A6521B66)' }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                  {/* Glassy ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-white/30" style={{ boxShadow: '0 0 32px 8px #F6C14833, 0 0 0 8px rgba(255,255,255,0.08) inset' }} />
                </div>
                <span className="mt-2 text-xs font-bold tracking-widest text-orange-700 drop-shadow-sm" style={{ letterSpacing: '0.15em' }}>c0py.me</span>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                aria-label="Close room modal"
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/30 focus:bg-white/40 transition-colors focus:outline-none border border-white/30 shadow"
                style={{ color: '#A6521B', backdropFilter: 'blur(8px)' }}
              >
                <X size={22} />
              </button>

              {/* Header */}
              <div className="text-center mb-8 mt-4">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <motion.div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border border-white/30 bg-white/30 backdrop-blur-[10px]"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <Users size={28} style={{ color: '#A6521B' }} />
                  </motion.div>
                </div>
                <h2 className="text-3xl font-extrabold mb-1 tracking-tight text-orange-900 drop-shadow-lg" style={{ letterSpacing: '-0.01em' }}>
                  Join Room
                </h2>
                <p className="text-base font-medium text-orange-700/90" style={{ textShadow: '0 1px 8px #fff8' }}>
                  Enter a room code to join an existing pride
                </p>
              </div>

              {/* Toggle buttons */}
              <div className="flex gap-2 mb-8">
                <motion.button
                  type="button"
                  onClick={handleCreateNew}
                  aria-label="Create new room"
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border-2 focus:outline-none focus:ring-2 focus:ring-orange-300 shadow-lg ${
                    isCreating 
                      ? 'bg-white/60 border-orange-400 text-orange-700 shadow-orange-200' 
                      : 'bg-white/30 border-white/40 text-gray-600 hover:bg-white/50'
                  }`}
                  style={{ backdropFilter: 'blur(10px)' }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/40 backdrop-blur-[6px] mr-2 shadow border border-white/30">
                    <Globe size={18} style={{ color: '#A6521B' }} />
                  </span>
                  Create New
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleJoinExisting}
                  aria-label="Join existing room"
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border-2 focus:outline-none focus:ring-2 focus:ring-orange-300 shadow-lg ${
                    !isCreating 
                      ? 'bg-white/60 border-orange-400 text-orange-700 shadow-orange-200' 
                      : 'bg-white/30 border-white/40 text-gray-600 hover:bg-white/50'
                  }`}
                  style={{ backdropFilter: 'blur(10px)' }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/40 backdrop-blur-[6px] mr-2 shadow border border-white/30">
                    <Lock size={18} style={{ color: '#A6521B' }} />
                  </span>
                  Join Existing
                </motion.button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-orange-900/90" style={{ letterSpacing: '0.04em' }}>
                    Room Code
                  </label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    placeholder={isCreating ? "Room code will be generated" : "Enter room code (5-10 characters)"}
                    className="w-full px-4 py-3 rounded-xl border border-orange-200 bg-white/60 shadow focus:outline-none focus:ring-2 focus:ring-orange-300 text-lg font-mono text-center tracking-widest"
                    style={{ color: '#2C1B12', letterSpacing: '0.15em', fontWeight: 600, background: 'rgba(255,255,255,0.7)', boxShadow: '0 2px 12px #F6C14822' }}
                    maxLength={10}
                    minLength={5}
                    disabled={isCreating}
                    aria-label="Room code input"
                    autoFocus
                  />
                  {isCreating && (
                    <p className="text-xs mt-2 text-center font-medium text-orange-700/90">
                      Share this code with others to invite them to your room
                    </p>
                  )}
                </div>

                <motion.button
                  type="submit"
                  className="w-full py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                  style={{ background: 'linear-gradient(90deg, #F6C148 60%, #A6521B 100%)', boxShadow: '0 4px 24px #F6C14833' }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={roomId.trim().length < 5 || roomId.trim().length > 10}
                  aria-label="Join room button"
                >
                  {isCreating ? (
                    <>
                      <Globe size={18} />
                      Create Room
                    </>
                  ) : (
                    <>
                      <Lock size={18} />
                      Join Room
                    </>
                  )}
                </motion.button>
              </form>

              {/* Info */}
              <div className="mt-6 p-3 rounded-lg border border-orange-100/60 bg-white/40 backdrop-blur-[6px] shadow-sm">
                <p className="text-xs text-center font-medium text-orange-700/90">
                  <strong>Room Privacy:</strong> Only users with the room code can join. Files are shared directly between room members.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};