import Redis from 'ioredis';
import { Peer, RedisPeer } from './types';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

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
        if (now - lastSeen > 300000) { // 5 minutes
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
}

export default RedisService.getInstance(); 