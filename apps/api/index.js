const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sharedrop', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining
  socket.on('join', (userId) => {
    connectedUsers.set(socket.id, userId);
    socket.broadcast.emit('userJoined', { userId, socketId: socket.id });
    console.log(`User ${userId} joined with socket ${socket.id}`);
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    if (data.target === 'broadcast') {
      // Broadcast to all other connected users
      socket.broadcast.emit('offer', {
        offer: data.offer,
        from: socket.id,
        userId: connectedUsers.get(socket.id)
      });
    } else {
      const targetSocket = connectedUsers.get(data.target);
      if (targetSocket) {
        socket.to(targetSocket).emit('offer', {
          offer: data.offer,
          from: socket.id,
          userId: connectedUsers.get(socket.id)
        });
      }
    }
  });

  socket.on('answer', (data) => {
    if (data.target === 'broadcast') {
      // Broadcast to all other connected users
      socket.broadcast.emit('answer', {
        answer: data.answer,
        from: socket.id,
        userId: connectedUsers.get(socket.id)
      });
    } else {
      const targetSocket = connectedUsers.get(data.target);
      if (targetSocket) {
        socket.to(targetSocket).emit('answer', {
          answer: data.answer,
          from: socket.id,
          userId: connectedUsers.get(socket.id)
        });
      }
    }
  });

  socket.on('ice-candidate', (data) => {
    if (data.target === 'broadcast') {
      // Broadcast to all other connected users
      socket.broadcast.emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id,
        userId: connectedUsers.get(socket.id)
      });
    } else {
      const targetSocket = connectedUsers.get(data.target);
      if (targetSocket) {
        socket.to(targetSocket).emit('ice-candidate', {
          candidate: data.candidate,
          from: socket.id,
          userId: connectedUsers.get(socket.id)
        });
      }
    }
  });

  // Handle file transfer requests
  socket.on('file-transfer-request', (data) => {
    if (data.target === 'broadcast') {
      // Broadcast to all other connected users
      socket.broadcast.emit('file-transfer-request', {
        fileName: data.fileName,
        fileSize: data.fileSize,
        from: socket.id,
        userId: connectedUsers.get(socket.id)
      });
    } else {
      const targetSocket = connectedUsers.get(data.target);
      if (targetSocket) {
        socket.to(targetSocket).emit('file-transfer-request', {
          fileName: data.fileName,
          fileSize: data.fileSize,
          from: socket.id,
          userId: connectedUsers.get(socket.id)
        });
      }
    }
  });

  // Handle file transfer response
  socket.on('file-transfer-response', (data) => {
    if (data.target === 'broadcast') {
      // Broadcast to all other connected users
      socket.broadcast.emit('file-transfer-response', {
        accepted: data.accepted,
        from: socket.id,
        userId: connectedUsers.get(socket.id)
      });
    } else {
      const targetSocket = connectedUsers.get(data.target);
      if (targetSocket) {
        socket.to(targetSocket).emit('file-transfer-response', {
          accepted: data.accepted,
          from: socket.id,
          userId: connectedUsers.get(socket.id)
        });
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const userId = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    socket.broadcast.emit('userLeft', { userId, socketId: socket.id });
    console.log(`User ${userId} disconnected: ${socket.id}`);
  });
});

// API Routes
app.get('/api/users', (req, res) => {
  const users = Array.from(connectedUsers.values());
  res.json({ users });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 