import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Peer, SocketEvents } from '../types';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    // In a real app, this would be your Socket.IO server URL
    socketRef.current = io('ws://localhost:3001', {
      transports: ['websocket']
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('peers', (peerList: Peer[]) => {
      setPeers(peerList);
    });

    socket.on('peer-joined', (peer: Peer) => {
      setPeers(prev => [...prev.filter(p => p.id !== peer.id), peer]);
    });

    socket.on('peer-left', (peerId: string) => {
      setPeers(prev => prev.filter(p => p.id !== peerId));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinRoom = (room: string, userId: string, name: string, color: string, emoji: string) => {
    socketRef.current?.emit('join-room', { room, userId, name, color, emoji });
  };

  const updateProfile = (name: string, color: string, emoji: string) => {
    socketRef.current?.emit('update-profile', { name, color, emoji });
  };

  const sendSignal = (to: string, from: string, data: any) => {
    socketRef.current?.emit('signal', { to, from, data });
  };

  const onSignal = (callback: (data: { from: string; data: any }) => void) => {
    socketRef.current?.on('signal', callback);
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