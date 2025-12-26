# Robust Dynamic Chunking System

## Overview

The robust chunking system provides reliable file transfer over WebRTC with dynamic chunk sizing, gap detection, integrity verification, and mobile-optimized storage. It ensures files are transferred correctly even under poor network conditions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SENDER SIDE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  File → Hash → Manifest → Send Chunks → Handle ACKs → Complete         │
│                    ↓              ↓                                      │
│            [transfer-manifest]  [binary chunks with headers]            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                        WebRTC DataChannel
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                          RECEIVER SIDE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Manifest → ACK → Receive Chunks → Verify Hashes → Assemble → Complete │
│      ↓              ↓                    ↓                               │
│  [manifest-ack]  [chunk-ack]      [request-resend]                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Dynamic Chunk Sizing

Chunk sizes are automatically selected based on device type and file size:

| Device Type | File Size | Chunk Size |
|-------------|-----------|------------|
| Mobile/Tablet | < 50MB | 8 KB |
| Mobile/Tablet | ≥ 50MB | 16 KB |
| Desktop | < 100MB | 64 KB |
| Desktop | 100MB - 500MB | 128 KB |
| Desktop | > 500MB | 256 KB |

### 2. Chunk Metadata

Each chunk includes a 48-byte binary header:

```
| Field    | Bytes | Type     | Description                    |
|----------|-------|----------|--------------------------------|
| Sequence | 4     | Uint32   | Chunk sequence number (0-based)|
| Offset   | 8     | BigInt64 | Byte offset in original file   |
| Size     | 4     | Uint32   | Chunk data size in bytes       |
| Hash     | 32    | Bytes    | SHA-256 hash of chunk data     |
```

### 3. Gap Detection & Recovery

The receiver maintains a bitmap of received chunks and detects gaps:

- **Bitmap Tracking**: Each received chunk is marked in a Set
- **Contiguous Tracking**: Tracks the last contiguous sequence number
- **Gap Detection**: Identifies missing chunks up to the current sequence
- **Automatic Resend**: Requests resend for detected gaps

### 4. Hash-Based Integrity

- **Per-Chunk Hash**: Each chunk has SHA-256 hash in header
- **Full File Hash**: Manifest includes complete file hash
- **Verification**: Receiver verifies each chunk and final file

### 5. IndexedDB Storage (Mobile)

For large files on mobile devices (> 50MB):
- Chunks stored in IndexedDB to prevent memory issues
- Automatic file assembly from stored chunks
- Cleanup on transfer completion

## Protocol Messages

### Sender → Receiver

#### transfer-manifest
Initial handshake with file information.

```typescript
{
  type: 'transfer-manifest',
  payload: {
    transferId: string,
    fileName: string,
    fileSize: number,
    fileType: string,
    fileHash: string,      // SHA-256 of entire file
    totalChunks: number,
    chunkSize: number,
    senderDevice: 'mobile' | 'tablet' | 'desktop',
    proposedChunkSize: number,
    protocolVersion: 1,
    timestamp: number
  }
}
```

#### Binary Chunk Data
Raw binary with 48-byte header followed by chunk data.

#### transfer-end
Signals all chunks have been sent.

```typescript
{
  type: 'transfer-end',
  payload: {
    transferId: string,
    fileHash: string,
    totalChunksSent: number,
    totalBytesSent: number,
    duration: number,
    timestamp: number
  }
}
```

### Receiver → Sender

#### manifest-ack
Acknowledges manifest and negotiates chunk size.

```typescript
{
  type: 'manifest-ack',
  payload: {
    transferId: string,
    agreedChunkSize: number,  // Negotiated chunk size
    receiverDevice: 'mobile' | 'tablet' | 'desktop',
    useIndexedDB: boolean,
    ackBatchSize: number,
    timestamp: number
  }
}
```

#### chunk-ack
Periodic acknowledgment of received chunks.

```typescript
{
  type: 'chunk-ack',
  payload: {
    transferId: string,
    lastContiguousSeq: number,
    receivedSequences: number[],
    gaps: number[],
    totalReceived: number,
    timestamp: number
  }
}
```

#### request-resend
Request specific chunks to be resent.

```typescript
{
  type: 'request-resend',
  payload: {
    transferId: string,
    sequences: number[],
    reason: 'gap' | 'hash_mismatch' | 'timeout',
    timestamp: number
  }
}
```

