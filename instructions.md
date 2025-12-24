# ShareDrop (c0py.me) - Complete Implementation Instructions

## Project Overview
ShareDrop is a WebRTC-based peer-to-peer file sharing application built with React, TypeScript, Socket.IO, and Express.js. It features a glassmorphism design with a lion/cub theme and supports three sharing modes: Jungle (global), Room (private), and Family (local WiFi).

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Socket.IO Client** for real-time communication
- **WebRTC API** for peer-to-peer file transfer
- **Lucide React** for icons
- **React Router DOM** for routing
- **JSZip** for ZIP file previews
- **React Confetti** for success animations

### Backend
- **Node.js** with Express.js
- **Socket.IO** for WebSocket communication
- **Redis** for session storage and offline message queuing
- **TypeScript** for type safety
- **CORS** for cross-origin requests

### Development Tools
- **Turborepo** for monorepo management
- **pnpm** for package management
- **ESLint** for code linting
- **Jest** for testing
- **Docker** for Redis container

## Color Scheme & Design System

### Primary Colors
```css
/* Main Brand Colors */
--primary-orange: #A6521B;      /* Dark orange - primary brand */
--accent-yellow: #F6C148;       /* Golden yellow - accent */
--text-dark: #2C1B12;           /* Dark brown - primary text */
--background-light: #FFF8F0;    /* Warm white background */

/* Glassmorphism Colors */
--glass-bg: rgba(255, 255, 255, 0.8);
--glass-border: rgba(166, 82, 27, 0.2);
--glass-hover: rgba(255, 255, 255, 0.2);

/* Status Colors */
--success-green: #10B981;
--error-red: #EF4444;
--warning-yellow: #F59E0B;
--info-blue: #3B82F6;
```

### Avatar Colors
```javascript
const AVATAR_COLORS = [
  '#F6C148', '#A6521B', '#FF6B6B', '#4ECDC4', '#45B7D1', 
  '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];
```

### Emoji Set
```javascript
const EMOJIS = [
  '🦁', '😀', '😎', '🤖', '🦄', '🐱', '🐶', '🦊', '🐼', '🐸',
  '🌟', '🔥', '⚡', '🌈', '🎯', '🎨', '🎭', '🎪', '🎸', '🚀'
];
```

## Project Structure

```
sharedrop/
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── components/     # React components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── pages/          # Page components
│   │   │   ├── services/       # API services
│   │   │   ├── types/          # TypeScript types
│   │   │   └── utils/          # Utility functions
│   │   ├── public/             # Static assets
│   │   └── package.json
│   └── api/                    # Express backend
│       ├── src/
│       │   ├── routes/         # API routes
│       │   ├── server.ts       # Main server file
│       │   ├── socketService.ts # Socket.IO service
│       │   └── redis.ts        # Redis configuration
│       └── package.json
├── packages/
│   ├── config/                 # Shared configuration
│   ├── database/               # Database models
│   └── ui/                     # Shared UI components
└── tools/
    ├── eslint-config/          # ESLint configurations
    └── typescript-config/      # TypeScript configurations
```

## Package Dependencies

### Frontend (apps/web/package.json)
```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "framer-motion": "^12.23.0",
    "jszip": "^3.10.1",
    "lucide-react": "^0.344.0",
    "react": "^18.3.1",
    "react-confetti": "^6.4.0",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.6.3",
    "socket.io": "^4.8.1",
    "socket.io-client": "^4.8.1",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.9.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@types/jest": "^30.0.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.18",
    "buffer": "^6.0.3",
    "crypto-browserify": "^3.12.1",
    "eslint": "^9.9.1",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.11",
    "globals": "^15.9.0",
    "jest": "^30.0.4",
    "jest-environment-jsdom": "^30.0.4",
    "postcss": "^8.4.35",
    "stream-browserify": "^3.0.0",
    "tailwindcss": "^3.4.1",
    "ts-jest": "^29.4.0",
    "typescript": "^5.5.3",
    "typescript-eslint": "^8.3.0",
    "vite": "^5.4.2",
    "vite-plugin-node-polyfills": "^0.23.0"
  }
}
```

### Backend (apps/api/package.json)
```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.6.1",
    "express": "^5.1.0",
    "ioredis": "^5.6.1",
    "redis": "^5.5.6",
    "socket.io": "^4.8.1",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.3",
    "@types/node": "^20.19.4",
    "@types/uuid": "^10.0.0",
    "nodemon": "^3.1.10",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3"
  }
}
```

## Core Components Implementation

### 1. GlassCard Component
```typescript
// apps/web/src/components/GlassCard.tsx
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
```

### 2. Avatar Component
```typescript
// apps/web/src/components/Avatar.tsx
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
```

### 3. CubProgress Component (Animated Progress Bar)
```typescript
// apps/web/src/components/CubProgress.tsx
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
  status?: string; // status of the task
}

export const CubProgress: React.FC<CubProgressProps> = ({ 
  progress, 
  className = '',
  showCub = true,
  speed,
  timeRemaining,
  fileSize,
  status
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
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
        {/* Progress percentage */}
        <div className="text-center">
          <span className="text-lg font-bold text-orange-800">
            {Math.round(clampedProgress)}%
          </span>
        </div>
        {/* File size, speed, and ETA or status icon */}
        <div className="flex justify-between items-center">
          {/* File size */}
          <div className="text-sm font-semibold text-orange-700 bg-orange-100/50 px-2 py-1 rounded">
            {fileSize ? formatFileSize(fileSize) : 'Unknown size'}
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
```

## WebRTC Implementation

### WebRTC Hook (useWebRTC.ts)
Key features:
- Peer-to-peer file transfer using RTCDataChannel
- Chunked file transfer (16KB chunks)
- Real-time progress tracking
- Connection state management
- Offline message queuing with Redis

