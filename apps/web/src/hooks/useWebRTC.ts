import { useRef, useState, useCallback } from 'react';
import { FileTransfer, Peer } from '../types';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

const CHUNK_SIZE = 16384; // 16KB chunks

export const useWebRTC = (onSignal: (to: string, from: string, data: any) => void, userId: string) => {
  const [connections, setConnections] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [transfers, setTransfers] = useState<FileTransfer[]>([]);
  const dataChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const receivedFilesRef = useRef<Map<string, { name: string; size: number; type: string; chunks: ArrayBuffer[] }>>(new Map());

  const createPeerConnection = useCallback((peerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
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
      
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Update transfer status to failed
        setTransfers(prev => prev.map(t => 
          t.peer.id === peerId && t.status === 'connecting' ? { ...t, status: 'failed' } : t
        ));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection state with ${peerId}:`, pc.iceConnectionState);
    };

    setConnections(prev => new Map(prev).set(peerId, pc));
    return pc;
  }, [onSignal, userId]);

  const sendFile = useCallback(async (file: File, peer: Peer) => {
    const transferId = `${Date.now()}-${Math.random()}`;
    const transfer: FileTransfer = {
      id: transferId,
      file,
      peer,
      status: 'connecting',
      progress: 0
    };

    setTransfers(prev => [...prev, transfer]);

    try {
      let pc = connections.get(peer.id);
      if (!pc) {
        pc = createPeerConnection(peer.id);
      }

      // Create data channel
      const dataChannel = pc.createDataChannel('file-transfer', {
        ordered: true
      });

      dataChannel.onopen = () => {
        console.log('📤 Data channel opened for sending');
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'transferring' } : t
        ));
        
        // Start file transfer
        sendFileInChunks(dataChannel, file, transferId);
      };

      dataChannel.onerror = (error) => {
        console.error('❌ Data channel error:', error);
        setTransfers(prev => prev.map(t => 
          t.id === transferId ? { ...t, status: 'failed' } : t
        ));
      };

      dataChannel.onclose = () => {
        console.log('📤 Data channel closed');
      };

      dataChannelsRef.current.set(peer.id, dataChannel);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
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
  }, [connections, createPeerConnection, onSignal, userId]);

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
    };

    readSlice();
  };

  const handleSignal = useCallback(async (from: string, data: any) => {
    let pc = connections.get(from);
    
    if (data.type === 'offer') {
      if (!pc) {
        pc = createPeerConnection(from);
        
        // Set up data channel for receiving
        pc.ondatachannel = (event) => {
          const dataChannel = event.channel;
          console.log('📥 Data channel opened for receiving');
          
          dataChannel.onmessage = (event) => {
            if (typeof event.data === 'string') {
              try {
                const message = JSON.parse(event.data);
                if (message.type === 'file-start') {
                  console.log('📥 Receiving file:', message.name);
                  receivedFilesRef.current.set(from, {
                    name: message.name,
                    size: message.size,
                    type: message.fileType,
                    chunks: []
                  });
                  
                  // Add transfer to list for UI
                  const transferId = `receive-${Date.now()}-${Math.random()}`;
                  setTransfers(prev => [...prev, {
                    id: transferId,
                    file: new File([], message.name, { type: message.fileType }),
                    peer: { id: from, name: 'Unknown', emoji: '📱', color: '#F6C148', isOnline: true },
                    status: 'transferring',
                    progress: 0
                  }]);
                } else if (message.type === 'file-end') {
                  const receivedFile = receivedFilesRef.current.get(from);
                  if (receivedFile) {
                    console.log('📥 File received, reconstructing...');
                    
                    // Reconstruct file
                    const blob = new Blob(receivedFile.chunks, { type: receivedFile.type });
                    const url = URL.createObjectURL(blob);
                    
                    // Trigger download
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = receivedFile.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    URL.revokeObjectURL(url);
                    receivedFilesRef.current.delete(from);
                    
                    // Update transfer status
                    setTransfers(prev => prev.map(t => 
                      t.peer.id === from && t.status === 'transferring' ? { ...t, status: 'completed', progress: 100 } : t
                    ));
                    
                    // Show success notification
                    if ('Notification' in window && Notification.permission === 'granted') {
                      new Notification('File Received', {
                        body: `Successfully received ${receivedFile.name}`,
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
  }, [connections, createPeerConnection, onSignal, userId]);

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

  return {
    transfers,
    sendFile,
    handleSignal,
    cancelTransfer
  };
};