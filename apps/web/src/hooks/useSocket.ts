import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Peer } from '../types';
import { getRandomEmoji, getRandomColor } from '../utils/colors';

// Random name generator
const randomNames = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery',
  'Morgan', 'Drew', 'Blake', 'Cameron', 'Dakota', 'Emery', 'Finley', 'Harper',
  'Indigo', 'Jules', 'Kai', 'Logan', 'Mason', 'Nova', 'Ocean', 'Parker',
  'Quincy', 'River', 'Sage', 'Tatum', 'Unity', 'Vale', 'Winter', 'Xander'
];

const getRandomName = () => randomNames[Math.floor(Math.random() * randomNames.length)];

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set()); // Track joined rooms per connection

  // Fetch public IP for Family world
  useEffect(() => {
    const fetchPublicIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setPublicIp(data.ip);
      } catch (error) {
        console.warn('Failed to fetch public IP:', error);
        // Fallback to a default family room
        setPublicIp('unknown');
      }
    };
    
    fetchPublicIp();
  }, []);

  useEffect(() => {
    // Use VITE_WS_URL from env, fallback to VITE_CLIENT_URL, then ws://localhost:3001
    const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_CLIENT_URL || 'ws://localhost:3001';
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
    setCurrentRoom(room);
  };

  const joinDefaultRoom = (userId: string, name: string, color: string, emoji: string) => {
    joinRoom('jungle', userId, name, color, emoji);
  };

  const joinFamilyRoom = (userId: string, name: string, color: string, emoji: string) => {
    if (!publicIp) {
      console.warn('⚠️ Public IP not available yet, cannot join family room');
      return;
    }
    const familyRoomId = `family-${publicIp}`;
    joinRoom(familyRoomId, userId, name, color, emoji);
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
    currentRoom,
    publicIp,
    joinRoom,
    joinDefaultRoom,
    joinFamilyRoom,
    updateProfile,
    sendSignal,
    onSignal
  };
};