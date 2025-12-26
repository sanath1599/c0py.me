/**
 * Chunking Types for WebRTC File Transfer
 * 
 * This module defines all types related to the robust chunking system
 * including chunk metadata, transfer manifests, acknowledgments, and protocol messages.
 */

// ============================================================================
// Device and Network Types
// ============================================================================

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface NetworkInfo {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // Round-trip time in ms
}

// ============================================================================
// Chunk Configuration
// ============================================================================

export interface ChunkConfig {
  /** Chunk size in bytes */
  chunkSize: number;
  /** Total number of chunks */
  totalChunks: number;
  /** Whether to use IndexedDB for storage */
  useIndexedDB: boolean;
  /** Batch size for ACK messages */
  ackBatchSize: number;
  /** Buffer low watermark for flow control */
  bufferLowWatermark: number;
  /** Buffer high watermark for flow control */
  bufferHighWatermark: number;
}

// Chunk size constants based on device type and file size
// Note: Smaller chunks are more reliable for WebRTC data channels
export const CHUNK_SIZES = {
  MOBILE_SMALL: 8 * 1024,      // 8KB for mobile files < 50MB
  MOBILE_LARGE: 16 * 1024,     // 16KB for mobile files >= 50MB
  DESKTOP_SMALL: 32 * 1024,    // 32KB for desktop files < 100MB (reduced for reliability)
  DESKTOP_MEDIUM: 64 * 1024,   // 64KB for desktop files 100MB-500MB (reduced for reliability)
  DESKTOP_LARGE: 64 * 1024,    // 64KB for desktop files > 500MB (reduced for reliability)
} as const;

// File size thresholds in bytes
export const FILE_SIZE_THRESHOLDS = {
  MOBILE_LARGE: 50 * 1024 * 1024,      // 50MB
  DESKTOP_MEDIUM: 100 * 1024 * 1024,   // 100MB
  DESKTOP_LARGE: 500 * 1024 * 1024,    // 500MB
  INDEXEDDB_THRESHOLD_MOBILE: 50 * 1024 * 1024,  // Use IndexedDB for files > 50MB on mobile
} as const;

// ============================================================================
// Chunk Metadata
// ============================================================================

export interface ChunkMetadata {
  /** Sequence number (0-indexed) */
  sequence: number;
  /** Byte offset in the original file */
  offset: number;
  /** Size of this chunk in bytes */
  size: number;
  /** SHA-256 hash of chunk data (hex string) */
  hash: string;
  /** Timestamp when chunk was created */
  timestamp: number;
  /** Whether this is a resent chunk */
  isResend?: boolean;
}

export interface ChunkWithData extends ChunkMetadata {
  /** The actual chunk data */
  data: ArrayBuffer;
}

// ============================================================================
// Transfer Manifest (Initial Handshake)
// ============================================================================

export interface TransferManifest {
  /** Unique transfer ID */
  transferId: string;
  /** File name */
  fileName: string;
  /** Total file size in bytes */
  fileSize: number;
  /** File MIME type */
  fileType: string;
  /** SHA-256 hash of the entire file (hex string) */
  fileHash: string;
  /** Total number of chunks */
  totalChunks: number;
  /** Chunk size in bytes (negotiated) */
  chunkSize: number;
  /** Sender's device type */
  senderDevice: DeviceType;
  /** Sender's proposed chunk size */
  proposedChunkSize: number;
  /** Protocol version */
  protocolVersion: number;
  /** Timestamp */
  timestamp: number;
}

