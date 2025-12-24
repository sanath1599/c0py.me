import Redis from 'ioredis';
import { Peer, RedisPeer } from './types';
import logger from './logger';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err });
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

export interface PendingRequest {
  requestId: string;
  senderId: string;
  receiverId: string;
  requestType: 'file-transfer' | 'webrtc-signal';
  data: any;
  timestamp: number;
  expiresAt: number;
}

export class RedisService {
  private static instance: RedisService;
  private redis: Redis;

  private constructor() {
    this.redis = redis;
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  // Peer management
  async addPeer(peer: Peer): Promise<void> {
    const redisPeer: RedisPeer = {
      ...peer,
      lastSeen: Date.now()
    };
    await this.redis.hset(`peer:${peer.id}`, redisPeer);
    await this.redis.expire(`peer:${peer.id}`, 3600); // 1 hour TTL
  }

  async getPeer(peerId: string): Promise<Peer | null> {
    const data = await this.redis.hgetall(`peer:${peerId}`);
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    return {
      id: data.id,
      name: data.name,
      emoji: data.emoji,
      color: data.color,
      isOnline: data.isOnline === 'true',
      socketId: data.socketId,
      roomId: data.roomId || undefined
    };
  }

  async updatePeer(peerId: string, updates: Partial<Peer>): Promise<void> {
    const updatesWithTimestamp = {
      ...updates,
      lastSeen: Date.now()
    };
    await this.redis.hset(`peer:${peerId}`, updatesWithTimestamp);
  }

  async removePeer(peerId: string): Promise<void> {
    await this.redis.del(`peer:${peerId}`);
  }

  async getAllPeers(): Promise<Peer[]> {
    const keys = await this.redis.keys('peer:*');
    const peers: Peer[] = [];
    
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (data && Object.keys(data).length > 0) {
        peers.push({
          id: data.id,
          name: data.name,
          emoji: data.emoji,
          color: data.color,
          isOnline: data.isOnline === 'true',
          socketId: data.socketId,
          roomId: data.roomId || undefined
        });
      }
    }
    
    return peers;
  }

  // Room management
  async addPeerToRoom(roomId: string, peer: Peer): Promise<void> {
    await this.redis.sadd(`room:${roomId}:peers`, peer.id);
    await this.redis.expire(`room:${roomId}:peers`, 3600); // 1 hour TTL
  }

  async removePeerFromRoom(roomId: string, peerId: string): Promise<void> {
    await this.redis.srem(`room:${roomId}:peers`, peerId);
  }

  async getRoomPeers(roomId: string): Promise<Peer[]> {
    const peerIds = await this.redis.smembers(`room:${roomId}:peers`);
    const peers: Peer[] = [];
    
    for (const peerId of peerIds) {
      const peer = await this.getPeer(peerId);
      if (peer) {
        peers.push(peer);
      }
    }
    
    return peers;
  }

  // Cleanup expired peers
  async cleanupExpiredPeers(): Promise<void> {
    const keys = await this.redis.keys('peer:*');
    const now = Date.now();
    
    for (const key of keys) {
      const data = await this.redis.hgetall(key);
      if (data.lastSeen) {
        const lastSeen = parseInt(data.lastSeen);
        if (now - lastSeen > 900000) { // 15 minutes - much longer for reconnection attempts
          await this.redis.del(key);
        }
      }
    }
  }

  // Health check
  async ping(): Promise<string> {
    return await this.redis.ping();
  }

  // Close connection
  async close(): Promise<void> {
    await this.redis.quit();
  }

  // Pending request management
  async storePendingRequest(request: PendingRequest): Promise<void> {
    const key = `pending_request:${request.requestId}`;
    const receiverKey = `receiver_pending:${request.receiverId}`;
    
    // Store the request with 5-minute TTL
    await this.redis.setex(key, 300, JSON.stringify(request));
    
    // Add to receiver's pending requests list
    await this.redis.sadd(receiverKey, request.requestId);
    await this.redis.expire(receiverKey, 300); // 5 minutes TTL
    
    logger.debug(`Stored pending request ${request.requestId}`, { 
      requestId: request.requestId, 
      receiverId: request.receiverId,
      requestType: request.requestType
    });
  }

  async getPendingRequest(requestId: string): Promise<PendingRequest | null> {
    const key = `pending_request:${requestId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }
    
    try {
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error parsing pending request', { error, requestId });
      return null;
    }
  }

  async getReceiverPendingRequests(receiverId: string): Promise<PendingRequest[]> {
    const receiverKey = `receiver_pending:${receiverId}`;
    const requestIds = await this.redis.smembers(receiverKey);
    const requests: PendingRequest[] = [];
    
    for (const requestId of requestIds) {
      const request = await this.getPendingRequest(requestId);
      if (request) {
        requests.push(request);
      }
    }
    
    return requests;
  }

  async removePendingRequest(requestId: string, receiverId?: string): Promise<void> {
    const key = `pending_request:${requestId}`;
    await this.redis.del(key);
    
    if (receiverId) {
      const receiverKey = `receiver_pending:${receiverId}`;
      await this.redis.srem(receiverKey, requestId);
    }
    
    logger.debug(`Removed pending request ${requestId}`, { requestId, receiverId });
  }

  // Cleanup expired requests
  async cleanupExpiredRequests(): Promise<void> {
    // This will be handled automatically by Redis TTL
    // But we can also clean up orphaned receiver keys
    const receiverKeys = await this.redis.keys('receiver_pending:*');
    
    for (const receiverKey of receiverKeys) {
      const requestIds = await this.redis.smembers(receiverKey);
      const validRequests: string[] = [];
      
      for (const requestId of requestIds) {
        const request = await this.getPendingRequest(requestId);
        if (request) {
          validRequests.push(requestId);
        }
      }
      
      // Remove invalid request IDs from the set
      const invalidRequests = requestIds.filter(id => !validRequests.includes(id));
      if (invalidRequests.length > 0) {
        await this.redis.srem(receiverKey, ...invalidRequests);
      }
    }
  }

  // Start scheduled cleanup (run every 15 minutes)
  startScheduledCleanup(): void {
    setInterval(async () => {
      try {
        await this.cleanupExpiredRequests();
        logger.debug('Scheduled cleanup completed');
      } catch (error) {
        logger.error('Error during scheduled cleanup', { error });
      }
    }, 900000); // 15 minutes
  }
}

export default RedisService.getInstance(); 