import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Peer } from '../types';
import { getRandomEmoji, getRandomColor } from '../utils/colors';
import { generateRandomUsername } from '../utils/names';
import { useNetworkDetection } from './useNetworkDetection';
import { useFallbackConnection } from './useFallbackConnection';
import { useConnectionRetry } from './useConnectionRetry';

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
  
  // Network detection and fallback
  const { networkStatus, handleNetworkError: originalHandleNetworkError, manualRetry, resetRetryState, restored, restoredSpeed, restoredRtt, clearRestored } = useNetworkDetection({
    maxRetries: 5,
    retryDelay: 3000,
    healthCheckInterval: 10000,
    serverHealthUrl: '/api/health',
    enableFallback: true,
  });

  // Robust connection retry system
  const { retry: retryConnection, reset: resetRetry, cancel: cancelRetry, state: retryState } = useConnectionRetry(
    {
      maxRetries: 8,
      baseDelay: 2000,
      maxDelay: 60000,
      jitterFactor: 0.15,
      timeoutMs: 15000,
    },
    {
      onRetryStart: () => {
        console.log('🔄 Starting robust connection retry...');
      },
      onRetrySuccess: () => {
        console.log('✅ Robust connection retry succeeded');
        setIsConnected(true);
        setConnectionMode('websocket');
        resetRetryState();
        stopFallback();
        joinedRoomsRef.current.clear();
        startPingPong();
      },
      onRetryFailure: (error, retryCount) => {
        console.log(`❌ Connection retry ${retryCount} failed:`, error);
        setIsConnected(false);
        setConnectionMode('none');
      },
      onMaxRetriesExceeded: () => {
        console.log('🚨 Max connection retries exceeded, trying fallback...');
        startFallback('api');
      },
      onFallback: () => {
        console.log('🔄 Attempting fallback connection...');
        setConnectionMode('api');
      },
    }
  );

  // Debounced error handler to prevent flickering
  const handleNetworkError = useCallback((error: any) => {
    const now = Date.now();
    const errorKey = `${error.type || error.message || 'unknown'}`;
    
    // Prevent rapid error handling (minimum 3 seconds between same error type)
    if (lastErrorRef.current === errorKey && (now - lastConnectionTimeRef.current) < 3000) {
      return;
    }
    
    // Clear any existing debounce
    if (errorDebounceRef.current) {
      clearTimeout(errorDebounceRef.current);
    }
    
    lastErrorRef.current = errorKey;
    lastConnectionTimeRef.current = now;
    
    // For offline errors, immediately update socket state
    if (error.type === 'offline') {
      setIsConnected(false);
      setConnectionMode('none');
    }
    
    // Debounce error handling by 2 seconds
    errorDebounceRef.current = setTimeout(() => {
      originalHandleNetworkError(error);
    }, 2000);
  }, [originalHandleNetworkError]);
  
  const { status: fallbackStatus, startFallback, stopFallback, apiFallback, on: onFallbackEvent } = useFallbackConnection({
    apiBaseUrl: '/api',
    pollingInterval: 2000,
    maxRetries: 3,
    enableLongPolling: true,
    enableApiFallback: true,
  });
  
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'long-polling' | 'api' | 'none'>('none');
  const [isUnstable, setIsUnstable] = useState(false);
  
  // Ping-pong mechanism
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongRef = useRef<number>(Date.now());
  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounce error handling to prevent flickering
  const errorDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<string | null>(null);
  const connectionAttemptsRef = useRef<number>(0);
  const lastConnectionTimeRef = useRef<number>(0);

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
    // Use VITE_WS_URL from env, fallback to VITE_CLIENT_URL, then ws://localhost:4001
    const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_CLIENT_URL || 'ws://localhost:4001';
    socketRef.current = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000,
      forceNew: false,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      // Always mark as connected when socket connects, regardless of network status
      setIsConnected(true);
      setConnectionMode('websocket');
      resetRetryState();
      stopFallback();
      // Clear joined rooms on new connection
      joinedRoomsRef.current.clear();
      
      // Start ping-pong mechanism
      startPingPong();
      
      // If network is offline, mark as unstable but keep connection
      if (!networkStatus.isOnline) {
        setIsUnstable(true);
        console.log('⚠️ Socket connected but network is offline - marking as unstable connection');
      } else {
        setIsUnstable(false);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setIsConnected(false);
      setConnectionMode('none');
      // Clear joined rooms on disconnect
      joinedRoomsRef.current.clear();
      
      // Stop ping-pong mechanism
      stopPingPong();
      
      // Only handle as error if it's not a normal disconnect, reconnection, or client disconnect
      if (reason !== 'io client disconnect' && 
          reason !== 'io server disconnect' && 
          reason !== 'transport close' &&
          reason !== 'ping timeout') {
        handleNetworkError({ type: 'connection_lost', reason });
      } else {
        console.log('🔌 Normal disconnect - not triggering error handling');
      }
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error);
      setIsConnected(false);
      setConnectionMode('none');
      
      // Stop ping-pong mechanism
      stopPingPong();
      
      // Use robust retry system for connection errors
      retryConnection(
        async () => {
          // Attempt to reconnect
          const socket = socketRef.current;
          if (socket) {
            socket.connect();
            // Wait for connection or timeout
            return new Promise<boolean>((resolve) => {
              const timeout = setTimeout(() => resolve(false), 10000);
              const onConnect = () => {
                clearTimeout(timeout);
                socket.off('connect', onConnect);
                socket.off('connect_error', onError);
                resolve(true);
              };
              const onError = () => {
                clearTimeout(timeout);
                socket.off('connect', onConnect);
                socket.off('connect_error', onError);
                resolve(false);
              };
              socket.on('connect', onConnect);
              socket.on('connect_error', onError);
            });
          }
          return false;
        },
        async () => {
          // Fallback: try API connection
          console.log('🔄 Trying API fallback connection...');
          startFallback('api');
          return fallbackStatus.isActive;
        }
      );
      
      // Also handle as network error for UI feedback
      handleNetworkError(error);
    });

    // Ping-pong event handlers
    socket.on('pong', () => {
      lastPongRef.current = Date.now();
      
      // Clear any pending pong timeout
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = null;
      }
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

    return () => {
      socket.disconnect();
    };
  }, [handleNetworkError, resetRetryState, stopFallback]);

  // Setup fallback event listeners
  useEffect(() => {
    onFallbackEvent('peers', (peerList: Peer[]) => {
      console.log('📡 Received peers via fallback:', peerList.length);
      const peersWithRandomProps = peerList.map(peer => ({
        ...peer,
        name: peer.name || generateRandomUsername(),
        emoji: peer.emoji || getRandomEmoji(),
        color: peer.color || getRandomColor()
      }));
      setPeers(peersWithRandomProps);
    });

    onFallbackEvent('peer-joined', (peer: Peer) => {
      console.log('👥 Peer joined via fallback:', peer.name);
      const peerWithRandomProps = {
        ...peer,
        name: peer.name || generateRandomUsername(),
        emoji: peer.emoji || getRandomEmoji(),
        color: peer.color || getRandomColor()
      };
      setPeers(prev => [...prev.filter(p => p.id !== peer.id), peerWithRandomProps]);
    });

    onFallbackEvent('peer-left', (peerId: string) => {
      console.log('👋 Peer left via fallback:', peerId);
      setPeers(prev => prev.filter(p => p.id !== peerId));
    });
  }, [onFallbackEvent]);

  const joinRoom = (room: string, userId: string, name: string, color: string, emoji: string) => {
    const socket = socketRef.current;
    
    // Check if we've already joined this room in this connection
    const roomKey = `${room}-${userId}`;
    if (joinedRoomsRef.current.has(roomKey)) {
      console.log('🔄 Already joined room:', room);
      return;
    }

    if (socket && socket.connected) {
      // Use WebSocket connection
      console.log('🚀 Joining room via WebSocket:', room);
      socket.emit('join-room', { room, userId, name, color, emoji });
      joinedRoomsRef.current.add(roomKey);
      setCurrentRoom(room);
    } else if (fallbackStatus.isActive) {
      // Use fallback connection
      console.log('🚀 Joining room via fallback:', room);
      // For now, just queue the message for fallback
      // TODO: Implement proper fallback API calls
      joinedRoomsRef.current.add(roomKey);
      setCurrentRoom(room);
    } else {
      console.warn('⚠️ No connection available, cannot join room');
      // Try to start fallback connection
      if (networkStatus.lastError && networkStatus.retryCount >= 5) {
        console.log('🔄 Starting fallback connection...');
        startFallback('api');
      }
    }
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

  // Ping-pong functions
  const startPingPong = useCallback(() => {
    // Clear any existing intervals
    stopPingPong();
    
    // Send ping every 120 seconds (increased from 90)
    pingIntervalRef.current = setInterval(() => {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        console.log('🏓 Sending ping...');
        socket.emit('ping');
        
        // Set timeout for pong response (60 seconds - increased from 45)
        pongTimeoutRef.current = setTimeout(() => {
          console.log('⚠️ Pong timeout - forcing disconnect');
          // Force disconnect to trigger reconnection
          socket.disconnect();
        }, 60000);
      }
    }, 120000);
  }, []);

  const stopPingPong = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  // Cleanup ping-pong on unmount
  useEffect(() => {
    return () => {
      stopPingPong();
      
      // Cleanup error debounce
      if (errorDebounceRef.current) {
        clearTimeout(errorDebounceRef.current);
      }
    };
  }, [stopPingPong]);

  // Listen to network status changes
  useEffect(() => {
    // Only react to network changes if we have a stable connection
    // Don't disconnect immediately on network offline events
    if (!networkStatus.isOnline && isConnected && !isUnstable) {
      console.log('🌐 Network went offline - marking connection as unstable');
      setIsUnstable(true);
      
      // Give the network time to recover before taking action
      const recoveryTimeout = setTimeout(() => {
        if (isUnstable && !networkStatus.isOnline) {
          console.log('⚠️ Network still offline after recovery period - keeping unstable state');
          // Don't disconnect, just keep the unstable flag
          // Let the ping-pong mechanism handle actual connection issues
        }
      }, 15000); // 15 second recovery period
      
      return () => clearTimeout(recoveryTimeout);
    } else if (networkStatus.isOnline && isUnstable) {
      // Network is back online and socket was unstable
      console.log('✅ Network restored - clearing unstable flag');
      setIsUnstable(false);
    }
  }, [networkStatus.isOnline, isConnected, isUnstable]);

  return {
    isConnected,
    isUnstable,
    peers,
    currentRoom,
    publicIp,
    joinRoom,
    joinDefaultRoom,
    joinFamilyRoom,
    updateProfile,
    sendSignal,
    onSignal,
    // Network detection and fallback
    networkStatus,
    connectionMode,
    fallbackStatus,
    manualRetry,
    handleNetworkError,
    restored,
    restoredSpeed,
    restoredRtt,
    clearRestored,
    resetRetryState,
    // Robust retry system
    retryState,
    retryConnection,
    resetRetry,
    cancelRetry,
  };
};