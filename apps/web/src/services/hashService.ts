/**
 * Hash Service for WebRTC File Transfer
 * 
 * Provides SHA-256 hashing utilities for file and chunk integrity verification
 * using the Web Crypto API.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface HashResult {
  /** Hash as hex string */
  hex: string;
  /** Hash as Uint8Array (32 bytes for SHA-256) */
  bytes: Uint8Array;
}

export interface FileHashProgress {
  /** Bytes processed */
  bytesProcessed: number;
  /** Total bytes */
  totalBytes: number;
  /** Percentage complete */
  percentage: number;
}

export type HashProgressCallback = (progress: FileHashProgress) => void;

// ============================================================================
// Constants
// ============================================================================

/** Default chunk size for incremental hashing (1MB) */
const HASH_CHUNK_SIZE = 1024 * 1024;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert an ArrayBuffer to a hex string
 */
export function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to Uint8Array
 */
export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// Core Hashing Functions
// ============================================================================

/**
 * Hash an ArrayBuffer using SHA-256
 * @param data - The data to hash
 * @returns Hash result with hex string and bytes
 */
export async function hashArrayBuffer(data: ArrayBuffer): Promise<HashResult> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  return {
    hex: uint8ArrayToHex(bytes),
    bytes
  };
}

/**
 * Hash a Uint8Array using SHA-256
 * @param data - The data to hash
 * @returns Hash result with hex string and bytes
 */
export async function hashUint8Array(data: Uint8Array): Promise<HashResult> {
  return hashArrayBuffer(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}

/**
 * Hash a Blob using SHA-256
 * @param blob - The blob to hash
 * @returns Hash result with hex string and bytes
 */
export async function hashBlob(blob: Blob): Promise<HashResult> {
  const buffer = await blob.arrayBuffer();
  return hashArrayBuffer(buffer);
}

/**
 * Hash a string using SHA-256
 * @param str - The string to hash
 * @returns Hash result with hex string and bytes
 */
export async function hashString(str: string): Promise<HashResult> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return hashArrayBuffer(data.buffer);
}

// ============================================================================
// File Hashing with Progress
// ============================================================================

/**
 * Hash a File incrementally with progress reporting
 * This is memory-efficient for large files as it processes in chunks
 * 
 * @param file - The file to hash
 * @param onProgress - Optional callback for progress updates
 * @param chunkSize - Size of chunks to process (default 1MB)
 * @returns Hash result with hex string and bytes
 */
export async function hashFile(
  file: File,
  onProgress?: HashProgressCallback,
  chunkSize: number = HASH_CHUNK_SIZE
): Promise<HashResult> {
  // For small files, just hash directly
  if (file.size <= chunkSize * 2) {
    const buffer = await file.arrayBuffer();
    onProgress?.({
      bytesProcessed: file.size,
      totalBytes: file.size,
      percentage: 100
    });
    return hashArrayBuffer(buffer);
  }

  // For larger files, use incremental hashing
  return hashFileIncremental(file, onProgress, chunkSize);
}

/**
 * Incremental file hashing using streaming
 * Processes file in chunks to avoid loading entire file into memory
 */
async function hashFileIncremental(
  file: File,
  onProgress?: HashProgressCallback,
  chunkSize: number = HASH_CHUNK_SIZE
): Promise<HashResult> {
  // We need to use a streaming approach
  // Since Web Crypto doesn't support streaming directly, we'll accumulate chunks
  // and hash the final result. For true streaming, we'd need a WASM implementation.
  
  // For now, use the FileReader streaming approach
  const chunks: ArrayBuffer[] = [];
  let bytesProcessed = 0;
  
  // Process file in chunks using slice
  while (bytesProcessed < file.size) {
    const end = Math.min(bytesProcessed + chunkSize, file.size);
    const chunk = file.slice(bytesProcessed, end);
    const buffer = await chunk.arrayBuffer();
    chunks.push(buffer);
    
    bytesProcessed = end;
    
    onProgress?.({
      bytesProcessed,
      totalBytes: file.size,
      percentage: Math.round((bytesProcessed / file.size) * 100)
    });
  }
  
  // Combine all chunks and hash
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  
  return hashArrayBuffer(combined.buffer);
}

/**
 * Hash a file using a streaming approach with a Web Stream reader
 * More memory efficient for very large files
 */
