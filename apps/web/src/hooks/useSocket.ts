import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Peer } from '../types';
import { getRandomEmoji, getRandomColor } from '../utils/colors';
import { generateRandomUsername } from '../utils/names';

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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const joinedRoomsRef = useRef<Set<string>>(new Set()); // Track joined rooms per connection
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionErrorReason, setConnectionErrorReason] = useState<string | null>(null);

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
    // Use VITE_WS_URL from env, fallback to VITE_CLIENT_URL, then ws://100.69.69.100:3001
    const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_CLIENT_URL || 'ws://100.69.69.100:3001';
    socketRef.current = io(WS_URL, {
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      setIsConnected(true);
      setConnectionError(null);
      setRetrying(false);
      setRetryCount(0);
      joinedRoomsRef.current.clear();
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      setIsConnected(false);
      joinedRoomsRef.current.clear();
    });

    socket.on('connect_error', (err) => {
      setConnectionError('Unable to connect to the server.');
      setConnectionErrorReason(err?.message || String(err) || null);
    });

    socket.on('reconnect_failed', (err) => {
      setConnectionError('Unable to reconnect to the server.');
      setConnectionErrorReason(err?.message || String(err) || null);
    });

    socket.on('peers', (peerList: Peer[]) => {
      console.log('📡 Received peers:', peerList.length);
      // Ensure each peer has random properties if they don't exist
      const peersWithRandomProps = peerList.map(peer => ({
        ...peer,
        name: peer.name || generateRandomUsername(),
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
        name: peer.name || generateRandomUsername(),
        emoji: peer.emoji || getRandomEmoji(),
        color: peer.color || getRandomColor()
      };
      setPeers(prev => [...prev.filter(p => p.id !== peer.id), peerWithRandomProps]);
    });

    socket.on('peer-left', (peerId: string) => {
      console.log('👋 Peer left:', peerId);
      setPeers(prev => prev.filter(p => p.id !== peerId));
    });

    // Improved network change detection
    const handleNetworkChange = () => {
      if (!socket.connected) {
        setRetrying(true);
        setConnectionError('Network changed. Retrying connection...');
        setRetryCount((c) => c + 1);
        socket.connect();
      }
    };
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    window.addEventListener('visibilitychange', handleNetworkChange);
    if ((navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', handleNetworkChange);
    }

    // Periodic retry if disconnected
    retryIntervalRef.current = setInterval(() => {
      if (!socket.connected) {
        setRetrying(true);
        setConnectionError('Retrying connection...');
        setRetryCount((c) => c + 1);
        socket.connect();
      }
    }, 5000);

    return () => {
      socket.disconnect();
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      window.removeEventListener('visibilitychange', handleNetworkChange);
      if ((navigator as any).connection) {
        (navigator as any).connection.removeEventListener('change', handleNetworkChange);
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
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
    onSignal,
    connectionError,
    retrying,
    retryCount,
    connectionErrorReason,
  };
};