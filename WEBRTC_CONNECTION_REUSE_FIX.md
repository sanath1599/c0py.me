# WebRTC Connection Reuse Fix

## Problem
After a successful file transfer (taking about a minute), peers were automatically disconnecting and users were unable to transfer more files. Backend logs showed peers being removed as offline after 5 minutes.

## Root Causes

### 1. **Data Channel Closure After Transfer**
- After file transfer completed, the data channel was being closed immediately
- This triggered connection cleanup that removed the WebRTC peer connection
- The WebRTC connection was being removed even though it could be reused for future transfers

### 2. **Aggressive Connection Cleanup**
- When data channel closed, the code was calling `removeConnection()` which removed the WebRTC connection
- The connection state change handler was also removing connections on 'disconnected' state
- 'disconnected' is a temporary state and the connection might recover, but it was being removed too aggressively

### 3. **Always Creating New Connections**
- The code was creating a new WebRTC connection for every file transfer
- This caused unnecessary overhead and potential connection issues
- Existing healthy connections were not being reused

### 4. **Connection State Handling**
- The connection state handler was removing connections on 'disconnected' state
- 'disconnected' is temporary - connection might recover to 'connected'
- Only 'failed' or 'closed' states should trigger connection removal

## Solutions Implemented

### Frontend WebRTC Hook (`apps/web/src/hooks/useWebRTC.ts`)

#### 1. Keep Data Channels Open After Transfer
```typescript
// File transfer complete
dataChannel.send(JSON.stringify({ type: 'file-end' }));
setTransfers(prev => prev.map(t => 
  t.id === transferId ? { ...t, status: 'completed', progress: 100 } : t
));

// Don't close data channel immediately - keep it open for potential future transfers
// Only close if explicitly needed (e.g., user cancels or connection fails)
console.log('✅ File transfer completed - keeping data channel open for future transfers');
```

**Key Changes:**
- Removed automatic data channel closure after transfer completion
- Data channels remain open for potential future transfers
- Only close when explicitly needed (cancellation, errors, etc.)

#### 2. Improved Connection State Handling
```typescript
pc.onconnectionstatechange = () => {
  console.log(`🔗 Connection state with ${peerId}:`, pc.connectionState);
  
  // Only remove connection if it's completely failed or closed
  // 'disconnected' state is temporary and connection might recover
  if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
    console.log(`⚠️ WebRTC connection ${pc.connectionState} with ${peerId} - removing connection`);
    removeConnection(peerId);
    // Also remove data channel if it exists
    const dataChannel = dataChannelsRef.current.get(peerId);
    if (dataChannel) {
      dataChannelsRef.current.delete(peerId);
    }
  } else if (pc.connectionState === 'disconnected') {
    // Connection is disconnected but might recover - don't remove yet
    console.log(`⚠️ WebRTC connection disconnected with ${peerId} - waiting for recovery or failure`);
  } else if (pc.connectionState === 'connected') {
    console.log(`✅ WebRTC connection connected with ${peerId}`);
  }
};
```

**Key Changes:**
- Only remove connections on 'failed' or 'closed' states
- 'disconnected' state is temporary - wait for recovery or failure
- Better logging for connection state changes

#### 3. Connection Reuse Logic
```typescript
// Reuse existing connection if available and healthy, otherwise create new one
let pc = connections.get(peer.id);

// Check if existing connection is usable
if (pc) {
  const state = pc.connectionState;
  if (state === 'connected' || state === 'connecting') {
    console.log(`♻️ Reusing existing WebRTC connection with ${peer.id} (state: ${state})`);
    // Reuse existing connection
  } else if (state === 'closed' || state === 'failed') {
    console.log(`🔄 Existing connection ${state}, creating new one`);
    pc = createPeerConnection(peer.id);
  } else {
    // disconnected or other states - create new for reliability
    console.log(`⚠️ Existing connection in ${state} state, creating new one for reliability`);
    pc = createPeerConnection(peer.id);
  }
} else {
  console.log(`🆕 Creating new WebRTC connection with ${peer.id}`);
  pc = createPeerConnection(peer.id);
}
```

**Key Changes:**
- Check for existing connections before creating new ones
- Reuse connections in 'connected' or 'connecting' states
- Only create new connections when necessary
- Reduces connection overhead and improves performance

#### 4. Improved Data Channel Close Handling
```typescript
dataChannel.onclose = () => {
  console.log('📤 Data channel closed');
  
  // Remove from data channels ref
  dataChannelsRef.current.delete(peer.id);
  
  // Don't remove the WebRTC connection immediately - it might be reused
  // Only remove if the connection state is actually failed/closed
  // The connection state change handler will handle cleanup if needed
  console.log('ℹ️ Data channel closed - WebRTC connection may still be usable for future transfers');
};
```

**Key Changes:**
- Don't remove WebRTC connection when data channel closes
- Connection state handler will handle cleanup if needed
- Allows connection reuse for future transfers

## Key Improvements

1. **Connection Reuse**: WebRTC connections are now reused for multiple file transfers
2. **Better State Handling**: Only remove connections on permanent failures, not temporary disconnects
3. **Reduced Overhead**: Fewer connection establishments mean better performance
4. **Stability**: Connections remain available for future transfers
5. **Proper Cleanup**: Connections are only removed when actually failed/closed

## Expected Behavior

### After File Transfer Completes
- Data channel remains open (not closed immediately)
- WebRTC connection remains in connections map
- Connection can be reused for future transfers
- Socket.IO connection remains unaffected

### For Multiple File Transfers
- First transfer: Creates new WebRTC connection
- Subsequent transfers: Reuses existing connection if healthy
- New connection only created if existing one is failed/closed
- Better performance and reliability

### Connection State Changes
- 'connected' → Connection is healthy, can be reused
- 'connecting' → Connection is establishing, can be reused
- 'disconnected' → Temporary state, wait for recovery or failure
- 'failed' → Permanent failure, remove connection
- 'closed' → Connection closed, remove connection

## Testing Recommendations

1. **Test Multiple File Transfers**
   - Transfer first file
   - Verify connection remains after transfer completes
   - Transfer second file to same peer
   - Verify connection is reused (check logs for "Reusing existing WebRTC connection")

2. **Test Connection Recovery**
   - Start file transfer
   - Simulate temporary network issue (connection goes to 'disconnected')
   - Verify connection recovers to 'connected'
   - Verify transfer continues or can start new transfer

3. **Test Connection Failure**
   - Start file transfer
   - Force connection to 'failed' state
   - Verify connection is removed
   - Verify new connection is created for next transfer

## Files Modified

1. `apps/web/src/hooks/useWebRTC.ts` - WebRTC connection management and reuse logic

## Related Documentation

- [WebRTC Connection States](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState)
- [WebRTC Data Channels](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel)
- [WebRTC Best Practices](https://webrtc.org/getting-started/peer-connections)

