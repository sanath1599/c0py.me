<p align="center">
  <img src="apps/web/public/favicon.gif" alt="c0py.me Logo" width="96" height="96" />
</p>

# c0py.me 🦁

**Secure Anonymous P2P File Sharing**

A modern, open-source web application for secure peer-to-peer file sharing with a beautiful glassmorphic UI. Built with the MERN stack, WebRTC, and TypeScript.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Native-green.svg)](https://webrtc.org/)

## ✨ Features

### 🔒 **Security & Privacy**
- **Direct P2P Transfer**: Files never touch servers
- **Anonymous Sharing**: Random usernames, no accounts required
- **Secure Transmission**: WebRTC's built-in encryption
- **Privacy First**: No file storage, no tracking, no logs

### 🌍 **Multiple Worlds**
- **🌍 Jungle**: Global public space for anyone
- **🏠 Room**: Private rooms with custom codes
- **👨‍👩‍👧‍👦 Family**: Local network discovery

### ⚡ **Performance**
- **Lightning Fast**: Direct device-to-device transfers
- **Real-time Progress**: Animated cub progress tracking
- **Chunked Transfers**: Efficient large file handling
- **No Size Limits**: Limited only by browser memory

### 🎨 **User Experience**
- **Glassmorphic Design**: Modern, beautiful interface
- **Responsive Layout**: Works on all devices
- **Drag & Drop**: Intuitive file selection
- **Live Notifications**: Toast messages with sound effects

## 🏗️ Architecture

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

## 🚀 Quick Start

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

## 📖 Usage Guide

### Getting Started

1. **Open c0py.me** in your browser
2. **Choose your world**:
   - 🌍 **Jungle**: Connect with anyone globally
   - 🏠 **Room**: Create/join private rooms
   - 👨‍👩‍👧‍👦 **Family**: Connect with devices on same WiFi

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

## 🔧 Development

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

## 🚀 Deployment

### Production Deployment

1. **Build the application**
   ```bash
   pnpm build
   ```

2. **Set up environment variables**
   ```bash
   # Production environment variables
   MONGODB_URI=mongodb+srv://...
   PORT=3001
   CLIENT_URL=https://yourdomain.com
   NODE_ENV=production
   ```

3. **Deploy using Docker**
   ```bash
   # Use the provided deployment script
   ./deploy-sharedrop.sh
   ```

### Deployment Options

#### Docker Deployment
```bash
# Build and run with Docker
docker build -t c0py-me .
docker run -p 3001:3001 c0py-me
```

#### Manual Deployment
```bash
# Install PM2 for process management
npm install -g pm2

# Start the application
pm2 start apps/api/dist/server.js --name c0py-me-api
pm2 start apps/web/dist --name c0py-me-web
```

#### Cloud Platforms
- **Vercel**: Frontend deployment
- **Railway**: Full-stack deployment
- **Heroku**: Backend deployment
- **DigitalOcean**: VPS deployment

## 🔒 Security

### Data Privacy
- **No File Storage**: Files never stored on servers
- **Direct Transfer**: Peer-to-peer communication only
- **Anonymous Users**: No personal information collected
- **Encrypted Connections**: WebRTC's built-in encryption

### Network Security
- **HTTPS Only**: Secure connections in production
- **CORS Configuration**: Proper cross-origin settings
- **Input Validation**: Sanitized user inputs
- **Rate Limiting**: API endpoint protection

### WebRTC Security
- **STUN Servers**: Google's public STUN servers
- **ICE Candidates**: Secure connection establishment
- **Data Channels**: Encrypted file transfer
- **Connection Validation**: Peer verification

## 🧪 Testing

### Running Tests
```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### Test Coverage
- **Frontend**: React Testing Library
- **Backend**: Jest with supertest
- **WebRTC**: Manual testing scenarios
- **UI**: Visual regression testing

## 📊 Performance

### Optimization Features
- **Code Splitting**: Lazy-loaded components
- **Bundle Optimization**: Tree shaking and minification
- **Caching**: Efficient caching strategies
- **Memory Management**: Optimized file handling

### Performance Metrics
- **Transfer Speed**: Limited by network bandwidth
- **Connection Time**: 5-10 seconds for WebRTC setup
- **Memory Usage**: Efficient chunked file handling
- **Concurrent Transfers**: Multiple simultaneous transfers

## 🌐 Browser Support

### Supported Browsers
- **Chrome**: 56+ (Full WebRTC support)
- **Firefox**: 52+ (Full WebRTC support)
- **Safari**: 11+ (Limited WebRTC support)
- **Edge**: 79+ (Full WebRTC support)

### Feature Detection
- WebRTC API availability
- Data channel support
- STUN server connectivity
- Graceful degradation

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Consistent code style
- **Prettier**: Automatic formatting
- **Conventional Commits**: Standard commit messages

### Testing Guidelines
- **Unit Tests**: Test individual functions
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Monitor transfer speeds

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WebRTC Community**: For the amazing peer-to-peer technology
- **React Team**: For the incredible UI library
- **Socket.IO**: For real-time communication
- **Open Source Community**: For inspiration and support

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/sharedrop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/sharedrop/discussions)
- **Documentation**: [Wiki](https://github.com/yourusername/sharedrop/wiki)

---

<p align="center">
  Made with <span style="color: red;">♥</span> by <a href="https://www.linkedin.com/in/sanathswaroop/" target="_blank">Sanath</a>
</p> 