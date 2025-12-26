import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Peer } from '../types';
import { getRandomEmoji, getRandomColor } from '../utils/colors';
import { generateRandomUsername } from '../utils/names';
import { useNetworkDetection } from './useNetworkDetection';
import { useFallbackConnection } from './useFallbackConnection';
import { useConnectionRetry } from './useConnectionRetry';

// Random name generator (kept for potential future use)
// const randomNames = [
//   'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery',
//   'Morgan', 'Drew', 'Blake', 'Cameron', 'Dakota', 'Emery', 'Finley', 'Harper',
//   'Indigo', 'Jules', 'Kai', 'Logan', 'Mason', 'Nova', 'Ocean', 'Parker',
//   'Quincy', 'River', 'Sage', 'Tatum', 'Unity', 'Vale', 'Winter', 'Xander'
// ];

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
    serverHealthUrl: (() => {
      // Get API URL from environment or default to backend.c0py.me
      const apiUrl = import.meta.env.VITE_API_URL || 'https://backend.c0py.me';
      const baseUrl = apiUrl.replace(/\/$/, '');
      return `${baseUrl}/api/health`;
    })(),
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
        // Don't start custom ping-pong - Socket.IO handles this internally
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
  
  const { status: fallbackStatus, startFallback, stopFallback, on: onFallbackEvent } = useFallbackConnection({
    apiBaseUrl: '/api',
    pollingInterval: 2000,
    maxRetries: 3,
    enableLongPolling: true,
    enableApiFallback: true,
  });
  
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'long-polling' | 'api' | 'none'>('none');
  const [isUnstable, setIsUnstable] = useState(false);
  
  // Debounce error handling to prevent flickering
  const errorDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorRef = useRef<string | null>(null);
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
    // Use VITE_WS_URL from env, fallback to VITE_CLIENT_URL, then default to current host
    const WS_URL = import.meta.env.VITE_WS_URL || 
                   import.meta.env.VITE_CLIENT_URL || 
                   (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:4001` : 'ws://localhost:4001');
    
    console.log('🔌 Connecting to Socket.IO server:', WS_URL);
    console.log('🔌 Environment variables:', {
      VITE_WS_URL: import.meta.env.VITE_WS_URL,
      VITE_CLIENT_URL: import.meta.env.VITE_CLIENT_URL,
      NODE_ENV: import.meta.env.NODE_ENV
    });
    
    socketRef.current = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying to reconnect
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000, // Connection timeout
      forceNew: false,
      path: '/socket.io/',
      autoConnect: true,
      upgrade: true,
      rememberUpgrade: true, // Remember successful upgrade to websocket
      // Let Socket.IO handle ping/pong internally - don't interfere
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔌 Socket connected');
      // Always mark as connected when socket connects, regardless of network status
      setIsConnected(true);
      setConnectionMode('websocket');
      // Use the latest versions of these functions
      resetRetryState();
      stopFallback();
      // Clear joined rooms on new connection
      joinedRoomsRef.current.clear();
      
      // Don't start custom ping-pong - Socket.IO handles this internally
      // The built-in mechanism is more reliable
      
      // Check network status (using current state, not closure)
      setIsUnstable(false); // Reset unstable state on successful connection
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      console.error('Error details:', {
        message: error.message,
        description: (error as any).description,
        context: (error as any).context,
        type: (error as any).type,
        stack: error.stack
      });
      
      setIsConnected(false);
      setConnectionMode('none');
      
      // Check for specific namespace errors
      if (error.message && error.message.includes('namespace')) {
        console.error('🚨 Namespace error detected:', error.message);
        console.error('🔧 Attempting to fix namespace configuration...');
        
        // Try reconnecting with corrected configuration
        setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = io(WS_URL, {
              transports: ['websocket', 'polling'],
              reconnection: true,
              reconnectionAttempts: Infinity,
              reconnectionDelay: 1000,
              reconnectionDelayMax: 5000,
              timeout: 20000,
              forceNew: true, // Force new connection
              path: '/socket.io/',
              autoConnect: true,
              upgrade: true,
              rememberUpgrade: true
            });
          }
        }, 2000);
      } else {
        // Only trigger network error handling if we're actually offline
        // Socket.IO connection errors can happen for many reasons (server issues, CORS, etc.)
        // that don't mean the network is offline
        if (!navigator.onLine) {
          // Actually offline - handle as network error
          console.log('🌐 Device is offline - handling as network error');
          handleNetworkError({ type: 'offline' });
        } else {
          // Online but Socket.IO connection failed - let Socket.IO handle reconnection
          // Don't mark network as offline, just log the error
          console.log('⚠️ Socket.IO connection error but device is online - letting Socket.IO handle reconnection');
          // Socket.IO will automatically retry, we just need to wait
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setIsConnected(false);
      setConnectionMode('none');
      // Clear joined rooms on disconnect
      joinedRoomsRef.current.clear();
      
      // Only handle as network error if we're actually offline
      // Socket.IO will automatically handle reconnection for most disconnect reasons
      if (!navigator.onLine) {
        // Actually offline - handle as network error
        console.log('🌐 Device is offline - handling disconnect as network error');
        handleNetworkError({ type: 'offline' });
      } else if (reason !== 'io client disconnect' && 
          reason !== 'io server disconnect' && 
          reason !== 'transport close' &&
          reason !== 'ping timeout' &&
          reason !== 'transport error') {
        // Online but unexpected disconnect - only log, don't mark network as offline
        console.log('⚠️ Unexpected disconnect reason:', reason, '- Socket.IO will handle reconnection');
        // Don't call handleNetworkError here - Socket.IO will reconnect automatically
      } else {
        console.log('🔌 Normal disconnect - Socket.IO will handle reconnection');
      }
    });

    socket.on('peers', (peerList: Peer[]) => {
      console.log('📡 Received peers:', peerList.length);
      // Ensure each peer has random properties if they don't exist
      // Preserve isOnline status from server
      const peersWithRandomProps = peerList.map(peer => ({
        ...peer,
        name: peer.name || generateRandomUsername(),
        emoji: peer.emoji || getRandomEmoji(),
        color: peer.color || getRandomColor(),
        isOnline: peer.isOnline !== undefined ? peer.isOnline : true // Default to online if not specified
      }));
      console.log('📡 Peers with status:', peersWithRandomProps.map(p => ({ name: p.name, isOnline: p.isOnline })));
      setPeers(peersWithRandomProps);
    });

    socket.on('peer-joined', (peer: Peer) => {
      console.log('👥 Peer joined:', peer.name, 'isOnline:', peer.isOnline);
      // Ensure the peer has random properties and is marked as online
      const peerWithRandomProps = {
        ...peer,
        name: peer.name || generateRandomUsername(),
        emoji: peer.emoji || getRandomEmoji(),
        color: peer.color || getRandomColor(),
        isOnline: true // Always mark as online when peer-joined event is received
      };
      setPeers(prev => [...prev.filter(p => p.id !== peer.id), peerWithRandomProps]);
    });

    socket.on('peer-left', (peerId: string) => {
      console.log('👋 Peer left:', peerId);
      // Mark peer as offline instead of removing them
      // This allows them to show as offline but still be in the list
      setPeers(prev => prev.map(p => 
        p.id === peerId ? { ...p, isOnline: false } : p
      ));
    });

    return () => {
      // Cleanup: disconnect socket when component unmounts
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - socket should only be created once on mount
  // Functions like handleNetworkError, resetRetryState, stopFallback are stable from hooks

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
      console.log('📡 Received signal:', signalData);
      callback(signalData.from, signalData.data);
    });

    // Handle pending file transfer requests on reconnection
    socket.on('file-transfer-request', (requestData: { from: string; fileName: string; fileSize: number; fileType: string; transferId: string }) => {
      console.log('📁 Received pending file transfer request:', requestData);
      // This will be handled by the WebRTC hook
      callback(requestData.from, { type: 'file-transfer-request', ...requestData });
    });
    
    // Return cleanup function
    return () => {
      socket.off('signal');
      socket.off('file-transfer-request');
    };
  };

  // Removed custom ping-pong functions - Socket.IO handles ping/pong internally
  // Socket.IO's built-in mechanism is more reliable and doesn't conflict

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup error debounce
      if (errorDebounceRef.current) {
        clearTimeout(errorDebounceRef.current);
      }
    };
  }, []);

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