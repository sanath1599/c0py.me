/**
 * useChunkedTransfer Hook
 * 
 * Encapsulates the robust chunking system for WebRTC file transfer.
 * Handles:
 * - Dynamic chunk sizing and negotiation
 * - Chunk generation with metadata
 * - Gap detection and recovery
 * - Hash-based integrity verification
 * - Pause/resume functionality
 * - IndexedDB storage for large files on mobile
 */

import { useRef, useState, useCallback } from 'react';
import type {
  TransferManifest,
  ManifestAck,
  ChunkACK,
  ResendRequest,
  TransferEnd,
  TransferComplete,
  TransferFailed,
  TransferProtocolMessage,
  ChunkBitmap,
  TransferState,
  TransferProgress,
  ChunkWithData,
  BinaryChunkHeader
} from '../types/chunking';

import {
  detectDeviceType,
  calculateChunkConfig,
  createTransferManifest,
  createManifestAck,
  encodeChunkHeader,
  parseBinaryChunk,
  createBinaryChunk,
  generateChunk,
  createChunkBitmap,
  markChunkReceived,
  detectGaps,
  isTransferComplete,
  getProgressFromBitmap,
  createTransferState,
  updateTransferState,
  assembleChunksToFile,
  verifyBinaryChunk,
  negotiateChunkSize,
  HEADER_SIZE,
  DEFAULT_ACK_BATCH_SIZE
} from '../services/chunkingService';

import {
  hashFile,
  hashArrayBuffer,
  verifyBlob,
  hashSummary
} from '../services/hashService';

import {
  storeChunk as storeChunkToDB,
  getAllChunks,
  cleanupTransfer,
  storeTransfer,
  updateTransfer,
  assembleFileObject,
  serializeBitmap,
  deserializeBitmap,
  isIndexedDBAvailable
} from '../services/indexedDBService';

// ============================================================================
// Types
// ============================================================================

export interface ChunkedTransferOptions {
  /** Callback for progress updates */
  onProgress?: (progress: TransferProgress) => void;
  /** Callback when transfer completes */
  onComplete?: (file: File, transferId: string) => void;
  /** Callback when transfer fails */
  onError?: (error: string, transferId: string) => void;
  /** Callback for logging/debugging */
  onLog?: (message: string) => void;
  /** Throttle interval for progress updates (ms) */
  progressThrottleMs?: number;
}

export interface SendTransferContext {
  transferId: string;
  file: File;
  manifest: TransferManifest;
  chunkSize: number;
  totalChunks: number;
  sentChunks: Set<number>;
  pendingResends: number[];
  isPaused: boolean;
  startTime: number;
  lastProgressUpdate: number;
  useIndexedDB: boolean;
}

