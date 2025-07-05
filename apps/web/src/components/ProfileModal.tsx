import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Palette } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Avatar } from './Avatar';
import { AVATAR_COLORS, EMOJIS } from '../utils/colors';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: { name: string; emoji: string; color: string };
  onSave: (profile: { name: string; emoji: string; color: string }) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSave
}) => {
  const [name, setName] = useState(currentProfile.name);
  const [emoji, setEmoji] = useState(currentProfile.emoji);
  const [color, setColor] = useState(currentProfile.color);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave({ name: name.trim(), emoji, color });
      onClose();
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
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <User size={20} />
                Edit Profile
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

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Preview */}
              <div className="text-center">
                <Avatar
                  emoji={emoji}
                  color={color}
                  size="xl"
                  className="mx-auto mb-2"
                />
                <p className="font-medium" style={{ color: '#2C1B12' }}>{name || 'Your Name'}</p>
              </div>

              {/* Name input */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C1B12', opacity: 0.8 }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none transition-colors"
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
                  maxLength={20}
                />
              </div>

              {/* Emoji selection */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C1B12', opacity: 0.8 }}>
                  Avatar Emoji
                </label>
                <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto p-2 rounded-lg" style={{ backgroundColor: 'rgba(166, 82, 27, 0.05)' }}>
                  {EMOJIS.map((emojiOption) => (
                    <button
                      key={emojiOption}
                      type="button"
                      onClick={() => setEmoji(emojiOption)}
                      className={`
                        p-2 rounded-lg text-lg transition-colors
                      `}
                      style={{
                        backgroundColor: emoji === emojiOption ? '#F6C148' : 'rgba(166, 82, 27, 0.1)'
                      }}
                      onMouseEnter={(e) => {
                        if (emoji !== emojiOption) {
                          e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.2)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (emoji !== emojiOption) {
                          e.currentTarget.style.backgroundColor = 'rgba(166, 82, 27, 0.1)';
                        }
                      }}
                    >
                      {emojiOption}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color selection */}
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2" style={{ color: '#2C1B12', opacity: 0.8 }}>
                  <Palette size={16} />
                  Avatar Color
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AVATAR_COLORS.map((colorOption) => (
                    <button
                      key={colorOption}
                      type="button"
                      onClick={() => setColor(colorOption)}
                      className={`
                        w-10 h-10 rounded-lg transition-transform
                        ${color === colorOption ? 'scale-110 ring-2' : 'hover:scale-105'}
                      `}
                      style={{ backgroundColor: colorOption }}
                      onMouseEnter={(e) => {
                        if (color !== colorOption) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (color !== colorOption) {
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="w-full py-3 px-4 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                style={{
                  backgroundColor: !name.trim() ? '#ccc' : '#F6C148'
                }}
                onMouseEnter={(e) => {
                  if (name.trim()) {
                    e.currentTarget.style.backgroundColor = '#A6521B';
                  }
                }}
                onMouseLeave={(e) => {
                  if (name.trim()) {
                    e.currentTarget.style.backgroundColor = '#F6C148';
                  }
                }}
              >
                Save Profile
              </button>
            </form>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};