# c0py.me Architecture Documentation

## 🏗️ System Overview

c0py.me is a modern, secure peer-to-peer file sharing application built with the MERN stack and WebRTC technology. The system enables direct file transfers between devices without server storage, ensuring complete privacy and maximum transfer speeds.

### Core Principles
- **Zero Server Storage**: Files never touch our servers
- **Direct P2P Communication**: WebRTC for device-to-device transfers
- **Anonymous Sharing**: Random usernames, no accounts required
- **Real-time Progress**: Live transfer tracking with animated UI
- **Cross-platform**: Works on any modern browser

## 🏛️ Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ LandingPage │ │   AppPage   │ │   Modals    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Component Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  LionsDen   │ │   Avatar    │ │ CubProgress │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ RoomModal   │ │   Toast     │ │   Radar     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Hook Layer                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  useSocket  │ │  useWebRTC  │ │   Utils     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Backend Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Socket.IO   │ │   MongoDB   │ │   Express   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Network Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   WebRTC    │ │   STUN      │ │  WebSocket  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
sharedrop/
├── apps/
│   ├── web/                    # React Frontend
│   │   ├── src/
│   │   │   ├── components/     # UI Components
│   │   │   ├── hooks/          # Custom React Hooks
│   │   │   ├── pages/          # Page Components
│   │   │   ├── types/          # TypeScript Definitions
│   │   │   ├── utils/          # Utility Functions
│   │   │   └── main.tsx        # Application Entry
│   │   ├── public/             # Static Assets
│   │   └── package.json
│   └── api/                    # Express Backend
│       ├── src/
│       │   ├── controllers/    # Route Controllers
│       │   ├── models/         # Database Models
│       │   ├── routes/         # API Routes
│       │   ├── services/       # Business Logic
│       │   └── server.ts       # Server Entry
│       └── package.json
├── packages/
│   ├── ui/                     # Shared UI Components
│   ├── database/               # Database Models & Utils
│   └── config/                 # Shared Configuration
├── tools/
│   ├── eslint-config/          # Shared ESLint Config
│   └── typescript-config/      # Shared TypeScript Config
└── turbo.json                  # Turborepo Configuration
```

## 🔄 Data Flow

### 1. User Connection Flow
```
User Opens App → Landing Page → World Selection → Socket Connection → Room Join
```

### 2. File Transfer Flow
```
File Selection → Peer Selection → Connection Request → Authorization → WebRTC Setup → File Transfer → Progress Tracking → Completion
```

### 3. WebRTC Signaling Flow
```
Offer → ICE Candidates → Answer → Data Channel → File Chunks → Completion
```

## 🧩 Core Components

### Frontend Components

#### **LionsDen** (`apps/web/src/components/LionsDen.tsx`)
- **Purpose**: Main file sharing interface
- **Features**: 
  - Peer radar visualization
  - File selection and drag-drop
  - Transfer progress tracking
  - Real-time status updates
- **Key Props**: `peers`, `selectedFiles`, `transfers`, `currentWorld`

#### **RoomModal** (`apps/web/src/components/RoomModal.tsx`)
- **Purpose**: Room creation and joining interface
- **Features**:
  - Random room code generation
  - Room code validation
  - Copy to clipboard functionality
- **Key Props**: `isOpen`, `onClose`, `onJoinRoom`

#### **CubProgress** (`apps/web/src/components/CubProgress.tsx`)
- **Purpose**: Animated progress indicator
- **Features**:
  - Lion cub animation
  - Real-time progress tracking
  - Speed and time estimates
- **Key Props**: `progress`, `speed`, `timeRemaining`

#### **IncomingFileModal** (`apps/web/src/components/IncomingFileModal.tsx`)
- **Purpose**: File transfer authorization
- **Features**:
  - File details display
  - Accept/reject options
  - Sender information
- **Key Props**: `file`, `onAccept`, `onReject`

### Backend Services

#### **SocketService** (`apps/api/src/socketService.ts`)
- **Purpose**: Real-time communication hub
- **Features**:
  - WebSocket connection management
  - Room-based user grouping
  - WebRTC signaling relay
  - User presence tracking

#### **User Model** (`packages/database/models/User.ts`)
- **Purpose**: User session management
- **Features**:
  - Connection status tracking
  - Profile information storage
  - Room membership management

## 🔌 Hooks & Utilities

### **useSocket** (`apps/web/src/hooks/useSocket.ts`)
- **Purpose**: Socket.IO connection management
- **Features**:
  - Connection state management
  - Room joining/leaving
  - Signal forwarding
  - User list synchronization

### **useWebRTC** (`apps/web/src/hooks/useWebRTC.ts`)
- **Purpose**: WebRTC peer connection management
- **Features**:
  - Peer connection establishment
  - Data channel management
  - File chunking and transfer
  - Progress tracking

### **Utils**
- **format.ts**: File size and speed formatting
- **colors.ts**: Random color and emoji generation
- **names.ts**: Random username generation
- **sound.ts**: Audio feedback utilities

## 🔒 Security Architecture

### Data Privacy
- **Zero Server Storage**: Files never stored on servers
- **Direct P2P Transfer**: WebRTC encrypted connections
- **Anonymous Users**: Random usernames, no personal data
- **No Logging**: Minimal server-side logging

### Network Security
- **HTTPS Only**: Secure connections in production
- **STUN Servers**: Google's public STUN servers
- **Input Validation**: Sanitized user inputs
- **Rate Limiting**: API endpoint protection

### WebRTC Security
- **Built-in Encryption**: WebRTC's DTLS/SRTP encryption
- **ICE Candidate Validation**: Secure connection establishment
- **Data Channel Security**: Encrypted file transfer
- **Connection Validation**: Peer verification

## 🌐 Network Architecture

### Signaling Server
```
Client A ←→ Socket.IO Server ←→ Client B
    ↓              ↓              ↓
