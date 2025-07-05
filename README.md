<p align="center">
  <img src="apps/web/public/favicon.gif" alt="ShareDrop Logo" width="96" height="96" />
</p>

# ShareDrop (Open Source)

**P2P File Transfer**

ShareDrop is a free, open-source web app that allows you to easily and securely share files directly between devices without uploading them to any server first. Built with the MERN stack, WebRTC, and a modern UI with glassmorphism design.

## Features
- ⚡ **Peer-to-peer file transfer** using WebRTC
- 🔒 **End-to-end encrypted**: files never touch a server
- 🌐 **Works across local and remote networks**
- 🖥️ **Modern, responsive UI** (glassmorphism design)
- 🖱️ **Drag & drop or click to upload**
- 📡 **No account required**
- 📝 **Open source, MIT licensed**

## How It Works
1. Open ShareDrop on two devices (same or different networks)
2. Upload files using the big green button
3. Select a peer to send files to (appears as avatars/radar)
4. Recipient accepts and the transfer happens directly, encrypted, via WebRTC

## Usage
- **Local:** Open the app on two devices in the same network
- **Remote:** Use the + button to connect to a peer in another network
- **No VPNs:** VPNs may block peer discovery

## Development
```bash
pnpm install
pnpm --filter @sharedrop/web dev
pnpm --filter @sharedrop/api dev
```

## Deployment
See `deploy-sharedrop.sh` for a full production deployment script (Docker, Nginx, MongoDB, etc).

## License

MIT License. See [LICENSE](LICENSE).

---

> Built with modern web technologies and the open-source community.

## 🏗️ Architecture

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

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Socket.IO Client for real-time communication
- WebRTC API for peer-to-peer file transfer
- Modern CSS with glassmorphism design

**Backend:**
- Node.js with Express.js
- Socket.IO for WebRTC signaling
- MongoDB with Mongoose
- TypeScript for type safety

**Build Tools:**
- Turborepo for monorepo management
- pnpm for package management
- TypeScript for type safety
- ESLint and Prettier for code quality

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB** (v4.4 or higher)
- **pnpm** (v8 or higher)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sharedrop
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   node setup.js
   ```

4. **Start MongoDB**
   ```bash
   # On macOS with Homebrew
   brew services start mongodb-community
   
   # On Ubuntu/Debian
   sudo systemctl start mongod
   
   # On Windows
   net start MongoDB
   ```

5. **Start the development servers**
   ```bash
   pnpm dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 📦 Available Scripts

### Root Level Commands
```bash
# Development
pnpm dev              # Start all applications in development mode
pnpm build            # Build all applications
pnpm lint             # Lint all applications
pnpm test             # Run tests across all applications
pnpm type-check       # Run TypeScript type checking
pnpm clean            # Clean all build artifacts
pnpm format           # Format code with Prettier

# Database
pnpm db:generate      # Generate database schema
pnpm db:push          # Push database schema changes
pnpm db:studio        # Open database studio

# Setup
pnpm setup            # Run setup script
pnpm test:connection  # Test database and server connections
```

### Workspace-Specific Commands
```bash
# Web App
pnpm --filter @sharedrop/web dev
pnpm --filter @sharedrop/web build
pnpm --filter @sharedrop/web test

# API
pnpm --filter @sharedrop/api dev
pnpm --filter @sharedrop/api start
pnpm --filter @sharedrop/api test

# Packages
pnpm --filter @sharedrop/ui build
pnpm --filter @sharedrop/database build
pnpm --filter @sharedrop/config build
```

## 🏛️ Monorepo Architecture

### Apps

#### `@sharedrop/web` - React Frontend
- Modern React application with TypeScript
- WebRTC peer-to-peer file transfer
- Real-time user presence and file transfer status
- Glassmorphism UI design
- Responsive layout for mobile and desktop

