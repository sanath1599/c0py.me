/**
 * Chunking Service for WebRTC File Transfer
 * 
 * Core chunking logic including:
 * - Dynamic chunk size calculation based on device type and file size
 * - Chunk generation with metadata
 * - Chunk assembly and file reconstruction
 * - Gap detection using bitmap tracking
 * - Binary header encoding/decoding
 */

import type {
  DeviceType,
  NetworkInfo,
  ChunkConfig,
  ChunkMetadata,
  ChunkWithData,
  TransferManifest,
  ManifestAck,
  ChunkBitmap,
  TransferState,
  TransferProgress,
  BinaryChunkHeader,
  CHUNK_HEADER_SIZE
} from '../types/chunking';

import {
  CHUNK_SIZES,
  FILE_SIZE_THRESHOLDS,
  PROTOCOL_VERSION
} from '../types/chunking';

import {
  hashArrayBuffer,
  hashFile,
  uint8ArrayToHex,
  hexToUint8Array,
  type HashProgressCallback
} from './hashService';

import {
  storeChunk,
  getChunk,
  getAllChunks,
  isIndexedDBAvailable
} from './indexedDBService';

// ============================================================================
// Constants
// ============================================================================

/** Header size for binary chunk format */
const HEADER_SIZE = 48;

/** Default ACK batch size (how many chunks before sending ACK) */
const DEFAULT_ACK_BATCH_SIZE = 10;

/** Default buffer watermarks for flow control */
const DEFAULT_BUFFER_LOW_WATERMARK = 64 * 1024; // 64KB
const DEFAULT_BUFFER_HIGH_WATERMARK = 1024 * 1024; // 1MB

/** Maximum retries for failed chunks */
const MAX_CHUNK_RETRIES = 3;

// ============================================================================
// Device Detection
// ============================================================================

/**
 * Detect the current device type
 * @returns Device type: 'mobile', 'tablet', or 'desktop'
 */
export function detectDeviceType(): DeviceType {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|phone/i.test(userAgent);
  const isTablet = /tablet|ipad/i.test(userAgent);
  
  if (isTablet) return 'tablet';
  if (isMobile) return 'mobile';
  return 'desktop';
}

/**
 * Check if the current device is mobile (including tablets)
 */
export function isMobileDevice(): boolean {
  const type = detectDeviceType();
  return type === 'mobile' || type === 'tablet';
}

/**
 * Get network information if available
 */
export function getNetworkInfo(): NetworkInfo {
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;
  
  return {
    effectiveType: connection?.effectiveType || 'unknown',
    downlink: connection?.downlink || 0,
    rtt: connection?.rtt || 0
  };
}

// ============================================================================
// Dynamic Chunk Size Calculation
// ============================================================================

/**
 * Calculate optimal chunk size based on device type, file size, and network
 * 
 * @param fileSize - Size of file in bytes
 * @param deviceType - Type of device
 * @param networkInfo - Optional network information
 * @returns Optimal chunk size in bytes
 */
export function calculateChunkSize(
  fileSize: number,
  deviceType: DeviceType,
  networkInfo?: NetworkInfo
): number {
  // Mobile devices use smaller chunks to prevent memory issues
  if (deviceType === 'mobile' || deviceType === 'tablet') {
    if (fileSize >= FILE_SIZE_THRESHOLDS.MOBILE_LARGE) {
      return CHUNK_SIZES.MOBILE_LARGE; // 16KB
    }
    return CHUNK_SIZES.MOBILE_SMALL; // 8KB
  }
  
  // Desktop devices can handle larger chunks
  if (fileSize >= FILE_SIZE_THRESHOLDS.DESKTOP_LARGE) {
    return CHUNK_SIZES.DESKTOP_LARGE; // 256KB
  }
  
  if (fileSize >= FILE_SIZE_THRESHOLDS.DESKTOP_MEDIUM) {
    return CHUNK_SIZES.DESKTOP_MEDIUM; // 128KB
  }
  
  return CHUNK_SIZES.DESKTOP_SMALL; // 64KB
}

/**
 * Determine whether to use IndexedDB for storage
 * 
 * @param fileSize - Size of file in bytes
 * @param deviceType - Type of device
 * @returns Whether to use IndexedDB
 */
