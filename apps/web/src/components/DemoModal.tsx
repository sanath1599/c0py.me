import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Maximize2 } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoModal: React.FC<DemoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Fullscreen Container */}
        <motion.div
          className="w-full h-full flex flex-col"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 bg-white/10 backdrop-blur-md border-b border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                <Play size={16} className="text-white ml-0.5" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white">
                c0py.me Demo
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <X size={24} />
            </button>
          </div>

          {/* Video Container */}
          <div className="flex-1 relative">
            <iframe
              src="https://www.youtube.com/embed/bC7uP2NqT10?autoplay=1&rel=0&modestbranding=1&showinfo=0"
              title="c0py.me Demo Video"
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Footer */}
          <div className="p-4 md:p-6 bg-white/10 backdrop-blur-md border-t border-white/20">
            <div className="flex items-center justify-between">
              <div className="text-white/80 text-sm md:text-base">
                Watch how c0py.me enables secure, anonymous peer-to-peer file sharing
              </div>
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <Maximize2 size={16} />
                <span>Fullscreen Demo</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}; 