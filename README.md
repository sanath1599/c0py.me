

<p align="center">
  <img src="apps/web/public/c0py.me-logo.gif" alt="c0py.me Logo" width="96" height="96" />
   <h1>c0py.me</h1>
</p>


**Secure Anonymous P2P File Sharing**

A modern, open-source web application for secure peer-to-peer file sharing with a beautiful glassmorphic UI. Built with the MERN stack, WebRTC, and TypeScript.

<p align="center">
  <img src="apps/web/public/banner.png" alt="c0py.me Banner" width="800" height="400" />
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Native-green.svg)](https://webrtc.org/)

## Features

- **Secure P2P Transfer**: Files travel directly between devices using WebRTC. No servers store or access your data.
- **Anonymous Sharing**: Generate random usernames, no accounts required. Share files without revealing your identity.
- **Lightning Fast**: Direct device-to-device transfers eliminate server bottlenecks. Experience maximum transfer speeds.
- **Three Worlds**: Jungle (global), Room (private codes), or Family (same WiFi). Choose your sharing environment.
- **Connection Authorization**: Recipients see file details and approve transfers. No surprise file downloads.
- **Real-time Progress**: Watch animated cubs track transfer progress with live speed and time estimates.

## How It Works

1. **Choose Your World**
   - Join the global Jungle, create private Rooms with codes, or connect with Family on the same WiFi network.
2. **Select & Send Request**
   - Pick your files, choose a recipient, and send a connection request. The recipient sees your file details and can accept or decline.
3. **Direct P2P Transfer**
   - Once accepted, files transfer directly between devices via WebRTC. Watch the animated cub track progress in real-time.

## Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Framer Motion, Tailwind CSS
- **Backend**: Node.js, Express.js, Socket.IO
- **Real-time**: WebRTC, WebSocket signaling
- **Build Tools**: Turborepo, Vite, pnpm
- **Database**: MongoDB (user sessions only)

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

1. **Open c0py.me** in your browser
2. **Choose your world**:
   - **Jungle**: Connect with anyone globally
   - **Room**: Create/join private rooms
   - **Family**: Connect with devices on same WiFi

3. **Share files**:
   - Drag & drop files or click to select
   - Choose a recipient from the available peers
   - Watch the animated cub track progress
   - Files transfer directly between devices

### File Transfer Process

1. **Connection Request**: Sender requests connection with recipient
2. **Authorization**: Recipient approves via modal
3. **WebRTC Handshake**: Secure peer-to-peer connection established
4. **File Transfer**: Chunked file transfer with progress tracking
5. **Completion**: File saved to recipient's device

### Supported File Types
- **All file types** supported (no restrictions)
- **Large files** handled efficiently with chunking
- **Multiple files** can be transferred simultaneously
- **No size limits** (browser memory dependent)

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
├── hooks/         # Custom React hooks
├── pages/         # Page components
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
└── main.tsx       # Application entry point
```

#### Backend (`apps/api/`)
```
src/
├── controllers/   # Route controllers
├── models/        # Database models
├── routes/        # API routes
├── services/      # Business logic
├── utils/         # Utility functions
└── server.ts      # Server entry point
```

### Key Components

#### WebRTC Integration
- **Peer Connection**: Manages WebRTC connections
- **Data Channels**: Handles file transfer
- **Signaling**: Socket.IO for connection establishment
- **ICE Handling**: STUN server configuration

#### UI Components
- **GlassCard**: Reusable glassmorphic card component
- **Avatar**: User avatar with emoji and colors
- **CubProgress**: Animated progress indicator
- **Toast**: Notification system with sound

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
   PORT=3001
   CLIENT_URL=https://your-domain.com
   NODE_ENV=production
   ```

3. **Deploy to your preferred platform**
   - **Vercel**: Frontend deployment
   - **Railway/Render**: Backend deployment
   - **MongoDB Atlas**: Database hosting

### Docker Deployment

```bash
# Build and run with Docker
docker build -t c0py-me .
docker run -p 3001:3001 c0py-me
```

## Security

### Privacy Features
- **No File Storage**: Files never touch our servers
- **Anonymous Users**: Random usernames, no accounts
- **Direct P2P**: End-to-end encrypted transfers
- **Connection Authorization**: Recipients approve transfers
- **No Logging**: We don't log file transfers or user data

### Technical Security
- **WebRTC Encryption**: Built-in encryption for all transfers
- **HTTPS Only**: Secure connections in production
- **Input Validation**: All user inputs validated and sanitized
- **CORS Protection**: Proper cross-origin resource sharing
- **Rate Limiting**: API rate limiting to prevent abuse

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical docs
- **Issues**: Report bugs and feature requests on GitHub
- **Discussions**: Join community discussions on GitHub

## Acknowledgments

- **WebRTC**: For peer-to-peer communication
- **React**: For the amazing frontend framework
- **Framer Motion**: For smooth animations
- **Tailwind CSS**: For utility-first styling
- **Socket.IO**: For real-time signaling

---

**Made with love for secure, anonymous file sharing**