export function shouldUseIndexedDB(
  fileSize: number,
  deviceType: DeviceType
): boolean {
  // Only use IndexedDB if available
  if (!isIndexedDBAvailable()) {
    return false;
  }
  
  // Mobile devices should use IndexedDB for large files
  if (deviceType === 'mobile' || deviceType === 'tablet') {
    return fileSize >= FILE_SIZE_THRESHOLDS.INDEXEDDB_THRESHOLD_MOBILE;
  }
  
  // Desktop can handle larger files in memory
  return false;
}

/**
 * Calculate complete chunk configuration
 * 
 * @param fileSize - Size of file in bytes
 * @param deviceType - Type of device
 * @param networkInfo - Optional network information
 * @returns Complete chunk configuration
 */
export function calculateChunkConfig(
  fileSize: number,
  deviceType: DeviceType,
  networkInfo?: NetworkInfo
): ChunkConfig {
  const chunkSize = calculateChunkSize(fileSize, deviceType, networkInfo);
  const totalChunks = Math.ceil(fileSize / chunkSize);
  const useIndexedDB = shouldUseIndexedDB(fileSize, deviceType);
  
  // Adjust ACK batch size based on chunk count
  let ackBatchSize = DEFAULT_ACK_BATCH_SIZE;
  if (totalChunks < 20) {
    ackBatchSize = 5;
  } else if (totalChunks > 1000) {
    ackBatchSize = 50;
  }
  
  return {
    chunkSize,
    totalChunks,
    useIndexedDB,
    ackBatchSize,
    bufferLowWatermark: DEFAULT_BUFFER_LOW_WATERMARK,
    bufferHighWatermark: DEFAULT_BUFFER_HIGH_WATERMARK
  };
}

/**
 * Negotiate chunk size between sender and receiver
 * Takes the smaller of the two proposed sizes for compatibility
 * 
 * @param senderChunkSize - Sender's proposed chunk size
 * @param receiverChunkSize - Receiver's proposed chunk size
 * @returns Agreed chunk size
 */
export function negotiateChunkSize(
  senderChunkSize: number,
  receiverChunkSize: number
): number {
  // Use the smaller chunk size for compatibility
  return Math.min(senderChunkSize, receiverChunkSize);
}

// ============================================================================
// Transfer Manifest Creation
// ============================================================================

/**
 * Create a transfer manifest for a file
 * 
 * @param file - The file to transfer
 * @param transferId - Unique transfer ID
 * @param onHashProgress - Optional callback for hash progress
 * @returns Transfer manifest
 */
export async function createTransferManifest(
  file: File,
  transferId: string,
  onHashProgress?: HashProgressCallback
): Promise<TransferManifest> {
  const deviceType = detectDeviceType();
  const chunkSize = calculateChunkSize(file.size, deviceType);
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  // Calculate file hash
  const hashResult = await hashFile(file, onHashProgress);
  
  return {
    transferId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    fileHash: hashResult.hex,
    totalChunks,
    chunkSize,
    senderDevice: deviceType,
    proposedChunkSize: chunkSize,
    protocolVersion: PROTOCOL_VERSION,
    timestamp: Date.now()
  };
}

/**
 * Create manifest acknowledgment
 * 
 * @param manifest - Received manifest
 * @returns Manifest acknowledgment
 */
export function createManifestAck(manifest: TransferManifest): ManifestAck {
  const receiverDevice = detectDeviceType();
  const receiverChunkSize = calculateChunkSize(manifest.fileSize, receiverDevice);
  const agreedChunkSize = negotiateChunkSize(manifest.proposedChunkSize, receiverChunkSize);
  const useIndexedDB = shouldUseIndexedDB(manifest.fileSize, receiverDevice);
  const config = calculateChunkConfig(manifest.fileSize, receiverDevice);
  
  return {
    transferId: manifest.transferId,
    agreedChunkSize,
    receiverDevice,
    useIndexedDB,
    ackBatchSize: config.ackBatchSize,
    timestamp: Date.now()
  };
}

// ============================================================================
// Binary Header Encoding/Decoding
// ============================================================================

/**
 * Encode chunk metadata into a binary header
 * 
 * Header format (48 bytes):
 * - Sequence: 4 bytes (Uint32)
 * - Offset: 8 bytes (BigInt64)
 * - Size: 4 bytes (Uint32)
 * - Hash: 32 bytes (raw SHA-256)
 * 
 * @param metadata - Chunk metadata
 * @returns Binary header as Uint8Array
 */
