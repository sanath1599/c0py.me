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
    useIndexedDB: boolean;
    transferId: string;
    chunkIndex: number;
  }>>(new Map());
  const pendingFilesRef = useRef<Map<string, { file: File; peer: any; transferId: string }>>(new Map());
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
                  
                  // Set up received file immediately (synchronously) to avoid race conditions
                  receivedFilesRef.current.set(from, {
                    name: message.name,
                    size: message.size,
                    type: message.fileType,
                    receivedSize: 0,
                    blobParts: [],
                    startTime: startTime,
                    lastProgressUpdate: 0,
                    useIndexedDB: false, // Will be updated async
                    transferId: transferId,
                    chunkIndex: 0
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
                  (async () => {
                    const { INDEXEDDB_CONSTANTS } = await import('@sharedrop/config');
                    const shouldUseIDB = message.useIndexedDB && isMobileDevice() && message.size > INDEXEDDB_CONSTANTS.INDEXEDDB_MOBILE_THRESHOLD;
                    
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
                        console.log('📦 Storing incoming file metadata to IndexedDB');
                        
                        // Update the receivedFile to use IndexedDB
                        const receivedFile = receivedFilesRef.current.get(from);
                        if (receivedFile) {
                          receivedFile.useIndexedDB = true;
                        }
                      } catch (error) {
                        console.error('Failed to store metadata to IndexedDB:', error);
                        // Continue with memory storage
                      }
                    }
                  })();
                } else if (message.type === 'file-end') {
                  const receivedFile = receivedFilesRef.current.get(from);
                  if (receivedFile) {
                    console.log('📥 File received, reconstructing...');
                    
                    // Reconstruct file from IndexedDB or memory
                    (async () => {
                      let blob: Blob;
                      
                      if (receivedFile.useIndexedDB) {
                        const { reconstructFileFromIDB, cleanupTransfer } = await import('../utils/indexedDB');
                        try {
                          blob = await reconstructFileFromIDB(receivedFile.transferId);
                          await cleanupTransfer(receivedFile.transferId);
                          console.log('📦 Reconstructed file from IndexedDB');
                        } catch (error) {
                          console.error('Failed to reconstruct from IndexedDB:', error);
                          // Fallback to memory if available
                          blob = new Blob(receivedFile.blobParts, { type: receivedFile.type });
                        }
                      } else {
                        blob = new Blob(receivedFile.blobParts, { type: receivedFile.type });
                      }
                      
                      const url = URL.createObjectURL(blob);
                      // Store for transfer complete modal
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
                      const transferIdToComplete = receivedFile.transferId;
                      receivedFilesRef.current.delete(from);
                      // Update transfer status by transferId
                      setTransfers(prev => prev.map(t => 
                        t.id === transferIdToComplete && t.status === 'transferring' ? { ...t, status: 'completed', progress: 100 } : t
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
                    })();
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
              
              // Store chunk to IndexedDB or memory (async)
              (async () => {
                try {
                  if (receivedFile.useIndexedDB) {
                    const { storeIncomingChunk } = await import('../utils/indexedDB');
                    try {
                      await storeIncomingChunk(receivedFile.transferId, receivedFile.chunkIndex, event.data);
                      receivedFile.chunkIndex++;
                    } catch (error) {
                      console.error('Failed to store chunk to IndexedDB:', error);
                      // Fallback to memory
                      receivedFile.blobParts.push(event.data);
                    }
                  } else {
                    receivedFile.blobParts.push(event.data);
                  }
                } catch (error) {
                  console.error('Error storing chunk:', error);
                  // Still add to blobParts as fallback
                  receivedFile.blobParts.push(event.data);
                }
              })();
              
              // Throttled progress update (synchronous calculation, async state update)
              const now = Date.now();
              const { WEBRTC_CONSTANTS } = await import('@sharedrop/config');
              const PROGRESS_UPDATE_INTERVAL = WEBRTC_CONSTANTS.PROGRESS_UPDATE_INTERVAL;
              const PROGRESS_CHANGE_THRESHOLD = WEBRTC_CONSTANTS.PROGRESS_CHANGE_THRESHOLD;
              
              // Always update on first chunk or if enough time has passed
              const shouldUpdate = receivedFile.lastProgressUpdate === 0 || 
                                   (now - receivedFile.lastProgressUpdate) >= PROGRESS_UPDATE_INTERVAL;
              
              if (shouldUpdate) {
                const progress = (receivedFile.receivedSize / receivedFile.size) * 100;
                const lastProgress = receivedFile.lastProgressUpdate === 0 ? 0 : 
                  ((receivedFile.receivedSize - chunkSize) / receivedFile.size) * 100;
                
                // Update if progress changed significantly or it's the first update
                if (receivedFile.lastProgressUpdate === 0 || 
                    Math.abs(progress - lastProgress) >= PROGRESS_CHANGE_THRESHOLD) {
                  receivedFile.lastProgressUpdate = now;
                  const elapsed = (now - receivedFile.startTime) / 1000;
                  const speed = elapsed > 0 ? receivedFile.receivedSize / elapsed : 0;
                  const timeRemaining = speed > 0 ? (receivedFile.size - receivedFile.receivedSize) / speed : 0;
                  
                  // Update transfer by transferId for more accurate matching
                  const transferId = receivedFile.transferId;
                  const currentProgress = Math.min(Math.round(progress * 10) / 10, 99.9);
                  const currentSpeed = Math.round(speed);
                  const currentTimeRemaining = Math.round(timeRemaining);
                  
                  // Use setTimeout instead of requestAnimationFrame for more reliable updates
                  setTimeout(() => {
                    setTransfers(prev => prev.map(t => {
                      if (t.id === transferId && t.status === 'transferring') {
                        return { 
                          ...t, 
                          progress: currentProgress,
                          speed: currentSpeed,
                          timeRemaining: currentTimeRemaining
                        };
                      }
                      return t;
                    }));
                  }, 0);
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
        chunks: [],
        startTime: Date.now()
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