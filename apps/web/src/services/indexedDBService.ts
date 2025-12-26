/**
 * IndexedDB Service for WebRTC File Transfer
 * 
 * Provides storage for large file chunks on mobile devices to prevent
 * memory issues during file transfer.
 */

import type { 
  StoredChunk, 
  StoredTransfer, 
  TransferManifest,
  ChunkBitmap 
} from '../types/chunking';

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = 'ShareDropFileTransfer';
const DB_VERSION = 1;

// Object store names
const STORES = {
  CHUNKS: 'chunks',
  TRANSFERS: 'transfers',
  FILES: 'files'
} as const;

// ============================================================================
// Database Instance
// ============================================================================

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

// ============================================================================
// Database Initialization
// ============================================================================

/**
 * Initialize the IndexedDB database
 * @returns Promise resolving to the database instance
 */
export async function initDB(): Promise<IDBDatabase> {
  // Return existing instance if available
  if (dbInstance) {
    return dbInstance;
  }

  // Return pending initialization if in progress
  if (dbInitPromise) {
    return dbInitPromise;
  }

  // Start initialization
  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('❌ IndexedDB error:', request.error);
      dbInitPromise = null;
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('✅ IndexedDB initialized');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create chunks store
      if (!db.objectStoreNames.contains(STORES.CHUNKS)) {
        const chunksStore = db.createObjectStore(STORES.CHUNKS, { keyPath: 'id' });
        chunksStore.createIndex('transferId', 'transferId', { unique: false });
        chunksStore.createIndex('sequence', 'sequence', { unique: false });
        chunksStore.createIndex('transferId_sequence', ['transferId', 'sequence'], { unique: true });
      }

      // Create transfers store
      if (!db.objectStoreNames.contains(STORES.TRANSFERS)) {
        const transfersStore = db.createObjectStore(STORES.TRANSFERS, { keyPath: 'transferId' });
        transfersStore.createIndex('state', 'state', { unique: false });
        transfersStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Create files store (for storing complete files temporarily)
      if (!db.objectStoreNames.contains(STORES.FILES)) {
        const filesStore = db.createObjectStore(STORES.FILES, { keyPath: 'transferId' });
        filesStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      console.log('✅ IndexedDB schema upgraded to version', DB_VERSION);
    };
  });

  return dbInitPromise;
}

/**
 * Close the database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbInitPromise = null;
    console.log('🔒 IndexedDB closed');
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// ============================================================================
// Chunk Storage Operations
// ============================================================================

/**
 * Store a chunk in IndexedDB
 * @param transferId - Transfer ID
 * @param sequence - Chunk sequence number
 * @param data - Chunk data
 * @param hash - Chunk hash
 */