#### `@sharedrop/api` - Express.js Backend
- RESTful API endpoints
- WebSocket signaling server for WebRTC
- MongoDB integration with Mongoose
- User session management
- File transfer request handling

### Packages

#### `@sharedrop/ui` - Shared UI Components
- Reusable React components
- TypeScript interfaces for props
- Consistent styling and theming
- Button, Card, ProgressBar, StatusIndicator components

#### `@sharedrop/database` - Database Layer
- Mongoose models with TypeScript
- Database connection utilities
- Validation helpers
- Type-safe database operations

#### `@sharedrop/config` - Configuration
- Environment configuration
- Constants and validation
- Shared configuration utilities
- Type-safe config access

### Tools

#### `@sharedrop/eslint-config` - ESLint Configuration
- Shared ESLint rules across workspaces
- React-specific configurations
- TypeScript-specific configurations
- Consistent code style enforcement

#### `@sharedrop/typescript-config` - TypeScript Configuration
- Base TypeScript configuration
- React-specific configuration
- Node.js-specific configuration
- Strict type checking settings

## 🔧 Development Workflow

### Adding Dependencies

```bash
# Add to specific workspace
pnpm add <package> --filter @sharedrop/web
pnpm add <package> --filter @sharedrop/api

# Add dev dependency
pnpm add -D <package> --filter @sharedrop/web

# Add workspace dependency
pnpm add @sharedrop/ui --filter @sharedrop/web
```

### Creating New Components

1. **Create component in UI package**
   ```typescript
   // packages/ui/components/NewComponent.tsx
   import React from 'react';
   import { NewComponentProps } from '../types';

   export const NewComponent: React.FC<NewComponentProps> = ({ ... }) => {
     // Component implementation
   };
   ```

2. **Export from UI package**
   ```typescript
   // packages/ui/index.ts
   export * from './components/NewComponent';
   ```

3. **Use in web app**
   ```typescript
   // apps/web/src/components/SomeComponent.tsx
   import { NewComponent } from '@sharedrop/ui';
   ```

### Database Models

1. **Create model in database package**
   ```typescript
   // packages/database/models/NewModel.ts
   import mongoose, { Document, Schema } from 'mongoose';

   export interface INewModel extends Document {
     // Model interface
   }

   const newModelSchema = new Schema<INewModel>({
     // Schema definition
   });

   export const NewModel = mongoose.model<INewModel>('NewModel', newModelSchema);
   ```

2. **Export from database package**
   ```typescript
   // packages/database/index.ts
   export * from './models/NewModel';
   ```

3. **Use in API**
   ```typescript
   // apps/api/index.js
   import { NewModel } from '@sharedrop/database';
   ```

## 🌐 WebRTC Implementation

### Connection Flow
1. **Signaling**: Users connect via WebSocket to exchange connection information
2. **Offer/Answer**: Sender creates WebRTC offer, receiver responds with answer
3. **ICE Candidates**: Both peers exchange network information for optimal routing
4. **Data Channel**: Bidirectional communication channel established for file transfer
5. **File Transfer**: Files chunked and sent through data channel

### File Transfer Process
1. **Request**: Sender requests file transfer through signaling server
2. **Acceptance**: Receiver accepts transfer request
3. **Connection**: WebRTC peer connection established
4. **Chunking**: File split into 16KB chunks for efficient transfer
5. **Transfer**: Chunks sent through data channel with progress tracking
6. **Assembly**: Receiver reassembles chunks into complete file
7. **Download**: File available for download with original metadata

## 🧪 Testing

### Running Tests
```bash
# Run all tests
pnpm test

# Run tests for specific workspace
pnpm --filter @sharedrop/web test
pnpm --filter @sharedrop/api test

# Run tests in watch mode
pnpm --filter @sharedrop/web test --watch
```

### Test Structure
- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test API endpoints and WebSocket communication
- **E2E Tests**: Test complete user workflows and file transfers

## 🚀 Deployment