#### transfer-complete
Confirms successful transfer and verification.

```typescript
{
  type: 'transfer-complete',
  payload: {
    transferId: string,
    verified: boolean,
    calculatedHash: string,
    totalChunksReceived: number,
    duration: number,
    timestamp: number
  }
}
```

#### transfer-failed
Reports transfer failure.

```typescript
{
  type: 'transfer-failed',
  payload: {
    transferId: string,
    reason: 'hash_mismatch' | 'timeout' | 'connection_lost' | 'cancelled' | 'storage_error',
    message: string,
    expectedHash?: string,
    calculatedHash?: string,
    timestamp: number
  }
}
```

## Transfer Flow

### Successful Transfer

```
Sender                                  Receiver
  │                                        │
  │──── transfer-manifest ─────────────────│
  │                                        │
  │◄─── manifest-ack ──────────────────────│
  │                                        │
  │──── binary chunk (seq 0) ──────────────│
  │──── binary chunk (seq 1) ──────────────│
  │──── binary chunk (seq 2) ──────────────│
  │         ...                            │
  │                                        │
  │◄─── chunk-ack (seq 0-9) ───────────────│
  │                                        │
  │──── binary chunk (seq 10-19) ──────────│
  │                                        │
  │◄─── chunk-ack (seq 10-19) ─────────────│
  │                                        │
  │         ...                            │
  │                                        │
  │──── transfer-end ──────────────────────│
  │                                        │
  │◄─── transfer-complete ─────────────────│
  │                                        │
```

### Transfer with Gap Recovery

```
Sender                                  Receiver
  │                                        │
  │──── chunk (seq 0) ─────────────────────│
  │──── chunk (seq 1) ─────────────────────│
  │──X─ chunk (seq 2) LOST ────────────────│
  │──── chunk (seq 3) ─────────────────────│
  │──── chunk (seq 4) ─────────────────────│
  │                                        │
  │◄─── request-resend [seq: 2] ───────────│
  │                                        │
  │──── chunk (seq 2) RESENT ──────────────│
  │                                        │
  │◄─── chunk-ack (gaps: []) ──────────────│
  │                                        │
```

## API Reference

### Services

#### hashService.ts

```typescript
// Hash an ArrayBuffer
hashArrayBuffer(data: ArrayBuffer): Promise<HashResult>

// Hash a file with progress
hashFile(file: File, onProgress?: HashProgressCallback): Promise<HashResult>

// Verify chunk integrity
verifyChunk(chunk: ArrayBuffer, expectedHash: string): Promise<boolean>

// Verify file integrity
verifyFile(file: File, expectedHash: string): Promise<boolean>
```

#### indexedDBService.ts

```typescript
// Store a chunk
storeChunk(transferId: string, sequence: number, data: ArrayBuffer, hash: string): Promise<void>

// Get a chunk
getChunk(transferId: string, sequence: number): Promise<StoredChunk | null>

// Get all chunks for a transfer
getAllChunks(transferId: string): Promise<StoredChunk[]>

// Assemble file from chunks
assembleFile(transferId: string, manifest: TransferManifest): Promise<Blob>

// Clean up transfer data
cleanupTransfer(transferId: string): Promise<void>
```

#### chunkingService.ts

```typescript
// Detect device type
detectDeviceType(): DeviceType

// Calculate optimal chunk configuration
calculateChunkConfig(fileSize: number, deviceType: DeviceType): ChunkConfig

// Create transfer manifest
createTransferManifest(file: File, transferId: string): Promise<TransferManifest>

// Generate chunk with metadata
generateChunk(file: File, sequence: number, chunkSize: number): Promise<ChunkWithData>

// Create binary chunk with header
createBinaryChunk(metadata: ChunkMetadata, data: ArrayBuffer): ArrayBuffer

// Parse binary chunk
parseBinaryChunk(chunk: ArrayBuffer): { header: BinaryChunkHeader; data: ArrayBuffer }

// Create/update chunk bitmap
createChunkBitmap(totalChunks: number): ChunkBitmap
markChunkReceived(bitmap: ChunkBitmap, sequence: number): ChunkBitmap
detectGaps(bitmap: ChunkBitmap): number[]

// Verify binary chunk
verifyBinaryChunk(chunk: ArrayBuffer): Promise<{ valid: boolean; header: BinaryChunkHeader; data: ArrayBuffer; computedHash: string }>
```

