# WebRTC Bidirectional Transfer Fix

## Problem
After a file transfer completes, the sender can continue sending more files to the receiver, but the receiver cannot send files back to the sender. This is a bidirectional transfer issue.

## Root Causes

### 1. **Connection Reuse Without Proper Setup**
- When receiver tries to send a file back, it reuses the existing connection (good!)
- However, when reusing an existing connection, the code was trying to create a new offer
- You cannot create a new offer on an already-established WebRTC connection
- This caused the bidirectional transfer to fail

### 2. **Data Channel Creation on Established Connections**
- When reusing an existing connection, a new data channel can be created directly
- The data channel will be available on the other side via `ondatachannel` event
- The code was incorrectly trying to create a new offer/answer exchange

### 3. **ondatachannel Handler Not Always Set Up**
- The `ondatachannel` handler was only set up when creating a new connection
- When reusing an existing connection, the handler might not be set up
- This prevented receiving data channels created by the other peer

## Solutions Implemented

### Frontend WebRTC Hook (`apps/web/src/hooks/useWebRTC.ts`)

#### 1. Fixed Connection Reuse Logic
```typescript
// Check if existing connection is usable
let isNewConnection = false;
if (pc) {
  const state = pc.connectionState;
  if (state === 'connected' || state === 'connecting') {
    console.log(`♻️ Reusing existing WebRTC connection with ${peer.id} (state: ${state})`);
    // Connection already established - can create data channel directly
    isNewConnection = false;
  } else {
    // Create new connection
    pc = createPeerConnection(peer.id);
    isNewConnection = true;
  }
} else {
  // Create new connection
  pc = createPeerConnection(peer.id);
  isNewConnection = true;
}
```

**Key Changes:**
- Track whether connection is new or reused
- Only create offer/answer exchange for new connections
- For existing connections, just create data channel directly

#### 2. Conditional Offer Creation
```typescript
// Only create offer if this is a new connection
// If reusing existing connection, data channel will be available via ondatachannel on the other side
if (isNewConnection) {
  // Create offer
  console.log(`📤 Creating offer for ${peer.id}`);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  onSignal(peer.id, userId, {
    type: 'offer',
    sdp: offer
  });
} else {
  // Connection already established - data channel will be available on the other side
  // via ondatachannel event handler
  console.log(`✅ Reusing existing connection - data channel will be available on peer side via ondatachannel`);
  
  // Wait a bit for the data channel to be established
  // The onopen event will fire when ready
  if (dataChannel.readyState === 'open') {
    // Channel is already open, send file request immediately
    dataChannel.send(JSON.stringify({
      type: 'file-request',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      transferId: transferId
    }));
    pendingFilesRef.current.set(transferId, { file, peer, transferId });
  }
}
```

**Key Changes:**
- Only create offer for new connections
- For existing connections, data channel is created and will be received by other peer via `ondatachannel`
- Handle both cases properly

#### 3. Always Set Up ondatachannel Handler
```typescript
if (data.type === 'offer') {
  console.log(`📡 Processing offer from ${from}`);
  if (!pc) {
    pc = createPeerConnection(from);
  }
  
  // Set up data channel handler (if not already set up)
  // This handler will receive data channels created by the other peer
  // We need to set this up even if connection exists, to handle bidirectional transfers
  if (!pc.ondatachannel) {
    pc.ondatachannel = (event) => {
      const dataChannel = event.channel;
      console.log('📥 Data channel opened for receiving');
      
      // Store the data channel for accept/reject operations
      dataChannelsRef.current.set(from, dataChannel);
      // ... rest of handler ...
    };
  }
  
  // Process offer and create answer
  await pc.setRemoteDescription(data.sdp);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  onSignal(from, userId, { type: 'answer', sdp: answer });
}
```

**Key Changes:**
- Always set up `ondatachannel` handler when processing offers
- Handler is set up even if connection already exists
- Ensures bidirectional data channels are properly received

#### 4. Improved Data Channel Storage
```typescript
// Store data channel with a unique key (peer.id + transferId) to allow multiple channels
const channelKey = `${peer.id}-${transferId}`;
dataChannelsRef.current.set(channelKey, dataChannel);
```

**Key Changes:**
- Store data channels with unique keys to allow multiple channels per peer
- Maintains backward compatibility with existing accept/reject functions

## Key Improvements

1. **Bidirectional Transfers**: Both peers can now send files to each other
2. **Connection Reuse**: Existing connections are properly reused for bidirectional transfers
3. **Proper Data Channel Handling**: Data channels are created correctly on established connections
4. **ondatachannel Setup**: Handler is always set up to receive data channels from other peer

## Expected Behavior

### First Transfer (Sender → Receiver)
1. Sender creates new connection
2. Sender creates data channel
3. Sender creates offer and sends to receiver
4. Receiver processes offer, creates answer
5. Connection established, data channel available
6. File transfer proceeds

### Second Transfer (Receiver → Sender)
1. Receiver reuses existing connection
2. Receiver creates new data channel on existing connection
3. No new offer/answer needed (connection already established)
4. Data channel is received by sender via `ondatachannel`
5. File transfer proceeds

### Multiple Transfers
- Both peers can send multiple files to each other
- Each transfer can use the same connection
- New data channels are created for each transfer
- All data channels work bidirectionally

## Testing Recommendations

1. **Test Bidirectional Transfer**
   - Send file from Peer A to Peer B
   - Verify transfer completes
   - Send file from Peer B to Peer A
   - Verify transfer completes

2. **Test Multiple Bidirectional Transfers**
   - Send multiple files back and forth
   - Verify all transfers complete successfully
   - Verify connection is reused (check logs)

3. **Test Connection Reuse**
   - Send file from Peer A to Peer B
   - Check logs for "Reusing existing WebRTC connection"
   - Send file from Peer B to Peer A
   - Verify connection is reused

## Files Modified

1. `apps/web/src/hooks/useWebRTC.ts` - Fixed bidirectional transfer logic

## Related Documentation

- [WebRTC Data Channels](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel)
- [WebRTC Peer Connections](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)
- [WebRTC Connection Establishment](https://webrtc.org/getting-started/peer-connections)

