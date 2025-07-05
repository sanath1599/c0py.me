import React from 'react';
import { motion } from 'framer-motion';

interface CubProgressProps {
  progress: number; // 0-100
  className?: string;
  showCub?: boolean;
}

export const CubProgress: React.FC<CubProgressProps> = ({ 
  progress, 
  className = '',
  showCub = true 
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  return (
    <div className={`relative ${className}`}>
      {/* Progress Bar Background */}
      <div className="w-full h-3 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm border border-white/40">
        {/* Progress Fill */}
        <motion.div
          className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full relative"
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Cub Animation */}
          {showCub && (
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-lg"
              initial={{ x: 0 }}
              animate={{ x: `${clampedProgress}%` }}
              transition={{ 
                duration: 0.5, 
                ease: "easeOut",
                delay: 0.1 
              }}
              style={{ 
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                zIndex: 10
              }}
            >
              <motion.div
                animate={{ 
                  y: [0, -2, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              >
                🦁
              </motion.div>
            </motion.div>
          )}
          
          {/* Sparkle effect when progress is high */}
          {clampedProgress > 80 && (
            <motion.div
              className="absolute inset-0"
              animate={{ 
                background: [
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                  'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)'
                ]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          )}
        </motion.div>
      </div>
      
      {/* Progress Text */}
      <div className="mt-2 text-center">
        <span className="text-sm font-semibold text-orange-800">
          {Math.round(clampedProgress)}%
        </span>
      </div>
    </div>
  );
}; 