export async function storeChunk(
  transferId: string,
  sequence: number,
  data: ArrayBuffer,
  hash: string
): Promise<void> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CHUNKS, 'readwrite');
    const store = transaction.objectStore(STORES.CHUNKS);
    
    const chunk: StoredChunk = {
      id: `${transferId}-${sequence}`,
      transferId,
      sequence,
      data,
      hash,
      storedAt: Date.now()
    };
    
    const request = store.put(chunk);
    
    request.onerror = () => {
      reject(new Error(`Failed to store chunk: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Retrieve a chunk from IndexedDB
 * @param transferId - Transfer ID
 * @param sequence - Chunk sequence number
 * @returns The stored chunk or null if not found
 */
export async function getChunk(
  transferId: string,
  sequence: number
): Promise<StoredChunk | null> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CHUNKS, 'readonly');
    const store = transaction.objectStore(STORES.CHUNKS);
    const request = store.get(`${transferId}-${sequence}`);
    
    request.onerror = () => {
      reject(new Error(`Failed to get chunk: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * Get all chunks for a transfer
 * @param transferId - Transfer ID
 * @returns Array of stored chunks sorted by sequence
 */
export async function getAllChunks(transferId: string): Promise<StoredChunk[]> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CHUNKS, 'readonly');
    const store = transaction.objectStore(STORES.CHUNKS);
    const index = store.index('transferId');
    const request = index.getAll(transferId);
    
    request.onerror = () => {
      reject(new Error(`Failed to get chunks: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      const chunks = request.result || [];
      // Sort by sequence number
      chunks.sort((a, b) => a.sequence - b.sequence);
      resolve(chunks);
    };
  });
}

/**
 * Get chunk count for a transfer
 * @param transferId - Transfer ID
 * @returns Number of chunks stored
 */
export async function getChunkCount(transferId: string): Promise<number> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CHUNKS, 'readonly');
    const store = transaction.objectStore(STORES.CHUNKS);
    const index = store.index('transferId');
    const request = index.count(transferId);
    
    request.onerror = () => {
      reject(new Error(`Failed to count chunks: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/**
 * Delete a specific chunk
 * @param transferId - Transfer ID
 * @param sequence - Chunk sequence number
 */
export async function deleteChunk(
  transferId: string,
  sequence: number
): Promise<void> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CHUNKS, 'readwrite');
    const store = transaction.objectStore(STORES.CHUNKS);
    const request = store.delete(`${transferId}-${sequence}`);
    
    request.onerror = () => {
      reject(new Error(`Failed to delete chunk: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Delete all chunks for a transfer
 * @param transferId - Transfer ID
 */
export async function deleteAllChunks(transferId: string): Promise<void> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.CHUNKS, 'readwrite');
    const store = transaction.objectStore(STORES.CHUNKS);
    const index = store.index('transferId');
    const request = index.openCursor(transferId);
    
    request.onerror = () => {
      reject(new Error(`Failed to delete chunks: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
  });
}

// ============================================================================
// Transfer State Operations
// ============================================================================

/**
 * Store transfer state
 * @param transfer - Transfer state to store
 */
export async function storeTransfer(transfer: StoredTransfer): Promise<void> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TRANSFERS, 'readwrite');
    const store = transaction.objectStore(STORES.TRANSFERS);
    const request = store.put(transfer);
    
    request.onerror = () => {
      reject(new Error(`Failed to store transfer: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Get transfer state
 * @param transferId - Transfer ID
 * @returns Transfer state or null if not found
 */
export async function getTransfer(transferId: string): Promise<StoredTransfer | null> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TRANSFERS, 'readonly');
    const store = transaction.objectStore(STORES.TRANSFERS);
    const request = store.get(transferId);
    
    request.onerror = () => {
      reject(new Error(`Failed to get transfer: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * Update transfer state
 * @param transferId - Transfer ID
 * @param updates - Partial transfer updates
 */
export async function updateTransfer(
  transferId: string,
  updates: Partial<Omit<StoredTransfer, 'transferId'>>
): Promise<void> {
  const existing = await getTransfer(transferId);
  if (!existing) {
    throw new Error(`Transfer not found: ${transferId}`);
  }
  
  const updated: StoredTransfer = {
    ...existing,
    ...updates,
    updatedAt: Date.now()
  };
  
  await storeTransfer(updated);
}

/**
 * Delete transfer state
 * @param transferId - Transfer ID
 */
export async function deleteTransfer(transferId: string): Promise<void> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TRANSFERS, 'readwrite');
    const store = transaction.objectStore(STORES.TRANSFERS);
    const request = store.delete(transferId);
    
    request.onerror = () => {
      reject(new Error(`Failed to delete transfer: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Get all incomplete transfers
 * @returns Array of incomplete transfer states
 */
export async function getIncompleteTransfers(): Promise<StoredTransfer[]> {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TRANSFERS, 'readonly');
    const store = transaction.objectStore(STORES.TRANSFERS);
    const request = store.getAll();
    
    request.onerror = () => {
      reject(new Error(`Failed to get transfers: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      const transfers = (request.result || []).filter(
        t => t.state !== 'completed' && t.state !== 'failed'
      );
      resolve(transfers);
    };
  });
}

// ============================================================================
// File Assembly Operations
// ============================================================================

/**
 * Assemble a complete file from stored chunks
 * @param transferId - Transfer ID
 * @param manifest - Transfer manifest with file info
 * @returns The assembled Blob
 */
export async function assembleFile(
  transferId: string,
  manifest: TransferManifest
): Promise<Blob> {
  const chunks = await getAllChunks(transferId);
  
  if (chunks.length !== manifest.totalChunks) {
    throw new Error(
      `Incomplete transfer: expected ${manifest.totalChunks} chunks, got ${chunks.length}`
    );
  }
  
  // Verify all chunks are present and in order
  for (let i = 0; i < manifest.totalChunks; i++) {
    if (!chunks[i] || chunks[i].sequence !== i) {
      throw new Error(`Missing or out-of-order chunk at sequence ${i}`);
    }
  }
  
  // Combine all chunk data
  const blobParts = chunks.map(chunk => chunk.data);
  return new Blob(blobParts, { type: manifest.fileType });
}

/**
 * Create a File object from stored chunks
 * @param transferId - Transfer ID
 * @param manifest - Transfer manifest with file info
 * @returns The assembled File
 */
export async function assembleFileObject(
  transferId: string,
  manifest: TransferManifest
): Promise<File> {
  const blob = await assembleFile(transferId, manifest);
  return new File([blob], manifest.fileName, { type: manifest.fileType });
}

/**
 * Store a complete file for sending (splits into chunks)
 * @param transferId - Transfer ID
 * @param file - File to store
 * @param chunkSize - Size of each chunk
 */
export async function storeFileForSending(
  transferId: string,
  file: File,
  chunkSize: number
): Promise<void> {
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    const buffer = await chunk.arrayBuffer();
    
    // We'll compute hash on the fly when sending
    await storeChunk(transferId, i, buffer, '');
  }
}

/**
 * Read a chunk from a stored file for sending
 * @param transferId - Transfer ID
 * @param sequence - Chunk sequence number
 * @returns The chunk data or null if not found
 */
export async function readChunkForSending(
  transferId: string,
  sequence: number
): Promise<ArrayBuffer | null> {
  const chunk = await getChunk(transferId, sequence);
  return chunk?.data || null;
}

// ============================================================================
// Bitmap Serialization
// ============================================================================

/**
 * Serialize a ChunkBitmap to an array for storage
 * @param bitmap - The chunk bitmap
 * @returns Array of received sequence numbers
 */
export function serializeBitmap(bitmap: ChunkBitmap): number[] {
  return Array.from(bitmap.received);
}

/**
 * Deserialize a bitmap array back to ChunkBitmap
 * @param array - Array of received sequence numbers
 * @param totalChunks - Total number of expected chunks
 * @returns ChunkBitmap instance
 */
export function deserializeBitmap(array: number[], totalChunks: number): ChunkBitmap {
  const received = new Set(array);
  
  // Calculate last contiguous sequence
  let lastContiguous = -1;
  for (let i = 0; i < totalChunks; i++) {
    if (received.has(i)) {
      lastContiguous = i;
    } else {
      break;
    }
  }
  
  return {
    totalChunks,
    received,
    lastContiguous
  };
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Clean up all data for a transfer
 * @param transferId - Transfer ID
 */
export async function cleanupTransfer(transferId: string): Promise<void> {
  await Promise.all([
    deleteAllChunks(transferId),
    deleteTransfer(transferId)
  ]);
  console.log(`🧹 Cleaned up transfer: ${transferId}`);
}

/**
 * Clean up old incomplete transfers (older than specified age)
 * @param maxAgeMs - Maximum age in milliseconds (default 24 hours)
 */
export async function cleanupOldTransfers(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
  const db = await initDB();
  const cutoff = Date.now() - maxAgeMs;
  
  const transfers = await getIncompleteTransfers();
  const oldTransfers = transfers.filter(t => t.createdAt < cutoff);
  
  for (const transfer of oldTransfers) {
    await cleanupTransfer(transfer.transferId);
  }
  
  if (oldTransfers.length > 0) {
    console.log(`🧹 Cleaned up ${oldTransfers.length} old transfers`);
  }
}

/**
 * Get storage usage statistics
 * @returns Object with storage statistics
 */
export async function getStorageStats(): Promise<{
  chunksCount: number;
  transfersCount: number;
  estimatedSize: number;
}> {
  const db = await initDB();
  
  const getCount = (storeName: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  };
  
  const [chunksCount, transfersCount] = await Promise.all([
    getCount(STORES.CHUNKS),
    getCount(STORES.TRANSFERS)
  ]);
  
  // Estimate size (rough calculation)
  // This is a rough estimate as IndexedDB doesn't provide exact storage info easily
  const estimatedSize = await estimateStorageSize();
  
  return {
    chunksCount,
    transfersCount,
    estimatedSize
  };
}

/**
 * Estimate total storage size used
 */
async function estimateStorageSize(): Promise<number> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage || 0;
  }
  return 0;
}

/**
 * Clear all data from IndexedDB
 * WARNING: This will delete all stored transfers and chunks
 */
export async function clearAllData(): Promise<void> {
  const db = await initDB();
  
  const clearStore = (storeName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  };
  
  await Promise.all([
    clearStore(STORES.CHUNKS),
    clearStore(STORES.TRANSFERS),
    clearStore(STORES.FILES)
  ]);
  
  console.log('🧹 All IndexedDB data cleared');
}

// ============================================================================
// Export Database Instance Getter
// ============================================================================

/**
 * Get the database instance (for advanced operations)
 * @returns The database instance or null if not initialized
 */
export function getDBInstance(): IDBDatabase | null {
  return dbInstance;
}

