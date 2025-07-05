import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  onClick,
  hover = false,
  style
}) => {
  return (
    <motion.div
      className={`
        backdrop-blur-xl border rounded-2xl shadow-xl
        ${hover ? 'hover:bg-white/20 cursor-pointer' : ''}
        ${className}
      `}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderColor: 'rgba(166, 82, 27, 0.2)',
        backdropFilter: 'blur(12px)',
        ...style
      }}
      onClick={onClick}
      whileHover={hover ? { scale: 1.02, y: -2 } : {}}
      whileTap={hover ? { scale: 0.98 } : {}}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
};