### Environment Configuration
```bash
# Production environment variables
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://your-mongodb-uri
CLIENT_URL=https://your-domain.com
JWT_SECRET=your-jwt-secret
```

### Build Process
```bash
# Build all applications
pnpm build

# Build specific application
pnpm --filter @sharedrop/web build
pnpm --filter @sharedrop/api build
```

### Deployment Options
- **Vercel**: Deploy frontend and API
- **Railway**: Deploy full-stack application
- **Heroku**: Deploy with MongoDB Atlas
- **Docker**: Containerized deployment

## 🔒 Security

### Data Privacy
- Files transferred directly between peers (not stored on server)
- WebRTC connections encrypted by default
- User sessions managed via unique IDs
- No file content passes through the signaling server

### Network Security
- STUN/TURN servers for secure NAT traversal
- WebSocket connections over HTTPS (production)
- Input validation and sanitization
- Rate limiting for API endpoints

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   ```bash
   # Check MongoDB status
   brew services list | grep mongodb
   
   # Start MongoDB
   brew services start mongodb-community
   ```

2. **WebRTC Connection Fails**
   - Check firewall settings
   - Ensure STUN servers are accessible
   - Try using a different network

3. **Build Failures**
   ```bash
   # Clear Turborepo cache
   pnpm clean
   rm -rf node_modules
   pnpm install
   ```

4. **TypeScript Errors**
   ```bash
   # Run type checking
   pnpm type-check
   
   # Check specific workspace
   pnpm --filter @sharedrop/web type-check
   ```

### Debug Tools
- Browser dev tools for WebRTC debugging
- MongoDB Compass for database inspection
- Turborepo's `--verbose` flag for build debugging

## 📚 Additional Resources

### Documentation
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)

### Best Practices
- Follow React best practices for hooks and components
- Use TypeScript strict mode for better type safety
- Implement proper error boundaries in React
- Use appropriate design patterns for scalability

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📄 Acknowledgments

- Built with modern web technologies for optimal performance
- Uses Google's STUN servers for NAT traversal

# ShareDrop Backend

A robust WebRTC signaling server for peer-to-peer file sharing built with Node.js, TypeScript, Express, Socket.IO, and MongoDB.

## 🚀 Features

- **WebRTC Signaling**: Complete signaling server for peer-to-peer connections
- **Real-time Communication**: Socket.IO for instant messaging and peer discovery
- **User Management**: Track users, rooms, and connection states
- **Comprehensive Logging**: Winston with file rotation and structured logging
- **Input Validation**: Zod schemas for all incoming data
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **TypeScript**: Full type safety and modern development experience
- **Docker Support**: Production-ready containerization
- **Testing**: Jest setup for unit and integration tests

## 📋 Prerequisites

- Node.js 18+
- pnpm 8+
- MongoDB (local or cloud)

## 🛠️ Installation

1. **Clone and navigate to the backend:**
   ```bash
   cd apps/api
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB** (if using local):
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or using MongoDB locally
   mongod
   ```

## 🚀 Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint

