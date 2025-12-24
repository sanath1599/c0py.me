import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Peer, JoinRoomData, UpdateProfileData, SignalMessage } from './types';
import redisService, { PendingRequest } from './redis';
import { getEnvironmentConfig } from '../../../packages/config/env';
import logger from './logger';

export class SocketService {
  private io: SocketIOServer;
  private peerSockets: Map<string, Socket> = new Map();
  // Removed custom ping tracking - Socket.IO handles this internally

  constructor(server: HTTPServer) {
    const config = getEnvironmentConfig();
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true, // Allow Engine.IO v3 clients
      path: '/socket.io/',
      // Optimized ping/pong timing for stable connections
      // pingInterval: how often server sends ping (default 25000ms)
      // pingTimeout: how long to wait for pong before disconnecting (default 20000ms)
      // Increased timeout to prevent premature disconnects
      pingTimeout: 60000, // 60 seconds - wait longer for pong response
      pingInterval: 25000, // 25 seconds - standard ping interval
      // Connection timeout
      connectTimeout: 45000, // 45 seconds to establish connection
    });

    // Handle connection errors
    this.io.engine.on('connection_error', (err) => {
      logger.error('Socket.IO connection error', {
        message: err.message,
        description: err.description,
        context: err.context,
        type: err.type
      });
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`New connection: ${socket.id}`, {
        address: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        origin: socket.handshake.headers.origin
      });
      
      // Store socket reference
      this.peerSockets.set(socket.id, socket);

      // Handle connection errors
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}`, { error });
      });

      // Handle join room
      socket.on('join-room', async (data: JoinRoomData) => {
        await this.handleJoinRoom(socket, data);
      });

      // Handle profile updates
      socket.on('update-profile', async (data: UpdateProfileData) => {
        await this.handleUpdateProfile(socket, data);
      });

      // Handle WebRTC signaling
      socket.on('signal', async (data: SignalMessage) => {
        await this.handleSignal(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', async (reason) => {
        logger.debug(`Socket ${socket.id} disconnecting. Reason: ${reason}`);
        await this.handleDisconnect(socket);
      });

      // Remove custom ping handler - Socket.IO handles ping/pong internally
      // The built-in mechanism is more reliable and doesn't conflict
      // Socket.IO automatically sends ping and expects pong responses
    });
  }

  private async handleJoinRoom(socket: Socket, data: JoinRoomData): Promise<void> {
    try {
      const { room, userId, name, color, emoji } = data;
      
      logger.info(`User ${name} (${userId}) joining room: ${room}`);

      // Check if peer already exists (reconnection)
      const existingPeer = await redisService.getPeer(userId);
      
      // Create or update peer
      const peer: Peer = {
        id: userId,
        name,
        emoji,
        color,
        isOnline: true,
        socketId: socket.id,
        roomId: room
      };

      // Store peer in Redis
      await redisService.addPeer(peer);
      await redisService.addPeerToRoom(room, peer);
      
      // If this is a reconnection, notify other peers
      if (existingPeer && !existingPeer.isOnline) {
        logger.info(`User ${name} reconnected to room ${room}`);
        // Emit peer-joined event to notify other peers that peer is back online
        socket.to(room).emit('peer-joined', peer);
      }

      // Join socket room
      socket.join(room);

      // Check for pending requests for this user
      await this.deliverPendingRequests(socket, userId);

      // Get all peers in the room
      const roomPeers = await redisService.getRoomPeers(room);
      
      // Send current peers to the joining user
      socket.emit('peers', roomPeers);

      // Notify other peers in the room
      socket.to(room).emit('peer-joined', peer);

      logger.info(`User ${name} joined room ${room}. Total peers: ${roomPeers.length}`);
    } catch (error) {
      logger.error('Error handling join room', { error, userId: data?.userId, room: data?.room, socketId: socket.id });
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  private async handleUpdateProfile(socket: Socket, data: UpdateProfileData): Promise<void> {
    try {
      const { name, color, emoji } = data;
      
      // Find the peer by socket ID
      const allPeers = await redisService.getAllPeers();
      const peer = allPeers.find(p => p.socketId === socket.id);
      
      if (!peer) {
        logger.warn(`Peer not found for socket: ${socket.id}`);
        return;
      }

      // Update peer data
      const updatedPeer: Peer = {
        ...peer,
        name,
        color,
        emoji
      };

      await redisService.updatePeer(peer.id, updatedPeer);

      // Notify other peers in the same room
      if (peer.roomId) {
        socket.to(peer.roomId).emit('peer-joined', updatedPeer);
      }

      logger.debug(`Profile updated for ${name}`);
    } catch (error) {
      logger.error('Error handling profile update', { error, socketId: socket.id });
    }
  }

  private async handleSignal(socket: Socket, data: SignalMessage): Promise<void> {
    try {
      const { to, from, data: signalData } = data;
      
      // Find the target peer by user ID
      const allPeers = await redisService.getAllPeers();
      const targetPeer = allPeers.find(p => p.id === to);
      
      if (targetPeer && targetPeer.socketId && targetPeer.isOnline) {
        // Find the target peer's socket
        const targetSocket = this.peerSockets.get(targetPeer.socketId);
        
        if (targetSocket) {
          // Forward the signal to the target peer
          targetSocket.emit('signal', { from, data: signalData });
          logger.debug(`Signal forwarded from ${from} to ${to}`, { socketId: targetPeer.socketId });
        } else {
          logger.warn(`Target peer ${to} socket not found for signal from ${from}`);
          await this.storePendingSignal(from, to, signalData);
        }
      } else {
        // Target peer is offline, store the signal as pending request
        logger.debug(`Target peer ${to} is offline, storing signal as pending request`);
        await this.storePendingSignal(from, to, signalData);
      }
    } catch (error) {
      logger.error('Error handling signal', { error, from: data?.from, to: data?.to, socketId: socket.id });
    }
  }

  private async storePendingSignal(from: string, to: string, signalData: any): Promise<void> {
    const requestId = `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const request: PendingRequest = {
      requestId,
      senderId: from,
      receiverId: to,
      requestType: 'webrtc-signal',
      data: signalData,
      timestamp: Date.now(),
      expiresAt: Date.now() + 300000 // 5 minutes
    };

    await redisService.storePendingRequest(request);
  }

  private async deliverPendingRequests(socket: Socket, userId: string): Promise<void> {
    try {
      const pendingRequests = await redisService.getReceiverPendingRequests(userId);
      
      if (pendingRequests.length > 0) {
        logger.info(`Delivering ${pendingRequests.length} pending requests to ${userId}`);
        
        for (const request of pendingRequests) {
          if (request.requestType === 'webrtc-signal') {
            // Deliver WebRTC signal
            socket.emit('signal', { 
              from: request.senderId, 
              data: request.data 
            });
            logger.debug(`Delivered pending signal from ${request.senderId} to ${userId}`);
          } else if (request.requestType === 'file-transfer') {
            // Deliver file transfer request
            socket.emit('file-transfer-request', {
              from: request.senderId,
              ...request.data
            });
            logger.debug(`Delivered pending file transfer request from ${request.senderId} to ${userId}`);
          }
          
          // Remove the delivered request
          await redisService.removePendingRequest(request.requestId, userId);
        }
      }
    } catch (error) {
      logger.error('Error delivering pending requests', { error, userId });
    }
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      logger.debug(`Disconnection: ${socket.id}`);

      // Find the peer by socket ID
      const allPeers = await redisService.getAllPeers();
      const peer = allPeers.find(p => p.socketId === socket.id);
      
      if (peer) {
        // Mark peer as offline
        await redisService.updatePeer(peer.id, { isOnline: false });
        
        // Remove from room
        if (peer.roomId) {
          await redisService.removePeerFromRoom(peer.roomId, peer.id);
          
          // Notify other peers in the room
          socket.to(peer.roomId).emit('peer-left', peer.id);
        }

        // Remove peer from Redis after a longer delay (in case of reconnection)
        setTimeout(async () => {
          const currentPeer = await redisService.getPeer(peer.id);
          if (currentPeer && !currentPeer.isOnline) {
            await redisService.removePeer(peer.id);
            logger.debug(`Removed offline peer: ${peer.name}`);
          }
        }, 300000); // 5 minutes delay - much longer for reconnection attempts

        logger.info(`User ${peer.name} disconnected from room ${peer.roomId}`);
      }

      // Remove socket reference
      this.peerSockets.delete(socket.id);
    } catch (error) {
      logger.error('Error handling disconnect', { error, socketId: socket.id });
    }
  }

  // Public methods
  public getIO(): SocketIOServer {
    return this.io;
  }

  public async getConnectedPeers(): Promise<Peer[]> {
    return await redisService.getAllPeers();
  }

  public getConnectionStats() {
    return {
      totalConnections: this.peerSockets.size,
      // Ping/pong is handled internally by Socket.IO
    };
  }

  public async cleanup(): Promise<void> {
    // Cleanup expired peers
    await redisService.cleanupExpiredPeers();
    
    // Close Redis connection
    await redisService.close();
  }
} 