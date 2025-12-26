import { useRef, useState, useCallback, useEffect } from 'react';
import { FileTransfer, Peer } from '../types';
import { formatFileSize } from '../utils/format';
import { playChime, playSuccessSound } from '../utils/sound';
import { logSystemEvent, logUserAction } from '../utils/eventLogger';

// Import chunking system
import { useChunkedTransfer } from './useChunkedTransfer';
import type { TransferProgress, TransferProtocolMessage } from '../types/chunking';
import {
  detectDeviceType,
  calculateChunkConfig,
  createTransferManifest,
  createManifestAck,
  createBinaryChunk,
  generateChunk,
  parseBinaryChunk,
  createChunkBitmap,
  markChunkReceived,
  detectGaps,
  isTransferComplete,
  assembleChunksToFile,
  verifyBinaryChunk,
  negotiateChunkSize,
  HEADER_SIZE
} from '../services/chunkingService';
import { hashFile, hashSummary } from '../services/hashService';
import {
  storeChunk as storeChunkToDB,
  cleanupTransfer,
  isIndexedDBAvailable
} from '../services/indexedDBService';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

// Feature flag to enable new chunking system
const USE_ROBUST_CHUNKING = true;

export const useWebRTC = (
  onSignal: (to: string, from: string, data: any) => void, 
  userId: string,
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void,
  peers?: Array<{ id: string; name: string; emoji: string; color: string }>,
  isConnected?: boolean,
  onLargeFileTransfer?: (fileSize: number, fileName?: string) => void
) => {
  // Helper function to get peer name
  const getPeerName = useCallback((peerId: string) => {
    const peer = peers?.find(p => p.id === peerId);
    return peer?.name || 'Unknown User';
  }, [peers]);

  const [connections, setConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const [incomingFiles, setIncomingFiles] = useState<Array<{
    id: string;
    from: string;
    fromName: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    transferId: string;
  }>>([]);
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const receivedFilesRef = useRef<Map<string, { 
    name: string; 
    size: number; 
    type: string; 
    chunks: ArrayBuffer[]; 
    startTime: number;
    // New chunking system fields
    useRobustChunking?: boolean;
    manifest?: any;
    bitmap?: ReturnType<typeof createChunkBitmap>;
    receivedChunks?: Map<number, ArrayBuffer>;
    useIndexedDB?: boolean;
    lastAckSeq?: number;
    ackBatchSize?: number;
  }>>(new Map());
  const pendingFilesRef = useRef<Map<string, { file: File; peer: any; transferId: string }>>(new Map());
  const [completedReceived, setCompletedReceived] = useState<Array<{
    id: string;
    file: File;
    url: string;
    peer: { id: string; name: string; emoji: string; color: string };
  }>>([]);

  // Robust chunking context for sender
  const robustSendContextRef = useRef<Map<string, {
    file: File;
    manifest: any;
    chunkSize: number;
    totalChunks: number;
    sentChunks: Set<number>;
    pendingResends: number[];
    isPaused: boolean;
    startTime: number;
    lastProgressUpdate: number;
    useIndexedDB: boolean;
  }>>(new Map());

  // Store pending request in Redis when receiver is offline
  const storePendingRequest = useCallback(async (receiverId: string, file: File, transferId: string) => {
    try {
      const response = await fetch('/api/file-transfer/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: userId,
          receiverId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          transferId
        }),
      });

      if (response.ok) {
        console.log(`💾 Stored pending file transfer request for ${receiverId}`);
        addToast?.('info', `File transfer request stored for offline user. Will be delivered when they reconnect.`);
      } else {
        console.error('❌ Failed to store pending request');
      }
    } catch (error) {
      console.error('❌ Error storing pending request:', error);
    }
  }, [userId, addToast]);

  // Store pending WebRTC signal in Redis when receiver is offline
  const storePendingSignal = useCallback(async (receiverId: string, signalData: any) => {
    try {
      const response = await fetch('/api/webrtc/signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: userId,
          receiverId,
          signalData
        }),
      });

      if (response.ok) {
        console.log(`💾 Stored pending WebRTC signal for ${receiverId}`);
      } else {
        console.error('❌ Failed to store pending signal');
      }
    } catch (error) {
      console.error('❌ Error storing pending signal:', error);
    }
  }, [userId]);

  const createPeerConnection = useCallback((peerId: string) => {
    // Always create a new connection
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS
    });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onSignal(peerId, userId, {
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };
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
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state with ${peerId}:`, pc.iceConnectionState);
    };
    setConnections(prev => {
      const newMap = new Map(prev);
      newMap.set(peerId, pc);
      return newMap;
    });
    return pc;
  }, [onSignal, userId]);

  const removeConnection = (peerId: string) => {
    setConnections(prev => {
      const newMap = new Map(prev);
      newMap.delete(peerId);
      return newMap;
    });
  };

  // ============================================================================
  // Robust Chunking - Sender Functions
  // ============================================================================

  /**
   * Send file using the robust chunking protocol
   */
  const sendFileRobust = useCallback(async (
    dataChannel: RTCDataChannel, 
    file: File, 
    transferId: string,
    peer: Peer
  ) => {
    console.log(`📤 [Robust] Starting chunked transfer for ${file.name}`);
    
    // Calculate file hash and create manifest
    console.log(`🔐 Calculating file hash...`);
    const manifest = await createTransferManifest(file, transferId, (progress) => {
      if (progress.percentage % 20 === 0) {
        console.log(`🔐 Hash progress: ${progress.percentage}%`);
      }
    });
    console.log(`🔐 File hash: ${hashSummary(manifest.fileHash)}`);

    const config = calculateChunkConfig(file.size, detectDeviceType());

    // Store send context
    robustSendContextRef.current.set(transferId, {
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
    });

    // Send manifest
    console.log(`📤 Sending transfer manifest (${config.totalChunks} chunks of ${config.chunkSize} bytes)`);
    dataChannel.send(JSON.stringify({
      type: 'transfer-manifest',
      payload: manifest
    }));
  }, [addToast]);

  /**
   * Handle manifest acknowledgment and start sending chunks
   */
  const handleManifestAck = useCallback(async (
    dataChannel: RTCDataChannel,
    transferId: string,
    ack: any
  ) => {
    const ctx = robustSendContextRef.current.get(transferId);
    if (!ctx) {
      console.warn(`⚠️ No send context for transfer ${transferId}`);
      return;
    }

    console.log(`✅ Manifest acknowledged. Agreed chunk size: ${ack.agreedChunkSize}`);
    
    // Update chunk size if negotiated differently
    if (ack.agreedChunkSize !== ctx.chunkSize) {
      const newTotalChunks = Math.ceil(ctx.file.size / ack.agreedChunkSize);
      ctx.chunkSize = ack.agreedChunkSize;
      ctx.totalChunks = newTotalChunks;
      ctx.manifest.chunkSize = ack.agreedChunkSize;
      ctx.manifest.totalChunks = newTotalChunks;
      console.log(`📏 Adjusted to ${newTotalChunks} chunks of ${ack.agreedChunkSize} bytes`);
    }

    // Start sending chunks
    await sendChunksRobust(dataChannel, transferId);
  }, []);

  /**
   * Send chunks with flow control, pacing, and retry logic
   * Optimized for large file transfers (1GB+)
   */
  const sendChunksRobust = useCallback(async (
    dataChannel: RTCDataChannel,
    transferId: string
  ) => {
    const ctx = robustSendContextRef.current.get(transferId);
    if (!ctx) return;

    // Buffer thresholds (lowered for reliability with large files)
    const BUFFER_HIGH_WATERMARK = 256 * 1024;  // 256KB - pause sending when buffer exceeds this
    const BUFFER_LOW_WATERMARK = 16 * 1024;    // 16KB - resume sending when buffer drops below this
    const MAX_CHUNK_RETRIES = 3;               // Retry failed chunks up to 3 times

    // Track retry counts per chunk
    const chunkRetryCount = new Map<number, number>();
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    // Check if data channel is already closed
    if (dataChannel.readyState !== 'open') {
      console.log(`⚠️ Data channel not open (state: ${dataChannel.readyState}), cannot send chunks`);
      setTransfers(prev => prev.map(t => 
        t.id === transferId ? { ...t, status: 'failed' } : t
      ));
      robustSendContextRef.current.delete(transferId);
      return;
    }

    ctx.isPaused = false;
    console.log(`🚀 Starting chunk transfer (buffer limits: ${BUFFER_HIGH_WATERMARK / 1024}KB high, ${BUFFER_LOW_WATERMARK / 1024}KB low)...`);

    // Helper function for adaptive delay based on buffer state
    const getAdaptiveDelay = (): number => {
      const buffered = dataChannel.bufferedAmount;
      if (buffered > 128 * 1024) return 10;  // 10ms delay if buffer > 128KB
      if (buffered > 64 * 1024) return 5;    // 5ms delay if buffer > 64KB
      return 0;                               // No delay if buffer is low
    };

    // Helper function to delay execution
    const delay = (ms: number): Promise<void> => {
      return new Promise(resolve => setTimeout(resolve, ms));
    };

    const sendSingleChunk = async (sequence: number): Promise<'sent' | 'channel_closed' | 'error' | 'retry_exhausted'> => {
      // Always check channel state before sending
      if (dataChannel.readyState !== 'open') {
        console.log(`⚠️ Data channel closed during transfer (state: ${dataChannel.readyState})`);
        return 'channel_closed';
      }
      
      const chunk = await generateChunk(ctx.file, sequence, ctx.chunkSize);
      const binaryChunk = createBinaryChunk(chunk, chunk.data);

      try {
        // Double-check state right before sending
        if (dataChannel.readyState !== 'open') {
          return 'channel_closed';
        }
        
        dataChannel.send(binaryChunk);
        ctx.sentChunks.add(sequence);
        consecutiveErrors = 0; // Reset consecutive error count on success
        
        // Update progress (throttled)
        const now = Date.now();
        if (now - ctx.lastProgressUpdate > 100) {
          ctx.lastProgressUpdate = now;
          const progress = (ctx.sentChunks.size / ctx.totalChunks) * 100;
          const elapsed = (now - ctx.startTime) / 1000;
          const bytesTransferred = Math.min(ctx.sentChunks.size * ctx.chunkSize, ctx.file.size);
          const speed = elapsed > 0 ? bytesTransferred / elapsed : 0;
          const timeRemaining = speed > 0 ? (ctx.file.size - bytesTransferred) / speed : 0;

          setTransfers(prev => prev.map(t => 
            t.id === transferId ? { 
              ...t, 
              progress: Math.round(progress),
              speed: Math.round(speed),
              timeRemaining: Math.round(timeRemaining),
              bytesTransferred: Math.round(bytesTransferred)
            } : t
          ));
        }
        
        return 'sent';
      } catch (error: any) {
        // Check if this is a channel closed error
        if (error?.name === 'InvalidStateError' || 
            error?.message?.includes('not \'open\'') ||
            dataChannel.readyState !== 'open') {
          console.log(`⚠️ Data channel closed, stopping transfer`);
          return 'channel_closed';
        }
        
        // Track retry count for this chunk
        const retries = (chunkRetryCount.get(sequence) || 0) + 1;
        chunkRetryCount.set(sequence, retries);
        consecutiveErrors++;
        
        if (retries >= MAX_CHUNK_RETRIES) {
          console.error(`❌ Chunk ${sequence} failed after ${MAX_CHUNK_RETRIES} retries`);
          return 'retry_exhausted';
        }
        
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`❌ Too many consecutive errors (${consecutiveErrors}), aborting transfer`);
          return 'retry_exhausted';
        }
        
        console.warn(`⚠️ Error sending chunk ${sequence} (attempt ${retries}/${MAX_CHUNK_RETRIES}):`, error?.message || error);
        
        // Wait a bit before retry
        await delay(100 * retries); // Exponential backoff: 100ms, 200ms, 300ms
        
        return 'error';
      }
    };

    // Wait for buffer to drain (with channel state check)
    const waitForBuffer = (): Promise<boolean> => {
      return new Promise((resolve) => {
        const check = () => {
          // Check if channel is still open
          if (dataChannel.readyState !== 'open') {
            resolve(false);
            return;
          }
          
          if (dataChannel.bufferedAmount < BUFFER_LOW_WATERMARK) {
            resolve(true);
          } else {
            setTimeout(check, 20); // Check more frequently
          }
        };
        
        if (dataChannel.bufferedAmountLowThreshold !== undefined) {
          dataChannel.bufferedAmountLowThreshold = BUFFER_LOW_WATERMARK;
          const originalHandler = dataChannel.onbufferedamountlow;
          dataChannel.onbufferedamountlow = () => {
            dataChannel.onbufferedamountlow = originalHandler;
            resolve(dataChannel.readyState === 'open');
          };
        } else {
          check();
        }
      });
    };

    // Helper to send a chunk with retry logic
    const sendChunkWithRetry = async (seq: number): Promise<'sent' | 'channel_closed' | 'failed'> => {
      let attempts = 0;
      const maxAttempts = MAX_CHUNK_RETRIES;
      
      while (attempts < maxAttempts) {
        const result = await sendSingleChunk(seq);
        
        if (result === 'sent') {
          return 'sent';
        }
        
        if (result === 'channel_closed' || result === 'retry_exhausted') {
          return result === 'channel_closed' ? 'channel_closed' : 'failed';
        }
        
        // Error - will retry
        attempts++;
        
        // Wait for buffer to clear before retrying
        if (dataChannel.readyState === 'open' && dataChannel.bufferedAmount > BUFFER_LOW_WATERMARK) {
          console.log(`⏳ Waiting for buffer to drain before retry...`);
          const canContinue = await waitForBuffer();
          if (!canContinue) {
            return 'channel_closed';
          }
        }
      }
      
      return 'failed';
    };

    // Process resends first
    while (ctx.pendingResends.length > 0 && !ctx.isPaused) {
      // Check channel state before each resend
      if (dataChannel.readyState !== 'open') {
        console.log(`⚠️ Data channel closed during resend, aborting transfer`);
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
        robustSendContextRef.current.delete(transferId);
        return;
      }
      
      const seq = ctx.pendingResends.shift()!;
      ctx.sentChunks.delete(seq); // Remove so we can resend
      const result = await sendChunkWithRetry(seq);
      
      if (result === 'channel_closed' || result === 'failed') {
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
        robustSendContextRef.current.delete(transferId);
        return;
      }
      
      // Flow control with lower threshold
      if (dataChannel.readyState === 'open' && dataChannel.bufferedAmount > BUFFER_HIGH_WATERMARK) {
        console.log(`⏸️ Buffer high (${Math.round(dataChannel.bufferedAmount / 1024)}KB), waiting...`);
        const canContinue = await waitForBuffer();
        if (!canContinue) {
          setTransfers(prev => prev.map(t => 
            t.id === transferId ? { ...t, status: 'failed' } : t
          ));
          robustSendContextRef.current.delete(transferId);
          return;
        }
      }
    }

    // Send remaining chunks
    for (let seq = 0; seq < ctx.totalChunks && !ctx.isPaused; seq++) {
      // Check channel state before each chunk
      if (dataChannel.readyState !== 'open') {
        console.log(`⚠️ Data channel closed during chunk sending, aborting transfer`);
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
        robustSendContextRef.current.delete(transferId);
        return;
      }
      
      if (!ctx.sentChunks.has(seq)) {
        const result = await sendChunkWithRetry(seq);
        
        if (result === 'channel_closed' || result === 'failed') {
          setTransfers(prev => prev.map(t => 
            t.id === transferId ? { ...t, status: 'failed' } : t
          ));
          robustSendContextRef.current.delete(transferId);
          return;
        }
        
        // Adaptive pacing - add delay based on buffer state
        const adaptiveDelay = getAdaptiveDelay();
        if (adaptiveDelay > 0) {
          await delay(adaptiveDelay);
        }
        
        // Flow control with lower threshold
        if (dataChannel.readyState === 'open' && dataChannel.bufferedAmount > BUFFER_HIGH_WATERMARK) {
          console.log(`⏸️ Buffer high (${Math.round(dataChannel.bufferedAmount / 1024)}KB), waiting...`);
          const canContinue = await waitForBuffer();
          if (!canContinue) {
            setTransfers(prev => prev.map(t => 
              t.id === transferId ? { ...t, status: 'failed' } : t
            ));
            robustSendContextRef.current.delete(transferId);
            return;
          }
        }
      }
    }

    // All chunks sent - verify channel is still open before sending end message
    if (ctx.sentChunks.size === ctx.totalChunks && ctx.pendingResends.length === 0) {
      if (dataChannel.readyState !== 'open') {
        console.log(`⚠️ Data channel closed before sending transfer-end`);
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
        robustSendContextRef.current.delete(transferId);
        return;
      }
      
      console.log(`📤 All chunks sent, sending transfer-end`);
      const duration = Date.now() - ctx.startTime;
      
      try {
        dataChannel.send(JSON.stringify({
          type: 'transfer-end',
          payload: {
            transferId,
            fileHash: ctx.manifest.fileHash,
            totalChunksSent: ctx.sentChunks.size,
            totalBytesSent: ctx.file.size,
            duration,
            timestamp: Date.now()
          }
        }));
      } catch (error) {
        console.error(`❌ Error sending transfer-end:`, error);
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
        robustSendContextRef.current.delete(transferId);
      }
    }
  }, []);

  /**
   * Handle resend request from receiver
   */
  const handleResendRequest = useCallback(async (
    dataChannel: RTCDataChannel,
    transferId: string,
    request: any
  ) => {
    const ctx = robustSendContextRef.current.get(transferId);
    if (!ctx) return;

    console.log(`🔄 Resend requested for sequences: ${request.sequences.join(', ')}`);
    
    // Add to pending resends
    for (const seq of request.sequences) {
      if (!ctx.pendingResends.includes(seq)) {
        ctx.pendingResends.push(seq);
        ctx.sentChunks.delete(seq); // Mark as not sent
      }
    }

    // Resume sending if paused
    if (!ctx.isPaused) {
      await sendChunksRobust(dataChannel, transferId);
    }
  }, [sendChunksRobust]);

  /**
   * Handle transfer complete from receiver
   */
  const handleTransferComplete = useCallback((transferId: string, complete: any) => {
    const ctx = robustSendContextRef.current.get(transferId);
    if (!ctx) return;

    if (complete.verified) {
      console.log(`✅ [Robust] Transfer verified successfully!`);
      setTransfers(prev => prev.map(t => 
        t.id === transferId ? { ...t, status: 'completed', progress: 100 } : t
      ));
      logSystemEvent.transferCompleted(transferId, Date.now() - ctx.startTime, ctx.file.size, 0);
    } else {
      console.log(`⚠️ Transfer completed but hash verification failed`);
      setTransfers(prev => prev.map(t => 
        t.id === transferId ? { ...t, status: 'failed' } : t
      ));
    }

    robustSendContextRef.current.delete(transferId);
  }, []);

  /**
   * Handle transfer failed from receiver
   */
  const handleTransferFailed = useCallback((transferId: string, failed: any) => {
    console.log(`❌ Transfer failed: ${failed.reason} - ${failed.message}`);
    
    setTransfers(prev => prev.map(t => 
      t.id === transferId ? { ...t, status: 'failed' } : t
    ));
    
    const ctx = robustSendContextRef.current.get(transferId);
    if (ctx) {
      logSystemEvent.transferFailed(transferId, failed.reason, Date.now() - ctx.startTime);
    }
    
    robustSendContextRef.current.delete(transferId);
  }, []);

  // ============================================================================
  // Robust Chunking - Receiver Functions
  // ============================================================================

  /**
   * Handle transfer manifest (receiver side)
   */
  const handleTransferManifest = useCallback((
    dataChannel: RTCDataChannel,
    from: string,
    manifest: any
  ) => {
    console.log(`📥 [Robust] Received transfer manifest for ${manifest.fileName}`);
    console.log(`   File size: ${manifest.fileSize} bytes`);
    console.log(`   Total chunks: ${manifest.totalChunks}`);
    console.log(`   File hash: ${hashSummary(manifest.fileHash)}`);

    const config = calculateChunkConfig(manifest.fileSize, detectDeviceType());
    const agreedChunkSize = negotiateChunkSize(manifest.chunkSize, config.chunkSize);
    const totalChunks = Math.ceil(manifest.fileSize / agreedChunkSize);

    // Update manifest with negotiated values
    const negotiatedManifest = {
      ...manifest,
      chunkSize: agreedChunkSize,
      totalChunks
    };

    // Store receive context
    receivedFilesRef.current.set(from, {
      name: manifest.fileName,
      size: manifest.fileSize,
      type: manifest.fileType,
      chunks: [],
      startTime: Date.now(),
      useRobustChunking: true,
      manifest: negotiatedManifest,
      bitmap: createChunkBitmap(totalChunks),
      receivedChunks: new Map(),
      useIndexedDB: config.useIndexedDB,
      lastAckSeq: -1,
      ackBatchSize: config.ackBatchSize
    });

    // Send acknowledgment
    const ack = createManifestAck(negotiatedManifest);
    dataChannel.send(JSON.stringify({
      type: 'manifest-ack',
      payload: ack
    }));

    console.log(`✅ Manifest acknowledged. Ready to receive ${totalChunks} chunks`);
  }, [addToast]);

  /**
   * Handle binary chunk (receiver side)
   */
  const handleBinaryChunk = useCallback(async (
    dataChannel: RTCDataChannel,
    from: string,
    data: ArrayBuffer
  ) => {
    const ctx = receivedFilesRef.current.get(from);
    if (!ctx || !ctx.useRobustChunking || !ctx.bitmap || !ctx.manifest || !ctx.receivedChunks) {
      return false;
    }

    // Parse and verify chunk
    const { valid, header, data: chunkData, computedHash } = await verifyBinaryChunk(data);

    if (!valid) {
      console.log(`❌ Chunk ${header.sequence} hash mismatch! Requesting resend...`);
      dataChannel.send(JSON.stringify({
        type: 'request-resend',
        payload: {
          transferId: ctx.manifest.transferId,
          sequences: [header.sequence],
          reason: 'hash_mismatch',
          timestamp: Date.now()
        }
      }));
      return true;
    }

    // Store chunk
    if (ctx.useIndexedDB) {
      await storeChunkToDB(ctx.manifest.transferId, header.sequence, chunkData, computedHash);
    } else {
      ctx.receivedChunks.set(header.sequence, chunkData);
    }

    // Update bitmap
    markChunkReceived(ctx.bitmap, header.sequence);

    // Check for gaps periodically and send ACK
    const shouldAck = (header.sequence - (ctx.lastAckSeq || -1)) >= (ctx.ackBatchSize || 10);
    
    if (shouldAck) {
      const gaps = detectGaps(ctx.bitmap, header.sequence);
      
      if (gaps.length > 0) {
        console.log(`🔍 Gaps detected: ${gaps.slice(0, 10).join(', ')}${gaps.length > 10 ? '...' : ''}`);
        dataChannel.send(JSON.stringify({
          type: 'request-resend',
          payload: {
            transferId: ctx.manifest.transferId,
            sequences: gaps,
            reason: 'gap',
            timestamp: Date.now()
          }
        }));
      }

      // Send ACK
      dataChannel.send(JSON.stringify({
        type: 'chunk-ack',
        payload: {
          transferId: ctx.manifest.transferId,
          lastContiguousSeq: ctx.bitmap.lastContiguous,
          receivedSequences: Array.from(ctx.bitmap.received).slice(-10),
          gaps,
          totalReceived: ctx.bitmap.received.size,
          timestamp: Date.now()
        }
      }));
      ctx.lastAckSeq = header.sequence;
    }

    // Update progress (throttled)
    const now = Date.now();
    const elapsed = (now - ctx.startTime) / 1000;
    const bytesReceived = Math.min(ctx.bitmap.received.size * ctx.manifest.chunkSize, ctx.manifest.fileSize);
    const progress = (ctx.bitmap.received.size / ctx.bitmap.totalChunks) * 100;
    const speed = elapsed > 0 ? bytesReceived / elapsed : 0;
    const timeRemaining = speed > 0 ? (ctx.manifest.fileSize - bytesReceived) / speed : 0;

    setTransfers(prev => prev.map(t => 
      t.peer.id === from && t.status === 'transferring' ? { 
        ...t, 
        progress: Math.round(progress),
        speed: Math.round(speed),
        timeRemaining: Math.round(timeRemaining),
        bytesTransferred: Math.round(bytesReceived)
      } : t
    ));

    return true;
  }, []);

  /**
   * Handle transfer end (receiver side)
   */
  const handleTransferEndRobust = useCallback(async (
    dataChannel: RTCDataChannel,
    from: string,
    end: any
  ) => {
    const ctx = receivedFilesRef.current.get(from);
    if (!ctx || !ctx.useRobustChunking || !ctx.bitmap || !ctx.manifest || !ctx.receivedChunks) {
      return false;
    }

    console.log(`📥 [Robust] Transfer end received. Verifying...`);

    // Check for any remaining gaps
    const gaps = detectGaps(ctx.bitmap);
    if (gaps.length > 0) {
      console.log(`⚠️ ${gaps.length} chunks missing. Requesting resend...`);
      dataChannel.send(JSON.stringify({
        type: 'request-resend',
        payload: {
          transferId: ctx.manifest.transferId,
          sequences: gaps,
          reason: 'gap',
          timestamp: Date.now()
        }
      }));
      return true;
    }

    // All chunks received, verify file hash
    console.log(`🔐 Verifying file integrity...`);
    
    let file: File;
    try {
      file = assembleChunksToFile(ctx.receivedChunks, ctx.manifest);
    } catch (error) {
      console.error(`❌ Failed to assemble file:`, error);
      dataChannel.send(JSON.stringify({
        type: 'transfer-failed',
        payload: {
          transferId: ctx.manifest.transferId,
          reason: 'storage_error',
          message: `Failed to assemble file: ${error}`,
          timestamp: Date.now()
        }
      }));
      return true;
    }

    // Verify hash
    const hashResult = await hashFile(file);
    const verified = hashResult.hex === end.fileHash.toLowerCase();

    const duration = Date.now() - ctx.startTime;

    if (verified) {
      console.log(`✅ File hash verified: ${hashSummary(hashResult.hex)}`);
      
      // Success!
      const blob = new Blob([file], { type: ctx.manifest.fileType });
      const url = URL.createObjectURL(blob);
      
      setCompletedReceived(prev => [
        ...prev,
        {
          id: `completed-${Date.now()}-${Math.random()}`,
          file,
          url,
          peer: { 
            id: from, 
            name: getPeerName(from), 
            emoji: '📱', 
            color: '#F6C148' 
          }
        }
      ]);
      
      setTransfers(prev => prev.map(t => 
        t.peer.id === from && t.status === 'transferring' ? { ...t, status: 'completed', progress: 100 } : t
      ));
      
      logSystemEvent.fileReceived(ctx.manifest.fileType, ctx.manifest.fileSize);
      playSuccessSound();
      
      if (addToast) {
        addToast('success', `File received: ${ctx.manifest.fileName} from ${getPeerName(from)}`);
      }
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('File Received', {
          body: `Successfully received ${ctx.manifest.fileName} from ${getPeerName(from)}`,
          icon: '/favicon.ico'
        });
      }
    } else {
      console.log(`❌ Hash mismatch! Expected: ${hashSummary(end.fileHash)}, Got: ${hashSummary(hashResult.hex)}`);
      addToast?.('error', 'File transfer failed: integrity check failed');
    }

    // Send completion message
    dataChannel.send(JSON.stringify({
      type: 'transfer-complete',
      payload: {
        transferId: ctx.manifest.transferId,
        verified,
        calculatedHash: hashResult.hex,
        totalChunksReceived: ctx.bitmap.received.size,
        duration,
        timestamp: Date.now()
      }
    }));

    // Cleanup
    receivedFilesRef.current.delete(from);
    
    return true;
  }, [getPeerName, addToast]);

  // ============================================================================
  // Main Send File Function
  // ============================================================================

  const sendFile = useCallback(async (file: File, peer: Peer) => {
    console.log(`📤 Sending file ${file.name} to ${peer.name}`);
    
    // Show modal notification for large files (non-blocking, appears immediately)
    const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
    if (file.size >= LARGE_FILE_THRESHOLD && onLargeFileTransfer) {
      onLargeFileTransfer(file.size, file.name);
    }
    
    // Check if there's already a transfer in progress
    const activeTransfers = transfers.filter(t => 
      t.status === 'transferring' || t.status === 'pending' || t.status === 'connecting'
    );
    
    if (activeTransfers.length > 0) {
      const errorMessage = 'Error: transfer in progress, please wait for current transfer to finish before starting a new transfer';
      console.error(errorMessage);
      
      if (addToast) {
        addToast('error', errorMessage);
      }
      
      throw new Error(errorMessage);
    }
    
    const transferId = `send-${Date.now()}-${Math.random()}`;
    const processName = 'webrtc_file_transfer';
    
    // Log transfer initiation
    logSystemEvent.systemProcessStarted(processName, 'transfer_initiated', {
      transferId,
      peerId: peer.id,
      peerName: peer.name,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      useRobustChunking: USE_ROBUST_CHUNKING
    });
    
    // Add to transfers list
    setTransfers(prev => [...prev, {
      id: transferId,
      file,
      peer,
      status: 'pending',
      progress: 0,
      speed: 0,
      timeRemaining: 0
    }]);

    // Check if peer is online
    if (!peer.isOnline || !isConnected) {
      console.log(`📦 Peer ${peer.name} is offline, storing request`);
      
      logSystemEvent.systemProcessStep(processName, 'peer_offline_storing_request', {
        transferId,
        peerId: peer.id,
        peerName: peer.name,
        isOnline: peer.isOnline,
        isConnected
      });
      
      await storePendingRequest(peer.id, file, transferId);
      setTransfers(prev => prev.map(t => 
        t.id === transferId ? { ...t, status: 'pending' } : t
      ));
      return;
    }

    try {
      // Always create a new connection for each transfer for reliability
      console.log(`🆕 Creating new WebRTC connection for transfer to ${peer.id}`);
      logSystemEvent.systemProcessStep(processName, 'creating_peer_connection', {
        transferId,
        peerId: peer.id
      });
      
      // Close and remove any existing connection for this peer to avoid conflicts
      const existingPc = connections.get(peer.id);
      if (existingPc) {
        console.log(`🔄 Closing existing connection for ${peer.id} before creating new one`);
        try {
          existingPc.close();
        } catch (error) {
          console.warn('⚠️ Error closing existing connection:', error);
        }
        removeConnection(peer.id);
      }
      
      // Create new connection
      const pc = createPeerConnection(peer.id);
      
      // Create data channel
      logSystemEvent.systemProcessStep(processName, 'creating_data_channel', {
        transferId,
        peerId: peer.id
      });
      
      const dataChannel = pc.createDataChannel('file-transfer', {
        ordered: true
      });
      
      // Set binary type for robust chunking
      dataChannel.binaryType = 'arraybuffer';
      
      dataChannel.onopen = () => {
        console.log('📤 Data channel opened for sending');
        
        logSystemEvent.systemProcessStep(processName, 'data_channel_opened', {
          transferId,
          peerId: peer.id
        });
        
        // Send file request first
        logSystemEvent.systemProcessStep(processName, 'sending_file_request', {
          transferId,
          peerId: peer.id,
          fileName: file.name,
          fileSize: file.size
        });
        
        dataChannel.send(JSON.stringify({
          type: 'file-request',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          transferId: transferId,
          useRobustChunking: USE_ROBUST_CHUNKING
        }));
        
        // Store pending file for when receiver accepts
        pendingFilesRef.current.set(transferId, { file, peer, transferId });
      };
      
      dataChannel.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          try {
            const message = JSON.parse(event.data);
            
            // Handle robust chunking protocol messages
            if (message.type === 'manifest-ack' && message.payload?.transferId === transferId) {
              await handleManifestAck(dataChannel, transferId, message.payload);
              return;
            }
            
            if (message.type === 'request-resend' && message.payload?.transferId === transferId) {
              await handleResendRequest(dataChannel, transferId, message.payload);
              return;
            }
            
            if (message.type === 'transfer-complete' && message.payload?.transferId === transferId) {
              handleTransferComplete(transferId, message.payload);
              return;
            }
            
            if (message.type === 'transfer-failed' && message.payload?.transferId === transferId) {
              handleTransferFailed(transferId, message.payload);
              return;
            }
            
            if (message.type === 'chunk-ack') {
              // Just log for now
              console.log(`📬 Chunk ACK: ${message.payload?.totalReceived || '?'} received`);
              return;
            }
            
            // Legacy protocol handlers
            if (message.type === 'file-accepted' && message.transferId === transferId) {
              console.log('📤 File accepted, starting transfer');
              
              logSystemEvent.systemProcessStep(processName, 'file_accepted', {
                transferId,
                peerId: peer.id
              });
              
              setTransfers(prev => prev.map(t => 
                t.id === transferId ? { ...t, status: 'transferring' } : t
              ));
              
              // Start file transfer using robust chunking
              if (USE_ROBUST_CHUNKING) {
                await sendFileRobust(dataChannel, file, transferId, peer);
              } else {
                sendFileInChunksLegacy(dataChannel, file, transferId);
              }
            } else if (message.type === 'file-rejected' && message.transferId === transferId) {
              console.log('📤 File rejected');
              
              logSystemEvent.systemProcessFailed(processName, 'file_rejected', 'File transfer was rejected by recipient', {
                transferId,
                peerId: peer.id
              });
              
              setTransfers(prev => prev.map(t =>
                t.id === transferId ? { ...t, status: 'cancelled' } : t
              ));
              pendingFilesRef.current.delete(transferId);
            }
          } catch (error) {
            console.error('❌ Error parsing message:', error);
          }
        }
      };
      
      dataChannel.onerror = (error) => {
        console.error('❌ Data channel error:', error);
        
        logSystemEvent.systemProcessFailed(processName, 'data_channel_error', 'Data channel error occurred', {
          transferId,
          peerId: peer.id,
          error: error.toString()
        });
        
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
      };
      
      dataChannel.onclose = () => {
        console.log('📤 Data channel closed');
        
        logSystemEvent.systemProcessStep(processName, 'data_channel_closed', {
          transferId,
          peerId: peer.id
        });
        
        console.log('ℹ️ Data channel closed - WebRTC connection may still be usable for future transfers');
      };
      
      // Store data channel
      const channelKey = `${peer.id}-${transferId}`;
      dataChannelsRef.current.set(channelKey, dataChannel);
      
      // Create offer
      console.log(`📤 Creating offer for ${peer.id}`);
      
      logSystemEvent.systemProcessStep(processName, 'creating_offer', {
        transferId,
        peerId: peer.id
      });
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      logSystemEvent.systemProcessStep(processName, 'sending_offer', {
        transferId,
        peerId: peer.id
      });
      
      console.log(`📤 Sending offer to ${peer.id}`);
      onSignal(peer.id, userId, {
        type: 'offer',
        sdp: offer
      });
    } catch (error) {
      console.error('❌ Error sending file:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logSystemEvent.systemProcessFailed(processName, 'connection_failed', errorMessage, {
        transferId,
        peerId: peer.id,
        fileName: file.name
      });
      
      setTransfers(prev => prev.map(t => 
        t.id === transferId ? { ...t, status: 'failed' } : t
      ));
    }
  }, [connections, createPeerConnection, onSignal, userId, storePendingRequest, isConnected, transfers, addToast, sendFileRobust, handleManifestAck, handleResendRequest, handleTransferComplete, handleTransferFailed, onLargeFileTransfer]);

  // Legacy chunk sending (fallback)
  const sendFileInChunksLegacy = (dataChannel: RTCDataChannel, file: File, transferId: string) => {
    const CHUNK_SIZE = 16384; // 16KB legacy chunks
    const reader = new FileReader();
    let offset = 0;
    const startTime = Date.now();

    const readSlice = () => {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (event) => {
      if (event.target?.result && dataChannel.readyState === 'open') {
        const chunk = event.target.result as ArrayBuffer;
        
        // Send metadata first if it's the first chunk
        if (offset === 0) {
          dataChannel.send(JSON.stringify({
            type: 'file-start',
            name: file.name,
            size: file.size,
            fileType: file.type
          }));
        }

        // Send chunk
        dataChannel.send(chunk);
        offset += chunk.byteLength;

        // Update progress
        const progress = (offset / file.size) * 100;
        const elapsed = Date.now() - startTime;
        const speed = offset / (elapsed / 1000);
        const timeRemaining = speed > 0 ? (file.size - offset) / speed : 0;

        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { 
            ...t, 
            progress: Math.round(progress),
            speed: Math.round(speed),
            timeRemaining: Math.round(timeRemaining),
            bytesTransferred: Math.round(offset)
          } : t
        ));

        if (offset < file.size) {
          readSlice();
        } else {
          // File transfer complete
          dataChannel.send(JSON.stringify({ type: 'file-end' }));
          setTransfers(prev => prev.map(t => 
            t.id === transferId ? { ...t, status: 'completed', progress: 100 } : t
          ));
          
          logSystemEvent.transferCompleted(transferId, Date.now() - startTime, file.size, 0);
          console.log('✅ File transfer completed');
        }
      }
    };

    reader.onerror = () => {
      console.error('❌ Error reading file chunk');
      setTransfers(prev => prev.map(t => 
        t.id === transferId ? { ...t, status: 'failed' } : t
      ));
      logSystemEvent.transferFailed(transferId, 'transfer_failed', Date.now() - startTime);
    };

    readSlice();
  };

  const handleSignal = useCallback(async (from: string, data: any) => {
    console.log(`📡 Received signal from ${from}:`, data.type);
    
    // If we're not connected, store the signal for later
    if (!isConnected) {
      console.log(`📦 Not connected, storing signal for later`);
      await storePendingSignal(from, data);
      return;
    }
    
    let pc = connections.get(from);
    
    if (data.type === 'offer') {
      console.log(`📡 Processing offer from ${from}`);
      if (!pc) {
        pc = createPeerConnection(from);
      }
      
      // Set up data channel handler
      if (!pc.ondatachannel) {
        pc.ondatachannel = (event) => {
          const dataChannel = event.channel;
          console.log('📥 Data channel opened for receiving');
          
          // Set binary type for robust chunking
          dataChannel.binaryType = 'arraybuffer';
          
          // Store the data channel
          dataChannelsRef.current.set(from, dataChannel);
          
          dataChannel.onmessage = async (event) => {
            // Handle binary chunk (robust chunking)
            if (event.data instanceof ArrayBuffer) {
              const handled = await handleBinaryChunk(dataChannel, from, event.data);
              if (handled) return;
              
              // Fallback: legacy binary handling
              const receivedFile = receivedFilesRef.current.get(from);
              if (receivedFile && !receivedFile.useRobustChunking) {
                receivedFile.chunks.push(event.data);
                
                const totalReceived = receivedFile.chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
                const progress = (totalReceived / receivedFile.size) * 100;
                const elapsed = Date.now() - receivedFile.startTime;
                const speed = elapsed > 0 ? totalReceived / (elapsed / 1000) : 0;
                const timeRemaining = speed > 0 ? (receivedFile.size - totalReceived) / speed : 0;
                
                setTransfers(prev => prev.map(t => 
                  t.peer.id === from && t.status === 'transferring' ? { 
                    ...t, 
                    progress: Math.round(progress),
                    speed: Math.round(speed),
                    timeRemaining: Math.round(timeRemaining),
                    bytesTransferred: Math.round(totalReceived)
                  } : t
                ));
              }
              return;
            }
            
            // Handle string messages
            if (typeof event.data === 'string') {
              try {
                const message = JSON.parse(event.data);
                
                // Robust chunking protocol messages
                if (message.type === 'transfer-manifest') {
                  handleTransferManifest(dataChannel, from, message.payload);
                  return;
                }
                
                if (message.type === 'transfer-end') {
                  const handled = await handleTransferEndRobust(dataChannel, from, message.payload);
                  if (handled) return;
                }
                
                // Legacy protocol messages
                if (message.type === 'file-request') {
                  console.log('📥 Incoming file request:', message);
                  
                  logSystemEvent.fileReceived(message.fileType, message.fileSize);
                  
                  const incomingFileId = `incoming-${Date.now()}-${Math.random()}`;
                  setIncomingFiles(prev => [...prev, {
                    id: incomingFileId,
                    from: from,
                    fromName: getPeerName(from),
                    fileName: message.fileName,
                    fileSize: message.fileSize,
                    fileType: message.fileType,
                    transferId: message.transferId
                  }]);
                  
                  playChime();
                  
                  if (addToast) {
                    addToast('info', `Incoming file: ${message.fileName} from ${getPeerName(from)}`);
                  }
                  
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Incoming File', {
                      body: `${message.fileName} (${formatFileSize(message.fileSize)}) from ${getPeerName(from)}`,
                      icon: '/favicon.ico'
                    });
                  }
                  
                } else if (message.type === 'file-start') {
                  console.log('📥 Receiving file:', message.name);
                  receivedFilesRef.current.set(from, {
                    name: message.name,
                    size: message.size,
                    type: message.fileType,
                    chunks: [],
                    startTime: Date.now(),
                    useRobustChunking: false
                  });
                  
                  setTransfers(prev => {
                    const alreadyExists = prev.some(t =>
                      t.peer.id === from &&
                      t.file.name === message.name &&
                      t.file.type === message.fileType &&
                      t.status !== 'completed'
                    );
                    if (alreadyExists) {
                      return prev.map(t =>
                        t.peer.id === from && t.file.name === message.name && t.file.type === message.fileType && t.status !== 'completed'
                          ? { ...t, status: 'transferring' }
                          : t
                      );
                    } else {
                      const transferId = `receive-${Date.now()}-${Math.random()}`;
                      return [
                        ...prev,
                        {
                          id: transferId,
                          file: new File([new ArrayBuffer(message.size)], message.name, { type: message.fileType }),
                          peer: { 
                            id: from, 
                            name: getPeerName(from), 
                            emoji: '📱', 
                            color: '#F6C148', 
                            isOnline: true 
                          },
                          status: 'transferring',
                          progress: 0,
                          speed: 0,
                          timeRemaining: 0
                        }
                      ];
                    }
                  });
                } else if (message.type === 'file-end') {
                  const receivedFile = receivedFilesRef.current.get(from);
                  if (receivedFile && !receivedFile.useRobustChunking) {
                    console.log('📥 File received, reconstructing...');
                    const blob = new Blob(receivedFile.chunks, { type: receivedFile.type });
                    const url = URL.createObjectURL(blob);
                    
                    setCompletedReceived(prev => [
                      ...prev,
                      {
                        id: `completed-${Date.now()}-${Math.random()}`,
                        file: new File([blob], receivedFile.name, { type: receivedFile.type }),
                        url,
                        peer: { 
                          id: from, 
                          name: getPeerName(from), 
                          emoji: '📱', 
                          color: '#F6C148' 
                        }
                      }
                    ]);
                    receivedFilesRef.current.delete(from);
                    
                    setTransfers(prev => prev.map(t => 
                      t.peer.id === from && t.status === 'transferring' ? { ...t, status: 'completed', progress: 100 } : t
                    ));
                    
                    logSystemEvent.fileReceived(receivedFile.type, receivedFile.size);
                    playSuccessSound();
                    
                    if (addToast) {
                      addToast('success', `File received: ${receivedFile.name} from ${getPeerName(from)}`);
                    }
                    
                    if ('Notification' in window && Notification.permission === 'granted') {
                      new Notification('File Received', {
                        body: `Successfully received ${receivedFile.name} from ${getPeerName(from)}`,
                        icon: '/favicon.ico'
                      });
                    }
                  }
                }
              } catch (error) {
                console.error('❌ Error parsing message:', error);
              }
            }
          };
          
          dataChannel.onerror = (error) => {
            console.error('❌ Data channel error:', error);
          };
          
          dataChannel.onclose = () => {
            console.log('📥 Data channel closed');
            dataChannelsRef.current.delete(from);
            console.log('ℹ️ Data channel closed - WebRTC connection may still be usable for future transfers');
          };
        };
      }
      
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      onSignal(from, userId, {
        type: 'answer',
        sdp: answer
      });
    } else if (data.type === 'answer') {
      if (pc) {
        await pc.setRemoteDescription(data.sdp);
      }
    } else if (data.type === 'ice-candidate') {
      if (pc) {
        await pc.addIceCandidate(data.candidate);
      }
    }
  }, [connections, createPeerConnection, onSignal, userId, addToast, peers, isConnected, storePendingSignal, handleBinaryChunk, handleTransferManifest, handleTransferEndRobust, getPeerName]);

  const cancelTransfer = useCallback((transferId: string) => {
    setTransfers(prev => prev.map(t => 
      t.id === transferId ? { ...t, status: 'cancelled' } : t
    ));
    
    // Close data channel if it's open
    const transfer = transfers.find(t => t.id === transferId);
    if (transfer) {
      const dataChannel = dataChannelsRef.current.get(transfer.peer.id);
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.close();
      }
    }
    
    // Clean up robust chunking context
    robustSendContextRef.current.delete(transferId);
  }, [transfers]);

  const acceptIncomingFile = useCallback((incomingFileId: string) => {
    const incomingFile = incomingFiles.find(f => f.id === incomingFileId);
    if (!incomingFile) {
      console.error('❌ Incoming file not found:', incomingFileId);
      return;
    }
    
    console.log('✅ Accepting incoming file:', incomingFile);
    
    // Show modal notification for large files (non-blocking, appears immediately)
    const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB
    if (incomingFile.fileSize >= LARGE_FILE_THRESHOLD && onLargeFileTransfer) {
      onLargeFileTransfer(incomingFile.fileSize, incomingFile.fileName);
    }
    
    const dataChannel = dataChannelsRef.current.get(incomingFile.from);
    if (!dataChannel) {
      console.error('❌ Data channel not found for sender:', incomingFile.from);
      return;
    }
    
    if (dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({
        type: 'file-accepted',
        transferId: incomingFile.transferId
      }));
      
      setIncomingFiles(prev => prev.filter(f => f.id !== incomingFileId));
      
      const transferId = `receive-${Date.now()}-${Math.random()}`;
      setTransfers(prev => [...prev, {
        id: transferId,
        file: new File([new ArrayBuffer(incomingFile.fileSize)], incomingFile.fileName, { type: incomingFile.fileType }),
        peer: { 
          id: incomingFile.from, 
          name: getPeerName(incomingFile.from), 
          emoji: '📱', 
          color: '#F6C148', 
          isOnline: true 
        },
        status: 'transferring',
        progress: 0,
        speed: 0,
        timeRemaining: 0
      }]);
      
      // Initialize receiving state (will be updated when manifest or file-start is received)
      receivedFilesRef.current.set(incomingFile.from, {
        name: incomingFile.fileName,
        size: incomingFile.fileSize,
        type: incomingFile.fileType,
        chunks: [],
        startTime: Date.now()
      });
      
      console.log('✅ File acceptance sent, transfer started');
    } else {
      console.error('❌ Data channel not open, state:', dataChannel.readyState);
    }
  }, [incomingFiles, getPeerName, onLargeFileTransfer]);

  const rejectIncomingFile = useCallback((incomingFileId: string) => {
    const incomingFile = incomingFiles.find(f => f.id === incomingFileId);
    if (!incomingFile) {
      console.error('❌ Incoming file not found for rejection:', incomingFileId);
      return;
    }
    
    console.log('❌ Rejecting incoming file:', incomingFile);
    
    const dataChannel = dataChannelsRef.current.get(incomingFile.from);
    if (dataChannel && dataChannel.readyState === 'open' && incomingFile) {
      dataChannel.send(JSON.stringify({
        type: 'file-rejected',
        transferId: incomingFile.transferId
      }));
      console.log('✅ File rejection sent');
    } else {
      console.error('❌ Data channel not available for rejection');
    }
    
    setIncomingFiles(prev => prev.filter(f => f.id !== incomingFileId));
  }, [incomingFiles]);

  const playSound = (url: string) => {
    const audio = new window.Audio(url);
    audio.play();
  };

  return {
    transfers,
    incomingFiles,
    sendFile,
    handleSignal,
    cancelTransfer,
    acceptIncomingFile,
    rejectIncomingFile,
    completedReceived,
  };
};