export interface ManifestAck {
  /** Transfer ID being acknowledged */
  transferId: string;
  /** Agreed chunk size (may differ from proposed) */
  agreedChunkSize: number;
  /** Receiver's device type */
  receiverDevice: DeviceType;
  /** Whether receiver will use IndexedDB */
  useIndexedDB: boolean;
  /** Preferred ACK batch size */
  ackBatchSize: number;
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Chunk Acknowledgment
// ============================================================================

export interface ChunkACK {
  /** Transfer ID */
  transferId: string;
  /** Last contiguous sequence number received */
  lastContiguousSeq: number;
  /** Array of received sequence numbers in this batch */
  receivedSequences: number[];
  /** Array of detected gap sequence numbers */
  gaps: number[];
  /** Total chunks received so far */
  totalReceived: number;
  /** Timestamp */
  timestamp: number;
}

export interface ResendRequest {
  /** Transfer ID */
  transferId: string;
  /** Sequence numbers to resend */
  sequences: number[];
  /** Reason for resend */
  reason: 'gap' | 'hash_mismatch' | 'timeout';
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Transfer Completion
// ============================================================================

export interface TransferEnd {
  /** Transfer ID */
  transferId: string;
  /** Final file hash for verification */
  fileHash: string;
  /** Total chunks sent */
  totalChunksSent: number;
  /** Total bytes sent */
  totalBytesSent: number;
  /** Transfer duration in ms */
  duration: number;
  /** Timestamp */
  timestamp: number;
}

export interface TransferComplete {
  /** Transfer ID */
  transferId: string;
  /** Whether file hash verification passed */
  verified: boolean;
  /** Calculated file hash by receiver */
  calculatedHash: string;
  /** Total chunks received */
  totalChunksReceived: number;
  /** Transfer duration in ms */
  duration: number;
  /** Timestamp */
  timestamp: number;
}

export interface TransferFailed {
  /** Transfer ID */
  transferId: string;
  /** Failure reason */
  reason: 'hash_mismatch' | 'timeout' | 'connection_lost' | 'cancelled' | 'storage_error';
  /** Error message */
  message: string;
  /** Expected hash (if applicable) */
  expectedHash?: string;
  /** Calculated hash (if applicable) */
  calculatedHash?: string;
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Protocol Messages (Union Type)
// ============================================================================

export type TransferProtocolMessage =
  | { type: 'transfer-manifest'; payload: TransferManifest }
  | { type: 'manifest-ack'; payload: ManifestAck }
  | { type: 'chunk-ack'; payload: ChunkACK }
  | { type: 'request-resend'; payload: ResendRequest }
  | { type: 'transfer-end'; payload: TransferEnd }
  | { type: 'transfer-complete'; payload: TransferComplete }
  | { type: 'transfer-failed'; payload: TransferFailed }
  | { type: 'transfer-pause'; payload: { transferId: string; timestamp: number } }
  | { type: 'transfer-resume'; payload: { transferId: string; timestamp: number } };

// ============================================================================
// Binary Chunk Header Format
// ============================================================================

/**
 * Binary header format for chunks sent over the data channel:
 * 
 * | Field    | Bytes | Type     | Description                    |
 * |----------|-------|----------|--------------------------------|
 * | Sequence | 4     | Uint32   | Chunk sequence number          |
 * | Offset   | 8     | BigInt64 | Byte offset in file            |
 * | Size     | 4     | Uint32   | Chunk data size                |
 * | Hash     | 32    | Bytes    | SHA-256 hash (raw bytes)       |
 * | Data     | var   | Bytes    | Actual chunk data              |
 * 
 * Total header size: 48 bytes
 */
export const CHUNK_HEADER_SIZE = 48;

export interface BinaryChunkHeader {
  sequence: number;
  offset: number;
  size: number;
  hash: Uint8Array; // 32 bytes
}

// ============================================================================
// Transfer State Tracking
// ============================================================================

export interface ChunkBitmap {
  /** Total number of chunks expected */
  totalChunks: number;
  /** Set of received chunk sequence numbers */
  received: Set<number>;
  /** Last contiguous sequence number */
  lastContiguous: number;
}

export interface TransferState {
  /** Transfer ID */
  transferId: string;
  /** Transfer manifest */
  manifest: TransferManifest | null;
  /** Chunk bitmap for tracking received chunks */
  bitmap: ChunkBitmap;
  /** Chunks waiting to be verified/assembled */
  pendingChunks: Map<number, ChunkWithData>;
  /** Start timestamp */
  startTime: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Current status */
  status: 'negotiating' | 'transferring' | 'paused' | 'completing' | 'completed' | 'failed';
  /** Pause reason if paused */
  pauseReason?: 'gap_filling' | 'buffer_full' | 'user_requested';
  /** Retry count for failed chunks */
  retryCount: number;
  /** Max retries allowed */
  maxRetries: number;
}

// ============================================================================
// Progress and Statistics
// ============================================================================

export interface TransferProgress {
  /** Transfer ID */
  transferId: string;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Bytes transferred */
  bytesTransferred: number;
  /** Total bytes */
  totalBytes: number;
  /** Chunks transferred */
  chunksTransferred: number;
  /** Total chunks */
  totalChunks: number;
  /** Current transfer speed (bytes/sec) */
  speed: number;
  /** Estimated time remaining (seconds) */
  eta: number;
  /** Number of chunks resent */
  resendCount: number;
  /** Number of gaps detected */
  gapsDetected: number;
}

export interface TransferStatistics {
  /** Transfer ID */
  transferId: string;
  /** Total duration in ms */
  duration: number;
  /** Average speed in bytes/sec */
  averageSpeed: number;
  /** Peak speed in bytes/sec */
  peakSpeed: number;
  /** Total chunks */
  totalChunks: number;
  /** Chunks that needed resend */
  chunksResent: number;
  /** Total gaps detected */
  gapsDetected: number;
  /** Hash verification passed */
  hashVerified: boolean;
  /** Storage method used */
  storageMethod: 'memory' | 'indexeddb';
}

// ============================================================================
// IndexedDB Storage Types
// ============================================================================

export interface StoredChunk {
  /** Composite key: transferId + sequence */
  id: string;
  /** Transfer ID */
  transferId: string;
  /** Sequence number */
  sequence: number;
  /** Chunk data */
  data: ArrayBuffer;
  /** Chunk hash */
  hash: string;
  /** Timestamp stored */
  storedAt: number;
}

export interface StoredTransfer {
  /** Transfer ID */
  transferId: string;
  /** Transfer manifest */
  manifest: TransferManifest;
  /** Transfer state */
  state: 'sending' | 'receiving' | 'paused' | 'completed' | 'failed';
  /** Received chunks bitmap (serialized) */
  receivedBitmap: number[];
  /** Created timestamp */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
}

// ============================================================================
// Protocol Version
// ============================================================================

export const PROTOCOL_VERSION = 1;

