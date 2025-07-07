import { Router, Request, Response } from 'express';
import redisService from './redis';

const router: Router = Router();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  redisService.ping()
    .then(redisPing => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        redis: redisPing === 'PONG' ? 'connected' : 'disconnected',
        uptime: process.uptime()
      });
    })
    .catch(error => {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });
});

// Get all connected peers
router.get('/peers', (req: Request, res: Response) => {
  redisService.getAllPeers()
    .then(peers => {
      res.json({
        peers,
        count: peers.length,
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      res.status(500).json({
        error: 'Failed to fetch peers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
});

// Get peers in a specific room
router.get('/rooms/:roomId/peers', (req: Request, res: Response) => {
  const { roomId } = req.params;
  redisService.getRoomPeers(roomId)
    .then(peers => {
      res.json({
        roomId,
        peers,
        count: peers.length,
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      res.status(500).json({
        error: 'Failed to fetch room peers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
});

// Get specific peer
router.get('/peers/:peerId', (req: Request, res: Response) => {
  const { peerId } = req.params;
  redisService.getPeer(peerId)
    .then(peer => {
      if (!peer) {
        res.status(404).json({
          error: 'Peer not found',
          peerId
        });
      } else {
        res.json(peer);
      }
    })
    .catch(error => {
      res.status(500).json({
        error: 'Failed to fetch peer',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
});

// Cleanup expired peers (admin endpoint)
router.post('/cleanup', (req: Request, res: Response) => {
  redisService.cleanupExpiredPeers()
    .then(() => {
      res.json({
        message: 'Cleanup completed',
        timestamp: new Date().toISOString()
      });
    })
    .catch(error => {
      res.status(500).json({
        error: 'Failed to cleanup peers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
});

// Fallback endpoints for network detection
router.post('/fallback/ping', (req: Request, res: Response) => {
  const { sessionId, timestamp } = req.body;
  
  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  const latency = Date.now() - (timestamp || Date.now());
  
  res.status(200).json({
    pong: true,
    sessionId,
    latency,
    timestamp: Date.now(),
  });
});

router.get('/fallback/poll', (req: Request, res: Response) => {
  const { sessionId } = req.query;
  
  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  // For now, return empty messages
  // In a real implementation, this would check for pending messages for the session
  res.status(200).json({
    sessionId,
    messages: [],
    timestamp: Date.now(),
  });
});

router.post('/fallback/messages', (req: Request, res: Response) => {
  const { sessionId, messages } = req.body;
  
  if (!sessionId || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Session ID and messages array required' });
    return;
  }

  // For now, just acknowledge receipt
  // In a real implementation, this would process and route messages
  res.status(200).json({
    received: messages.length,
    sessionId,
    timestamp: Date.now(),
  });
});

// Connection statistics endpoint
router.get('/stats/connections', (req: Request, res: Response) => {
  // This endpoint can be enhanced later to include socket service stats
  res.json({
    message: 'Connection stats endpoint ready',
    timestamp: new Date().toISOString(),
    note: 'Socket service stats will be added in future update'
  });
});

export default router; 