import { useRef, useState, useCallback, useEffect } from 'react';
import { FileTransfer, Peer } from '../types';
import { formatFileSize } from '../utils/format';
import { playChime, playSuccessSound } from '../utils/sound';
import { logSystemEvent, logUserAction } from '../utils/eventLogger';
import { isMobileDevice } from '../utils/device';
import { WEBRTC_CONSTANTS } from '@sharedrop/config';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

/**
 * Get optimal chunk size based on device type and file size
 */
const getOptimalChunkSize = (fileSize: number): number => {
  const mobile = isMobileDevice();
  
  // Mobile: smaller chunks for better memory management
  if (mobile) {
    return 8192; // 8KB
  }
  
  // Desktop: larger chunks for better performance
  // For very large files (>500MB), use even larger chunks
  if (fileSize > 500 * 1024 * 1024) {
    return 256 * 1024; // 256KB for very large files
  } else if (fileSize > 100 * 1024 * 1024) {
    return 128 * 1024; // 128KB for large files
  } else {
    return 64 * 1024; // 64KB for medium files
  }
};

export const useWebRTC = (
  onSignal: (to: string, from: string, data: any) => void, 
  userId: string,
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void,
  peers?: Array<{ id: string; name: string; emoji: string; color: string }>,
  isConnected?: boolean
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
    receivedSize: number;
    blobParts: BlobPart[];
    startTime: number;
    lastProgressUpdate: number;
    lastProgressSize: number; // Track size at last progress update
    useIndexedDB: boolean;
    transferId: string;
    chunkIndex: number;
    expectedChunks: number;
    receivedChunkIndices: Set<number>;
    pendingChunkOperations: Promise<void>[]; // Track pending async chunk storage operations
    nextRetryChunkIndex?: number; // Track chunk index for retry chunks
  }>>(new Map());
  const pendingFilesRef = useRef<Map<string, { file: File; peer: any; transferId: string }>>(new Map());
  // Track active file transfers for retry capability
  const activeTransfersRef = useRef<Map<string, {
    file: File;
    fileId?: string;
    useIndexedDB: boolean;
    chunkSize: number;
    dataChannel: RTCDataChannel;
    transferId: string;
  }>>(new Map());
  const [completedReceived, setCompletedReceived] = useState<Array<{
    id: string;
    file: File;
    url: string;
    peer: { id: string; name: string; emoji: string; color: string };
  }>>([]);

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

  const sendFile = useCallback(async (file: File, peer: Peer) => {
    console.log(`📤 Sending file ${file.name} to ${peer.name}`);
    
    // Extract IndexedDB metadata if present
    const fileId = (file as any).fileId;
    const useIndexedDB = (file as any).useIndexedDB === true;
    
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
      fileType: file.type
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
      // This ensures clean state and avoids connection reuse issues
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
      const isNewConnection = true;
      
      // Create data channel
      logSystemEvent.systemProcessStep(processName, 'creating_data_channel', {
        transferId,
        peerId: peer.id
      });
      
      const dataChannel = pc.createDataChannel('file-transfer', {
        ordered: true,
        maxRetransmits: 3
      });
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
          transferId: transferId
        }));
        // Store pending file for when receiver accepts
        pendingFilesRef.current.set(transferId, { file, peer, transferId });
      };
      dataChannel.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'file-accepted' && message.transferId === transferId) {
              console.log('📤 File accepted, starting transfer');
              
              logSystemEvent.systemProcessStep(processName, 'file_accepted', {
                transferId,
                peerId: peer.id
              });
              
              setTransfers(prev => prev.map(t => 
                t.id === transferId ? { ...t, status: 'transferring' } : t
              ));
              // Start file transfer with IndexedDB support
              const fileId = (file as any).fileId;
              const useIndexedDB = (file as any).useIndexedDB === true;
              sendFileInChunks(dataChannel, file, transferId, fileId, useIndexedDB);
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
            } else if (message.type === 'chunk-retry-request' && message.transferId === transferId) {
              console.log(`🔄 Received retry request for ${message.chunkIndices?.length || 0} chunks`);
              
              if (message.chunkIndices && Array.isArray(message.chunkIndices) && message.chunkIndices.length > 0) {
                // Update transfer status to show retry
                setTransfers(prev => prev.map(t => 
                  t.id === transferId ? { ...t, status: 'transferring' } : t
                ));
                
                // Resend the requested chunks
                resendChunks(transferId, message.chunkIndices);
              }
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
        
        // Remove from data channels ref (but keep connection for other channels)
        // Don't delete by peer.id as there might be multiple channels
        // Instead, track channels by transferId or use a different key
        console.log('ℹ️ Data channel closed - WebRTC connection may still be usable for future transfers');
      };
      
      // Store data channel with a unique key (peer.id + transferId) to allow multiple channels
      const channelKey = `${peer.id}-${transferId}`;
      dataChannelsRef.current.set(channelKey, dataChannel);
      
      // Always create offer for new connection
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
  }, [connections, createPeerConnection, onSignal, userId, storePendingRequest, isConnected, transfers, addToast]);

  const sendFileInChunks = async (
    dataChannel: RTCDataChannel, 
    file: File, 
    transferId: string,
    fileId?: string,
    useIndexedDB?: boolean
  ) => {
    const { getOutgoingFile, deleteOutgoingFile } = await import('../utils/indexedDB');
    const { WEBRTC_CONSTANTS } = await import('@sharedrop/config');
    
    let fileToSend = file;
    
    // Load from IndexedDB if needed
    if (useIndexedDB && fileId) {
      try {
        fileToSend = await getOutgoingFile(fileId);
        console.log('📦 Loaded file from IndexedDB for transfer');
      } catch (error) {
        console.error('❌ Failed to load file from IndexedDB:', error);
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
        return;
      }
    }
    
    const CHUNK_SIZE = getOptimalChunkSize(fileToSend.size);
    const MAX_BUFFERED_AMOUNT = WEBRTC_CONSTANTS.MAX_BUFFERED_AMOUNT;
    const BUFFERED_AMOUNT_LOW_THRESHOLD = WEBRTC_CONSTANTS.BUFFERED_AMOUNT_LOW_THRESHOLD;
    const PROGRESS_UPDATE_INTERVAL = WEBRTC_CONSTANTS.PROGRESS_UPDATE_INTERVAL;
    const PROGRESS_CHANGE_THRESHOLD = WEBRTC_CONSTANTS.PROGRESS_CHANGE_THRESHOLD;
    
    // Store file reference for retry capability
    activeTransfersRef.current.set(transferId, {
      file: fileToSend,
      fileId,
      useIndexedDB: useIndexedDB || false,
      chunkSize: CHUNK_SIZE,
      dataChannel,
      transferId
    });
    
    const reader = new FileReader();
    let offset = 0;
    const startTime = Date.now();
    let isPaused = false;
    
    // Progress update throttling
    let lastProgressUpdate = 0;
    let lastReportedProgress = 0;
    
    // Set up flow control
    dataChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_THRESHOLD;
    dataChannel.onbufferedamountlow = () => {
      if (isPaused && offset < fileToSend.size) {
        isPaused = false;
        console.log('▶️ Buffer low, resuming transfer');
        readSlice();
      }
    };

    const updateProgress = (currentOffset: number, force: boolean = false) => {
      const now = Date.now();
      const progress = (currentOffset / fileToSend.size) * 100;
      
      // Throttle: max once per interval
      if (!force && (now - lastProgressUpdate) < PROGRESS_UPDATE_INTERVAL) {
        return;
      }
      
      // Threshold: only update if changed significantly
      if (!force && Math.abs(progress - lastReportedProgress) < PROGRESS_CHANGE_THRESHOLD) {
        return;
      }
      
      lastProgressUpdate = now;
      lastReportedProgress = progress;
      
      const elapsed = (now - startTime) / 1000; // seconds
      const speed = elapsed > 0 ? currentOffset / elapsed : 0;
      const timeRemaining = speed > 0 ? (fileToSend.size - currentOffset) / speed : 0;

      // Update state (batched via requestAnimationFrame)
      requestAnimationFrame(() => {
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { 
            ...t, 
            progress: Math.round(progress * 10) / 10,
            speed: Math.round(speed),
            timeRemaining: Math.round(timeRemaining)
          } : t
        ));
      });
    };

    const readSlice = () => {
      if (isPaused) return;
      
      const slice = fileToSend.slice(offset, offset + CHUNK_SIZE);
      reader.readAsArrayBuffer(slice);
    };

    const sendChunk = (chunk: ArrayBuffer) => {
      // Flow control: check buffer before sending
      if (dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        if (!isPaused) {
          isPaused = true;
          console.log('⏸️ Buffer full, pausing transfer. Buffered:', dataChannel.bufferedAmount);
        }
        return;
      }

      if (isPaused) {
        isPaused = false;
      }

      try {
        dataChannel.send(chunk);
        offset += chunk.byteLength;
        
        // Throttled progress update
        updateProgress(offset);

        if (offset < fileToSend.size) {
          // Use requestAnimationFrame for better scheduling
          requestAnimationFrame(() => {
            readSlice();
          });
        } else {
          // Final update
          updateProgress(offset, true);
          
          dataChannel.send(JSON.stringify({ type: 'file-end' }));
          setTransfers(prev => prev.map(t => 
            t.id === transferId ? { ...t, status: 'completed', progress: 100 } : t
          ));
          
          logSystemEvent.transferCompleted(transferId, Date.now() - startTime, fileToSend.size, 0);
          
          // Clean up IndexedDB entry after successful transfer
          if (useIndexedDB && fileId) {
            deleteOutgoingFile(fileId).catch(error => {
              console.error('Failed to delete file from IndexedDB:', error);
            });
          }
          
          // Keep transfer reference for potential retries (clean up after timeout)
          setTimeout(() => {
            activeTransfersRef.current.delete(transferId);
          }, 60000); // Keep for 60 seconds after completion for retries
          
          console.log('✅ File transfer completed - keeping data channel open for future transfers');
        }
      } catch (error) {
        console.error('❌ Error sending chunk:', error);
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
        logSystemEvent.transferFailed(transferId, 'transfer_failed', Date.now() - startTime);
      }
    };

    reader.onload = (event) => {
      if (event.target?.result && dataChannel.readyState === 'open') {
        const chunk = event.target.result as ArrayBuffer;
        
        // Send metadata first if it's the first chunk
        if (offset === 0) {
          dataChannel.send(JSON.stringify({
            type: 'file-start',
            name: fileToSend.name,
            size: fileToSend.size,
            fileType: fileToSend.type,
            chunkSize: CHUNK_SIZE,
            useIndexedDB: useIndexedDB || false
          }));
        }

        sendChunk(chunk);
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

  // Function to resend specific chunks by index
  const resendChunks = async (
    transferId: string,
    chunkIndices: number[]
  ) => {
    const transfer = activeTransfersRef.current.get(transferId);
    if (!transfer) {
      console.error(`❌ Transfer ${transferId} not found for retry`);
      return;
    }

    const { dataChannel, file, fileId, useIndexedDB, chunkSize } = transfer;
    
    if (dataChannel.readyState !== 'open') {
      console.error(`❌ Data channel not open for retry: ${dataChannel.readyState}`);
      return;
    }

    console.log(`🔄 Retrying ${chunkIndices.length} chunks for transfer ${transferId}`);
    
    let fileToSend = file;
    
    // Load from IndexedDB if needed
    if (useIndexedDB && fileId) {
      try {
        const { getOutgoingFile } = await import('../utils/indexedDB');
        fileToSend = await getOutgoingFile(fileId);
      } catch (error) {
        console.error('❌ Failed to load file from IndexedDB for retry:', error);
        return;
      }
    }

    const reader = new FileReader();
    let chunksSent = 0;

    const sendChunkByIndex = (chunkIndex: number) => {
      const startOffset = chunkIndex * chunkSize;
      const endOffset = Math.min(startOffset + chunkSize, fileToSend.size);
      const slice = fileToSend.slice(startOffset, endOffset);
      
      reader.onload = (event) => {
        if (event.target?.result && dataChannel.readyState === 'open') {
          const chunk = event.target.result as ArrayBuffer;
          
          // Send retry chunk with metadata
          dataChannel.send(JSON.stringify({
            type: 'chunk-retry',
            chunkIndex: chunkIndex,
            transferId: transferId
          }));
          
          dataChannel.send(chunk);
          chunksSent++;
          
          console.log(`✅ Resent chunk ${chunkIndex} (${chunk.byteLength} bytes)`);
          
          // Send next chunk if any remaining
          if (chunksSent < chunkIndices.length) {
            sendChunkByIndex(chunkIndices[chunksSent]);
          } else {
            console.log(`✅ Finished resending ${chunksSent} chunks`);
          }
        }
      };
      
      reader.onerror = () => {
        console.error(`❌ Error reading chunk ${chunkIndex} for retry`);
      };
      
      reader.readAsArrayBuffer(slice);
    };

    // Start sending chunks
    if (chunkIndices.length > 0) {
      sendChunkByIndex(chunkIndices[0]);
    }
  };

  // Helper function to process file reconstruction after verification
  const processFileReconstruction = async (
    receivedFile: { 
      name: string; 
      size: number; 
      type: string; 
      receivedSize: number;
      blobParts: BlobPart[];
      useIndexedDB: boolean;
      transferId: string;
    },
    from: string
  ) => {
    let blob: Blob;
    let reconstructionError: Error | null = null;
    
    try {
      if (receivedFile.useIndexedDB) {
        const { reconstructFileFromIDB, cleanupTransfer } = await import('../utils/indexedDB');
        try {
          console.log('📦 Reconstructing file from IndexedDB...');
          blob = await reconstructFileFromIDB(receivedFile.transferId);
          console.log(`✅ Reconstructed blob from IndexedDB: ${blob.size} bytes`);
          
          // Verify blob size
          if (blob.size !== receivedFile.size) {
            throw new Error(`Blob size mismatch: expected ${receivedFile.size}, got ${blob.size}`);
          }
          
          await cleanupTransfer(receivedFile.transferId);
          console.log('🧹 Cleaned up IndexedDB entries');
        } catch (error) {
          reconstructionError = error instanceof Error ? error : new Error(String(error));
          console.error('❌ Failed to reconstruct from IndexedDB:', reconstructionError);
          
          // Try fallback to memory if available
          if (receivedFile.blobParts.length > 0) {
            console.log('🔄 Attempting fallback to memory reconstruction...');
            try {
              blob = new Blob(receivedFile.blobParts, { type: receivedFile.type });
              if (blob.size !== receivedFile.size) {
                throw new Error(`Memory blob size mismatch: expected ${receivedFile.size}, got ${blob.size}`);
              }
              console.log('✅ Fallback to memory successful');
              reconstructionError = null;
            } catch (fallbackError) {
              console.error('❌ Fallback to memory also failed:', fallbackError);
              throw reconstructionError; // Re-throw original error
            }
          } else {
            throw reconstructionError;
          }
        }
      } else {
        console.log('📝 Reconstructing file from memory...');
        if (receivedFile.blobParts.length === 0) {
          throw new Error('No blob parts available for reconstruction');
        }
        blob = new Blob(receivedFile.blobParts, { type: receivedFile.type });
        console.log(`✅ Reconstructed blob from memory: ${blob.size} bytes`);
        
        // Verify blob size
        if (blob.size !== receivedFile.size) {
          throw new Error(`Blob size mismatch: expected ${receivedFile.size}, got ${blob.size}`);
        }
      }
      
      // Create object URL
      const url = URL.createObjectURL(blob);
      console.log('🔗 Created object URL for download');
      
      // Create File object (for large files, this might be slow but necessary)
      let file: File;
      try {
        file = new File([blob], receivedFile.name, { 
          type: receivedFile.type,
          lastModified: Date.now()
        });
        console.log('📄 Created File object');
      } catch (fileError) {
        console.error('❌ Failed to create File object:', fileError);
        // For very large files, File constructor might fail
        // Store blob directly and handle download differently
        throw new Error('File object creation failed - file may be too large');
      }
      
      // Store for transfer complete modal
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
      
      const transferIdToComplete = receivedFile.transferId;
      receivedFilesRef.current.delete(from);
      
      // Update transfer status by transferId
      setTransfers(prev => prev.map(t => 
        t.id === transferIdToComplete && t.status === 'transferring' 
          ? { ...t, status: 'completed', progress: 100 } 
          : t
      ));
      
      // Track file received
      logSystemEvent.fileReceived(receivedFile.type, receivedFile.size);
      
      // Play success sound
      playSuccessSound();
      
      // Show success notification
      if (addToast) {
        addToast('success', `File received: ${receivedFile.name} from ${getPeerName(from)}`);
      }
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('File Received', {
          body: `Successfully received ${receivedFile.name} from ${getPeerName(from)}`,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('❌ File reconstruction failed:', error);
      const transferIdToComplete = receivedFile.transferId;
      receivedFilesRef.current.delete(from);
      
      // Update transfer status to failed
      setTransfers(prev => prev.map(t => 
        t.id === transferIdToComplete && t.status === 'transferring' 
          ? { ...t, status: 'failed' } 
          : t
      ));
      
      if (addToast) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        addToast('error', `Failed to reconstruct file: ${receivedFile.name}. ${errorMsg}`);
      }
    }
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
      
      // Set up data channel handler (if not already set up)
      // This handler will receive data channels created by the other peer
      // We need to set this up even if connection exists, to handle bidirectional transfers
      if (!pc.ondatachannel) {
        pc.ondatachannel = (event) => {
          const dataChannel = event.channel;
          console.log('📥 Data channel opened for receiving');
          
          // Store the data channel for accept/reject operations
          // Use peer.id as key for backward compatibility with accept/reject functions
          dataChannelsRef.current.set(from, dataChannel);
          
          dataChannel.onmessage = (event) => {
            if (typeof event.data === 'string') {
              try {
                const message = JSON.parse(event.data);
                if (message.type === 'file-request') {
                  console.log('📥 Incoming file request:', message);
                  
                  // Log incoming file event (triggers auto-upload)
                  logSystemEvent.fileReceived(message.fileType, message.fileSize);
                  
                  // Add to incoming files list
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
                  
                  // Play chime sound
                  playChime();
                  
                  // Show toast notification
                  if (addToast) {
                    addToast('info', `Incoming file: ${message.fileName} from ${getPeerName(from)}`);
                  }
                  
                  // Show browser notification if available
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Incoming File', {
                      body: `${message.fileName} (${formatFileSize(message.fileSize)}) from ${getPeerName(from)}`,
                      icon: '/favicon.ico'
                    });
                  }
                  
                } else if (message.type === 'file-start') {
                  console.log('📥 Receiving file:', message.name);
                  
                  // Determine if we should use IndexedDB (async operation)
                  const transferId = `receive-${from}-${Date.now()}-${Math.random()}`;
                  const startTime = Date.now();
                  
                  // Calculate expected chunk count
                  const chunkSize = message.chunkSize || 8192;
                  const expectedChunks = Math.ceil(message.size / chunkSize);
                  
                  // Set up received file immediately (synchronously) to avoid race conditions
                  receivedFilesRef.current.set(from, {
                    name: message.name,
                    size: message.size,
                    type: message.fileType,
                    receivedSize: 0,
                    blobParts: [],
                    startTime: startTime,
                    lastProgressUpdate: 0,
                    lastProgressSize: 0, // Track size at last progress update
                    useIndexedDB: false, // Will be updated async
                    transferId: transferId,
                    chunkIndex: 0,
                    expectedChunks: expectedChunks,
                    receivedChunkIndices: new Set<number>(),
                    pendingChunkOperations: [], // Track pending async chunk storage operations
                    nextRetryChunkIndex: undefined // Track chunk index for retry chunks
                  });
                  
                  // Add transfer immediately
                  setTransfers(prev => {
                    const alreadyExists = prev.some(t =>
                      t.peer.id === from &&
                      t.file.name === message.name &&
                      t.file.type === message.fileType &&
                      t.status !== 'completed' &&
                      t.status !== 'failed'
                    );
                    if (!alreadyExists) {
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
                    } else {
                      return prev.map(t =>
                        t.peer.id === from && t.file.name === message.name && t.file.type === message.fileType && t.status !== 'completed' && t.status !== 'failed'
                          ? { ...t, status: 'transferring', progress: 0, id: transferId }
                          : t
                      );
                    }
                  });
                  
                  // Handle IndexedDB setup asynchronously (non-blocking)
                  // Use IndexedDB for large files (>50MB) on all devices, not just mobile
                  (async () => {
                    const { INDEXEDDB_CONSTANTS } = await import('@sharedrop/config');
                    const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB
                    const shouldUseIDB = message.size > LARGE_FILE_THRESHOLD || 
                                        (message.useIndexedDB && isMobileDevice() && message.size > INDEXEDDB_CONSTANTS.INDEXEDDB_MOBILE_THRESHOLD);
                    
                    if (shouldUseIDB) {
                      const { storeIncomingMetadata } = await import('../utils/indexedDB');
                      const chunkSize = message.chunkSize || 8192;
                      const chunkCount = Math.ceil(message.size / chunkSize);
                      
                      try {
                        await storeIncomingMetadata(transferId, {
                          name: message.name,
                          size: message.size,
                          type: message.fileType,
                          chunkCount
                        });
                        console.log(`📦 Storing incoming file metadata to IndexedDB (${chunkCount} chunks)`);
                        
                        // Update the receivedFile to use IndexedDB
                        const receivedFile = receivedFilesRef.current.get(from);
                        if (receivedFile) {
                          receivedFile.useIndexedDB = true;
                          console.log('✅ Large file will use IndexedDB for storage');
                        }
                      } catch (error) {
                        console.error('Failed to store metadata to IndexedDB:', error);
                        // Continue with memory storage (may fail for very large files)
                      }
                    } else {
                      console.log(`📝 Small file (${(message.size / 1024 / 1024).toFixed(2)}MB) will use memory storage`);
                    }
                  })();
                } else if (message.type === 'chunk-retry') {
                  // This is a metadata message before a retry chunk
                  // The actual chunk will come as binary data next
                  const receivedFile = receivedFilesRef.current.get(from);
                  if (receivedFile && receivedFile.transferId === message.transferId) {
                    receivedFile.nextRetryChunkIndex = message.chunkIndex;
                    console.log(`🔄 Receiving retry chunk ${message.chunkIndex} for transfer ${message.transferId}`);
                  }
                  // The chunk will be handled in the binary data handler below
                } else if (message.type === 'file-end') {
                  const receivedFile = receivedFilesRef.current.get(from);
                  if (receivedFile) {
                    console.log(`📥 File transfer complete. Received: ${receivedFile.receivedSize} / ${receivedFile.size} bytes`);
                    
                    // Wait for all pending async chunk storage operations to complete
                    // This ensures IndexedDB operations finish before verification
                    (async () => {
                      try {
                        // Wait for all pending chunk storage operations (especially for IndexedDB)
                        if (receivedFile.pendingChunkOperations.length > 0) {
                          console.log(`⏳ Waiting for ${receivedFile.pendingChunkOperations.length} pending chunk operations to complete...`);
                          await Promise.all(receivedFile.pendingChunkOperations);
                          console.log(`✅ All chunk storage operations completed`);
                          
                          // Additional wait to ensure IndexedDB transactions are committed
                          await new Promise(resolve => setTimeout(resolve, 200));
                        } else {
                          // Small delay even if no pending operations (for consistency)
                          await new Promise(resolve => setTimeout(resolve, 50));
                        }
                        
                        // Verify we received the complete file
                        // Allow small tolerance for rounding errors (1 byte)
                        const sizeDifference = Math.abs(receivedFile.receivedSize - receivedFile.size);
                        if (sizeDifference > 1) {
                          console.error(`❌ File size mismatch! Expected: ${receivedFile.size}, Received: ${receivedFile.receivedSize}, Difference: ${sizeDifference}`);
                          
                          // Calculate which chunks might be missing based on size difference
                          const chunkSize = receivedFile.size / receivedFile.expectedChunks;
                          const missingBytes = receivedFile.size - receivedFile.receivedSize;
                          const estimatedMissingChunks = Math.ceil(missingBytes / chunkSize);
                          
                          // Request retry for potentially missing chunks
                          const dataChannel = dataChannelsRef.current.get(from);
                          if (dataChannel && dataChannel.readyState === 'open') {
                            // Calculate missing chunk indices based on received chunks
                            const missingChunkIndices: number[] = [];
                            for (let i = 0; i < receivedFile.expectedChunks; i++) {
                              if (!receivedFile.receivedChunkIndices.has(i)) {
                                missingChunkIndices.push(i);
                              }
                            }
                            
                            if (missingChunkIndices.length > 0) {
                              console.log(`🔄 Requesting retry for ${missingChunkIndices.length} missing chunks`);
                              dataChannel.send(JSON.stringify({
                                type: 'chunk-retry-request',
                                transferId: receivedFile.transferId,
                                chunkIndices: missingChunkIndices
                              }));
                              
                              setTransfers(prev => prev.map(t => 
                                t.id === receivedFile.transferId && t.status === 'transferring' 
                                  ? { ...t, status: 'transferring' } // Keep as transferring during retry
                                  : t
                              ));
                              
                              if (addToast) {
                                addToast('info', `Requesting retry for ${missingChunkIndices.length} missing chunks...`);
                              }
                              
                              // Don't return - wait for retry chunks
                              return;
                            }
                          }
                          
                          // If we can't retry, mark as failed
                          setTransfers(prev => prev.map(t => 
                            t.id === receivedFile.transferId && t.status === 'transferring' 
                              ? { ...t, status: 'failed' } 
                              : t
                          ));
                          if (addToast) {
                            addToast('error', `File transfer incomplete: ${receivedFile.name} (size mismatch: ${sizeDifference} bytes)`);
                          }
                          return;
                        }
                        
                        // Verify chunks - prioritize size check over chunk index tracking
                        // Size is the ultimate truth: if we have all bytes, we have the file
                        const sizeMatches = Math.abs(receivedFile.receivedSize - receivedFile.size) <= 1;
                        
                        if (receivedFile.useIndexedDB) {
                          try {
                            const idbUtils = await import('../utils/indexedDB');
                            const db = await idbUtils.initDB();
                            
                            // Check IndexedDB directly for actual stored chunks
                            const chunkCheckPromise = new Promise<{ chunks: any[], missing: number[] }>((resolve) => {
                              const transaction = db.transaction(['incoming-chunks'], 'readonly');
                              const store = transaction.objectStore('incoming-chunks');
                              const index = store.index('transferId');
                              const request = index.getAll(receivedFile.transferId);
                              
                              request.onsuccess = () => {
                                const chunks = request.result || [];
                                const storedIndices = new Set(chunks.map((c: any) => c.chunkIndex));
                                const missingChunks: number[] = [];
                                
                                for (let i = 0; i < receivedFile.expectedChunks; i++) {
                                  if (!storedIndices.has(i)) {
                                    missingChunks.push(i);
                                  }
                                }
                                
                                resolve({ chunks, missing: missingChunks });
                              };
                              
                              request.onerror = () => {
                                resolve({ chunks: [], missing: [] });
                              };
                            });
                            
                            const { chunks, missing } = await chunkCheckPromise;
                            
                            console.log(`🔍 IndexedDB verification: expected ${receivedFile.expectedChunks}, found ${chunks.length} chunks`);
                            console.log(`   In-memory indices tracked: ${receivedFile.receivedChunkIndices.size}`);
                            console.log(`   Received size: ${receivedFile.receivedSize}/${receivedFile.size} bytes`);
                            
                            // If size matches, we have all the data - chunk index tracking might be off
                            if (missing.length > 0) {
                              if (sizeMatches) {
                                // Size matches but chunk indices don't - likely a tracking issue, not actual missing data
                                console.warn(`⚠️ Chunk index mismatch (${missing.length} missing indices) but size matches - proceeding with reconstruction`);
                                console.warn(`   Missing indices: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? `... (${missing.length} total)` : ''}`);
                              } else {
                                // Both size and chunks don't match - real problem
                                console.error(`❌ Missing chunks in IndexedDB: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? `... (${missing.length} total)` : ''}`);
                                console.error(`   Expected: ${receivedFile.expectedChunks}, Found: ${chunks.length}, Missing: ${missing.length}`);
                                console.error(`   Received size: ${receivedFile.receivedSize}, Expected: ${receivedFile.size}, Difference: ${receivedFile.size - receivedFile.receivedSize}`);
                                
                                // Request retry for missing chunks
                                const dataChannel = dataChannelsRef.current.get(from);
                                if (dataChannel && dataChannel.readyState === 'open') {
                                  console.log(`🔄 Requesting retry for ${missing.length} missing chunks`);
                                  dataChannel.send(JSON.stringify({
                                    type: 'chunk-retry-request',
                                    transferId: receivedFile.transferId,
                                    chunkIndices: missing
                                  }));
                                  
                                  setTransfers(prev => prev.map(t => 
                                    t.id === receivedFile.transferId && t.status === 'transferring' 
                                      ? { ...t, status: 'transferring' } // Keep as transferring during retry
                                      : t
                                  ));
                                  
                                  if (addToast) {
                                    addToast('info', `Requesting retry for ${missing.length} missing chunks...`);
                                  }
                                  
                                  // Don't return - wait for retry chunks
                                  return;
                                }
                                
                                // If we can't retry, mark as failed
                                setTransfers(prev => prev.map(t => 
                                  t.id === receivedFile.transferId && t.status === 'transferring' 
                                    ? { ...t, status: 'failed' } 
                                    : t
                                ));
                                if (addToast) {
                                  addToast('error', `File transfer incomplete: missing ${missing.length} chunks`);
                                }
                                return;
                              }
                            } else {
                              console.log(`✅ All ${receivedFile.expectedChunks} chunks verified in IndexedDB`);
                            }
                          } catch (error) {
                            console.error('❌ Error verifying chunks in IndexedDB:', error);
                            // Fall back to size check - if size matches, proceed
                            if (!sizeMatches) {
                              console.error(`❌ Size mismatch: received ${receivedFile.receivedSize}, expected ${receivedFile.size}`);
                              setTransfers(prev => prev.map(t => 
                                t.id === receivedFile.transferId && t.status === 'transferring' 
                                  ? { ...t, status: 'failed' } 
                                  : t
                              ));
                              if (addToast) {
                                addToast('error', `File transfer incomplete: size mismatch`);
                              }
                              return;
                            } else {
                              console.warn('⚠️ Could not verify chunks in IndexedDB, but size matches - proceeding');
                            }
                          }
                        } else {
                          // For memory files, verify we have the right number of blob parts
                          const expectedBlobParts = receivedFile.expectedChunks;
                          if (receivedFile.blobParts.length !== expectedBlobParts && !sizeMatches) {
                            console.warn(`⚠️ Blob parts count mismatch: expected ${expectedBlobParts}, got ${receivedFile.blobParts.length}`);
                            // If size matches, it's fine - last chunk might be smaller
                          }
                        }
                        
                        // Continue with file reconstruction
                        await processFileReconstruction(receivedFile, from);
                      } catch (error) {
                        console.error('❌ Error during file verification:', error);
                        setTransfers(prev => prev.map(t => 
                          t.id === receivedFile.transferId && t.status === 'transferring' 
                            ? { ...t, status: 'failed' } 
                            : t
                        ));
                        if (addToast) {
                          addToast('error', `File transfer verification failed: ${receivedFile.name}`);
                        }
                      }
                    })();
                  } else {
                    console.error('❌ Received file-end but no file metadata found');
                  }
                }
              } catch (error) {
                console.error('❌ Error parsing message:', error);
              }
            } else {
              // Binary data (file chunk)
              const receivedFile = receivedFilesRef.current.get(from);
              if (!receivedFile) {
                console.warn('⚠️ Received chunk but no file metadata found for', from);
                return;
              }
              
              // Store chunk synchronously first, then handle async operations
              const chunkSize = event.data.byteLength || (event.data as ArrayBuffer).byteLength || 0;
              
              // Update received size immediately
              receivedFile.receivedSize += chunkSize;
              
              // Store chunk to IndexedDB or memory (async, non-blocking)
              // For large files, prioritize IndexedDB; for small files, use memory
              // Check if this is a retry chunk (has specific index) or a regular sequential chunk
              let currentChunkIndex: number;
              let isRetryChunk = false;
              if (receivedFile.nextRetryChunkIndex !== undefined) {
                // This is a retry chunk - use the specific index
                currentChunkIndex = receivedFile.nextRetryChunkIndex;
                receivedFile.nextRetryChunkIndex = undefined; // Clear it
                isRetryChunk = true;
                console.log(`🔄 Processing retry chunk ${currentChunkIndex} (${chunkSize} bytes)`);
                
                // For retry chunks, we might be replacing existing data
                // Adjust receivedSize if this chunk was already counted
                if (receivedFile.receivedChunkIndices.has(currentChunkIndex)) {
                  // This chunk was already received - we're replacing it
                  // Don't double-count the size, but do update the chunk data
                  console.log(`   Replacing existing chunk ${currentChunkIndex}`);
                } else {
                  // New chunk - add to received indices
                  receivedFile.receivedChunkIndices.add(currentChunkIndex);
                }
              } else {
                // Regular sequential chunk
                currentChunkIndex = receivedFile.chunkIndex;
                receivedFile.chunkIndex++;
                receivedFile.receivedChunkIndices.add(currentChunkIndex);
              }
              
              if (receivedFile.useIndexedDB) {
                // Store to IndexedDB asynchronously, but track the promise
                const chunkPromise = (async () => {
                  try {
                    const { storeIncomingChunk } = await import('../utils/indexedDB');
                    await storeIncomingChunk(receivedFile.transferId, currentChunkIndex, event.data);
                    
                    // Log progress for large files every 100 chunks
                    if (receivedFile.expectedChunks > 100 && currentChunkIndex % 100 === 0) {
                      console.log(`📦 Stored chunk ${currentChunkIndex}/${receivedFile.expectedChunks} to IndexedDB`);
                    }
                    
                    // If this was a retry chunk and we're now complete, re-verify
                    if (isRetryChunk && receivedFile.receivedSize >= receivedFile.size) {
                      console.log(`🔄 Retry chunk received, re-verifying file completion...`);
                      // Trigger re-verification by sending a file-end-like check
                      setTimeout(async () => {
                        const sizeMatches = Math.abs(receivedFile.receivedSize - receivedFile.size) <= 1;
                        if (sizeMatches) {
                          console.log(`✅ File complete after retry - proceeding with reconstruction`);
                          await processFileReconstruction(receivedFile, from);
                        }
                      }, 500);
                    }
                  } catch (error) {
                    console.error(`Failed to store chunk ${currentChunkIndex} to IndexedDB:`, error);
                    // Fallback to memory if IndexedDB fails
                    receivedFile.blobParts.push(event.data);
                  }
                })();
                
                // Track the promise so we can wait for it before verification
                receivedFile.pendingChunkOperations.push(chunkPromise);
                
                // Clean up completed promises to prevent memory leak
                chunkPromise.finally(() => {
                  const index = receivedFile.pendingChunkOperations.indexOf(chunkPromise);
                  if (index > -1) {
                    receivedFile.pendingChunkOperations.splice(index, 1);
                  }
                });
              } else {
                // Store to memory synchronously for small files
                // For retry chunks, replace the chunk at the correct index if it exists
                if (isRetryChunk && currentChunkIndex < receivedFile.blobParts.length) {
                  receivedFile.blobParts[currentChunkIndex] = event.data;
                } else {
                  // Ensure array is large enough, then set at index
                  while (receivedFile.blobParts.length <= currentChunkIndex) {
                    receivedFile.blobParts.push(new ArrayBuffer(0));
                  }
                  receivedFile.blobParts[currentChunkIndex] = event.data;
                }
              }
              
              // Throttled progress update (synchronous calculation, async state update)
              const now = Date.now();
              // Use constants directly to avoid async import delay
              // For large files, use more frequent updates
              const isLargeFile = receivedFile.size > 100 * 1024 * 1024; // > 100MB
              const PROGRESS_UPDATE_INTERVAL = isLargeFile ? 50 : 100; // ms - more frequent for large files
              // For large files, use absolute size threshold instead of percentage
              const PROGRESS_CHANGE_THRESHOLD = isLargeFile 
                ? 1024 * 1024 // 1MB absolute threshold for large files
                : 0.1; // 0.1% for small files
              
              // Calculate cumulative size change since last update
              const sizeSinceLastUpdate = receivedFile.receivedSize - (receivedFile.lastProgressSize || 0);
              
              // Always update on first chunk or if enough time has passed
              const shouldUpdate = receivedFile.lastProgressUpdate === 0 || 
                                   (now - receivedFile.lastProgressUpdate) >= PROGRESS_UPDATE_INTERVAL;
              
              if (shouldUpdate) {
                const progress = (receivedFile.receivedSize / receivedFile.size) * 100;
                const lastProgress = receivedFile.lastProgressUpdate === 0 ? 0 : 
                  ((receivedFile.lastProgressSize || 0) / receivedFile.size) * 100;
                
                // For large files, check cumulative size change since last update; for small files, check percentage
                const progressChanged = isLargeFile
                  ? sizeSinceLastUpdate >= PROGRESS_CHANGE_THRESHOLD
                  : Math.abs(progress - lastProgress) >= PROGRESS_CHANGE_THRESHOLD;
                
                // Update if progress changed significantly or it's the first update
                if (receivedFile.lastProgressUpdate === 0 || progressChanged) {
                  receivedFile.lastProgressUpdate = now;
                  receivedFile.lastProgressSize = receivedFile.receivedSize; // Update tracked size
                  const elapsed = (now - receivedFile.startTime) / 1000;
                  const speed = elapsed > 0 ? receivedFile.receivedSize / elapsed : 0;
                  const timeRemaining = speed > 0 ? (receivedFile.size - receivedFile.receivedSize) / speed : 0;
                  
                  // Update transfer by transferId for more accurate matching
                  const transferId = receivedFile.transferId;
                  const currentProgress = Math.min(Math.round(progress * 10) / 10, 99.9);
                  const currentSpeed = Math.round(speed);
                  const currentTimeRemaining = Math.round(timeRemaining);
                  
                  // Update immediately without setTimeout for faster UI updates
                  setTransfers(prev => {
                    const updated = prev.map(t => {
                      if (t.id === transferId && t.status === 'transferring') {
                        if (isLargeFile && currentProgress % 1 === 0) {
                          // Log every 1% for large files
                          console.log(`📊 Large file progress: ${currentProgress.toFixed(1)}% (${(currentSpeed / 1024 / 1024).toFixed(2)} MB/s)`);
                        }
                        return { 
                          ...t, 
                          progress: currentProgress,
                          speed: currentSpeed,
                          timeRemaining: currentTimeRemaining
                        };
                      }
                      return t;
                    });
                    return updated;
                  });
                }
              }
            }
          };
          
          dataChannel.onerror = (error) => {
            console.error('❌ Data channel error:', error);
          };
          
          dataChannel.onclose = () => {
            console.log('📥 Data channel closed');
            // Remove from data channels ref
            dataChannelsRef.current.delete(from);
            // Don't remove WebRTC connection - it might be reused for future transfers
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
  }, [connections, createPeerConnection, onSignal, userId, addToast, peers, isConnected, storePendingSignal]);

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
  }, [transfers]);

  const acceptIncomingFile = useCallback((incomingFileId: string) => {
    const incomingFile = incomingFiles.find(f => f.id === incomingFileId);
    if (!incomingFile) {
      console.error('❌ Incoming file not found:', incomingFileId);
      return;
    }
    
    console.log('✅ Accepting incoming file:', incomingFile);
    
    // Find the data channel for this sender
    const dataChannel = dataChannelsRef.current.get(incomingFile.from);
    if (!dataChannel) {
      console.error('❌ Data channel not found for sender:', incomingFile.from);
      return;
    }
    
    if (dataChannel.readyState === 'open') {
      // Send acceptance message with the sender's transferId
      dataChannel.send(JSON.stringify({
        type: 'file-accepted',
        transferId: incomingFile.transferId
      }));
      
      // Remove from incoming files
      setIncomingFiles(prev => prev.filter(f => f.id !== incomingFileId));
      
      // Add to transfers list
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
      
      // Set up file receiving
      receivedFilesRef.current.set(incomingFile.from, {
        name: incomingFile.fileName,
        size: incomingFile.fileSize,
        type: incomingFile.fileType,
        receivedSize: 0,
        blobParts: [],
        startTime: Date.now(),
        lastProgressUpdate: 0,
        lastProgressSize: 0,
        useIndexedDB: false,
        transferId: transferId,
        chunkIndex: 0,
        expectedChunks: 0, // Will be set when file-start is received
        receivedChunkIndices: new Set<number>(),
        pendingChunkOperations: [],
        nextRetryChunkIndex: undefined
      });
      
      console.log('✅ File acceptance sent, transfer started');
    } else {
      console.error('❌ Data channel not open, state:', dataChannel.readyState);
    }
  }, [incomingFiles, getPeerName]);

  const rejectIncomingFile = useCallback((incomingFileId: string) => {
    const incomingFile = incomingFiles.find(f => f.id === incomingFileId);
    if (!incomingFile) {
      console.error('❌ Incoming file not found for rejection:', incomingFileId);
      return;
    }
    
    console.log('❌ Rejecting incoming file:', incomingFile);
    
    // Find the data channel for this sender
    const dataChannel = dataChannelsRef.current.get(incomingFile.from);
    if (dataChannel && dataChannel.readyState === 'open' && incomingFile) {
      // Send rejection message with the sender's transferId
      dataChannel.send(JSON.stringify({
        type: 'file-rejected',
        transferId: incomingFile.transferId
      }));
      console.log('✅ File rejection sent');
    } else {
      console.error('❌ Data channel not available for rejection');
    }
    
    // Remove from incoming files
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