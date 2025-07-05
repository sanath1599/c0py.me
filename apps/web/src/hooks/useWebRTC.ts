import { useRef, useState, useCallback, useEffect } from 'react';
import { FileTransfer, Peer } from '../types';
import { formatFileSize } from '../utils/format';
import { playChime, playSuccessSound } from '../utils/sound';
import { trackPrivacyEvents, trackFileTransfer, trackError } from '../utils/analytics';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

const CHUNK_SIZE = 16384; // 16KB chunks

export const useWebRTC = (
  onSignal: (to: string, from: string, data: any) => void, 
  userId: string,
  addToast?: (type: 'success' | 'error' | 'info', message: string) => void,
  peers?: Array<{ id: string; name: string; emoji: string; color: string }>
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
  const receivedFilesRef = useRef<Map<string, { name: string; size: number; type: string; chunks: ArrayBuffer[] }>>(new Map());
  const pendingFilesRef = useRef<Map<string, { file: File; peer: any; transferId: string }>>(new Map());
  const [completedReceived, setCompletedReceived] = useState<Array<{
    id: string;
    file: File;
    url: string;
    peer: { id: string; name: string; emoji: string; color: string };
  }>>([]);

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
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        removeConnection(peerId);
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
    const transferId = `${Date.now()}-${Math.random()}`;
    const transfer: FileTransfer = {
      id: transferId,
      file,
      peer,
      status: 'pending',
      progress: 0
    };
    setTransfers(prev => [...prev, transfer]);
    try {
      // Always create a new connection for each transfer
      const pc = createPeerConnection(peer.id);
      // Create data channel
      const dataChannel = pc.createDataChannel('file-transfer', {
        ordered: true
      });
      dataChannel.onopen = () => {
        console.log('📤 Data channel opened for sending');
        // Send file request first
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
              setTransfers(prev => prev.map(t =>
                t.id === transferId ? { ...t, status: 'transferring' } : t
              ));
              // Start file transfer
              sendFileInChunks(dataChannel, file, transferId);
            } else if (message.type === 'file-rejected' && message.transferId === transferId) {
              console.log('📤 File rejected');
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
        setTransfers(prev => prev.map(t =>
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
      };
      dataChannel.onclose = () => {
        console.log('📤 Data channel closed');
        // Remove from data channels ref
        dataChannelsRef.current.delete(peer.id);
        // Remove closed connection
        removeConnection(peer.id);
      };
      dataChannelsRef.current.set(peer.id, dataChannel);
      // Create offer
      console.log(`📤 Creating offer for ${peer.id}`);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(`📤 Sending offer to ${peer.id}`);
      onSignal(peer.id, userId, {
        type: 'offer',
        sdp: offer
      });
    } catch (error) {
      console.error('❌ Error sending file:', error);
      setTransfers(prev => prev.map(t =>
        t.id === transferId ? { ...t, status: 'failed' } : t
      ));
    }
  }, [createPeerConnection, onSignal, userId]);

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
          trackFileTransfer.completed(file.size, 'unknown');
          
          // Close data channel after a delay
          setTimeout(() => {
            if (dataChannel.readyState === 'open') {
              dataChannel.close();
            }
          }, 1000);
        }
      }
    };

    reader.onerror = () => {
      console.error('❌ Error reading file chunk');
      setTransfers(prev => prev.map(t => 
        t.id === transferId ? { ...t, status: 'failed' } : t
      ));
      trackFileTransfer.failed('unknown');
    };

    readSlice();
  };

  const handleSignal = useCallback(async (from: string, data: any) => {
    console.log(`📡 Received signal from ${from}:`, data.type);
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
                    chunks: []
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
                          file: new File([], message.name, { type: message.fileType }),
                          peer: { 
                            id: from, 
                            name: getPeerName(from), 
                            emoji: '📱', 
                            color: '#F6C148', 
                            isOnline: true 
                          },
                          status: 'transferring',
                          progress: 0
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
                    trackPrivacyEvents.fileReceived(receivedFile.type);
                    
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
                
                // Update progress
                const progress = (receivedFile.chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0) / receivedFile.size) * 100;
                setTransfers(prev => prev.map(t => 
                  t.peer.id === from && t.status === 'transferring' ? { ...t, progress: Math.round(progress) } : t
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
  }, [connections, createPeerConnection, onSignal, userId, addToast, peers]);

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
        file: new File([], incomingFile.fileName, { type: incomingFile.fileType }),
        peer: { 
          id: incomingFile.from, 
          name: getPeerName(incomingFile.from), 
          emoji: '📱', 
          color: '#F6C148', 
          isOnline: true 
        },
        status: 'transferring',
        progress: 0
      }]);
      
      // Set up file receiving
      receivedFilesRef.current.set(incomingFile.from, {
        name: incomingFile.fileName,
        size: incomingFile.fileSize,
        type: incomingFile.fileType,
        chunks: []
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