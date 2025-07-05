import React from 'react';
import { StatusIndicatorProps } from '../types';

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  className = '',
}) => {
  const statusConfig = {
    online: {
      color: 'bg-green-500',
      text: 'Online',
    },
    offline: {
      color: 'bg-red-500',
      text: 'Offline',
    },
    connecting: {
      color: 'bg-yellow-500',
      text: 'Connecting',
    },
  };
  
  const config = statusConfig[status];
  
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-sm text-gray-600">{config.text}</span>
    </div>
  );
}; 