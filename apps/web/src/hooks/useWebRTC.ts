import { useRef, useState, useCallback, useEffect } from 'react';
import { FileTransfer, Peer } from '../types';
import { formatFileSize } from '../utils/format';
import { playChime, playSuccessSound } from '../utils/sound';
import { logSystemEvent } from '../utils/eventLogger';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

const CHUNK_SIZE = 16384; // 16KB chunks

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
  const receivedFilesRef = useRef<Map<string, { name: string; size: number; type: string; chunks: ArrayBuffer[]; startTime: number }>>(new Map());
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
      // Reuse existing connection if available and healthy, otherwise create new one
      logSystemEvent.systemProcessStep(processName, 'checking_connection', {
        transferId,
        peerId: peer.id
      });
      
      let pc = connections.get(peer.id);
      
      // Check if existing connection is usable
      if (pc) {
        const state = pc.connectionState;
        if (state === 'connected' || state === 'connecting') {
          console.log(`♻️ Reusing existing WebRTC connection with ${peer.id} (state: ${state})`);
          logSystemEvent.systemProcessStep(processName, 'reusing_connection', {
            transferId,
            peerId: peer.id,
            connectionState: state
          });
        } else if (state === 'closed' || state === 'failed') {
          console.log(`🔄 Existing connection ${state}, creating new one`);
          logSystemEvent.systemProcessStep(processName, 'creating_peer_connection', {
            transferId,
            peerId: peer.id
          });
          pc = createPeerConnection(peer.id);
        } else {
          // disconnected or other states - try to reuse but create new if needed
          console.log(`⚠️ Existing connection in ${state} state, creating new one for reliability`);
          logSystemEvent.systemProcessStep(processName, 'creating_peer_connection', {
            transferId,
            peerId: peer.id
          });
          pc = createPeerConnection(peer.id);
        }
      } else {
        console.log(`🆕 Creating new WebRTC connection with ${peer.id}`);
        logSystemEvent.systemProcessStep(processName, 'creating_peer_connection', {
          transferId,
          peerId: peer.id
        });
        pc = createPeerConnection(peer.id);
      }
      
      // Create data channel
      logSystemEvent.systemProcessStep(processName, 'creating_data_channel', {
        transferId,
        peerId: peer.id
      });
      
      const dataChannel = pc.createDataChannel('file-transfer', {
        ordered: true
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
              // Start file transfer
              sendFileInChunks(dataChannel, file, transferId);
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
        
        // Remove from data channels ref
        dataChannelsRef.current.delete(peer.id);
        
        // Don't remove the WebRTC connection immediately - it might be reused
        // Only remove if the connection state is actually failed/closed
        // The connection state change handler will handle cleanup if needed
        console.log('ℹ️ Data channel closed - WebRTC connection may still be usable for future transfers');
      };
      dataChannelsRef.current.set(peer.id, dataChannel);
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
  }, [connections, createPeerConnection, onSignal, userId, storePendingRequest, isConnected]);

  const sendFileInChunks = (dataChannel: RTCDataChannel, file: File, transferId: string) => {
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
        const speed = offset / (elapsed / 1000); // bytes per second
        const timeRemaining = speed > 0 ? (file.size - offset) / speed : 0;

        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { 
            ...t, 
            progress: Math.round(progress),
            speed: Math.round(speed),
            timeRemaining: Math.round(timeRemaining)
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
          
          // Track successful file transfer
          logSystemEvent.transferCompleted(transferId, Date.now() - startTime, file.size, 0);
          
          // Don't close data channel immediately - keep it open for potential future transfers
          // Only close if explicitly needed (e.g., user cancels or connection fails)
          // This allows multiple file transfers without re-establishing WebRTC connection
          console.log('✅ File transfer completed - keeping data channel open for future transfers');
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
        
        // Set up data channel for receiving
        pc.ondatachannel = (event) => {
          const dataChannel = event.channel;
          console.log('📥 Data channel opened for receiving');
          
          // Store the data channel for accept/reject operations
          dataChannelsRef.current.set(from, dataChannel);
          
          dataChannel.onmessage = (event) => {
            if (typeof event.data === 'string') {
              try {
                const message = JSON.parse(event.data);
                if (message.type === 'file-request') {
                  console.log('📥 Incoming file request:', message);
                  
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
                  receivedFilesRef.current.set(from, {
                    name: message.name,
                    size: message.size,
                    type: message.fileType,
                    chunks: [],
                    startTime: Date.now()
                  });
                  // Only add transfer if not already present for this peer and file
                  setTransfers(prev => {
                    const alreadyExists = prev.some(t =>
                      t.peer.id === from &&
                      t.file.name === message.name &&
                      t.file.type === message.fileType &&
                      t.status !== 'completed'
                    );
                    if (alreadyExists) {
                      // Update status to 'transferring' if needed
                      return prev.map(t =>
                        t.peer.id === from && t.file.name === message.name && t.file.type === message.fileType && t.status !== 'completed'
                          ? { ...t, status: 'transferring' }
                          : t
                      );
                    } else {
                      // Add new transfer if not present
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
                  if (receivedFile) {
                    console.log('📥 File received, reconstructing...');
                    // Reconstruct file
                    const blob = new Blob(receivedFile.chunks, { type: receivedFile.type });
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
                    receivedFilesRef.current.delete(from);
                    // Update transfer status
                    setTransfers(prev => prev.map(t => 
                      t.peer.id === from && t.status === 'transferring' ? { ...t, status: 'completed', progress: 100 } : t
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
                  }
                }
              } catch (error) {
                console.error('❌ Error parsing message:', error);
              }
            } else {
              // Binary data (file chunk)
              const receivedFile = receivedFilesRef.current.get(from);
              if (receivedFile) {
                receivedFile.chunks.push(event.data);
                
                // Calculate progress, speed, and ETA
                const totalReceived = receivedFile.chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
                const progress = (totalReceived / receivedFile.size) * 100;
                const elapsed = Date.now() - receivedFile.startTime;
                const speed = elapsed > 0 ? totalReceived / (elapsed / 1000) : 0; // bytes per second
                const timeRemaining = speed > 0 ? (receivedFile.size - totalReceived) / speed : 0;
                
                setTransfers(prev => prev.map(t => 
                  t.peer.id === from && t.status === 'transferring' ? { 
                    ...t, 
                    progress: Math.round(progress),
                    speed: Math.round(speed),
                    timeRemaining: Math.round(timeRemaining)
                  } : t
                ));
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