# Format code
pnpm format
```

## 📡 API Endpoints

### Health Check
```http
GET /api/health
```
Returns server status.

### User Management
```http
GET /api/users/room?room=roomName
POST /api/users
PUT /api/users/:userId
PATCH /api/users/:userId/offline
GET /api/users/stats
```

## 🔌 Socket.IO Events

### Client to Server

#### `join-room`
Join a room and get peer list.
```javascript
socket.emit('join-room', {
  room: 'my-room',
  userId: 'user123',
  name: 'John Doe',
  color: '#F6C148',
  emoji: '🦁'
});
```

#### `signal`
Send WebRTC signaling data.
```javascript
socket.emit('signal', {
  to: 'targetUserId',
  data: {
    type: 'offer',
    sdp: '...'
  }
});
```

#### `update-profile`
Update user profile.
```javascript
socket.emit('update-profile', {
  name: 'New Name',
  color: '#FF0000',
  emoji: '🐯'
});
```

#### `get-peers`
Get list of peers in room.
```javascript
socket.emit('get-peers', { room: 'my-room' });
```

### Server to Client

#### `peers`
List of peers in the room.
```javascript
socket.on('peers', (peers) => {
  // peers: [{ userId, name, color, emoji }]
});
```

#### `peer-joined`
New peer joined the room.
```javascript
socket.on('peer-joined', (peer) => {
  // peer: { id, name, color, emoji }
});
```

#### `peer-left`
Peer left the room.
```javascript
socket.on('peer-left', (userId) => {
  // userId: string
});
```

#### `signal`
WebRTC signaling data from another peer.
```javascript
socket.on('signal', ({ from, data }) => {
  // from: userId, data: { type, sdp, candidate }
});
```

#### `profile-updated`
Peer updated their profile.
```javascript
socket.on('profile-updated', ({ userId, name, color, emoji }) => {
  // Updated profile data
});
```

#### `error`
Error message from server.
```javascript
socket.on('error', ({ message }) => {
  // Handle error
});
```

## 🗄️ Database Schema

### User Model
```typescript
interface IUser {
  userId: string;           // Unique user identifier
  socketId: string;         // Current socket connection
  room: string;             // Current room
  name: string;             // Display name
  color: string;            // User color
  emoji: string;            // User emoji
  isOnline: boolean;        // Online status
  lastSeen: Date;           // Last activity
  connectionCount: number;  // Total connections
  createdAt: Date;          // Account creation
  updatedAt: Date;          // Last update
}
```

## 🐳 Docker Deployment

### Build and Run
```bash
# Build image
docker build -t sharedrop-backend .

# Run container
docker run -d \
  --name sharedrop-backend \
  -p 5000:5000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/sharedrop \
  -e CLIENT_URL=http://localhost:3000 \
  sharedrop-backend
```

### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/sharedrop
      - CLIENT_URL=http://localhost:3000
    depends_on:
      - mongo
    volumes:
      - ./logs:/app/logs

  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## 📊 Logging

The server uses Winston for comprehensive logging:

- **Console**: Colored output with timestamps
- **File**: Daily rotation with compression
- **Error Logs**: Separate error log files
- **Levels**: error, warn, info, debug, success

Log files are stored in `logs/` directory:
- `application-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Error logs only
- `exceptions-YYYY-MM-DD.log` - Unhandled exceptions
- `rejections-YYYY-MM-DD.log` - Unhandled rejections

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `NODE_ENV` | `development` | Environment |
| `MONGODB_URI` | `mongodb://localhost:27017/sharedrop` | MongoDB connection |
| `CLIENT_URL` | `http://localhost:3000` | Frontend URL |
| `LOG_LEVEL` | `debug` | Logging level |

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Run tests in watch mode
pnpm test:watch
```

## 📁 Project Structure

```
src/
├── controllers/     # Request handlers
├── models/         # Database models
├── routes/         # Express routes
├── services/       # Business logic
├── utils/          # Utilities and helpers
├── app.ts          # Express app setup
└── server.ts       # Server entry point

tests/              # Test files
logs/               # Log files
dist/               # Compiled output
```

## 🔒 Security Features

- **Input Validation**: All inputs validated with Zod
- **CORS**: Configurable cross-origin requests
- **Error Handling**: No sensitive data in error responses
- **Rate Limiting**: Ready for implementation
- **No File Storage**: All file transfers are P2P

## 🚀 Production Deployment

1. **Build the application:**
   ```bash
   pnpm build
   ```

2. **Set production environment variables:**
   ```bash
   NODE_ENV=production
   MONGODB_URI=your-production-mongodb-uri
   CLIENT_URL=your-frontend-url
   ```

3. **Start the server:**
   ```bash
   pnpm start
   ```

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update documentation
4. Use conventional commits

## 📄 License

MIT License - see LICENSE file for details. 