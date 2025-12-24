# WebSocket Connection Stability Fix

## Problem
The WebSocket connection was constantly reconnecting every few seconds, causing instability and poor user experience.

## Root Causes Identified

### 1. **Duplicate `connect_error` Handlers**
- Two separate `connect_error` event handlers were registered on the same socket
- This caused conflicting reconnection logic and multiple reconnection attempts

### 2. **Conflicting Ping-Pong Mechanisms**
- Socket.IO has a built-in ping/pong mechanism for keep-alive
- A custom ping/pong implementation was also running simultaneously
- These two mechanisms conflicted, causing premature disconnections:
  - Socket.IO: ping every 25s, timeout 60s
  - Custom: ping every 120s, timeout 60s
  - Server custom handler: timeout 180s
- The custom mechanism would disconnect the socket when it didn't receive a pong, even though Socket.IO's built-in mechanism was working correctly

### 3. **useEffect Dependency Issues**
- The socket connection `useEffect` had dependencies that could cause the socket to be recreated unnecessarily
- This led to multiple connection attempts and potential conflicts

### 4. **Aggressive Reconnection Settings**
- Some reconnection settings were too aggressive or conflicting

## Solutions Implemented

### Frontend Changes (`apps/web/src/hooks/useSocket.ts`)

#### 1. Removed Duplicate `connect_error` Handler
- Consolidated into a single handler that:
  - Logs errors properly
  - Handles namespace errors specifically
  - Lets Socket.IO handle automatic reconnection
  - Only updates UI state, doesn't interfere with reconnection logic

#### 2. Removed Custom Ping-Pong Mechanism
- Removed all custom ping/pong code:
  - `startPingPong()` function (now a no-op)
  - `stopPingPong()` function (now a no-op)
  - Custom ping interval and pong timeout
  - Custom ping/pong event handlers
- Socket.IO's built-in mechanism now handles all keep-alive functionality

#### 3. Fixed Socket.IO Configuration
```typescript
socketRef.current = io(WS_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity, // Keep trying to reconnect
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000, // Connection timeout
  forceNew: false,
  path: '/socket.io/',
  autoConnect: true,
  upgrade: true,
  rememberUpgrade: true, // Remember successful upgrade to websocket
  // Let Socket.IO handle ping/pong internally - don't interfere
});
```

#### 4. Fixed useEffect Dependencies
- Changed dependency array to empty `[]` to ensure socket is only created once on mount
- Added eslint-disable comment explaining why dependencies are omitted
- Functions from hooks are stable and don't need to be in dependencies

#### 5. Improved Disconnect Handling
- Better handling of disconnect reasons
- Only treats unexpected disconnects as errors
- Lets Socket.IO handle automatic reconnection for normal disconnects

### Backend Changes (`apps/api/src/socketService.ts`)

#### 1. Removed Custom Ping Handler
- Removed the custom `ping` event handler that conflicted with Socket.IO's built-in mechanism
- Socket.IO automatically handles ping/pong internally

#### 2. Optimized Socket.IO Server Configuration
```typescript
this.io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  path: '/socket.io/',
  // Optimized ping/pong timing for stable connections
  pingTimeout: 60000, // 60 seconds - wait longer for pong response
  pingInterval: 25000, // 25 seconds - standard ping interval
  connectTimeout: 45000, // 45 seconds to establish connection
});
```

#### 3. Cleaned Up Ping Tracking
- Removed unused ping tracking maps:
  - `lastPingTime: Map<string, number>`
  - `pingTimeout: Map<string, NodeJS.Timeout>`
- Updated `getConnectionStats()` to reflect removal of custom ping tracking

#### 4. Improved Disconnect Logging
- Added disconnect reason logging for better debugging

## Key Improvements

1. **Single Source of Truth**: Socket.IO's built-in ping/pong mechanism is now the only keep-alive system
2. **No Conflicts**: Removed all conflicting custom implementations
3. **Stable Connection**: Socket is created once and persists throughout component lifecycle
4. **Automatic Reconnection**: Socket.IO handles reconnection automatically without interference
5. **Better Error Handling**: Clear distinction between expected and unexpected disconnects

## Testing Recommendations

1. **Monitor Connection Stability**
   - Check browser console for connection/disconnection logs
   - Verify connection stays stable for extended periods
   - Monitor network tab for WebSocket frames

2. **Test Reconnection Scenarios**
   - Temporarily disable network (should reconnect when network returns)
   - Restart server (should reconnect automatically)
   - Close and reopen browser tab (should establish new connection)

3. **Verify Ping/Pong**
   - Socket.IO automatically sends ping every 25 seconds
   - Server responds with pong automatically
   - No custom ping/pong events should appear in logs

## Expected Behavior

- **Initial Connection**: Socket connects once when component mounts
- **Keep-Alive**: Socket.IO automatically maintains connection with ping/pong
- **Reconnection**: Socket.IO automatically reconnects on disconnect (unless manually disconnected)
- **Stability**: Connection should remain stable without constant reconnections

## Notes

- Socket.IO's built-in ping/pong mechanism is more reliable than custom implementations
- The `pingTimeout` of 60 seconds gives plenty of time for pong responses
- `reconnectionAttempts: Infinity` ensures the client keeps trying to reconnect
- `rememberUpgrade: true` helps maintain WebSocket transport preference

## Files Modified

1. `apps/web/src/hooks/useSocket.ts` - Frontend socket connection logic
2. `apps/api/src/socketService.ts` - Backend socket service

## Related Documentation

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Socket.IO Client Options](https://socket.io/docs/v4/client-api/#new-Managerurl-options)
- [Socket.IO Server Options](https://socket.io/docs/v4/server-api/#new-ServerhttpServer-options)

