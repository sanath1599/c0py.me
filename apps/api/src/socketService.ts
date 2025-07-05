import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Peer, JoinRoomData, UpdateProfileData, SignalMessage } from './types';
import redisService from './redis';

export class SocketService {
  private io: SocketIOServer;
  private peerSockets: Map<string, Socket> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
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

      // Handle join room
      socket.on('join-room', async (data: JoinRoomData) => {
        await this.handleJoinRoom(socket, data);
      });

      // Handle profile updates
      socket.on('update-profile', async (data: UpdateProfileData) => {
        await this.handleUpdateProfile(socket, data);
      });

      // Handle WebRTC signaling
      socket.on('signal', (data: SignalMessage) => {
        this.handleSignal(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });

      // Handle ping for keep-alive
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  private async handleJoinRoom(socket: Socket, data: JoinRoomData): Promise<void> {
    try {
      const { room, userId, name, color, emoji } = data;
      
      console.log(`👥 User ${name} (${userId}) joining room: ${room}`);

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

      // Join socket room
      socket.join(room);

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

  private handleSignal(socket: Socket, data: SignalMessage): void {
    try {
      const { to, from, data: signalData } = data;
      
      // Find the target peer's socket
      const targetSocket = this.peerSockets.get(to);
      
      if (targetSocket) {
        // Forward the signal to the target peer
        targetSocket.emit('signal', { from, data: signalData });
        console.log(`📡 Signal forwarded from ${from} to ${to}`);
      } else {
        console.warn(`⚠️ Target peer ${to} not found for signal from ${from}`);
      }
    } catch (error) {
      console.error('❌ Error handling signal:', error);
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

        // Remove peer from Redis after a delay (in case of reconnection)
        setTimeout(async () => {
          const currentPeer = await redisService.getPeer(peer.id);
          if (currentPeer && !currentPeer.isOnline) {
            await redisService.removePeer(peer.id);
            console.log(`🗑️ Removed offline peer: ${peer.name}`);
          }
        }, 30000); // 30 seconds delay

        console.log(`👋 User ${peer.name} disconnected from room ${peer.roomId}`);
      }

      // Remove socket reference
      this.peerSockets.delete(socket.id);
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

  public async cleanup(): Promise<void> {
    // Cleanup expired peers
    await redisService.cleanupExpiredPeers();
    
    // Close Redis connection
    await redisService.close();
  }
} 