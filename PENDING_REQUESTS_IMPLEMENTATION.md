# Pending Requests Implementation

## Overview

This implementation adds Redis-based request storage with a 5-minute timeout for both socket and API requests. When a sender makes a request and the receiver is offline, the request is stored in Redis. If the receiver reconnects within 5 minutes, the pending requests are automatically delivered.

## Architecture

### Components

1. **Redis Service** (`apps/api/src/redis.ts`)
   - Extended with pending request management
   - 5-minute TTL for automatic expiration
   - Scheduled cleanup every 5 minutes

2. **Socket Service** (`apps/api/src/socketService.ts`)
   - Stores pending signals when receivers are offline
   - Delivers pending requests on reconnection
   - Handles both WebRTC signals and file transfer requests

3. **API Routes** (`apps/api/src/routes.ts`)
   - REST endpoints for storing and retrieving pending requests
   - Separate endpoints for file transfers and WebRTC signals

4. **Frontend Hooks**
   - `useWebRTC`: Stores requests when receivers are offline
   - `useSocket`: Handles pending requests on reconnection

## Implementation Details

### Redis Storage Structure

```typescript
interface PendingRequest {
  requestId: string;
  senderId: string;
  receiverId: string;
  requestType: 'file-transfer' | 'webrtc-signal';
  data: any;
  timestamp: number;
  expiresAt: number;
}
```

**Redis Keys:**
- `pending_request:{requestId}` - Individual request data (TTL: 5 minutes)
- `receiver_pending:{receiverId}` - Set of request IDs for a receiver (TTL: 5 minutes)

### API Endpoints

#### File Transfer Requests
- `POST /api/file-transfer/request` - Store a pending file transfer request
- `GET /api/file-transfer/pending/:receiverId` - Get pending requests for a receiver
- `DELETE /api/file-transfer/request/:requestId` - Remove a pending request

#### WebRTC Signals
- `POST /api/webrtc/signal` - Store a pending WebRTC signal
- `GET /api/webrtc/pending/:receiverId` - Get pending signals for a receiver

### Socket Events

#### New Events
- `file-transfer-request` - Delivered when a pending file transfer request is available

#### Enhanced Events
- `signal` - Now handles both real-time and pending signals

### Frontend Integration

#### WebRTC Hook Updates
```typescript
// New parameters
useWebRTC(sendSignal, userId, addToast, peers, isConnected)

// New functions
storePendingRequest(receiverId, file, transferId)
storePendingSignal(receiverId, signalData)
```

#### Socket Hook Updates
```typescript
// Enhanced signal handling
socket.on('file-transfer-request', (requestData) => {
  // Handle pending file transfer requests
});
```

## Usage Flow

### 1. Sender Initiates Request (Receiver Offline)

```typescript
// Frontend detects receiver is offline
if (!peer.isOnline || !isConnected) {
  await storePendingRequest(peer.id, file, transferId);
  // Request stored in Redis with 5-minute TTL
}
```

### 2. Request Stored in Redis

```typescript
// Backend stores request
const request: PendingRequest = {
  requestId: `file-${Date.now()}-${randomId}`,
  senderId: 'user-123',
  receiverId: 'user-456',
  requestType: 'file-transfer',
  data: { fileName, fileSize, fileType, transferId },
  timestamp: Date.now(),
  expiresAt: Date.now() + 300000 // 5 minutes
};

await redisService.storePendingRequest(request);
```

### 3. Receiver Reconnects

```typescript
// Backend delivers pending requests
const pendingRequests = await redisService.getReceiverPendingRequests(userId);

for (const request of pendingRequests) {
  if (request.requestType === 'file-transfer') {
    socket.emit('file-transfer-request', {
      from: request.senderId,
      ...request.data
    });
  } else if (request.requestType === 'webrtc-signal') {
    socket.emit('signal', {
      from: request.senderId,
      data: request.data
    });
  }
  
  // Remove delivered request
  await redisService.removePendingRequest(request.requestId, userId);
}
```

### 4. Frontend Receives Pending Request

