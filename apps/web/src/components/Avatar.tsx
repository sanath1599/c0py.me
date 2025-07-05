import React from 'react';
import { motion } from 'framer-motion';

interface AvatarProps {
  emoji: string;
  color: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  isOnline?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-20 h-20 text-3xl'
};

export const Avatar: React.FC<AvatarProps> = ({ 
  emoji, 
  color, 
  size = 'md', 
  onClick,
  isOnline = true,
  className = ''
}) => {
  return (
    <motion.div
      className={`
        relative rounded-full flex items-center justify-center font-bold
        ${sizeClasses[size]}
        ${onClick ? 'cursor-pointer hover:scale-110' : ''}
        ${className}
      `}
      style={{ backgroundColor: color }}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.1 } : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
      transition={{ duration: 0.2 }}
    >
      {emoji}
      {isOnline && (
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
      )}
    </motion.div>
  );
};