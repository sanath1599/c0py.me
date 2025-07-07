import { v4 as uuid } from 'uuid';
import { EventEntry } from '../types';

const STORAGE_KEY = '_eventLog';
const sessionId = uuid();

let inMemoryBuffer: EventEntry[] = [];
let flushScheduled = false;

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  
  const flushFn = () => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(existing.concat(inMemoryBuffer))
      );
      inMemoryBuffer = [];
    } catch {
      // silent drop, retry next idle
    } finally {
      flushScheduled = false;
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(flushFn);
  } else {
    setTimeout(flushFn, 2000);
  }
}

export function logEvent(type: string, details: object) {
  try {
    const entry: EventEntry = {
      id: uuid(),
      type,
      details,
      timestamp: Date.now(),
      sessionId,
      // userId: get from auth context if available
    };
    inMemoryBuffer.push(entry);
    scheduleFlush();
  } catch {
    // swallow any errors
  }
}

export function flushEvents(): EventEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearEvents() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

// Convenience functions for common event types
export const logUserInteraction = {
  click: (elementId: string, additionalDetails?: Record<string, any>) => {
    logEvent('click', { elementId, ...additionalDetails });
  },
  
  navigation: (to: string, from?: string) => {
    logEvent('navigation', { to, from });
  },
  
  formSubmit: (formId: string, formData?: Record<string, any>) => {
    logEvent('form_submit', { formId, formData });
  },
  
  fileAction: (action: string, fileInfo?: Record<string, any>) => {
    logEvent('file_action', { action, ...fileInfo });
  },
  
  peerAction: (action: string, peerInfo?: Record<string, any>) => {
    logEvent('peer_action', { action, ...peerInfo });
  },
  
  error: (errorType: string, errorMessage: string, context?: Record<string, any>) => {
    logEvent('error', { errorType, errorMessage, ...context });
  }
}; 