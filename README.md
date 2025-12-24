
<p align="center">
  <img src="apps/web/public/c0py.me-logo.gif" alt="c0py.me Logo" width="96" height="96" />
   <h1>c0py.me</h1>
</p>

**Secure Anonymous P2P File Sharing**

A modern, open-source web application for secure peer-to-peer file sharing with a beautiful glassmorphic UI. Built with the MERN stack, WebRTC, and TypeScript.

<p align="center">
  <img src="apps/web/public/banner.png" alt="c0py.me Banner" width="800" height="400" />
</p>

<p align="center">
  <a href="https://c0py.me/">🌐 Live Website</a> • 
  <a href="https://www.youtube.com/watch?v=kf1zqB7TmNM">📹 Demo Video</a>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Native-green.svg)](https://webrtc.org/)

## Features

### Core Features
- **Secure P2P Transfer**: Files travel directly between devices using WebRTC. No servers store or access your data.
- **Anonymous Sharing**: Generate random usernames, no accounts required. Share files without revealing your identity.
- **Lightning Fast**: Direct device-to-device transfers eliminate server bottlenecks. Experience maximum transfer speeds.
- **Three Worlds**: Jungle (global), Room (private codes), or Family (same WiFi). Choose your sharing environment.
- **Connection Authorization**: Recipients see file details and approve transfers. No surprise file downloads.
- **Real-time Progress**: Watch animated cubs track transfer progress with live speed and time estimates.

### Advanced Features
- **Mobile Optimizations**: Intelligent device detection with optimized chunk sizes for mobile devices (8KB chunks)
- **IndexedDB Support**: Large files (>50MB) on mobile devices are stored in IndexedDB to prevent memory issues
- **Adaptive Chunking**: Dynamic chunk sizes based on device type and file size:
  - Mobile devices: 8KB chunks for stability
  - Desktop small files (<100MB): 64KB chunks
  - Desktop medium files (100-500MB): 128KB chunks
  - Desktop large files (>500MB): 256KB chunks
- **Flow Control**: Intelligent buffer management with automatic pause/resume to prevent buffer overflow
- **Progress Throttling**: Optimized UI updates to prevent performance degradation during large transfers
- **Cross-Platform**: Full support for mobile, tablet, and desktop devices with responsive design
- **Network Detection**: Automatic mobile data detection with warnings for Family mode (WiFi only)

## File Transfer Flow

The application uses an intelligent file transfer system that adapts to device capabilities and file sizes:

```mermaid
flowchart TD
    A[File Selected] --> B{Is Mobile?}
    B -->|Yes| C{File Size > 50MB?}
    B -->|No| D[Use In-Memory File]
    C -->|Yes| E[Store to IndexedDB]
    C -->|No| D
    E --> F[File Ready for Transfer]
    D --> F
    
    F --> G{Detect Device Type}
    G -->|Mobile| H[Use 8KB Chunks]
    G -->|Desktop| I{File Size?}
    I -->|>500MB| J[Use 256KB Chunks]
    I -->|>100MB| K[Use 128KB Chunks]
    I -->|Other| L[Use 64KB Chunks]
    
    H --> M[Send with Flow Control]
    J --> M
    K --> M
    L --> M
    
    M --> N{Buffer Check}
    N -->|Buffer Full| O[Pause & Wait]
    N -->|Buffer OK| P{Read Source}
    P -->|IndexedDB| Q[Read Chunk from IDB]
    P -->|Memory| R[Read Chunk from File]
    Q --> S[Send Chunk]
    R --> S
    O --> T[onbufferedamountlow]
    T --> P
    
    S --> U{Throttled Update?}
    U -->|Yes| V[Update Progress UI]
    U -->|No| W[Skip Update]
    V --> X{More Chunks?}
    W --> X
    X -->|Yes| N
    X -->|No| Y[Complete]
    
    Z[Receiving Chunk] --> AA{Is Mobile?}
    AA -->|Yes| AB{File Size > 50MB?}
    AA -->|No| AC[Store in Memory]
    AB -->|Yes| AD[Write to IndexedDB]
    AB -->|No| AC
    AD --> AE{File Complete?}
    AC --> AE
    AE -->|Yes| AF{From IndexedDB?}
    AF -->|Yes| AG[Read from IDB & Create Blob]
    AF -->|No| AH[Create Blob from Memory]
    AG --> AI[File Ready]
    AH --> AI
```

## How It Works

1. **Choose Your World**
   - **Jungle**: Connect with anyone globally in the public space
   - **Room**: Create or join private rooms with unique codes
   - **Family**: Connect with devices on the same WiFi network (WiFi only, mobile data detection included)

2. **Select & Send Request**
   - Drag & drop files or click to select
   - Choose a recipient from the available peers
   - The system automatically detects your device type and optimizes the transfer
   - Recipient sees file details and can accept or decline

3. **Intelligent File Transfer**
   - Files are automatically stored in IndexedDB on mobile if >50MB
   - Chunk size adapts based on device and file size
   - Flow control prevents buffer overflow
   - Real-time progress tracking with throttled UI updates
   - Direct P2P transfer via WebRTC

4. **Receive & Download**
   - Recipient receives file chunks
   - Large files stored in IndexedDB automatically
   - File assembled and ready for download
   - Original file metadata preserved

## Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Framer Motion, Tailwind CSS
- **Backend**: Node.js, Express.js, Socket.IO
- **Real-time**: WebRTC, WebSocket signaling
- **Storage**: IndexedDB (for large files on mobile), In-memory (for smaller files)
- **Build Tools**: Turborepo, Vite, pnpm
- **Database**: MongoDB (user sessions and metadata only, no file storage)
- **Caching**: Redis (for pending requests and session management)

### Monorepo Structure
```
sharedrop/
├── apps/
│   ├── web/          # React frontend application
│   └── api/          # Express.js backend API
├── packages/
│   ├── ui/           # Shared UI components
│   ├── database/     # Database models and utilities
│   └── config/       # Shared configuration
├── tools/
│   ├── eslint-config/    # Shared ESLint configuration
│   └── typescript-config/ # Shared TypeScript configuration
└── turbo.json        # Turborepo configuration
```

## Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm 8+
- MongoDB (local or Atlas)
- Redis (optional, for enhanced features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/sharedrop.git
   cd sharedrop
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   # apps/api/.env
   MONGODB_URI=mongodb://localhost:27017/c0py-me
   PORT=3001
   CLIENT_URL=http://localhost:5173
   REDIS_URL=redis://localhost:6379  # Optional
   
   # apps/web/.env
   VITE_API_URL=http://localhost:3001
   ```

4. **Start development servers**
   ```bash
   # Terminal 1: Backend
   pnpm --filter @sharedrop/api dev
   
   # Terminal 2: Frontend
   pnpm --filter @sharedrop/web dev
   ```

5. **Open your browser**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001

## Usage Guide

### Getting Started

1. **Visit [c0py.me](https://c0py.me/)** or open locally
2. **Choose your world**:
   - **Jungle**: Connect with anyone globally
   - **Room**: Create/join private rooms with codes
   - **Family**: Connect with devices on same WiFi (mobile data detection warns users)

3. **Share files**:
   - Drag & drop files or click to select
   - System automatically detects device type and optimizes transfer
   - Choose a recipient from the available peers
   - Watch the animated cub track progress in real-time
   - Files transfer directly between devices

### File Transfer Process

1. **File Selection**: Select files (system detects device and file size)
2. **Storage Decision**: Large files on mobile stored in IndexedDB automatically
3. **Connection Request**: Sender requests connection with recipient
4. **Authorization**: Recipient approves via modal with file details
5. **WebRTC Handshake**: Secure peer-to-peer connection established
6. **Adaptive Chunking**: Chunk size determined by device and file size
7. **Flow Control**: Buffer management prevents overflow
8. **File Transfer**: Chunked transfer with throttled progress updates
9. **Completion**: File assembled and ready for download

### Supported File Types
- **All file types** supported (no restrictions)
- **Large files** handled efficiently with IndexedDB on mobile
- **Multiple files** can be transferred simultaneously
- **No size limits** (browser storage dependent)

### Device-Specific Features

#### Mobile Devices
- Automatic IndexedDB storage for files >50MB
- 8KB chunk size for stability
- Mobile data detection and warnings
- Touch-optimized UI
- Responsive design

#### Desktop Devices
- In-memory file handling for most files
- Adaptive chunk sizes (64KB-256KB)
- Larger buffer sizes
- Keyboard shortcuts
- Full feature set

## Development

### Available Scripts

```bash
# Development
pnpm dev                    # Start all dev servers
pnpm --filter @sharedrop/web dev    # Frontend only
pnpm --filter @sharedrop/api dev    # Backend only

# Building
pnpm build                  # Build all packages
pnpm --filter @sharedrop/web build  # Build frontend
pnpm --filter @sharedrop/api build  # Build backend

# Linting
pnpm lint                   # Lint all packages
pnpm --filter @sharedrop/web lint   # Lint frontend
pnpm --filter @sharedrop/api lint   # Lint backend

# Type checking
pnpm type-check             # Type check all packages
```

### Project Structure

#### Frontend (`apps/web/`)
```
src/
├── components/     # React components
│   ├── LionsDen.tsx      # Main file sharing interface
│   ├── RoomModal.tsx     # Room creation/joining
│   ├── CubProgress.tsx   # Animated progress indicator
│   ├── IncomingFileModal.tsx  # File authorization
│   └── ...
├── hooks/         # Custom React hooks
│   ├── useSocket.ts      # Socket.IO connection management
│   ├── useWebRTC.ts      # WebRTC peer connection management
│   └── ...
├── pages/         # Page components
│   ├── LandingPage.tsx  # Landing page
│   ├── AppPage.tsx      # Main application page
│   └── ...
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
│   ├── deviceInfo.ts    # Device detection and info
│   ├── format.ts        # File size and speed formatting
│   └── ...
└── main.tsx       # Application entry point
```

#### Backend (`apps/api/`)
```
src/
├── routes/        # API routes
│   ├── routes.ts         # Main API routes
│   └── logs.ts           # Logging endpoints
├── socketService.ts      # Socket.IO service
├── server.ts      # Server entry point
└── ...
```

### Key Components

#### WebRTC Integration
- **Peer Connection**: Manages WebRTC connections with automatic cleanup
- **Data Channels**: Handles file transfer with flow control
- **Signaling**: Socket.IO for connection establishment
- **ICE Handling**: STUN server configuration for NAT traversal
- **Flow Control**: Buffer management with automatic pause/resume

#### File Handling
- **Device Detection**: Automatic mobile/tablet/desktop detection
- **IndexedDB Integration**: Large file storage on mobile devices
- **Adaptive Chunking**: Dynamic chunk sizes based on device and file size
- **Progress Tracking**: Throttled UI updates for performance
- **Memory Management**: Efficient handling of large files

#### UI Components
- **GlassCard**: Reusable glassmorphic card component
- **Avatar**: User avatar with emoji and colors
- **CubProgress**: Animated progress indicator with speed/time estimates
- **Toast**: Notification system with sound feedback
- **Radar**: Peer visualization component

## Deployment

### Production Deployment

1. **Build the application**
   ```bash
   pnpm build
   ```

2. **Set up environment variables**
   ```bash
   # Production environment variables
   MONGODB_URI=your_mongodb_atlas_uri
   REDIS_URL=your_redis_url  # Optional
   PORT=3001
   CLIENT_URL=https://c0py.me
   NODE_ENV=production
   ```

3. **Deploy to your preferred platform**
   - **Vercel/Netlify**: Frontend deployment
   - **Railway/Render**: Backend deployment
   - **MongoDB Atlas**: Database hosting
   - **Redis Cloud**: Caching and session management

### Docker Deployment

   ```bash
# Build and run with Docker
docker build -t c0py-me .
docker run -p 3001:3001 c0py-me
```

## Security

### Privacy Features
- **No File Storage**: Files never touch our servers
- **Anonymous Users**: Random usernames, no accounts required
- **Direct P2P**: End-to-end encrypted transfers via WebRTC
- **Connection Authorization**: Recipients approve transfers
- **No Logging**: We don't log file transfers or user data
- **IndexedDB Privacy**: Files stored locally on user's device only

### Technical Security
- **WebRTC Encryption**: Built-in DTLS/SRTP encryption for all transfers
- **HTTPS Only**: Secure connections in production
- **Input Validation**: All user inputs validated and sanitized
- **CORS Protection**: Proper cross-origin resource sharing
- **Rate Limiting**: API rate limiting to prevent abuse
- **Session Management**: Secure session handling with Redis

## Performance Optimizations

### Transfer Optimizations
- **Adaptive Chunking**: Optimal chunk sizes for different devices and file sizes
- **Flow Control**: Prevents buffer overflow and ensures smooth transfers
- **Progress Throttling**: Reduces UI update frequency for better performance
- **IndexedDB**: Efficient storage for large files on mobile devices
- **Connection Reuse**: Efficient WebRTC connection management

### Memory Management
- **Mobile**: IndexedDB for files >50MB to prevent memory issues
- **Desktop**: In-memory for most files with efficient chunking
- **Automatic Cleanup**: Proper resource cleanup after transfers
- **Buffer Management**: Intelligent buffer size management

## Browser Compatibility

### Supported Browsers
- **Chrome**: 56+ (Full WebRTC support, IndexedDB support)
- **Firefox**: 52+ (Full WebRTC support, IndexedDB support)
- **Safari**: 11+ (Limited WebRTC support, IndexedDB support)
- **Edge**: 79+ (Full WebRTC support, IndexedDB support)
- **Mobile Browsers**: iOS Safari, Chrome Mobile, Firefox Mobile

### Feature Detection
- WebRTC API availability checking
- IndexedDB availability checking
- Data channel support verification
- STUN server connectivity testing
- Device type detection
- Network information API

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful commit messages
- Add JSDoc comments for complex functions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- **[Documentation Index](docs/README.md)** - Complete documentation overview
- **[Architecture](docs/architecture/ARCHITECTURE.md)** - System architecture and design
- **[API Documentation](docs/API.md)** - API endpoints and WebSocket events
- **[Deployment Guide](docs/deployment/DEPLOYMENT.md)** - Production deployment instructions
- **[Contributing Guide](docs/CONTRIBUTING.md)** - How to contribute to the project
- **[Development Instructions](docs/development/instructions.md)** - Development setup and guidelines

## Support

- **Live Website**: [https://c0py.me/](https://c0py.me/)
- **Demo Video**: [Watch on YouTube](https://www.youtube.com/watch?v=kf1zqB7TmNM)
- **Documentation**: See [docs/](docs/) for comprehensive documentation
- **Issues**: Report bugs and feature requests on [GitHub](https://github.com/sanath1599/c0py.me/issues)
- **Discussions**: Join community discussions on [GitHub](https://github.com/sanath1599/c0py.me/discussions)

## Acknowledgments

- **WebRTC**: For peer-to-peer communication
- **React**: For the amazing frontend framework
- **Framer Motion**: For smooth animations
- **Tailwind CSS**: For utility-first styling
- **Socket.IO**: For real-time signaling
- **IndexedDB**: For efficient mobile file storage

---

**Made with love for secure, anonymous file sharing**

<p align="center">
  <a href="https://c0py.me/">🌐 Visit c0py.me</a> • 
  <a href="https://www.youtube.com/watch?v=kf1zqB7TmNM">📹 Watch Demo</a>
</p>