```typescript
// WebRTC hook handles the pending request
socket.on('file-transfer-request', (requestData) => {
  // Process the pending file transfer request
  // Show incoming file notification
  // Allow user to accept/reject
});
```

## Configuration

### Environment Variables
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Timeout Settings
- **Request TTL**: 5 minutes (300 seconds)
- **Cleanup Interval**: 5 minutes (300000 ms)
- **Redis Key Expiration**: Automatic via TTL

## Testing

### Manual Testing
1. Start the server: `pnpm --filter @sharedrop/api dev`
2. Run test script: `node test-pending-requests.js`

### Test Scenarios
1. **File Transfer Request Storage**
   - Send file to offline user
   - Verify request stored in Redis
   - Check 5-minute TTL

2. **WebRTC Signal Storage**
   - Send WebRTC signal to offline user
   - Verify signal stored in Redis
   - Check automatic delivery on reconnection

3. **Reconnection Handling**
   - Disconnect receiver
   - Send requests from sender
   - Reconnect receiver
   - Verify pending requests delivered

4. **Expiration Handling**
   - Send request to offline user
   - Wait 5+ minutes
   - Reconnect user
   - Verify request expired and not delivered

## Monitoring and Debugging

### Log Messages
- `💾 Stored pending request` - Request stored successfully
- `📦 Delivering pending requests` - Requests being delivered on reconnection
- `🗑️ Removed pending request` - Request removed after delivery
- `🧹 Scheduled cleanup completed` - Cleanup process completed

### Redis Commands for Debugging
```bash
# Check all pending requests
redis-cli keys "pending_request:*"

# Check requests for specific receiver
redis-cli smembers "receiver_pending:user-456"

# Get specific request data
redis-cli get "pending_request:file-1234567890-abc123"

# Check TTL for request
redis-cli ttl "pending_request:file-1234567890-abc123"
```

## Error Handling

### Frontend Errors
- Network errors when storing requests
- Failed request storage (graceful degradation)
- Connection issues during delivery

### Backend Errors
- Redis connection failures
- Invalid request data
- Cleanup process failures

### Recovery Mechanisms
- Automatic retry for failed operations
- Graceful degradation when Redis unavailable
- Request expiration prevents infinite storage

## Performance Considerations

### Redis Usage
- Efficient key structure for quick lookups
- Automatic TTL prevents memory leaks
- Scheduled cleanup removes orphaned data

### Network Impact
- Minimal overhead for online users
- Only stores requests when necessary
- Efficient delivery on reconnection

### Scalability
- Redis can handle thousands of pending requests
- Horizontal scaling possible with Redis cluster
- Stateless design allows multiple server instances

## Security Considerations

### Data Privacy
- No file content stored in Redis
- Only metadata and signaling data
- Automatic expiration prevents data retention

### Access Control
- No authentication required (matches current design)
- Request IDs are random and unguessable
- Receiver-specific key structure

## Future Enhancements

### Potential Improvements
1. **Authentication**: Add user authentication for request storage
2. **Encryption**: Encrypt sensitive request data
3. **Analytics**: Track request delivery success rates
4. **Notifications**: Push notifications for pending requests
5. **Webhooks**: External system notifications for pending requests

### Monitoring
1. **Metrics**: Track request storage and delivery rates
2. **Alerts**: Notify on high failure rates
3. **Dashboard**: Web interface for monitoring pending requests

## Troubleshooting

### Common Issues

1. **Requests Not Delivered**
   - Check Redis connection
   - Verify TTL settings
   - Check receiver ID matching

2. **Memory Usage**
   - Monitor Redis memory usage
   - Check cleanup process
   - Verify TTL expiration

3. **Performance Issues**
   - Monitor Redis response times
   - Check request volume
   - Optimize key structure if needed

### Debug Commands
```bash
# Check Redis health
curl http://localhost:3001/api/health

# Test request storage
curl -X POST http://localhost:3001/api/file-transfer/request \
  -H "Content-Type: application/json" \
  -d '{"senderId":"test","receiverId":"test","fileName":"test.txt","fileSize":100,"transferId":"test"}'

# Check pending requests
curl http://localhost:3001/api/file-transfer/pending/test
``` 