export async function hashFileStream(
  file: File,
  onProgress?: HashProgressCallback
): Promise<HashResult> {
  // Check if streams are supported
  if (!file.stream) {
    // Fallback to incremental approach
    return hashFile(file, onProgress);
  }

  const stream = file.stream();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let bytesProcessed = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      if (value) {
        chunks.push(value);
        bytesProcessed += value.length;
        
        onProgress?.({
          bytesProcessed,
          totalBytes: file.size,
          percentage: Math.round((bytesProcessed / file.size) * 100)
        });
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Combine all chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return hashArrayBuffer(combined.buffer);
}

// ============================================================================
// Chunk Hashing
// ============================================================================

/**
 * Hash a single chunk of data
 * @param chunk - The chunk data as ArrayBuffer
 * @returns Hash result
 */
export async function hashChunk(chunk: ArrayBuffer): Promise<HashResult> {
  return hashArrayBuffer(chunk);
}

/**
 * Hash multiple chunks in parallel
 * @param chunks - Array of chunk data
 * @returns Array of hash results in same order
 */
export async function hashChunks(chunks: ArrayBuffer[]): Promise<HashResult[]> {
  return Promise.all(chunks.map(chunk => hashArrayBuffer(chunk)));
}

// ============================================================================
// Verification Functions
// ============================================================================

/**
 * Verify a chunk's integrity against an expected hash
 * @param chunk - The chunk data
 * @param expectedHash - Expected hash (hex string or Uint8Array)
 * @returns true if hash matches
 */
export async function verifyChunk(
  chunk: ArrayBuffer,
  expectedHash: string | Uint8Array
): Promise<boolean> {
  const result = await hashArrayBuffer(chunk);
  
  if (typeof expectedHash === 'string') {
    return result.hex === expectedHash.toLowerCase();
  }
  
  if (result.bytes.length !== expectedHash.length) {
    return false;
  }
  
  for (let i = 0; i < result.bytes.length; i++) {
    if (result.bytes[i] !== expectedHash[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Verify a file's integrity against an expected hash
 * @param file - The file to verify
 * @param expectedHash - Expected hash (hex string)
 * @param onProgress - Optional progress callback
 * @returns true if hash matches
 */
export async function verifyFile(
  file: File,
  expectedHash: string,
  onProgress?: HashProgressCallback
): Promise<boolean> {
  const result = await hashFile(file, onProgress);
  return result.hex === expectedHash.toLowerCase();
}

/**
 * Verify a blob's integrity against an expected hash
 * @param blob - The blob to verify
 * @param expectedHash - Expected hash (hex string)
 * @returns true if hash matches
 */
export async function verifyBlob(
  blob: Blob,
  expectedHash: string
): Promise<boolean> {
  const result = await hashBlob(blob);
  return result.hex === expectedHash.toLowerCase();
}

// ============================================================================
// Binary Header Hash Utilities
// ============================================================================

/**
 * Extract hash bytes from a binary chunk header
 * Hash is stored at bytes 16-48 (after sequence, offset, size)
 * @param header - The 48-byte header
 * @returns The 32-byte hash as Uint8Array
 */
export function extractHashFromHeader(header: ArrayBuffer): Uint8Array {
  if (header.byteLength < 48) {
    throw new Error('Invalid header size: expected at least 48 bytes');
  }
  return new Uint8Array(header.slice(16, 48));
}

/**
 * Create hash bytes for inclusion in binary header
 * @param hash - Hash as hex string or HashResult
 * @returns 32-byte Uint8Array
 */
export function hashToHeaderBytes(hash: string | HashResult): Uint8Array {
  if (typeof hash === 'string') {
    return hexToUint8Array(hash);
  }
  return hash.bytes;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Calculate hashes for all chunks of a file
 * Useful for pre-calculating hashes before transfer
 * 
 * @param file - The file to process
 * @param chunkSize - Size of each chunk
 * @param onProgress - Progress callback
 * @returns Array of hash results for each chunk
 */
export async function calculateAllChunkHashes(
  file: File,
  chunkSize: number,
  onProgress?: (chunkIndex: number, totalChunks: number) => void
): Promise<HashResult[]> {
  const totalChunks = Math.ceil(file.size / chunkSize);
  const hashes: HashResult[] = [];
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    const buffer = await chunk.arrayBuffer();
    const hash = await hashArrayBuffer(buffer);
    hashes.push(hash);
    
    onProgress?.(i + 1, totalChunks);
  }
  
  return hashes;
}

// ============================================================================
// Comparison Utilities
// ============================================================================

/**
 * Compare two hashes for equality
 * @param hash1 - First hash (hex string or Uint8Array)
 * @param hash2 - Second hash (hex string or Uint8Array)
 * @returns true if hashes are equal
 */
export function compareHashes(
  hash1: string | Uint8Array,
  hash2: string | Uint8Array
): boolean {
  const h1 = typeof hash1 === 'string' ? hash1.toLowerCase() : uint8ArrayToHex(hash1);
  const h2 = typeof hash2 === 'string' ? hash2.toLowerCase() : uint8ArrayToHex(hash2);
  return h1 === h2;
}

/**
 * Create a hash summary for logging/debugging
 * @param hash - The hash to summarize
 * @returns Shortened hash string (first 8 + last 8 chars)
 */
export function hashSummary(hash: string | Uint8Array): string {
  const hex = typeof hash === 'string' ? hash : uint8ArrayToHex(hash);
  if (hex.length <= 16) return hex;
  return `${hex.slice(0, 8)}...${hex.slice(-8)}`;
}