### Hook: useChunkedTransfer

```typescript
const {
  isSending,
  isReceiving,
  initiateSend,
  handleMessage,
  pauseTransfer,
  resumeTransfer,
  cancelTransfer,
  getSendContext,
  getReceiveContext
} = useChunkedTransfer({
  onProgress: (progress) => { ... },
  onComplete: (file, transferId) => { ... },
  onError: (error, transferId) => { ... },
  onLog: (message) => { ... },
  progressThrottleMs: 100
});
```

## Error Handling

### Chunk Hash Mismatch
- **Detection**: Computed hash doesn't match header hash
- **Recovery**: Request single chunk resend
- **Max Retries**: 3 attempts per chunk

### Gap Detection
- **Detection**: Missing sequence numbers in bitmap
- **Recovery**: Request batch resend of missing chunks
- **Timing**: Checked on every ACK interval

### Final Hash Mismatch
- **Detection**: Assembled file hash doesn't match manifest hash
- **Recovery**: Transfer marked as failed
- **User Action**: Manual retry required

### Connection Drop
- **IndexedDB**: State persisted, can resume
- **Memory**: State lost, restart required

### Storage Error
- **IndexedDB Full**: Transfer fails with storage_error
- **Recovery**: Clean up old transfers, retry

## Configuration

### Feature Flag

```typescript
// In useWebRTC.ts
const USE_ROBUST_CHUNKING = true;  // Enable/disable robust chunking
```

### Constants

```typescript
// Chunk sizes
CHUNK_SIZES = {
  MOBILE_SMALL: 8 * 1024,      // 8KB
  MOBILE_LARGE: 16 * 1024,     // 16KB
  DESKTOP_SMALL: 64 * 1024,    // 64KB
  DESKTOP_MEDIUM: 128 * 1024,  // 128KB
  DESKTOP_LARGE: 256 * 1024    // 256KB
}

// File size thresholds
FILE_SIZE_THRESHOLDS = {
  MOBILE_LARGE: 50 * 1024 * 1024,    // 50MB
  DESKTOP_MEDIUM: 100 * 1024 * 1024, // 100MB
  DESKTOP_LARGE: 500 * 1024 * 1024   // 500MB
}

// Protocol
PROTOCOL_VERSION = 1
CHUNK_HEADER_SIZE = 48
DEFAULT_ACK_BATCH_SIZE = 10
MAX_CHUNK_RETRIES = 3
```

## Performance Considerations

### Memory Usage
- Mobile: IndexedDB for files > 50MB
- Desktop: In-memory for all file sizes
- Progress updates throttled to 100ms

### Network Efficiency
- Batch ACKs every 10 chunks (configurable)
- Flow control with buffer monitoring
- Pause when buffer > 1MB, resume at 64KB

### CPU Usage
- SHA-256 hashing via Web Crypto API (hardware accelerated)
- Incremental hashing for large files
- Async chunk generation

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebRTC DataChannel | ✓ | ✓ | ✓ | ✓ |
| Web Crypto API | ✓ | ✓ | ✓ | ✓ |
| IndexedDB | ✓ | ✓ | ✓ | ✓ |
| ArrayBuffer Transfer | ✓ | ✓ | ✓ | ✓ |
| BigInt64 (DataView) | ✓ | ✓ | ✓ | ✓ |

## Debugging

### Enable Logging

Console logs are prefixed with emojis for easy filtering:
- 📤 Sending operations
- 📥 Receiving operations
- 🔐 Hash operations
- ✅ Success
- ❌ Error
- ⚠️ Warning
- 🔄 Retry/resend

### Common Issues

1. **Chunks not arriving**: Check DataChannel binary type is 'arraybuffer'
2. **Hash mismatches**: Verify chunk size negotiation
3. **Slow transfers**: Check buffer management and throttling
4. **Memory issues**: Verify IndexedDB is being used on mobile

## Migration from Legacy

The new chunking system is backward compatible:
- If receiver doesn't support robust chunking, falls back to legacy
- Legacy protocol still functional (file-start, binary chunks, file-end)
- Feature flag allows easy enable/disable