export interface ReceiveTransferContext {
  transferId: string;
  manifest: TransferManifest | null;
  state: TransferState | null;
  receivedChunks: Map<number, ArrayBuffer>;
  bitmap: ChunkBitmap | null;
  isPaused: boolean;
  startTime: number;
  lastProgressUpdate: number;
  lastAckSeq: number;
  useIndexedDB: boolean;
  ackBatchSize: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useChunkedTransfer(options: ChunkedTransferOptions = {}) {
  const {
    onProgress,
    onComplete,
    onError,
    onLog,
    progressThrottleMs = 100
  } = options;

  // ============================================================================
  // State
  // ============================================================================
  
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  
  // Refs for mutable state that shouldn't trigger re-renders
  const sendContextRef = useRef<SendTransferContext | null>(null);
  const receiveContextRef = useRef<ReceiveTransferContext | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // ============================================================================
  // Logging Helper
  // ============================================================================
  
  const log = useCallback((message: string) => {
    console.log(`[ChunkedTransfer] ${message}`);
    onLog?.(message);
  }, [onLog]);

  // ============================================================================
  // Progress Reporting (Throttled)
  // ============================================================================
  
  const reportProgress = useCallback((
    context: SendTransferContext | ReceiveTransferContext,
    type: 'send' | 'receive'
  ) => {
    const now = Date.now();
    if (now - context.lastProgressUpdate < progressThrottleMs) {
      return;
    }
    context.lastProgressUpdate = now;

    if (type === 'send') {
      const ctx = context as SendTransferContext;
      const chunksTransferred = ctx.sentChunks.size;
      const bytesTransferred = Math.min(
        chunksTransferred * ctx.chunkSize,
        ctx.file.size
      );
      const percentage = (chunksTransferred / ctx.totalChunks) * 100;
      const elapsed = (now - ctx.startTime) / 1000;
      const speed = elapsed > 0 ? bytesTransferred / elapsed : 0;
      const remaining = ctx.file.size - bytesTransferred;
      const eta = speed > 0 ? remaining / speed : 0;

      onProgress?.({
        transferId: ctx.transferId,
        percentage: Math.round(percentage * 100) / 100,
        bytesTransferred,
        totalBytes: ctx.file.size,
        chunksTransferred,
        totalChunks: ctx.totalChunks,
        speed: Math.round(speed),
        eta: Math.round(eta),
        resendCount: ctx.pendingResends.length,
        gapsDetected: 0
      });
    } else {
      const ctx = context as ReceiveTransferContext;
      if (ctx.bitmap && ctx.manifest) {
        const progress = getProgressFromBitmap(
          ctx.bitmap,
          ctx.manifest.chunkSize,
          ctx.manifest.fileSize,
          ctx.startTime,
          ctx.transferId
        );
        onProgress?.(progress);
      }
    }
  }, [onProgress, progressThrottleMs]);

  // ============================================================================
  // Send Protocol Message
  // ============================================================================
  
  const sendProtocolMessage = useCallback((
    dataChannel: RTCDataChannel,
    message: TransferProtocolMessage
  ) => {
    if (dataChannel.readyState !== 'open') {
      log(`⚠️ Cannot send message, channel not open: ${dataChannel.readyState}`);
      return false;
    }
    
    try {
      dataChannel.send(JSON.stringify(message));
      return true;
    } catch (error) {
      log(`❌ Error sending protocol message: ${error}`);
      return false;
    }
  }, [log]);

  // ============================================================================
  // Sender Functions
  // ============================================================================

  /**
   * Initialize a file transfer (sender side)
   */
  const initiateSend = useCallback(async (
    file: File,
    dataChannel: RTCDataChannel,
    transferId: string
  ): Promise<void> => {
    log(`📤 Initiating send for ${file.name} (${file.size} bytes)`);
    setIsSending(true);
    dataChannelRef.current = dataChannel;

    // Calculate file hash and create manifest
    log(`🔐 Calculating file hash...`);
    const manifest = await createTransferManifest(file, transferId, (progress) => {
      log(`🔐 Hash progress: ${progress.percentage}%`);
    });
    log(`🔐 File hash: ${hashSummary(manifest.fileHash)}`);

    const config = calculateChunkConfig(file.size, detectDeviceType());

    // Create send context
    sendContextRef.current = {
      transferId,
      file,
      manifest,
      chunkSize: config.chunkSize,
      totalChunks: config.totalChunks,
      sentChunks: new Set(),
      pendingResends: [],
      isPaused: false,
      startTime: Date.now(),
      lastProgressUpdate: 0,
      useIndexedDB: config.useIndexedDB
    };

    // Send manifest
    log(`📤 Sending transfer manifest (${config.totalChunks} chunks of ${config.chunkSize} bytes)`);
    sendProtocolMessage(dataChannel, {
      type: 'transfer-manifest',
      payload: manifest
    });
  }, [log, sendProtocolMessage]);

  /**
   * Handle manifest acknowledgment (sender side)
   */
  const handleManifestAck = useCallback((ack: ManifestAck): void => {
    const ctx = sendContextRef.current;
    if (!ctx) {
      log(`⚠️ No send context for manifest ACK`);
      return;
    }

    log(`✅ Manifest acknowledged. Agreed chunk size: ${ack.agreedChunkSize}`);
    
    // Update chunk size if negotiated differently
    if (ack.agreedChunkSize !== ctx.chunkSize) {
      const newTotalChunks = Math.ceil(ctx.file.size / ack.agreedChunkSize);
      ctx.chunkSize = ack.agreedChunkSize;
      ctx.totalChunks = newTotalChunks;
      ctx.manifest.chunkSize = ack.agreedChunkSize;
      ctx.manifest.totalChunks = newTotalChunks;
      log(`📏 Adjusted to ${newTotalChunks} chunks of ${ack.agreedChunkSize} bytes`);
    }

    // Start sending chunks
    startChunkTransfer();
  }, [log]);

  /**
   * Start or resume chunk transfer (sender side)
   */
  const startChunkTransfer = useCallback(async (): Promise<void> => {
    const ctx = sendContextRef.current;
    const dc = dataChannelRef.current;
    if (!ctx || !dc) return;

    ctx.isPaused = false;
    log(`🚀 Starting chunk transfer...`);

    // Process resends first
    while (ctx.pendingResends.length > 0 && !ctx.isPaused) {
      const seq = ctx.pendingResends.shift()!;
      await sendChunk(seq);
    }

    // Send remaining chunks
    for (let seq = 0; seq < ctx.totalChunks && !ctx.isPaused; seq++) {
      if (!ctx.sentChunks.has(seq)) {
        await sendChunk(seq);
        
        // Flow control: check buffer
        if (dc.bufferedAmount > 1024 * 1024) { // 1MB buffer threshold
          log(`⏸️ Buffer full, pausing...`);
          await waitForBufferDrain(dc);
          log(`▶️ Buffer drained, resuming...`);
        }
      }
    }

    // All chunks sent, send transfer end
    if (ctx.sentChunks.size === ctx.totalChunks && ctx.pendingResends.length === 0) {
      sendTransferEnd();
    }
  }, [log]);

  /**
   * Send a single chunk (sender side)
   */
  const sendChunk = useCallback(async (sequence: number): Promise<void> => {
    const ctx = sendContextRef.current;
    const dc = dataChannelRef.current;
    if (!ctx || !dc || dc.readyState !== 'open') return;

    const chunk = await generateChunk(ctx.file, sequence, ctx.chunkSize);
    const binaryChunk = createBinaryChunk(chunk, chunk.data);

    try {
      dc.send(binaryChunk);
      ctx.sentChunks.add(sequence);
      reportProgress(ctx, 'send');
    } catch (error) {
      log(`❌ Error sending chunk ${sequence}: ${error}`);
      // Re-queue for resend
      if (!ctx.pendingResends.includes(sequence)) {
        ctx.pendingResends.push(sequence);
      }
    }
  }, [log, reportProgress]);

  /**
   * Wait for data channel buffer to drain
   */
  const waitForBufferDrain = (dc: RTCDataChannel): Promise<void> => {
    return new Promise((resolve) => {
      const check = () => {
        if (dc.bufferedAmount < 64 * 1024) { // 64KB low watermark
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      
      if (dc.bufferedAmountLowThreshold !== undefined) {
        dc.bufferedAmountLowThreshold = 64 * 1024;
        dc.onbufferedamountlow = () => {
          dc.onbufferedamountlow = null;
          resolve();
        };
      } else {
        check();
      }
    });
  };

  /**
   * Handle resend request (sender side)
   */
  const handleResendRequest = useCallback((request: ResendRequest): void => {
    const ctx = sendContextRef.current;
    if (!ctx) return;

    log(`🔄 Resend requested for sequences: ${request.sequences.join(', ')}`);
    
    // Add to pending resends (avoiding duplicates)
    for (const seq of request.sequences) {
      if (!ctx.pendingResends.includes(seq)) {
        ctx.pendingResends.push(seq);
      }
    }

    // If paused for gap filling, resume
    if (ctx.isPaused) {
      startChunkTransfer();
    }
  }, [log, startChunkTransfer]);

  /**
   * Send transfer end message (sender side)
   */
  const sendTransferEnd = useCallback((): void => {
    const ctx = sendContextRef.current;
    const dc = dataChannelRef.current;
    if (!ctx || !dc) return;

    const duration = Date.now() - ctx.startTime;
    log(`📤 Sending transfer end. Duration: ${duration}ms`);

    sendProtocolMessage(dc, {
      type: 'transfer-end',
      payload: {
        transferId: ctx.transferId,
        fileHash: ctx.manifest.fileHash,
        totalChunksSent: ctx.sentChunks.size,
        totalBytesSent: ctx.file.size,
        duration,
        timestamp: Date.now()
      }
    });
  }, [log, sendProtocolMessage]);

  /**
   * Handle transfer complete (sender side)
   */
  const handleTransferComplete = useCallback((complete: TransferComplete): void => {
    const ctx = sendContextRef.current;
    if (!ctx) return;

    if (complete.verified) {
      log(`✅ Transfer verified successfully!`);
    } else {
      log(`⚠️ Transfer completed but hash verification failed`);
    }

    setIsSending(false);
    sendContextRef.current = null;
  }, [log]);

  /**
   * Handle transfer failed (sender side)
   */
  const handleTransferFailed = useCallback((failed: TransferFailed): void => {
    const ctx = sendContextRef.current;
    if (!ctx) return;

    log(`❌ Transfer failed: ${failed.reason} - ${failed.message}`);
    onError?.(failed.message, failed.transferId);

    setIsSending(false);
    sendContextRef.current = null;
  }, [log, onError]);

  // ============================================================================
  // Receiver Functions
  // ============================================================================

  /**
   * Handle incoming transfer manifest (receiver side)
   */
  const handleTransferManifest = useCallback((
    manifest: TransferManifest,
    dataChannel: RTCDataChannel
  ): void => {
    log(`📥 Received transfer manifest for ${manifest.fileName}`);
    log(`   File size: ${manifest.fileSize} bytes`);
    log(`   Total chunks: ${manifest.totalChunks}`);
    log(`   File hash: ${hashSummary(manifest.fileHash)}`);

    setIsReceiving(true);
    dataChannelRef.current = dataChannel;

    const config = calculateChunkConfig(manifest.fileSize, detectDeviceType());
    const agreedChunkSize = negotiateChunkSize(manifest.chunkSize, config.chunkSize);
    const totalChunks = Math.ceil(manifest.fileSize / agreedChunkSize);

    // Update manifest with negotiated values
    const negotiatedManifest: TransferManifest = {
      ...manifest,
      chunkSize: agreedChunkSize,
      totalChunks
    };

    // Create receive context
    const state = createTransferState(negotiatedManifest);
    state.status = 'transferring';

    receiveContextRef.current = {
      transferId: manifest.transferId,
      manifest: negotiatedManifest,
      state,
      receivedChunks: new Map(),
      bitmap: createChunkBitmap(totalChunks),
      isPaused: false,
      startTime: Date.now(),
      lastProgressUpdate: 0,
      lastAckSeq: -1,
      useIndexedDB: config.useIndexedDB,
      ackBatchSize: config.ackBatchSize
    };

    // Store transfer state if using IndexedDB
    if (config.useIndexedDB) {
      storeTransfer({
        transferId: manifest.transferId,
        manifest: negotiatedManifest,
        state: 'receiving',
        receivedBitmap: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    // Send acknowledgment
    const ack = createManifestAck(negotiatedManifest);
    sendProtocolMessage(dataChannel, {
      type: 'manifest-ack',
      payload: ack
    });

    log(`✅ Manifest acknowledged. Ready to receive ${totalChunks} chunks`);
  }, [log, sendProtocolMessage]);

  /**
   * Handle incoming binary chunk (receiver side)
   */
  const handleBinaryChunk = useCallback(async (data: ArrayBuffer): Promise<void> => {
    const ctx = receiveContextRef.current;
    const dc = dataChannelRef.current;
    if (!ctx || !ctx.bitmap || !ctx.manifest || !dc) return;

    // Parse and verify chunk
    const { valid, header, data: chunkData, computedHash } = await verifyBinaryChunk(data);

    if (!valid) {
      log(`❌ Chunk ${header.sequence} hash mismatch! Requesting resend...`);
      sendProtocolMessage(dc, {
        type: 'request-resend',
        payload: {
          transferId: ctx.transferId,
          sequences: [header.sequence],
          reason: 'hash_mismatch',
          timestamp: Date.now()
        }
      });
      return;
    }

    // Store chunk
    if (ctx.useIndexedDB) {
      await storeChunkToDB(ctx.transferId, header.sequence, chunkData, computedHash);
    } else {
      ctx.receivedChunks.set(header.sequence, chunkData);
    }

    // Update bitmap
    markChunkReceived(ctx.bitmap, header.sequence);

    // Check for gaps periodically and send ACK
    const shouldAck = (header.sequence - ctx.lastAckSeq) >= ctx.ackBatchSize;
    
    if (shouldAck) {
      const gaps = detectGaps(ctx.bitmap, header.sequence);
      
      if (gaps.length > 0) {
        log(`🔍 Gaps detected: ${gaps.join(', ')}`);
        // Request resend for gaps
        sendProtocolMessage(dc, {
          type: 'request-resend',
          payload: {
            transferId: ctx.transferId,
            sequences: gaps,
            reason: 'gap',
            timestamp: Date.now()
          }
        });
      }

      // Send ACK
      const ack: ChunkACK = {
        transferId: ctx.transferId,
        lastContiguousSeq: ctx.bitmap.lastContiguous,
        receivedSequences: Array.from(ctx.bitmap.received).slice(-ctx.ackBatchSize),
        gaps,
        totalReceived: ctx.bitmap.received.size,
        timestamp: Date.now()
      };

      sendProtocolMessage(dc, { type: 'chunk-ack', payload: ack });
      ctx.lastAckSeq = header.sequence;
    }

    // Update progress
    reportProgress(ctx, 'receive');

    // Update IndexedDB state periodically
    if (ctx.useIndexedDB && shouldAck) {
      updateTransfer(ctx.transferId, {
        receivedBitmap: serializeBitmap(ctx.bitmap),
        updatedAt: Date.now()
      });
    }
  }, [log, sendProtocolMessage, reportProgress]);

  /**
   * Handle transfer end (receiver side)
   */
  const handleTransferEnd = useCallback(async (end: TransferEnd): Promise<void> => {
    const ctx = receiveContextRef.current;
    const dc = dataChannelRef.current;
    if (!ctx || !ctx.bitmap || !ctx.manifest || !dc) return;

    log(`📥 Transfer end received. Verifying...`);

    // Check for any remaining gaps
    const gaps = detectGaps(ctx.bitmap);
    if (gaps.length > 0) {
      log(`⚠️ ${gaps.length} chunks missing. Requesting resend...`);
      sendProtocolMessage(dc, {
        type: 'request-resend',
        payload: {
          transferId: ctx.transferId,
          sequences: gaps,
          reason: 'gap',
          timestamp: Date.now()
        }
      });
      return;
    }

    // All chunks received, verify file hash
    log(`🔐 Verifying file integrity...`);
    
    let file: File;
    try {
      if (ctx.useIndexedDB) {
        file = await assembleFileObject(ctx.transferId, ctx.manifest);
      } else {
        file = assembleChunksToFile(ctx.receivedChunks, ctx.manifest);
      }
    } catch (error) {
      log(`❌ Failed to assemble file: ${error}`);
      sendProtocolMessage(dc, {
        type: 'transfer-failed',
        payload: {
          transferId: ctx.transferId,
          reason: 'storage_error',
          message: `Failed to assemble file: ${error}`,
          timestamp: Date.now()
        }
      });
      return;
    }

    // Verify hash
    const hashResult = await hashFile(file);
    const verified = hashResult.hex === end.fileHash.toLowerCase();

    if (verified) {
      log(`✅ File hash verified: ${hashSummary(hashResult.hex)}`);
    } else {
      log(`❌ Hash mismatch! Expected: ${hashSummary(end.fileHash)}, Got: ${hashSummary(hashResult.hex)}`);
    }

    const duration = Date.now() - ctx.startTime;

    // Send completion message
    sendProtocolMessage(dc, {
      type: 'transfer-complete',
      payload: {
        transferId: ctx.transferId,
        verified,
        calculatedHash: hashResult.hex,
        totalChunksReceived: ctx.bitmap.received.size,
        duration,
        timestamp: Date.now()
      }
    });

    if (verified) {
      // Success! Clean up and notify
      if (ctx.useIndexedDB) {
        await cleanupTransfer(ctx.transferId);
      }
      
      onComplete?.(file, ctx.transferId);
    } else {
      onError?.('File hash verification failed', ctx.transferId);
    }

    setIsReceiving(false);
    receiveContextRef.current = null;
  }, [log, sendProtocolMessage, onComplete, onError]);

  // ============================================================================
  // Main Message Handler
  // ============================================================================

  /**
   * Handle incoming data channel message
   * Call this from useWebRTC when receiving messages
   */
  const handleMessage = useCallback(async (
    event: MessageEvent,
    dataChannel: RTCDataChannel
  ): Promise<boolean> => {
    // Check if it's a binary chunk
    if (event.data instanceof ArrayBuffer) {
      await handleBinaryChunk(event.data);
      return true;
    }

    // Parse JSON protocol message
    if (typeof event.data === 'string') {
      try {
        const message = JSON.parse(event.data) as TransferProtocolMessage;

        switch (message.type) {
          case 'transfer-manifest':
            handleTransferManifest(message.payload, dataChannel);
            return true;

          case 'manifest-ack':
            handleManifestAck(message.payload);
            return true;

          case 'chunk-ack':
            // Sender receives this - mainly for logging/debugging
            log(`📬 Chunk ACK: ${message.payload.totalReceived}/${sendContextRef.current?.totalChunks || '?'} received`);
            return true;

          case 'request-resend':
            handleResendRequest(message.payload);
            return true;

          case 'transfer-end':
            await handleTransferEnd(message.payload);
            return true;

          case 'transfer-complete':
            handleTransferComplete(message.payload);
            return true;

          case 'transfer-failed':
            handleTransferFailed(message.payload);
            return true;

          case 'transfer-pause':
            if (sendContextRef.current) {
              sendContextRef.current.isPaused = true;
              log(`⏸️ Transfer paused by receiver`);
            }
            return true;

          case 'transfer-resume':
            if (sendContextRef.current) {
              startChunkTransfer();
              log(`▶️ Transfer resumed`);
            }
            return true;

          default:
            // Unknown message type - might be handled by legacy code
            return false;
        }
      } catch {
        // Not a JSON message or not our protocol
        return false;
      }
    }

    return false;
  }, [
    handleBinaryChunk,
    handleTransferManifest,
    handleManifestAck,
    handleResendRequest,
    handleTransferEnd,
    handleTransferComplete,
    handleTransferFailed,
    startChunkTransfer,
    log
  ]);

  // ============================================================================
  // Control Functions
  // ============================================================================

  /**
   * Pause the current transfer
   */
  const pauseTransfer = useCallback((): void => {
    const dc = dataChannelRef.current;
    
    if (sendContextRef.current) {
      sendContextRef.current.isPaused = true;
      log(`⏸️ Send paused`);
    }
    
    if (receiveContextRef.current && dc) {
      receiveContextRef.current.isPaused = true;
      sendProtocolMessage(dc, {
        type: 'transfer-pause',
        payload: {
          transferId: receiveContextRef.current.transferId,
          timestamp: Date.now()
        }
      });
      log(`⏸️ Receive paused`);
    }
  }, [log, sendProtocolMessage]);

  /**
   * Resume the current transfer
   */
  const resumeTransfer = useCallback((): void => {
    const dc = dataChannelRef.current;
    
    if (sendContextRef.current) {
      startChunkTransfer();
    }
    
    if (receiveContextRef.current && dc) {
      receiveContextRef.current.isPaused = false;
      sendProtocolMessage(dc, {
        type: 'transfer-resume',
        payload: {
          transferId: receiveContextRef.current.transferId,
          timestamp: Date.now()
        }
      });
      log(`▶️ Receive resumed`);
    }
  }, [log, sendProtocolMessage, startChunkTransfer]);

  /**
   * Cancel the current transfer
   */
  const cancelTransfer = useCallback(async (): Promise<void> => {
    const dc = dataChannelRef.current;
    
    if (sendContextRef.current) {
      const ctx = sendContextRef.current;
      log(`❌ Send cancelled`);
      
      if (ctx.useIndexedDB) {
        await cleanupTransfer(ctx.transferId);
      }
      
      sendContextRef.current = null;
      setIsSending(false);
    }
    
    if (receiveContextRef.current) {
      const ctx = receiveContextRef.current;
      log(`❌ Receive cancelled`);
      
      if (dc) {
        sendProtocolMessage(dc, {
          type: 'transfer-failed',
          payload: {
            transferId: ctx.transferId,
            reason: 'cancelled',
            message: 'Transfer cancelled by user',
            timestamp: Date.now()
          }
        });
      }
      
      if (ctx.useIndexedDB) {
        await cleanupTransfer(ctx.transferId);
      }
      
      receiveContextRef.current = null;
      setIsReceiving(false);
    }
  }, [log, sendProtocolMessage]);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return {
    // State
    isSending,
    isReceiving,
    
    // Send functions
    initiateSend,
    
    // Message handler (integrate with useWebRTC)
    handleMessage,
    
    // Control functions
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    
    // Direct access to contexts (for advanced use)
    getSendContext: () => sendContextRef.current,
    getReceiveContext: () => receiveContextRef.current
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

export { isIndexedDBAvailable };

