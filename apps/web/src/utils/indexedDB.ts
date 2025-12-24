import { INDEXEDDB_CONSTANTS } from '@sharedrop/config';

const { INDEXEDDB_NAME, INDEXEDDB_VERSION } = INDEXEDDB_CONSTANTS;

let dbInstance: IDBDatabase | null = null;

export interface IncomingMetadata {
  name: string;
  size: number;
  type: string;
  chunkCount: number;
}

/**
 * Initialize IndexedDB database
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this browser'));
      return;
    }

    const request = indexedDB.open(INDEXEDDB_NAME, INDEXEDDB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('outgoing-files')) {
        db.createObjectStore('outgoing-files', { keyPath: 'fileId' });
      }

      if (!db.objectStoreNames.contains('incoming-chunks')) {
        const chunkStore = db.createObjectStore('incoming-chunks', { keyPath: 'key' });
        chunkStore.createIndex('transferId', 'transferId', { unique: false });
      }

      if (!db.objectStoreNames.contains('incoming-metadata')) {
        db.createObjectStore('incoming-metadata', { keyPath: 'transferId' });
      }
    };
  });
};

/**
 * Store an outgoing file to IndexedDB
 */
export const storeOutgoingFile = async (fileId: string, file: File): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['outgoing-files'], 'readwrite');
    const store = transaction.objectStore('outgoing-files');
    
    const request = store.put({
      fileId,
      file,
      metadata: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      }
    });

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to store outgoing file: ${request.error?.message}`));
    };
  });
};

/**
 * Get an outgoing file from IndexedDB
 */
export const getOutgoingFile = async (fileId: string): Promise<File> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['outgoing-files'], 'readonly');
    const store = transaction.objectStore('outgoing-files');
    const request = store.get(fileId);

    request.onsuccess = () => {
      const result = request.result;
      if (result && result.file) {
        resolve(result.file);
      } else {
        reject(new Error(`File not found in IndexedDB: ${fileId}`));
      }
    };

    request.onerror = () => {
      reject(new Error(`Failed to get outgoing file: ${request.error?.message}`));
    };
  });
};

/**
 * Delete an outgoing file from IndexedDB
 */
export const deleteOutgoingFile = async (fileId: string): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['outgoing-files'], 'readwrite');
    const store = transaction.objectStore('outgoing-files');
    const request = store.delete(fileId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to delete outgoing file: ${request.error?.message}`));
    };
  });
};

/**
 * Store incoming file metadata
 */
export const storeIncomingMetadata = async (
  transferId: string,
  metadata: IncomingMetadata
): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['incoming-metadata'], 'readwrite');
    const store = transaction.objectStore('incoming-metadata');
    
    const request = store.put({
      transferId,
      ...metadata
    });

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to store incoming metadata: ${request.error?.message}`));
    };
  });
};

/**
 * Get incoming file metadata
 */
export const getIncomingMetadata = async (transferId: string): Promise<IncomingMetadata> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['incoming-metadata'], 'readonly');
    const store = transaction.objectStore('incoming-metadata');
    const request = store.get(transferId);

    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        const { transferId: _, ...metadata } = result;
        resolve(metadata);
      } else {
        reject(new Error(`Metadata not found in IndexedDB: ${transferId}`));
      }
    };

    request.onerror = () => {
      reject(new Error(`Failed to get incoming metadata: ${request.error?.message}`));
    };
  });
};

/**
 * Store an incoming chunk to IndexedDB
 */
export const storeIncomingChunk = async (
  transferId: string,
  chunkIndex: number,
  chunk: ArrayBuffer
): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['incoming-chunks'], 'readwrite');
    const store = transaction.objectStore('incoming-chunks');
    
    const key = `${transferId}-${chunkIndex}`;
    const request = store.put({
      key,
      transferId,
      chunkIndex,
      chunk
    });

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to store incoming chunk: ${request.error?.message}`));
    };
  });
};

/**
 * Get an incoming chunk from IndexedDB
 */
export const getIncomingChunk = async (
  transferId: string,
  chunkIndex: number
): Promise<ArrayBuffer> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['incoming-chunks'], 'readonly');
    const store = transaction.objectStore('incoming-chunks');
    const key = `${transferId}-${chunkIndex}`;
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result;
      if (result && result.chunk) {
        resolve(result.chunk);
      } else {
        reject(new Error(`Chunk not found in IndexedDB: ${key}`));
      }
    };

    request.onerror = () => {
      reject(new Error(`Failed to get incoming chunk: ${request.error?.message}`));
    };
  });
};

/**
 * Reconstruct a file from IndexedDB chunks
 */
export const reconstructFileFromIDB = async (transferId: string): Promise<Blob> => {
  const db = await initDB();
  const metadata = await getIncomingMetadata(transferId);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['incoming-chunks'], 'readonly');
    const store = transaction.objectStore('incoming-chunks');
    const index = store.index('transferId');
    const request = index.getAll(transferId);

    request.onsuccess = () => {
      const chunks = request.result;
      
      // Sort chunks by chunkIndex
      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      
      // Extract chunk data
      const chunkData = chunks.map(item => item.chunk);
      
      // Create blob from chunks
      const blob = new Blob(chunkData, { type: metadata.type });
      
      resolve(blob);
    };

    request.onerror = () => {
      reject(new Error(`Failed to reconstruct file: ${request.error?.message}`));
    };
  });
};

/**
 * Clean up all IndexedDB entries for a transfer
 */
export const cleanupTransfer = async (transferId: string): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      ['incoming-metadata', 'incoming-chunks'],
      'readwrite'
    );
    
    let completed = 0;
    const total = 2;
    
    const checkComplete = () => {
      completed++;
      if (completed === total) {
        resolve();
      }
    };

    // Delete metadata
    const metadataStore = transaction.objectStore('incoming-metadata');
    const metadataRequest = metadataStore.delete(transferId);
    metadataRequest.onsuccess = checkComplete;
    metadataRequest.onerror = () => {
      // Continue even if metadata deletion fails
      checkComplete();
    };

    // Delete all chunks
    const chunkStore = transaction.objectStore('incoming-chunks');
    const index = chunkStore.index('transferId');
    const chunkRequest = index.openCursor(IDBKeyRange.only(transferId));
    
    chunkRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        checkComplete();
      }
    };
    
    chunkRequest.onerror = () => {
      // Continue even if chunk deletion fails
      checkComplete();
    };

    transaction.onerror = () => {
      reject(new Error(`Failed to cleanup transfer: ${transaction.error?.message}`));
    };
  });
};

