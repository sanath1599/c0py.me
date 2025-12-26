import React from 'react';
import { motion } from 'framer-motion';
import { formatFileSize } from '../utils/format';

interface CubProgressProps {
  progress: number; // 0-100
  className?: string;
  showCub?: boolean;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
  fileSize?: number; // file size in bytes
  bytesTransferred?: number; // bytes transferred so far
  status?: string; // status of the task
}

export const CubProgress: React.FC<CubProgressProps> = ({ 
  progress, 
  className = '',
  showCub = true,
  speed,
  timeRemaining,
  fileSize,
  bytesTransferred,
  status
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  // Calculate transferred bytes if not provided
  const transferred = bytesTransferred ?? (fileSize ? (clampedProgress / 100) * fileSize : 0);
  
  // Format speed
  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond >= 1024 * 1024) {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    } else if (bytesPerSecond >= 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else {
      return `${bytesPerSecond.toFixed(0)} B/s`;
    }
  };

  // Format time remaining
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.ceil(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.ceil((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };
  
  return (
    <div className={`relative ${className}`}>
      {/* Progress Bar Background */}
      <div className="w-full h-10 bg-white/30 rounded-full overflow-visible backdrop-blur-sm border border-white/40 shadow-inner flex items-center relative">
        {/* Progress Fill */}
        <motion.div
          className="h-4 rounded-full relative fire-progress-bar"
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: '100%',
            background: 'linear-gradient(270deg, #ff9800, #ffb300, #ffd740, #ff9800, #ffb300, #ffd740)',
            backgroundSize: '400% 100%',
            animation: 'fireBar 2s linear infinite',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {/* Cub PNG at the tip, updated instantly */}
        {showCub && clampedProgress >= 1 && (
          <motion.div
            className="absolute flex items-end"
            animate={{ left: `calc(${Math.round(clampedProgress)}% - 2rem)` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              bottom: '100%', // align bottom of cub with top of bar
              zIndex: 10
            }}
          >
            <motion.div
              animate={{ rotate: [-8, 8, -8] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <img 
                src="/progress_bar.png" 
                alt="Rocket" 
                className="w-16 h-16 object-contain"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
              />
            </motion.div>
          </motion.div>
        )}
      </div>
      {/* Progress Info */}
      <div className="mt-3 space-y-2">
        {/* Progress percentage - moved below progress bar */}
        <div className="text-center">
          <span className="text-lg font-bold text-orange-800">
            {Math.round(clampedProgress)}%
          </span>
        </div>
        {/* File size, speed, and ETA or status icon */}
        <div className="flex justify-between items-center">
          {/* File size - show transferred / total */}
          <div className="text-sm font-semibold text-orange-700 bg-orange-100/50 px-2 py-1 rounded">
            {fileSize ? (
              `${formatFileSize(transferred)} / ${formatFileSize(fileSize)}`
            ) : (
              transferred > 0 ? formatFileSize(transferred) : 'Unknown size'
            )}
          </div>
          {/* Speed and ETA or status icon */}
          <div className="flex gap-3">
            {speed && (
              <div className="text-sm font-semibold text-orange-700 bg-orange-100/50 px-2 py-1 rounded flex items-center gap-1">
                <span className="text-orange-600">⚡</span>
                {formatSpeed(speed)}
              </div>
            )}
            {/* Show ETA only if not completed/failed */}
            {status === 'completed' ? (
              <div className="text-2xl text-green-600 flex items-center justify-center">✔️</div>
            ) : status === 'failed' ? (
              <div className="text-2xl text-red-600 flex items-center justify-center">❌</div>
            ) : (timeRemaining && timeRemaining > 0 && (
              <div className="text-sm font-semibold text-orange-700 bg-orange-100/50 px-2 py-1 rounded flex items-center gap-1">
                <span className="text-orange-600">⏱️</span>
                {formatTime(timeRemaining)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

<style jsx global>{`
@keyframes fireBar {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}
`}</style> 