### ICE Servers Configuration
```typescript
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];
```

### File Transfer Process
1. **Connection Setup**: Create RTCPeerConnection with ICE servers
2. **Data Channel**: Create ordered data channel for file transfer
3. **File Request**: Send file metadata (name, size, type) to recipient
4. **Acceptance**: Recipient can accept or reject the transfer
5. **Chunked Transfer**: Send file in 16KB chunks with progress updates
6. **Completion**: Send completion signal and close connection

## Socket.IO Implementation

### Backend Socket Service
```typescript
// apps/api/src/socketService.ts
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, any> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id);
      
      socket.on('join-room', (data) => {
        // Handle room joining logic
      });
      
      socket.on('signal', (data) => {
        // Handle WebRTC signaling
      });
      
      socket.on('disconnect', () => {
        // Handle user disconnection
      });
    });
  }
}
```

### Frontend Socket Hook (useSocket.ts)
Key features:
- Automatic reconnection with exponential backoff
- Network status detection
- Fallback connection modes (long-polling, API)
- Ping-pong mechanism for connection health
- Room management (Jungle, Room, Family)

## Three Sharing Modes

### 1. Jungle (Global)
- Open world sharing with anyone globally
- No authentication required
- Uses default room "jungle"

### 2. Room (Private)
- Private rooms with custom codes
- Secure sharing with specific groups
- Room codes are generated and shared

### 3. Family (Local WiFi)
- Share with devices on same WiFi network
- Uses public IP to create family room
- Automatic discovery of local devices

## Backend API Endpoints

### Health Check
```
GET /api/health
Response: { status: 'ok', timestamp: '2024-01-01T00:00:00.000Z' }
```

### File Transfer Request Storage
```
POST /api/file-transfer/request
Body: {
  senderId: string,
  receiverId: string,
  fileName: string,
  fileSize: number,
  fileType: string,
  transferId: string
}
```

### WebRTC Signal Storage
```
POST /api/webrtc/signal
Body: {
  senderId: string,
  receiverId: string,
  signalData: any
}
```

## Redis Configuration

### Docker Setup
```bash
docker run -d \
  --name sharedrop-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes
```

### Redis Usage
- Store offline file transfer requests
- Store WebRTC signals for offline users
- Session management
- Scheduled cleanup of expired data

## Environment Variables

### Frontend (.env)
```env
VITE_WS_URL=ws://localhost:4001
VITE_CLIENT_URL=http://localhost:3000
```

### Backend (.env)
```env
PORT=4001
CLIENT_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

## Build and Deployment

### Development
```bash
# Install dependencies
pnpm install

# Start Redis container
pnpm run dev:redis

# Start development servers
pnpm run dev
```

### Production Build
```bash
# Build frontend
cd apps/web
pnpm run build

# Build backend
cd apps/api
pnpm run build

# Start production server
pnpm run start
```

## Key Features Implementation

### 1. Glassmorphism Design
- Backdrop blur effects
- Semi-transparent backgrounds
- Subtle borders and shadows
- Smooth hover animations

### 2. Lion/Cub Theme
- Lion logo and branding
- Cub progress indicators
- Jungle/Room/Family terminology
- Animated cub on progress bars

### 3. Real-time Progress Tracking
- Live transfer speed display
- Time remaining estimates
- Animated progress bars
- Success/error notifications

### 4. Offline Support
- Redis-based message queuing
- Automatic delivery on reconnection
- Connection state management
- Fallback connection modes

### 5. File Type Support
- All file types supported
- ZIP file preview
- Text file preview
- Image/video previews
- PDF preview

## Security Considerations

### WebRTC Security
- Encrypted peer-to-peer connections
- No file content stored on servers
- STUN servers for NAT traversal
- Connection authorization required

### Data Privacy
- No user accounts or authentication
- Random usernames and avatars
- No file content logging
- Temporary session data only

## Performance Optimizations

### Frontend
- React.memo for expensive components
- Lazy loading for routes
- Optimized bundle size
- Efficient state management

### Backend
- Redis connection pooling
- Efficient WebSocket handling
- Scheduled cleanup tasks
- Minimal memory usage

### WebRTC
- Optimized chunk sizes
- Connection reuse where possible
- Efficient signaling
- Error recovery mechanisms

## Testing

### Frontend Tests
```bash
cd apps/web
pnpm run test
```

### Backend Tests
```bash
cd apps/api
pnpm run test
```

## Deployment Scripts

### Simple Deployment
```bash
./deploy-sharedrop-simple.sh
```

### Full Deployment
```bash
./deploy-sharedrop.sh
```

## Troubleshooting

### Common Issues
1. **WebRTC Connection Failures**: Check STUN server connectivity
2. **File Transfer Issues**: Verify chunk size and memory limits
3. **Socket.IO Connection Problems**: Check CORS and namespace configuration
4. **Redis Connection Issues**: Ensure Redis container is running

### Debug Tools
- Browser dev tools for WebRTC debugging
- Socket.IO debug mode
- Redis CLI for data inspection
- Network tab for connection monitoring

## Additional Resources

### Documentation
- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.IO Documentation](https://socket.io/docs/)
- [React Documentation](https://react.dev/)
- [Framer Motion Documentation](https://www.framer.com/motion/)

### Assets Required
- `/logo.png` - Main lion logo
- `/favicon.gif` - Animated favicon
- `/progress_bar.png` - Cub progress indicator
- `/banner.png` - Landing page banner
- `/network_error.png` - Error illustration

This implementation provides a complete, production-ready WebRTC file sharing application with a beautiful glassmorphism design and robust peer-to-peer functionality.

