# c0py.me API Documentation

This document describes the API endpoints and WebSocket events used in c0py.me.

## 🌐 REST API Endpoints

### Base URL
- Development: `http://localhost:3001`
- Production: `https://api.c0py.me` (or your production URL)

### Health Check

#### GET `/health`
Check server health status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-05T12:00:00.000Z"
}
```

### Logs API

#### GET `/api/logs`
Get client event logs.

**Query Parameters:**
- `limit` (optional): Number of logs to return (default: 100)
- `offset` (optional): Pagination offset (default: 0)
- `userId` (optional): Filter by user ID
- `eventType` (optional): Filter by event type

**Response:**
```json
{
  "logs": [
    {
      "id": "log-id",
      "userId": "user-id",
      "eventType": "file_transfer",
      "timestamp": "2025-01-05T12:00:00.000Z",
      "data": {}
    }
  ],
  "total": 100,
  "limit": 100,
  "offset": 0
}
```

#### POST `/api/logs/upload`
Upload client event logs.

**Request Body:**
```json
{
  "logs": [
    {
      "userId": "user-id",
      "eventType": "file_transfer",
      "timestamp": "2025-01-05T12:00:00.000Z",
      "data": {}
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "uploaded": 1
}
```

### File Transfer API

#### POST `/file-transfer/request`
Store a file transfer request for offline peers.

**Request Body:**
```json
{
  "senderId": "sender-id",
  "receiverId": "receiver-id",
  "fileName": "example.pdf",
  "fileSize": 1024000,
  "fileType": "application/pdf",
  "transferId": "transfer-id"
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "request-id",
  "message": "File transfer request stored successfully"
}
```

#### GET `/file-transfer/pending/:receiverId`
Get pending file transfer requests for a receiver.

**Response:**
```json
{
  "requests": [
    {
      "requestId": "request-id",
      "senderId": "sender-id",
      "fileName": "example.pdf",
      "fileSize": 1024000,
      "fileType": "application/pdf",
      "transferId": "transfer-id",
      "timestamp": "2025-01-05T12:00:00.000Z"
    }
  ]
}
```

## 🔌 WebSocket Events

### Connection

#### `connect`
Client connects to the server.

#### `disconnect`
Client disconnects from the server.

### Room Management

#### `join-room`
Join a room (Jungle, Room, or Family).

**Emit:**
```json
{
  "room": "room-id",
  "userId": "user-id",
  "name": "username",
  "color": "#FF5733",
  "emoji": "🦁"
}
```

#### `leave-room`
Leave the current room.

**Emit:**
```json
{
  "room": "room-id",
  "userId": "user-id"
}
```

### Profile Updates

#### `update-profile`
Update user profile information.

**Emit:**
```json
{
  "name": "new-username",
  "color": "#FF5733",
  "emoji": "🦁"
}
```

**Listen:**
```json
{
  "userId": "user-id",
  "name": "new-username",
  "color": "#FF5733",
  "emoji": "🦁"
}
```

### WebRTC Signaling

#### `signal`
Send WebRTC signaling data to a peer.

**Emit:**
```json
{
  "to": "peer-id",
  "from": "sender-id",
  "data": {
    "type": "offer",
    "sdp": "..."
  }
}
```

**Listen:**
```json
{
  "from": "sender-id",
  "data": {
    "type": "offer",
    "sdp": "..."
  }
}
```

### User Presence

#### `user-joined`
Emitted when a user joins the room.

**Listen:**
```json
{
  "userId": "user-id",
  "name": "username",
  "color": "#FF5733",
  "emoji": "🦁",
  "socketId": "socket-id"
}
```

#### `user-left`
Emitted when a user leaves the room.

**Listen:**
```json
{
  "userId": "user-id"
}
```

#### `users-list`
Get list of users in the current room.

**Emit:**
```json
{
  "room": "room-id"
}
```

**Listen:**
```json
{
  "users": [
    {
      "id": "user-id",
      "name": "username",
      "color": "#FF5733",
      "emoji": "🦁",
      "isOnline": true
    }
  ]
}
```

### Connection Health

#### `ping`
Ping the server to check connection.

**Emit:**
```json
{}
```

#### `pong`
Response to ping.

**Listen:**
```json
{
  "timestamp": "2025-01-05T12:00:00.000Z"
}
```

## 📡 WebRTC Data Channel Messages

### File Transfer

#### File Request
```json
{
  "type": "file-request",
  "fileName": "example.pdf",
  "fileSize": 1024000,
  "fileType": "application/pdf",
  "transferId": "transfer-id"
}
```

#### File Acceptance
```json
{
  "type": "file-accepted",
  "transferId": "transfer-id"
}
```

#### File Rejection
```json
{
  "type": "file-rejected",
  "transferId": "transfer-id"
}
```

#### File Start
```json
{
  "type": "file-start",
  "name": "example.pdf",
  "size": 1024000,
  "fileType": "application/pdf"
}
```

#### File Chunk
Binary data (ArrayBuffer) - sent directly, not JSON.

#### File End
```json
{
  "type": "file-end"
}
```

## 🔒 Authentication

Currently, c0py.me uses anonymous authentication with random user IDs. No authentication tokens are required.

## 📊 Rate Limiting

API endpoints may have rate limiting in production:
- Standard endpoints: 100 requests/minute
- Log upload: 10 requests/minute
- WebSocket connections: No limit (but monitored)

## 🐛 Error Responses

### Standard Error Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 📝 Notes

- All timestamps are in ISO 8601 format
- File sizes are in bytes
- WebRTC signaling uses standard SDP format
- Data channel messages use binary for file chunks

---

For more information, see:
- [Architecture Overview](architecture/ARCHITECTURE.md)
- [Development Instructions](development/instructions.md)