export function encodeChunkHeader(metadata: ChunkMetadata): Uint8Array {
  const header = new ArrayBuffer(HEADER_SIZE);
  const view = new DataView(header);
  
  // Sequence (4 bytes)
  view.setUint32(0, metadata.sequence, true);
  
  // Offset (8 bytes as BigInt64)
  view.setBigInt64(4, BigInt(metadata.offset), true);
  
  // Size (4 bytes)
  view.setUint32(12, metadata.size, true);
  
  // Hash (32 bytes)
  const hashBytes = hexToUint8Array(metadata.hash);
  new Uint8Array(header, 16, 32).set(hashBytes);
  
  return new Uint8Array(header);
}

/**
 * Decode binary header into chunk metadata
 * 
 * @param header - Binary header (first 48 bytes)
 * @returns Decoded chunk metadata (without data)
 */
export function decodeChunkHeader(header: ArrayBuffer): BinaryChunkHeader {
  if (header.byteLength < HEADER_SIZE) {
    throw new Error(`Invalid header size: ${header.byteLength}, expected ${HEADER_SIZE}`);
  }
  
  const view = new DataView(header);
  
  return {
    sequence: view.getUint32(0, true),
    offset: Number(view.getBigInt64(4, true)),
    size: view.getUint32(12, true),
    hash: new Uint8Array(header.slice(16, 48))
  };
}

/**
 * Create a complete binary chunk with header and data
 * 
 * @param metadata - Chunk metadata
 * @param data - Chunk data
 * @returns Complete binary chunk (header + data)
 */
export function createBinaryChunk(metadata: ChunkMetadata, data: ArrayBuffer): ArrayBuffer {
  const header = encodeChunkHeader(metadata);
  const combined = new ArrayBuffer(HEADER_SIZE + data.byteLength);
  
  new Uint8Array(combined, 0, HEADER_SIZE).set(header);
  new Uint8Array(combined, HEADER_SIZE).set(new Uint8Array(data));
  
  return combined;
}

/**
 * Parse a binary chunk into header and data
 * 
 * @param chunk - Complete binary chunk
 * @returns Parsed header and data
 */
export function parseBinaryChunk(chunk: ArrayBuffer): { header: BinaryChunkHeader; data: ArrayBuffer } {
  if (chunk.byteLength < HEADER_SIZE) {
    throw new Error(`Chunk too small: ${chunk.byteLength} bytes`);
  }
  
  const header = decodeChunkHeader(chunk.slice(0, HEADER_SIZE));
  const data = chunk.slice(HEADER_SIZE);
  
  return { header, data };
}

// ============================================================================
// Chunk Generation
// ============================================================================

/**
 * Generate a single chunk with metadata from a file
 * 
 * @param file - Source file
 * @param sequence - Chunk sequence number
 * @param chunkSize - Size of each chunk
 * @returns Chunk with data and metadata
 */
export async function generateChunk(
  file: File,
  sequence: number,
  chunkSize: number
): Promise<ChunkWithData> {
  const offset = sequence * chunkSize;
  const end = Math.min(offset + chunkSize, file.size);
  const slice = file.slice(offset, end);
  const data = await slice.arrayBuffer();
  
  // Calculate hash
  const hashResult = await hashArrayBuffer(data);
  
  return {
    sequence,
    offset,
    size: data.byteLength,
    hash: hashResult.hex,
    timestamp: Date.now(),
    data
  };
}

/**
 * Generate chunk from IndexedDB storage (for resuming transfers)
 * 
 * @param transferId - Transfer ID
 * @param sequence - Chunk sequence number
 * @returns Chunk with data or null if not found
 */
export async function generateChunkFromStorage(
  transferId: string,
  sequence: number
): Promise<ChunkWithData | null> {
  const storedChunk = await getChunk(transferId, sequence);
  if (!storedChunk) {
    return null;
  }
  
  // Recalculate hash if not stored
  let hash = storedChunk.hash;
  if (!hash) {
    const hashResult = await hashArrayBuffer(storedChunk.data);
    hash = hashResult.hex;
  }
  
  return {
    sequence: storedChunk.sequence,
    offset: 0, // Would need to recalculate from sequence and chunk size
    size: storedChunk.data.byteLength,
    hash,
    timestamp: storedChunk.storedAt,
    data: storedChunk.data
  };
}