WebRTC Offer   Signal Relay   WebRTC Answer
    ↓              ↓              ↓
ICE Candidates  Signal Relay   ICE Candidates
    ↓              ↓              ↓
Direct P2P Connection Established
```

### STUN/TURN Configuration
```javascript
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];
```

## 📊 Performance Optimization

### Frontend Optimizations
- **Code Splitting**: Lazy-loaded components
- **Bundle Optimization**: Tree shaking and minification
- **Memory Management**: Efficient file handling
- **Animation Performance**: Framer Motion optimizations

### Backend Optimizations
- **Connection Pooling**: MongoDB connection management
- **Signal Efficiency**: Minimal WebSocket overhead
- **Memory Usage**: Efficient user session handling
- **Scalability**: Horizontal scaling ready

### WebRTC Optimizations
- **Chunked Transfers**: 16KB chunks for large files
- **Connection Reuse**: Efficient peer connection management
- **Progress Tracking**: Real-time transfer monitoring
- **Error Recovery**: Automatic retry mechanisms

## 🚀 Deployment Architecture

### Development Environment
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │   Backend   │    │  MongoDB    │
│  localhost  │◄──►│  localhost  │◄──►│  localhost  │
│    5173     │    │    3001     │    │    27017    │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Production Environment
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   CDN/      │    │   Load      │    │  MongoDB    │
│  Frontend   │◄──►│  Balancer   │◄──►│   Atlas     │
│   (Vercel)  │    │   (Nginx)   │    │  (Cloud)    │
└─────────────┘    └─────────────┘    └─────────────┘
                        │
                ┌─────────────┐
                │   Backend   │
                │   (Docker)  │
                │   (Railway) │
                └─────────────┘
```

## 🔧 Development Guidelines

### Code Organization
- **Component Structure**: Functional components with hooks
- **Type Safety**: Strict TypeScript configuration
- **State Management**: React hooks and context
- **Styling**: Tailwind CSS with glassmorphism design

### Testing Strategy
- **Unit Tests**: Component and utility testing
- **Integration Tests**: Hook and service testing
- **E2E Tests**: Complete user workflow testing
- **Performance Tests**: Transfer speed monitoring

### Code Quality
- **ESLint**: Consistent code style enforcement
- **Prettier**: Automatic code formatting
- **TypeScript**: Strict type checking
- **Git Hooks**: Pre-commit validation

## 📈 Monitoring & Analytics

### Performance Metrics
- **Transfer Speed**: Real-time speed monitoring
- **Connection Success**: WebRTC connection rates
- **User Engagement**: Session duration and activity
- **Error Rates**: Transfer failure tracking

### Health Checks
- **Server Status**: API endpoint monitoring
- **Database Health**: MongoDB connection status
- **WebRTC Status**: STUN server connectivity
- **Client Performance**: Browser compatibility

## 🔮 Future Enhancements

### Planned Features
1. **TURN Server**: Custom TURN server for better NAT traversal
2. **File Compression**: Automatic file compression
3. **Resume Transfers**: Interrupted transfer recovery
4. **Mobile App**: React Native mobile application
5. **Cloud Integration**: Optional cloud storage
6. **Advanced Security**: Custom encryption keys

### Technical Improvements
1. **Service Workers**: Offline functionality
2. **WebAssembly**: Performance optimizations
3. **Progressive Web App**: Native app experience
4. **Real-time Collaboration**: Multi-user editing
5. **API Versioning**: Backward compatibility
6. **Microservices**: Scalable architecture

## 📚 API Documentation

### WebSocket Events
```typescript
// Join Room
socket.emit('join-room', { room, userId, name, color, emoji });

// Update Profile
socket.emit('update-profile', { name, color, emoji });

// WebRTC Signaling
socket.emit('signal', { to, from, data });

// Ping/Pong
socket.emit('ping');
socket.on('pong', () => {});
```

### WebRTC Data Channel Messages
```typescript
// File Request
{ type: 'file-request', fileName, fileSize, fileType, transferId }

// File Acceptance
{ type: 'file-accepted', transferId }

// File Rejection
{ type: 'file-rejected', transferId }

// File Start
{ type: 'file-start', name, size, fileType }

// File End
{ type: 'file-end' }

// File Chunk (Binary)
ArrayBuffer
```

## 🛠️ Troubleshooting

### Common Issues
1. **WebRTC Connection Failures**: Check STUN server connectivity
2. **File Transfer Issues**: Verify chunk size and memory limits
3. **Database Connection**: Check MongoDB connection string
4. **Build Failures**: Clear Turborepo cache and node_modules

### Debug Tools
- **Browser Dev Tools**: WebRTC debugging
- **WebSocket Monitor**: Connection status
- **MongoDB Logs**: Database operations
- **Turborepo Verbose**: Build debugging

---

*This architecture documentation provides a comprehensive overview of c0py.me's system design, implementation details, and development guidelines. For specific implementation questions, refer to the individual component files and inline documentation.* 