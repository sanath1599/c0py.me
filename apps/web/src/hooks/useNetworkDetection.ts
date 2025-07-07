import { useState, useEffect, useRef, useCallback } from 'react';

export interface NetworkError {
  type: 'offline' | 'server_unreachable' | 'timeout' | 'connection_lost' | 'slow_connection' | 'unknown';
  message: string;
  details: string;
  timestamp: number;
  retryCount: number;
}

export interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // Round trip time in ms
  saveData: boolean;
  lastError: NetworkError | null;
  retryCount: number;
  isRetrying: boolean;
  retryCountdown: number;
}

export interface NetworkDetectionOptions {
  maxRetries?: number;
  retryDelay?: number;
  healthCheckInterval?: number;
  serverHealthUrl?: string;
  enableFallback?: boolean;
}

const DEFAULT_OPTIONS: Required<NetworkDetectionOptions> = {
  maxRetries: 5,
  retryDelay: 3000,
  healthCheckInterval: 10000, // Much less frequent checks to reduce false positives
  serverHealthUrl: '/api/health',
  enableFallback: true,
};

export const useNetworkDetection = (options: NetworkDetectionOptions = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
    lastError: null,
    retryCount: 0,
    isRetrying: false,
    retryCountdown: 0,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [restored, setRestored] = useState(false);
  const [restoredSpeed, setRestoredSpeed] = useState<number | null>(null);
  const [restoredRtt, setRestoredRtt] = useState<number | null>(null);
  const restoredTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [, forceUpdate] = useState({});
  
  // Auto-reload after 12 seconds of connection errors
  const autoReloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorStartTimeRef = useRef<number | null>(null);

  // Get network information if available
  const getNetworkInfo = useCallback(() => {
    // If we're not online, return default values
    if (!navigator.onLine) {
      return {
        connectionType: 'unknown',
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
        saveData: false,
      };
    }
    
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      return {
        connectionType: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false,
      };
    }
    
    return {
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
    };
  }, []);

  // Check server health
  const checkServerHealth = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(config.serverHealthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('Server health check failed:', error);
      return false;
    }
  }, [config.serverHealthUrl]);

  // Enhanced network connectivity check
  const checkNetworkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      // Try to fetch a small resource to test actual connectivity
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      return response.ok;
    } catch (error) {
      console.warn('Network connectivity check failed:', error);
      return false;
    }
  }, []);

  // Detect error type
  const detectErrorType = useCallback((error: any): NetworkError['type'] => {
    if (!navigator.onLine) {
      return 'offline';
    }
    
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      return 'timeout';
    }
    
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      return 'server_unreachable';
    }
    
    if (error.code === 'ERR_CONNECTION_LOST' || error.message?.includes('connection lost')) {
      return 'connection_lost';
    }
    
    const networkInfo = getNetworkInfo();
    if (networkInfo.effectiveType === 'slow-2g' || networkInfo.effectiveType === '2g') {
      return 'slow_connection';
    }
    
    return 'unknown';
  }, [getNetworkInfo]);

  // Get error message and details
  const getErrorInfo = useCallback((errorType: NetworkError['type']): { message: string; details: string } => {
    switch (errorType) {
      case 'offline':
        return {
          message: 'No Internet Connection',
          details: 'Your device appears to be offline. Please check your internet connection and try again.',
        };
      case 'server_unreachable':
        return {
          message: 'Server Unreachable',
          details: 'Unable to connect to the ShareDrop server. The server might be down or your network is blocking the connection.',
        };
      case 'timeout':
        return {
          message: 'Connection Timeout',
          details: 'The connection to the server timed out. This might be due to a slow network or server overload.',
        };
      case 'connection_lost':
        return {
          message: 'Connection Lost',
          details: 'Your connection to the server was lost unexpectedly. This could be due to network instability.',
        };
      case 'slow_connection':
        return {
          message: 'Slow Connection Detected',
          details: 'Your network connection is very slow. File transfers may be affected and could take longer than usual.',
        };
      default:
        return {
          message: 'Connection Error',
          details: 'An unexpected error occurred while connecting to the server. Please try again.',
        };
    }
  }, []);

  // Auto-reload with state restoration
  const triggerAutoReload = useCallback(() => {
    // Try to get selectedWorld/currentRoom from a global variable set by AppPage
    let selectedWorld = null;
    let currentRoom = null;
    if (window && (window as any).__sharedrop_restore) {
      selectedWorld = (window as any).__sharedrop_restore.selectedWorld;
      currentRoom = (window as any).__sharedrop_restore.currentRoom;
    }
    const currentState = {
      timestamp: Date.now(),
      selectedWorld,
      currentRoom,
    };
    sessionStorage.setItem('sharedrop_restore_state', JSON.stringify(currentState));
    window.location.reload();
  }, []);

  // Start auto-reload timer
  const startAutoReloadTimer = useCallback(() => {
    // Clear any existing timer
    if (autoReloadTimeoutRef.current) {
      clearTimeout(autoReloadTimeoutRef.current);
    }
    
    // Set error start time if not already set
    if (errorStartTimeRef.current === null) {
      errorStartTimeRef.current = Date.now();
    }
    
    // Set 12-second timer for auto-reload
    autoReloadTimeoutRef.current = setTimeout(() => {
      triggerAutoReload();
    }, 12000);
  }, [triggerAutoReload]);

  // Stop auto-reload timer
  const stopAutoReloadTimer = useCallback(() => {
    if (autoReloadTimeoutRef.current) {
      clearTimeout(autoReloadTimeoutRef.current);
      autoReloadTimeoutRef.current = null;
    }
    errorStartTimeRef.current = null;
  }, []);

  // Start retry process
  const startRetry = useCallback(async () => {
    if (networkStatus.retryCount >= config.maxRetries) {
      setNetworkStatus(prev => ({
        ...prev,
        isRetrying: false,
        retryCountdown: 0,
      }));
      return;
    }

    // Clear any existing intervals/timeouts
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const newRetryCount = networkStatus.retryCount + 1;
    const countdownSeconds = config.retryDelay / 1000;

    setNetworkStatus(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: newRetryCount,
      retryCountdown: countdownSeconds,
    }));

    // Start countdown
    let currentCountdown = countdownSeconds;
    countdownIntervalRef.current = setInterval(() => {
      currentCountdown -= 1;
      
      setNetworkStatus(prev => ({
        ...prev,
        retryCountdown: currentCountdown,
      }));
      
      if (currentCountdown <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    }, 1000);

    // Attempt reconnection after delay
    retryTimeoutRef.current = setTimeout(async () => {
      const isHealthy = await checkServerHealth();
      
      if (isHealthy) {
        const info = getNetworkInfo();
        setNetworkStatus(prev => ({
          ...prev,
          isRetrying: false,
          retryCountdown: 0,
          lastError: null,
          ...info,
        }));
        setRestored(true);
        setRestoredSpeed(info.downlink);
        setRestoredRtt(info.rtt);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        if (restoredTimeoutRef.current) clearTimeout(restoredTimeoutRef.current);
        restoredTimeoutRef.current = setTimeout(() => setRestored(false), 5000);
      } else {
        // Only continue retrying if we haven't reached max retries
        if (newRetryCount < config.maxRetries) {
          // Use setTimeout to avoid recursive call issues
          setTimeout(() => startRetry(), 100);
        } else {
          setNetworkStatus(prev => ({
            ...prev,
            isRetrying: false,
            retryCountdown: 0,
          }));
        }
      }
    }, config.retryDelay);
  }, [networkStatus.retryCount, config.maxRetries, config.retryDelay, checkServerHealth, getNetworkInfo]);

  // Handle network error
  const handleNetworkError = useCallback((error: any) => {
    // Prevent multiple error handling for the same error
    const errorType = detectErrorType(error);
    const { message, details } = getErrorInfo(errorType);
    
    const networkError: NetworkError = {
      type: errorType,
      message,
      details,
      timestamp: Date.now(),
      retryCount: networkStatus.retryCount,
    };

    setNetworkStatus(prev => {
      // Only update if this is a new error or different error type
      if (!prev.lastError || prev.lastError.type !== errorType) {
        const update: Partial<NetworkStatus> = {
          lastError: networkError,
          retryCount: 0,
        };
        
        // Clear network info for offline errors
        if (errorType === 'offline') {
          update.connectionType = 'unknown';
          update.effectiveType = 'unknown';
          update.downlink = 0;
          update.rtt = 0;
          update.saveData = false;
        }
        
        return {
          ...prev,
          ...update,
        };
      }
      return prev;
    });

    // Start auto-reload timer for persistent errors
    startAutoReloadTimer();

    // Only start retry if not already retrying
    if (!networkStatus.isRetrying) {
      startRetry();
    }
  }, [detectErrorType, getErrorInfo, networkStatus.retryCount, networkStatus.isRetrying, startRetry, startAutoReloadTimer]);

  // Reset retry state
  const resetRetryState = useCallback(() => {
    setNetworkStatus(prev => ({
      ...prev,
      retryCount: 0,
      isRetrying: false,
      retryCountdown: 0,
      lastError: null,
    }));
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Manual retry
  const manualRetry = useCallback(() => {
    resetRetryState();
    startRetry();
  }, [resetRetryState, startRetry]);

  // Setup network event listeners
  useEffect(() => {
    const handleOnline = () => {
      const networkInfo = getNetworkInfo();
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: true,
        lastError: null,
        ...networkInfo,
      }));
      resetRetryState();
    };

    const handleOffline = () => {
      // Debounce: wait 15 seconds (increased from 10), then double-check with health check
      setTimeout(async () => {
        if (!navigator.onLine) {
          // Double-check with health check
          const isHealthy = await checkServerHealth();
          if (!isHealthy) {
            setNetworkStatus(prev => ({
              ...prev,
              isOnline: false,
              // Clear network info when offline
              connectionType: 'unknown',
              effectiveType: 'unknown',
              downlink: 0,
              rtt: 0,
              saveData: false,
            }));
            handleNetworkError({ type: 'offline' });
          }
        }
      }, 15000); // 15 second debounce (increased from 10)
    };

    const handleConnectionChange = () => {
      // Only update network info if we're actually online
      if (navigator.onLine) {
        const networkInfo = getNetworkInfo();
        setNetworkStatus(prev => ({
          ...prev,
          ...networkInfo,
        }));
      }
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if ((navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', handleConnectionChange);
    }

    // Initial network info
    const initialNetworkInfo = getNetworkInfo();
    setNetworkStatus(prev => ({
      ...prev,
      ...initialNetworkInfo,
    }));

    // Start health check interval
    healthCheckIntervalRef.current = setInterval(async () => {
      // First check if we have actual network connectivity
      const hasConnectivity = await checkNetworkConnectivity();
      
      if (!hasConnectivity) {
        // No network connectivity - mark as offline and clear all network info
        setNetworkStatus(prev => ({
          ...prev,
          isOnline: false,
          connectionType: 'unknown',
          effectiveType: 'unknown',
          downlink: 0,
          rtt: 0,
          saveData: false,
        }));
        handleNetworkError({ type: 'offline' });
        return;
      }
      
      // We have connectivity, now check server health
      const isHealthy = await checkServerHealth();
      if (!isHealthy && !networkStatus.isRetrying) {
        // Only trigger error handling if we've had multiple consecutive failures
        // This prevents false positives from temporary network hiccups
        const consecutiveFailures = networkStatus.lastError?.type === 'server_unreachable' ? 
          (networkStatus.lastError.retryCount || 0) + 1 : 1;
        
        if (consecutiveFailures >= 3) {
          handleNetworkError({ type: 'server_unreachable' });
        } else {
          // Just log the failure but don't trigger error handling yet
          console.warn(`Server health check failed (attempt ${consecutiveFailures}/3)`);
        }
      }
    }, config.healthCheckInterval);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      
      if ((navigator as any).connection) {
        (navigator as any).connection.removeEventListener('change', handleConnectionChange);
      }
      
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [getNetworkInfo, checkServerHealth, handleNetworkError, resetRetryState, config.healthCheckInterval, networkStatus.isRetrying]);

  // Add a function to immediately clear restored state
  const clearRestored = useCallback(() => {
    setRestored(false);
    if (restoredTimeoutRef.current) clearTimeout(restoredTimeoutRef.current);
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
      if (restoredTimeoutRef.current) {
        clearTimeout(restoredTimeoutRef.current);
        restoredTimeoutRef.current = null;
      }
      if (autoReloadTimeoutRef.current) {
        clearTimeout(autoReloadTimeoutRef.current);
        autoReloadTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    networkStatus,
    handleNetworkError,
    manualRetry,
    resetRetryState,
    checkServerHealth,
    restored,
    restoredSpeed,
    restoredRtt,
    clearRestored,
    startAutoReloadTimer,
    stopAutoReloadTimer,
  };
}; 