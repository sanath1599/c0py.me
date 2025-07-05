import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Peer, SocketEvents } from '../types';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const joinedRoomsRef = useRef<Set<string>>(new Set()); // Track joined rooms per connection

  useEffect(() => {
    // In a real app, this would be your Socket.IO server URL
    socketRef.current = io('ws://localhost:3001', {
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
      setPeers(peerList);
    });

    socket.on('peer-joined', (peer: Peer) => {
      console.log('👥 Peer joined:', peer.name);
      setPeers(prev => [...prev.filter(p => p.id !== peer.id), peer]);
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

  const onSignal = (callback: (data: { from: string; data: any }) => void) => {
    const socket = socketRef.current;
    if (!socket) return;
    
    socket.on('signal', callback);
    
    // Return cleanup function
    return () => {
      socket.off('signal', callback);
    };
  };

  return {
    isConnected,
    peers,
    joinRoom,
    updateProfile,
    sendSignal,
    onSignal
  };
};