/**
 * Async generator for iterating over file chunks
 * 
 * @param file - Source file
 * @param chunkSize - Size of each chunk
 * @yields ChunkWithData for each chunk
 */
export async function* chunkGenerator(
  file: File,
  chunkSize: number
): AsyncGenerator<ChunkWithData> {
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  for (let sequence = 0; sequence < totalChunks; sequence++) {
    yield await generateChunk(file, sequence, chunkSize);
  }
}

// ============================================================================
// Chunk Bitmap (Gap Detection)
// ============================================================================

/**
 * Create a new chunk bitmap for tracking received chunks
 * 
 * @param totalChunks - Total number of expected chunks
 * @returns Empty chunk bitmap
 */
export function createChunkBitmap(totalChunks: number): ChunkBitmap {
  return {
    totalChunks,
    received: new Set(),
    lastContiguous: -1
  };
}

/**
 * Mark a chunk as received in the bitmap
 * 
 * @param bitmap - Chunk bitmap to update
 * @param sequence - Sequence number of received chunk
 * @returns Updated bitmap (mutates in place)
 */
export function markChunkReceived(bitmap: ChunkBitmap, sequence: number): ChunkBitmap {
  bitmap.received.add(sequence);
  
  // Update last contiguous if this fills a gap
  if (sequence === bitmap.lastContiguous + 1) {
    // Find new last contiguous
    let newLastContiguous = sequence;
    while (bitmap.received.has(newLastContiguous + 1)) {
      newLastContiguous++;
    }
    bitmap.lastContiguous = newLastContiguous;
  }
  
  return bitmap;
}

/**
 * Detect gaps in received chunks
 * 
 * @param bitmap - Chunk bitmap
 * @param upToSequence - Check for gaps up to this sequence (optional)
 * @returns Array of missing sequence numbers
 */
export function detectGaps(bitmap: ChunkBitmap, upToSequence?: number): number[] {
  const maxSeq = upToSequence ?? bitmap.totalChunks - 1;
  const gaps: number[] = [];
  
  for (let seq = 0; seq <= maxSeq; seq++) {
    if (!bitmap.received.has(seq)) {
      gaps.push(seq);
    }
  }
  
  return gaps;
}

/**
 * Check if all chunks have been received
 * 
 * @param bitmap - Chunk bitmap
 * @returns true if complete
 */
export function isTransferComplete(bitmap: ChunkBitmap): boolean {
  return bitmap.received.size === bitmap.totalChunks &&
         bitmap.lastContiguous === bitmap.totalChunks - 1;
}

/**
 * Get transfer progress from bitmap
 * 
 * @param bitmap - Chunk bitmap
 * @param chunkSize - Size of each chunk
 * @param fileSize - Total file size
 * @param startTime - Transfer start timestamp
 * @param transferId - Transfer ID
 * @returns Transfer progress object
 */
export function getProgressFromBitmap(
  bitmap: ChunkBitmap,
  chunkSize: number,
  fileSize: number,
  startTime: number,
  transferId: string
): TransferProgress {
  const chunksTransferred = bitmap.received.size;
  const bytesTransferred = Math.min(chunksTransferred * chunkSize, fileSize);
  const percentage = (chunksTransferred / bitmap.totalChunks) * 100;
  
  const elapsed = (Date.now() - startTime) / 1000; // seconds
  const speed = elapsed > 0 ? bytesTransferred / elapsed : 0;
  const remaining = fileSize - bytesTransferred;
  const eta = speed > 0 ? remaining / speed : 0;
  
  // Count gaps up to last received chunk
  const maxReceived = Math.max(...Array.from(bitmap.received));
  const gaps = detectGaps(bitmap, maxReceived);
  
  return {
    transferId,
    percentage: Math.round(percentage * 100) / 100,
    bytesTransferred,
    totalBytes: fileSize,
    chunksTransferred,
    totalChunks: bitmap.totalChunks,
    speed: Math.round(speed),
    eta: Math.round(eta),
    resendCount: 0, // Would need to track separately
    gapsDetected: gaps.length
  };
}

