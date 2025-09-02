import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Peer, JoinRoomData, UpdateProfileData, SignalMessage } from './types';
import redisService, { PendingRequest } from './redis';
import { getEnvironmentConfig } from '../../../packages/config/env';

export class SocketService {
  private io: SocketIOServer;
  private peerSockets: Map<string, Socket> = new Map();
  private lastPingTime: Map<string, number> = new Map();
  private pingTimeout: Map<string, NodeJS.Timeout> = new Map();

  constructor(server: HTTPServer) {
    const config = getEnvironmentConfig();
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 New connection: ${socket.id}`);
      
      // Store socket reference
      this.peerSockets.set(socket.id, socket);

      // Handle connection errors
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
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
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });

      // Handle ping for keep-alive
      socket.on('ping', () => {
        console.log(`🏓 Ping received from socket: ${socket.id}`);
        
        // Update last ping time
        this.lastPingTime.set(socket.id, Date.now());
        
        // Clear existing timeout
        if (this.pingTimeout.has(socket.id)) {
          clearTimeout(this.pingTimeout.get(socket.id)!);
        }
        
        // Set new timeout (180 seconds - much longer than client's 60s ping interval)
        const timeoutId = setTimeout(() => {
          console.warn(`⚠️ Ping timeout for socket: ${socket.id} - forcing disconnect`);
          socket.disconnect(true);
        }, 180000);
        
        this.pingTimeout.set(socket.id, timeoutId);
        
        socket.emit('pong');
        console.log(`🏓 Pong sent to socket: ${socket.id}`);
      });
    });
  }

  private async handleJoinRoom(socket: Socket, data: JoinRoomData): Promise<void> {
    try {
      const { room, userId, name, color, emoji } = data;
      
      console.log(`👥 User ${name} (${userId}) joining room: ${room}`);

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
        console.log(`🔄 User ${name} reconnected to room ${room}`);
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

      console.log(`✅ User ${name} joined room ${room}. Total peers: ${roomPeers.length}`);
    } catch (error) {
      console.error('❌ Error handling join room:', error);
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
        console.warn(`⚠️ Peer not found for socket: ${socket.id}`);
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

      console.log(`🔄 Profile updated for ${name}`);
    } catch (error) {
      console.error('❌ Error handling profile update:', error);
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
          console.log(`📡 Signal forwarded from ${from} to ${to} (socket: ${targetPeer.socketId})`);
        } else {
          console.warn(`⚠️ Target peer ${to} socket not found for signal from ${from}`);
          await this.storePendingSignal(from, to, signalData);
        }
      } else {
        // Target peer is offline, store the signal as pending request
        console.log(`📦 Target peer ${to} is offline, storing signal as pending request`);
        await this.storePendingSignal(from, to, signalData);
      }
    } catch (error) {
      console.error('❌ Error handling signal:', error);
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
        console.log(`📦 Delivering ${pendingRequests.length} pending requests to ${userId}`);
        
        for (const request of pendingRequests) {
          if (request.requestType === 'webrtc-signal') {
            // Deliver WebRTC signal
            socket.emit('signal', { 
              from: request.senderId, 
              data: request.data 
            });
            console.log(`📡 Delivered pending signal from ${request.senderId} to ${userId}`);
          } else if (request.requestType === 'file-transfer') {
            // Deliver file transfer request
            socket.emit('file-transfer-request', {
              from: request.senderId,
              ...request.data
            });
            console.log(`📁 Delivered pending file transfer request from ${request.senderId} to ${userId}`);
          }
          
          // Remove the delivered request
          await redisService.removePendingRequest(request.requestId, userId);
        }
      }
    } catch (error) {
      console.error('❌ Error delivering pending requests:', error);
    }
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      console.log(`🔌 Disconnection: ${socket.id}`);

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
            console.log(`🗑️ Removed offline peer: ${peer.name}`);
          }
        }, 300000); // 5 minutes delay - much longer for reconnection attempts

        console.log(`👋 User ${peer.name} disconnected from room ${peer.roomId}`);
      }

      // Remove socket reference and cleanup ping tracking
      this.peerSockets.delete(socket.id);
      
      // Cleanup ping tracking
      this.lastPingTime.delete(socket.id);
      if (this.pingTimeout.has(socket.id)) {
        clearTimeout(this.pingTimeout.get(socket.id)!);
        this.pingTimeout.delete(socket.id);
      }
    } catch (error) {
      console.error('❌ Error handling disconnect:', error);
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
      pingTimeouts: this.pingTimeout.size,
      lastPingTimes: Object.fromEntries(this.lastPingTime),
    };
  }

  public async cleanup(): Promise<void> {
    // Cleanup expired peers
    await redisService.cleanupExpiredPeers();
    
    // Close Redis connection
    await redisService.close();
  }
} 