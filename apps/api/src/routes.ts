import express, { Request, Response } from 'express';
import redisService, { PendingRequest } from './redis';
import logsRouter from './routes/logs';

const router: express.Router = express.Router();

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

// File transfer request endpoints
router.post('/file-transfer/request', (req: Request, res: Response) => {
  const { senderId, receiverId, fileName, fileSize, fileType, transferId } = req.body;
  
  if (!senderId || !receiverId || !fileName || !fileSize || !transferId) {
    res.status(400).json({ 
      error: 'Missing required fields: senderId, receiverId, fileName, fileSize, transferId' 
    });
    return;
  }

  const requestId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const request: PendingRequest = {
    requestId,
    senderId,
    receiverId,
    requestType: 'file-transfer',
    data: {
      fileName,
      fileSize,
      fileType,
      transferId
    },
    timestamp: Date.now(),
    expiresAt: Date.now() + 300000 // 5 minutes
  };

  redisService.storePendingRequest(request)
    .then(() => {
      console.log(`💾 Stored file transfer request ${requestId} from ${senderId} to ${receiverId}`);
      res.status(200).json({
        success: true,
        requestId,
        message: 'File transfer request stored successfully'
      });
    })
    .catch(error => {
      console.error('❌ Error storing file transfer request:', error);
      res.status(500).json({ error: 'Failed to store file transfer request' });
    });
});

router.get('/file-transfer/pending/:receiverId', (req: Request, res: Response) => {
  const { receiverId } = req.params;
  
  if (!receiverId) {
    res.status(400).json({ error: 'Receiver ID is required' });
    return;
  }

  redisService.getReceiverPendingRequests(receiverId)
    .then(pendingRequests => {
      const fileTransferRequests = pendingRequests.filter(req => req.requestType === 'file-transfer');
      res.status(200).json({
        success: true,
        requests: fileTransferRequests,
        count: fileTransferRequests.length
      });
    })
    .catch(error => {
      console.error('❌ Error retrieving pending file transfer requests:', error);
      res.status(500).json({ error: 'Failed to retrieve pending requests' });
    });
});

router.delete('/file-transfer/request/:requestId', (req: Request, res: Response) => {
  const { requestId } = req.params;
  const { receiverId } = req.query;
  
  if (!requestId) {
    res.status(400).json({ error: 'Request ID is required' });
    return;
  }

  redisService.removePendingRequest(requestId, receiverId as string)
    .then(() => {
      res.status(200).json({
        success: true,
        message: 'Request removed successfully'
      });
    })
    .catch(error => {
      console.error('❌ Error removing file transfer request:', error);
      res.status(500).json({ error: 'Failed to remove request' });
    });
});

// WebRTC signal endpoints
router.post('/webrtc/signal', (req: Request, res: Response) => {
  const { senderId, receiverId, signalData } = req.body;
  
  if (!senderId || !receiverId || !signalData) {
    res.status(400).json({ 
      error: 'Missing required fields: senderId, receiverId, signalData' 
    });
    return;
  }

  const requestId = `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const request: PendingRequest = {
    requestId,
    senderId,
    receiverId,
    requestType: 'webrtc-signal',
    data: signalData,
    timestamp: Date.now(),
    expiresAt: Date.now() + 300000 // 5 minutes
  };

  redisService.storePendingRequest(request)
    .then(() => {
      console.log(`💾 Stored WebRTC signal ${requestId} from ${senderId} to ${receiverId}`);
      res.status(200).json({
        success: true,
        requestId,
        message: 'WebRTC signal stored successfully'
      });
    })
    .catch(error => {
      console.error('❌ Error storing WebRTC signal:', error);
      res.status(500).json({ error: 'Failed to store WebRTC signal' });
    });
});

router.get('/webrtc/pending/:receiverId', (req: Request, res: Response) => {
  const { receiverId } = req.params;
  
  if (!receiverId) {
    res.status(400).json({ error: 'Receiver ID is required' });
    return;
  }

  redisService.getReceiverPendingRequests(receiverId)
    .then(pendingRequests => {
      const signalRequests = pendingRequests.filter(req => req.requestType === 'webrtc-signal');
      res.status(200).json({
        success: true,
        requests: signalRequests,
        count: signalRequests.length
      });
    })
    .catch(error => {
      console.error('❌ Error retrieving pending WebRTC signals:', error);
      res.status(500).json({ error: 'Failed to retrieve pending signals' });
    });
});

// Mount logs routes
router.use('/logs', logsRouter);

export default router; 