// ============================================================================
// Transfer State Management
// ============================================================================

/**
 * Create initial transfer state for receiving
 * 
 * @param manifest - Transfer manifest
 * @returns Initial transfer state
 */
export function createTransferState(manifest: TransferManifest): TransferState {
  return {
    transferId: manifest.transferId,
    manifest,
    bitmap: createChunkBitmap(manifest.totalChunks),
    pendingChunks: new Map(),
    startTime: Date.now(),
    lastActivity: Date.now(),
    status: 'negotiating',
    retryCount: 0,
    maxRetries: MAX_CHUNK_RETRIES
  };
}

/**
 * Update transfer state with received chunk
 * 
 * @param state - Current transfer state
 * @param chunk - Received chunk
 * @returns Updated state (mutates in place)
 */
export function updateTransferState(
  state: TransferState,
  chunk: ChunkWithData
): TransferState {
  markChunkReceived(state.bitmap, chunk.sequence);
  state.lastActivity = Date.now();
  
  // Check if complete
  if (isTransferComplete(state.bitmap)) {
    state.status = 'completing';
  }
  
  return state;
}

// ============================================================================
// Chunk Assembly
// ============================================================================

/**
 * Assemble chunks from memory into a Blob
 * 
 * @param chunks - Map of sequence -> chunk data
 * @param manifest - Transfer manifest
 * @returns Assembled Blob
 */
export function assembleChunksFromMemory(
  chunks: Map<number, ArrayBuffer>,
  manifest: TransferManifest
): Blob {
  // Verify all chunks present
  if (chunks.size !== manifest.totalChunks) {
    throw new Error(
      `Missing chunks: expected ${manifest.totalChunks}, got ${chunks.size}`
    );
  }
  
  // Collect chunks in order
  const orderedChunks: ArrayBuffer[] = [];
  for (let seq = 0; seq < manifest.totalChunks; seq++) {
    const chunk = chunks.get(seq);
    if (!chunk) {
      throw new Error(`Missing chunk at sequence ${seq}`);
    }
    orderedChunks.push(chunk);
  }
  
  return new Blob(orderedChunks, { type: manifest.fileType });
}

/**
 * Assemble chunks into a File object
 * 
 * @param chunks - Map of sequence -> chunk data
 * @param manifest - Transfer manifest
 * @returns Assembled File
 */
export function assembleChunksToFile(
  chunks: Map<number, ArrayBuffer>,
  manifest: TransferManifest
): File {
  const blob = assembleChunksFromMemory(chunks, manifest);
  return new File([blob], manifest.fileName, { type: manifest.fileType });
}

// ============================================================================
// Chunk Verification
// ============================================================================

/**
 * Verify a chunk's hash
 * 
 * @param data - Chunk data
 * @param expectedHash - Expected hash (hex string or Uint8Array)
 * @returns true if hash matches
 */
export async function verifyChunkHash(
  data: ArrayBuffer,
  expectedHash: string | Uint8Array
): Promise<boolean> {
  const hashResult = await hashArrayBuffer(data);
  
  if (typeof expectedHash === 'string') {
    return hashResult.hex === expectedHash.toLowerCase();
  }
  
  const expectedHex = uint8ArrayToHex(expectedHash);
  return hashResult.hex === expectedHex.toLowerCase();
}

/**
 * Verify received binary chunk (header hash vs computed hash)
 * 
 * @param chunk - Complete binary chunk with header
 * @returns Object with verification result and parsed data
 */
export async function verifyBinaryChunk(chunk: ArrayBuffer): Promise<{
  valid: boolean;
  header: BinaryChunkHeader;
  data: ArrayBuffer;
  computedHash: string;
}> {
  const { header, data } = parseBinaryChunk(chunk);
  const hashResult = await hashArrayBuffer(data);
  const headerHashHex = uint8ArrayToHex(header.hash);
  
  return {
    valid: hashResult.hex === headerHashHex.toLowerCase(),
    header,
    data,
    computedHash: hashResult.hex
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

export {
  HEADER_SIZE,
  DEFAULT_ACK_BATCH_SIZE,
  DEFAULT_BUFFER_LOW_WATERMARK,
  DEFAULT_BUFFER_HIGH_WATERMARK,
  MAX_CHUNK_RETRIES
};

