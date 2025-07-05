import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Peer, SocketEvents } from '../types';

// Random name generator
const randomNames = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery',
  'Morgan', 'Drew', 'Blake', 'Cameron', 'Dakota', 'Emery', 'Finley', 'Harper',
  'Indigo', 'Jules', 'Kai', 'Logan', 'Mason', 'Nova', 'Ocean', 'Parker',
  'Quincy', 'River', 'Sage', 'Tatum', 'Unity', 'Vale', 'Winter', 'Xander'
];

// Random emoji generator
const randomEmojis = ['🦁', '🐯', '🐻', '🐨', '🐼', '🐸', '🐙', '🦄', '🦋', '🐞', '🦅', '🦉', '🦇', '🐺', '🦊', '🐱', '🐶', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦉', '🦇', '🐺', '🦊', '🐱', '🐶', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆'];

// Random color generator
const randomColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A', '#85C1E9',
  '#D7BDE2', '#F9E79F', '#ABEBC6', '#FAD7A0', '#D5A6BD', '#A9CCE3', '#F8C471',
  '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2', '#F9E79F', '#ABEBC6', '#FAD7A0'
];

const getRandomName = () => randomNames[Math.floor(Math.random() * randomNames.length)];
const getRandomEmoji = () => randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
const getRandomColor = () => randomColors[Math.floor(Math.random() * randomColors.length)];

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const joinedRoomsRef = useRef<Set<string>>(new Set()); // Track joined rooms per connection

  useEffect(() => {
    // Use CLIENT_URL from env, fallback to ws://localhost:3001
    const WS_URL = import.meta.env.VITE_CLIENT_URL || 'ws://localhost:3001';
    socketRef.current = io(WS_URL, {
      transports: ['websocket']
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      setIsConnected(true);
      // Clear joined rooms on new connection
      joinedRoomsRef.current.clear();
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
      // Clear joined rooms on disconnect
      joinedRoomsRef.current.clear();
    });

    socket.on('peers', (peerList: Peer[]) => {
      console.log('📡 Received peers:', peerList.length);
      // Ensure each peer has random properties if they don't exist
      const peersWithRandomProps = peerList.map(peer => ({
        ...peer,
        name: peer.name || getRandomName(),
        emoji: peer.emoji || getRandomEmoji(),
        color: peer.color || getRandomColor()
      }));
      setPeers(peersWithRandomProps);
    });

    socket.on('peer-joined', (peer: Peer) => {
      console.log('👥 Peer joined:', peer.name);
      // Ensure the peer has random properties
      const peerWithRandomProps = {
        ...peer,
        name: peer.name || getRandomName(),
        emoji: peer.emoji || getRandomEmoji(),
        color: peer.color || getRandomColor()
      };
      setPeers(prev => [...prev.filter(p => p.id !== peer.id), peerWithRandomProps]);
    });

    socket.on('peer-left', (peerId: string) => {
      console.log('👋 Peer left:', peerId);
      setPeers(prev => prev.filter(p => p.id !== peerId));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = (room: string, userId: string, name: string, color: string, emoji: string) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn('⚠️ Socket not connected, cannot join room');
      return;
    }

    // Check if we've already joined this room in this connection
    const roomKey = `${room}-${userId}`;
    if (joinedRoomsRef.current.has(roomKey)) {
      console.log('🔄 Already joined room:', room);
      return;
    }

    console.log('🚀 Joining room:', room);
    socket.emit('join-room', { room, userId, name, color, emoji });
    joinedRoomsRef.current.add(roomKey);
  };

  const joinDefaultRoom = (userId: string, name: string, color: string, emoji: string) => {
    joinRoom('jungle', userId, name, color, emoji);
  };

  const updateProfile = (name: string, color: string, emoji: string) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn('⚠️ Socket not connected, cannot update profile');
      return;
    }
    socket.emit('update-profile', { name, color, emoji });
  };

  const sendSignal = (to: string, from: string, data: any) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      console.warn('⚠️ Socket not connected, cannot send signal');
      return;
    }
    socket.emit('signal', { to, from, data });
  };

  const onSignal = (callback: (from: string, data: any) => void) => {
    const socket = socketRef.current;
    if (!socket) return;
    
    socket.on('signal', (signalData: { from: string; data: any }) => {
      callback(signalData.from, signalData.data);
    });
    
    // Return cleanup function
    return () => {
      socket.off('signal');
    };
  };

  return {
    isConnected,
    peers,
    joinRoom,
    joinDefaultRoom,
    updateProfile,
    sendSignal,
    onSignal
  };
};