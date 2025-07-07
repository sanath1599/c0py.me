import { useState, useCallback, useRef, useEffect } from 'react';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitterFactor: number;
  timeoutMs: number;
}

export interface RetryState {
  isRetrying: boolean;
  retryCount: number;
  lastError: string | null;
  nextRetryDelay: number;
  timeUntilNextRetry: number;
}

export interface RetryCallbacks {
  onRetryStart?: () => void;
  onRetrySuccess?: () => void;
  onRetryFailure?: (error: string, retryCount: number) => void;
  onMaxRetriesExceeded?: () => void;
  onFallback?: () => void;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  jitterFactor: 0.1, // 10% jitter
  timeoutMs: 10000, // 10 seconds per attempt
};

export const useConnectionRetry = (
  config: Partial<RetryConfig> = {},
  callbacks: RetryCallbacks = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
    nextRetryDelay: 0,
    timeUntilNextRetry: 0,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const attemptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate exponential backoff with jitter
  const calculateDelay = useCallback((retryCount: number): number => {
    const exponentialDelay = Math.min(
      finalConfig.baseDelay * Math.pow(2, retryCount),
      finalConfig.maxDelay
    );
    
    const jitter = exponentialDelay * finalConfig.jitterFactor * Math.random();
    return exponentialDelay + jitter;
  }, [finalConfig]);

  // Clear all timeouts
  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (attemptTimeoutRef.current) {
      clearTimeout(attemptTimeoutRef.current);
      attemptTimeoutRef.current = null;
    }
  }, []);

  // Start countdown timer
  const startCountdown = useCallback((delay: number) => {
    let remaining = Math.ceil(delay / 1000);
    
    setState(prev => ({
      ...prev,
      timeUntilNextRetry: remaining,
    }));

    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setState(prev => ({
        ...prev,
        timeUntilNextRetry: Math.max(0, remaining),
      }));

      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }
    }, 1000);
  }, []);

  // Execute retry attempt
  const executeRetry = useCallback(async (
    retryFn: () => Promise<boolean>,
    _retryCount: number
  ): Promise<boolean> => {
    try {
      // Set attempt timeout
      const attemptPromise = new Promise<boolean>((resolve, reject) => {
        attemptTimeoutRef.current = setTimeout(() => {
          reject(new Error('Attempt timeout'));
        }, finalConfig.timeoutMs);
      });

      // Execute the retry function
      const retryPromise = retryFn();
      
      // Race between retry function and timeout
      const result = await Promise.race([retryPromise, attemptPromise]);
      
      // Clear attempt timeout if retry completed
      if (attemptTimeoutRef.current) {
        clearTimeout(attemptTimeoutRef.current);
        attemptTimeoutRef.current = null;
      }

      return result;
    } catch (error) {
      // Clear attempt timeout
      if (attemptTimeoutRef.current) {
        clearTimeout(attemptTimeoutRef.current);
        attemptTimeoutRef.current = null;
      }
      throw error;
    }
  }, [finalConfig.timeoutMs]);

  // Main retry function
  const retry = useCallback(async (
    retryFn: () => Promise<boolean>,
    fallbackFn?: () => Promise<boolean>
  ) => {
    clearTimeouts();
    
    setState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: 0,
      lastError: null,
    }));

    callbacks.onRetryStart?.();

    let currentRetryCount = 0;
    let lastError: string = '';

    while (currentRetryCount <= finalConfig.maxRetries) {
      try {
        const success = await executeRetry(retryFn, currentRetryCount);
        
        if (success) {
          setState(prev => ({
            ...prev,
            isRetrying: false,
            retryCount: currentRetryCount,
            lastError: null,
            timeUntilNextRetry: 0,
          }));
          
          callbacks.onRetrySuccess?.();
          return true;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        setState(prev => ({
          ...prev,
          lastError,
          retryCount: currentRetryCount,
        }));
        
        callbacks.onRetryFailure?.(lastError, currentRetryCount);
      }

      currentRetryCount++;

      if (currentRetryCount <= finalConfig.maxRetries) {
        const delay = calculateDelay(currentRetryCount - 1);
        
        setState(prev => ({
          ...prev,
          nextRetryDelay: delay,
        }));

        startCountdown(delay);

        // Wait for the delay
        await new Promise(resolve => {
          timeoutRef.current = setTimeout(resolve, delay);
        });
      }
    }

    // Max retries exceeded
    setState(prev => ({
      ...prev,
      isRetrying: false,
      timeUntilNextRetry: 0,
    }));

    callbacks.onMaxRetriesExceeded?.();

    // Try fallback if available
    if (fallbackFn) {
      try {
        callbacks.onFallback?.();
        const fallbackSuccess = await fallbackFn();
        if (fallbackSuccess) {
          return true;
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }

    return false;
  }, [
    clearTimeouts,
    finalConfig.maxRetries,
    calculateDelay,
    startCountdown,
    executeRetry,
    callbacks,
  ]);

  // Reset retry state
  const reset = useCallback(() => {
    clearTimeouts();
    setState({
      isRetrying: false,
      retryCount: 0,
      lastError: null,
      nextRetryDelay: 0,
      timeUntilNextRetry: 0,
    });
  }, [clearTimeouts]);

  // Cancel ongoing retry
  const cancel = useCallback(() => {
    clearTimeouts();
    setState(prev => ({
      ...prev,
      isRetrying: false,
      timeUntilNextRetry: 0,
    }));
  }, [clearTimeouts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
    };
  }, [clearTimeouts]);

  return {
    retry,
    reset,
    cancel,
    state,
    config: finalConfig,
  };
}; 