import { useState, useRef, useCallback, useEffect } from 'react';
import { Peer } from '../types';

export interface FallbackMessage {
  type: 'join-room' | 'update-profile' | 'signal' | 'peers' | 'peer-joined' | 'peer-left' | 'ping' | 'pong';
  data: any;
  timestamp: number;
  id: string;
}

export interface FallbackConnectionStatus {
  isActive: boolean;
  mode: 'websocket' | 'long-polling' | 'api' | 'none';
  lastPing: number;
  latency: number;
  messageQueue: FallbackMessage[];
}

export interface FallbackConnectionOptions {
  apiBaseUrl?: string;
  pollingInterval?: number;
  maxRetries?: number;
  enableLongPolling?: boolean;
  enableApiFallback?: boolean;
}

const DEFAULT_OPTIONS: Required<FallbackConnectionOptions> = {
  apiBaseUrl: '/api',
  pollingInterval: 2000,
  maxRetries: 3,
  enableLongPolling: true,
  enableApiFallback: true,
};

export const useFallbackConnection = (options: FallbackConnectionOptions = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const [status, setStatus] = useState<FallbackConnectionStatus>({
    isActive: false,
    mode: 'none',
    lastPing: 0,
    latency: 0,
    messageQueue: [],
  });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<FallbackMessage[]>([]);
  const eventListenersRef = useRef<Map<string, Function[]>>(new Map());
  const sessionIdRef = useRef<string>(`session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Add message to queue
  const queueMessage = useCallback((message: Omit<FallbackMessage, 'id' | 'timestamp'>) => {
    const queuedMessage: FallbackMessage = {
      ...message,
      id: generateMessageId(),
      timestamp: Date.now(),
    };
    
    messageQueueRef.current.push(queuedMessage);
    setStatus(prev => ({
      ...prev,
      messageQueue: [...messageQueueRef.current],
    }));
  }, [generateMessageId]);

  // Process message queue
  const processMessageQueue = useCallback(async () => {
    if (messageQueueRef.current.length === 0) return;

    const messages = [...messageQueueRef.current];
    messageQueueRef.current = [];

    try {
      const response = await fetch(`${config.apiBaseUrl}/fallback/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          messages,
        }),
      });

      if (!response.ok) {
        // Re-queue messages if failed
        messageQueueRef.current = [...messages, ...messageQueueRef.current];
        setStatus(prev => ({
          ...prev,
          messageQueue: [...messageQueueRef.current],
        }));
      }
    } catch (error) {
      console.warn('Failed to send fallback messages:', error);
      // Re-queue messages
      messageQueueRef.current = [...messages, ...messageQueueRef.current];
      setStatus(prev => ({
        ...prev,
        messageQueue: [...messageQueueRef.current],
      }));
    }
  }, [config.apiBaseUrl]);

  // Long polling for messages
  const startLongPolling = useCallback(async () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
    }

    const poll = async () => {
      try {
        const startTime = Date.now();
        const response = await fetch(`${config.apiBaseUrl}/fallback/poll?sessionId=${sessionIdRef.current}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        const latency = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json();
          
          if (data.messages && Array.isArray(data.messages)) {
            // Process incoming messages
            data.messages.forEach((message: FallbackMessage) => {
              const listeners = eventListenersRef.current.get(message.type) || [];
              listeners.forEach(listener => listener(message.data));
            });
          }

          setStatus(prev => ({
            ...prev,
            lastPing: Date.now(),
            latency,
          }));
        }
      } catch (error) {
        console.warn('Long polling failed:', error);
      } finally {
        // Continue polling
        pollingRef.current = setTimeout(poll, config.pollingInterval);
      }
    };

    poll();
  }, [config.apiBaseUrl, config.pollingInterval]);

  // API-based fallback methods
  const apiFallback = useCallback(() => {
    return {
      joinRoom: async (data: { room: string; userId: string; name: string; color: string; emoji: string }) => {
        try {
          const response = await fetch(`${config.apiBaseUrl}/fallback/join-room`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              ...data,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            // Emit peers event
            const listeners = eventListenersRef.current.get('peers') || [];
            listeners.forEach(listener => listener(result.peers || []));
          }
        } catch (error) {
          console.error('API fallback join room failed:', error);
          queueMessage({ type: 'join-room', data });
        }
      },

      updateProfile: async (data: { name: string; color: string; emoji: string }) => {
        try {
          await fetch(`${config.apiBaseUrl}/fallback/update-profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              ...data,
            }),
          });
        } catch (error) {
          console.error('API fallback update profile failed:', error);
          queueMessage({ type: 'update-profile', data });
        }
      },

      sendSignal: async (data: { to: string; from: string; data: any }) => {
        try {
          await fetch(`${config.apiBaseUrl}/fallback/signal`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              ...data,
            }),
          });
        } catch (error) {
          console.error('API fallback signal failed:', error);
          queueMessage({ type: 'signal', data });
        }
      },

      ping: async () => {
        try {
          const startTime = Date.now();
          await fetch(`${config.apiBaseUrl}/fallback/ping`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              timestamp: startTime,
            }),
          });
          
          const latency = Date.now() - startTime;
          setStatus(prev => ({
            ...prev,
            lastPing: Date.now(),
            latency,
          }));
        } catch (error) {
          console.warn('API fallback ping failed:', error);
        }
      },
    };
  }, [config.apiBaseUrl, queueMessage]);

  // Event listener management
  const on = useCallback((event: string, callback: Function) => {
    const listeners = eventListenersRef.current.get(event) || [];
    listeners.push(callback);
    eventListenersRef.current.set(event, listeners);
  }, []);

  const off = useCallback((event: string, callback?: Function) => {
    if (!callback) {
      eventListenersRef.current.delete(event);
    } else {
      const listeners = eventListenersRef.current.get(event) || [];
      const filteredListeners = listeners.filter(listener => listener !== callback);
      eventListenersRef.current.set(event, filteredListeners);
    }
  }, []);

  // Start fallback connection
  const startFallback = useCallback((mode: 'long-polling' | 'api') => {
    setStatus(prev => ({
      ...prev,
      isActive: true,
      mode,
    }));

    if (mode === 'long-polling' && config.enableLongPolling) {
      startLongPolling();
    }

    // Process message queue periodically
    const queueInterval = setInterval(processMessageQueue, 1000);
    
    return () => {
      clearInterval(queueInterval);
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [config.enableLongPolling, startLongPolling, processMessageQueue]);

  // Stop fallback connection
  const stopFallback = useCallback(() => {
    setStatus(prev => ({
      ...prev,
      isActive: false,
      mode: 'none',
    }));

    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  return {
    status,
    startFallback,
    stopFallback,
    apiFallback,
    on,
    off,
    queueMessage,
    processMessageQueue,
  };
}; 