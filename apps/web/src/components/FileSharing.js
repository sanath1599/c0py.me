import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import './FileSharing.css';

const FileSharing = ({ userId, files, targetPeer }) => {
  const [transferProgress, setTransferProgress] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState('');
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  
  const peerConnections = useRef(new Map());
  const dataChannels = useRef(new Map());
  const fileChunks = useRef(new Map());
  const socketRef = useRef(null);
  const selectedFile = files && files.length > 0 ? files[0] : null;

  const handleOffer = useCallback(async (data) => {
    try {
      const peerConnection = new window.RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerConnections.current.set(data.from, peerConnection);
      peerConnection.ondatachannel = (event) => {
        const dataChannel = event.channel;
        dataChannels.current.set(data.from, dataChannel);
        setupDataChannel(dataChannel, data.from);
      };
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit('ice-candidate', {
            candidate: event.candidate,
            target: data.from
          });
        }
      };
      await peerConnection.setRemoteDescription(new window.RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socketRef.current.emit('answer', {
        answer: answer,
        target: data.from
      });
    } catch (error) {
      // handle error
    }
  }, [socketRef, setupDataChannel]);

  const handleAnswer = useCallback(async (data) => {
    try {
      const peerConnection = peerConnections.current.get(data.from);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new window.RTCSessionDescription(data.answer));
      }
    } catch (error) {
      // handle error
    }
  }, []);

  const handleIceCandidate = useCallback(async (data) => {
    try {
      const peerConnection = peerConnections.current.get(data.from);
      if (peerConnection) {
        await peerConnection.addIceCandidate(new window.RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      // handle error
    }
  }, []);

  const handleFileTransferRequest = useCallback((data) => {
    const transferId = uuidv4();
    const newTransfer = {
      id: transferId,
      fileName: data.fileName,
      fileSize: data.fileSize,
      from: data.userId,
      socketId: data.from
    };
    setPendingTransfers(prev => [...prev, newTransfer]);
  }, []);

  const sendFileChunks = useCallback((targetSocketId) => {
    const dataChannel = dataChannels.current.get(targetSocketId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      setTimeout(() => sendFileChunks(targetSocketId), 100);
      return;
    }

    const chunkSize = 16384; // 16KB chunks
    const reader = new FileReader();
    let offset = 0;

    // Send file start message
    dataChannel.send(JSON.stringify({
      type: 'file-start',
      fileName: selectedFile.name,
      fileSize: selectedFile.size
    }));

    const readNextChunk = () => {
      const slice = selectedFile.slice(offset, offset + chunkSize);
      reader.readAsArrayBuffer(slice);
    };

    reader.onload = (e) => {
      const chunk = e.target.result;
      dataChannel.send(JSON.stringify({
        type: 'file-chunk',
        chunk: chunk
      }));

      offset += chunk.byteLength;
      const progress = (offset / selectedFile.size) * 100;
      setTransferProgress(progress);

      if (offset < selectedFile.size) {
        readNextChunk();
      } else {
        // Send file end message
        dataChannel.send(JSON.stringify({
          type: 'file-end'
        }));
        setTransferStatus('File sent successfully!');
        setIsTransferring(false);
        setTransferProgress(0);
      }
    };

    readNextChunk();
  }, [selectedFile]);

  const handleFileTransferResponse = useCallback((data) => {
    if (data.accepted) {
      setTransferStatus('Transfer accepted, starting...');
      sendFileChunks(data.from);
    } else {
      setTransferStatus('Transfer rejected');
      setIsTransferring(false);
    }
  }, [sendFileChunks]);

  // Memoize setupDataChannel and file handlers if needed
  const setupDataChannel = useCallback((dataChannel, peerId) => {
    dataChannel.onopen = () => {};
    dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'file-start') {
        handleFileStart(message, peerId);
      } else if (message.type === 'file-chunk') {
        handleFileChunk(message, peerId);
      } else if (message.type === 'file-end') {
        handleFileEnd(message, peerId);
      }
    };
    dataChannel.onclose = () => {
      dataChannels.current.delete(peerId);
    };
  }, [handleFileStart, handleFileChunk, handleFileEnd]);

  const handleFileStart = useCallback((message, peerId) => {
    const { fileName, fileSize } = message;
    fileChunks.current.set(peerId, {
      fileName,
      fileSize,
      chunks: [],
      receivedSize: 0
    });
    setTransferStatus(`Receiving ${fileName}...`);
  }, []);

  const handleFileChunk = useCallback((message, peerId) => {
    const fileData = fileChunks.current.get(peerId);
    if (fileData) {
      fileData.chunks.push(message.chunk);
      fileData.receivedSize += message.chunk.byteLength;
      const progress = (fileData.receivedSize / fileData.fileSize) * 100;
      setTransferProgress(progress);
    }
  }, []);

  const handleFileEnd = useCallback((message, peerId) => {
    const fileData = fileChunks.current.get(peerId);
    if (fileData) {
      const blob = new Blob(fileData.chunks);
      const url = URL.createObjectURL(blob);
      const receivedFile = {
        id: uuidv4(),
        name: fileData.fileName,
        size: fileData.fileSize,
        url: url,
        receivedAt: new Date()
      };
      setReceivedFiles(prev => [...prev, receivedFile]);
      setTransferProgress(0);
      setTransferStatus('File received successfully!');
      fileChunks.current.delete(peerId);
    }
  }, []);

  // Connect to signaling server and set up event listeners
  useEffect(() => {
    if (!userId) return;
    const socket = io(process.env.REACT_APP_SIGNALING_SERVER || 'http://localhost:5000');
    socketRef.current = socket;
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('file-transfer-request', handleFileTransferRequest);
    socket.on('file-transfer-response', handleFileTransferResponse);
    return () => { socket.disconnect(); };
  }, [userId]);

  // When both a file and a peer are selected, start the transfer
  useEffect(() => {
    if (selectedFile && targetPeer && targetPeer.id) {
      startFileTransfer(targetPeer.id, selectedFile);
    }
    // eslint-disable-next-line
  }, [selectedFile, targetPeer]);

  const startFileTransfer = async (peerId, file) => {
    setIsTransferring(true);
    setTransferStatus('Requesting file transfer...');
    const socket = socketRef.current;
    // Create peer connection
    const peerConnection = new window.RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    peerConnections.current.set(peerId, peerConnection);
    // Create data channel
    const dataChannel = peerConnection.createDataChannel('fileTransfer');
    dataChannels.current.set(peerId, dataChannel);
    setupDataChannel(dataChannel, peerId);
    // ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          target: peerId
        });
      }
    };
    // Create and send offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', {
      offer: offer,
      target: peerId
    });
    // Send file transfer request
    socket.emit('file-transfer-request', {
      fileName: file.name,
      fileSize: file.size,
      target: peerId
    });
  };

  useEffect(() => {
    if (files && files.length > 0) {
      // TODO: Replace this with actual WebRTC/file transfer logic
      console.log('Files selected for sharing:', files);
    }
  }, [files]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // setSelectedFile(file);
    }
  };

  const acceptTransfer = (transferId) => {
    const transfer = pendingTransfers.find(t => t.id === transferId);
    if (transfer) {
      socketRef.current.emit('file-transfer-response', {
        accepted: true,
        target: transfer.socketId
      });
      setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
    }
  };

  const rejectTransfer = (transferId) => {
    const transfer = pendingTransfers.find(t => t.id === transferId);
    if (transfer) {
      socketRef.current.emit('file-transfer-response', {
        accepted: false,
        target: transfer.socketId
      });
      setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
    }
  };

  const downloadFile = (file) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="file-sharing">
      <div className="file-upload-section">
        <h3>Send File</h3>
        <input
          type="file"
          onChange={handleFileSelect}
          disabled={isTransferring}
          className="file-input"
        />
        {selectedFile && (
          <div className="file-info">
            <p>Selected: {selectedFile.name} ({selectedFile.size} bytes)</p>
            <button 
              onClick={() => startFileTransfer(targetPeer.id, selectedFile)}
              disabled={isTransferring}
              className="send-file-btn"
            >
              Send File
            </button>
          </div>
        )}
      </div>

      {isTransferring && (
        <div className="transfer-progress">
          <h4>Transfer Progress</h4>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${transferProgress}%` }}
            ></div>
          </div>
          <p>{transferStatus}</p>
          <p>{Math.round(transferProgress)}%</p>
        </div>
      )}

      {pendingTransfers.length > 0 && (
        <div className="pending-transfers">
          <h3>Pending Transfers</h3>
          {pendingTransfers.map(transfer => (
            <div key={transfer.id} className="transfer-item">
              <p>{transfer.fileName} from {transfer.from}</p>
              <div className="transfer-actions">
                <button onClick={() => acceptTransfer(transfer.id)}>Accept</button>
                <button onClick={() => rejectTransfer(transfer.id)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {receivedFiles.length > 0 && (
        <div className="received-files">
          <h3>Received Files</h3>
          {receivedFiles.map(file => (
            <div key={file.id} className="file-item">
              <p>{file.name} ({file.size} bytes)</p>
              <button onClick={() => downloadFile(file)}>Download</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileSharing; 