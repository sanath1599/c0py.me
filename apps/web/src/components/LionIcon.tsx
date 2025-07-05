import React from 'react';

interface LionIconProps {
  size?: number;
  className?: string;
}

export const LionIcon: React.FC<LionIconProps> = ({ size = 24, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Mane */}
      <circle cx="50" cy="50" r="45" fill="#A6521B" stroke="#2C1B12" strokeWidth="2"/>
      
      {/* Face */}
      <circle cx="50" cy="55" r="28" fill="#F6C148" stroke="#2C1B12" strokeWidth="1.5"/>
      
      {/* Eyes */}
      <circle cx="42" cy="48" r="3" fill="#2C1B12"/>
      <circle cx="58" cy="48" r="3" fill="#2C1B12"/>
      <circle cx="43" cy="47" r="1" fill="white"/>
      <circle cx="59" cy="47" r="1" fill="white"/>
      
      {/* Nose */}
      <path d="M50 55 L47 58 L53 58 Z" fill="#2C1B12"/>
      
      {/* Mouth */}
      <path d="M50 60 Q45 65 40 62" stroke="#2C1B12" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M50 60 Q55 65 60 62" stroke="#2C1B12" strokeWidth="2" fill="none" strokeLinecap="round"/>
      
      {/* Whiskers */}
      <line x1="30" y1="52" x2="38" y2="54" stroke="#2C1B12" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="30" y1="58" x2="38" y2="58" stroke="#2C1B12" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="62" y1="54" x2="70" y2="52" stroke="#2C1B12" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="62" y1="58" x2="70" y2="58" stroke="#2C1B12" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
};