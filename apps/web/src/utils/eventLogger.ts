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

// Meaningful event logging with consistent format
export const logUserAction = {
  // User interface interactions
  worldSelected: (world: string, roomId?: string) => {
    logEvent('user_action', { 
      action: 'world_selected',
      world,
      roomId,
      category: 'navigation'
    });
  },
  
  roomJoined: (roomId: string, world: string) => {
    logEvent('user_action', { 
      action: 'room_joined',
      roomId,
      world,
      category: 'navigation'
    });
  },
  
  roomCreated: (roomId: string, world: string) => {
    logEvent('user_action', { 
      action: 'room_created',
      roomId,
      world,
      category: 'navigation'
    });
  },
  
  roomCodeCopied: (roomId: string) => {
    logEvent('user_action', { 
      action: 'room_code_copied',
      roomId,
      category: 'navigation'
    });
  },
  
  peerSelected: (peerId: string, peerName: string) => {
    logEvent('user_action', { 
      action: 'peer_selected',
      peerId,
      peerName,
      category: 'interaction'
    });
  },
  
  filesSelected: (fileCount: number, totalSize: number, fileTypes: string[]) => {
    logEvent('user_action', { 
      action: 'files_selected',
      fileCount,
      totalSize,
      fileTypes,
      category: 'file_operation'
    });
  },
  
  transferInitiated: (peerId: string, fileCount: number, totalSize: number) => {
    logEvent('user_action', { 
      action: 'transfer_initiated',
      peerId,
      fileCount,
      totalSize,
      category: 'file_operation'
    });
  },
  
  transferCancelled: (transferId: string, reason?: string) => {
    logEvent('user_action', { 
      action: 'transfer_cancelled',
      transferId,
      reason,
      category: 'file_operation'
    });
  },
  
  profileUpdated: (field: string, oldValue: string, newValue: string) => {
    logEvent('user_action', { 
      action: 'profile_updated',
      field,
      oldValue,
      newValue,
      category: 'profile'
    });
  }
};

export const logSystemEvent = {
  // Socket connection events
  socketConnected: (connectionMode: string, latency?: number) => {
    logEvent('system_event', { 
      event: 'socket_connected',
      connectionMode,
      latency,
      category: 'connection'
    });
  },
  
  socketDisconnected: (reason: string, duration: number) => {
    logEvent('system_event', { 
      event: 'socket_disconnected',
      reason,
      duration,
      category: 'connection'
    });
  },
  
  // WebRTC events
  webrtcOfferSent: (peerId: string, transferId: string) => {
    logEvent('system_event', { 
      event: 'webrtc_offer_sent',
      peerId,
      transferId,
      category: 'webrtc'
    });
  },
  
  webrtcAnswerReceived: (peerId: string, transferId: string) => {
    logEvent('system_event', { 
      event: 'webrtc_answer_received',
      peerId,
      transferId,
      category: 'webrtc'
    });
  },
  
  webrtcConnectionEstablished: (peerId: string, transferId: string, latency: number) => {
    logEvent('system_event', { 
      event: 'webrtc_connection_established',
      peerId,
      transferId,
      latency,
      category: 'webrtc'
    });
  },
  
  webrtcConnectionFailed: (peerId: string, transferId: string, reason: string) => {
    logEvent('system_event', { 
      event: 'webrtc_connection_failed',
      peerId,
      transferId,
      reason,
      category: 'webrtc'
    });
  },
  
  // File transfer progress
  transferProgress: (transferId: string, progress: number, speed: number, timeRemaining: number) => {
    logEvent('system_event', { 
      event: 'transfer_progress',
      transferId,
      progress,
      speed,
      timeRemaining,
      category: 'transfer'
    });
  },
  
  transferCompleted: (transferId: string, duration: number, totalSize: number, averageSpeed: number) => {
    logEvent('system_event', { 
      event: 'transfer_completed',
      transferId,
      duration,
      totalSize,
      averageSpeed,
      category: 'transfer'
    });
  },
  
  transferFailed: (transferId: string, reason: string, duration: number) => {
    logEvent('system_event', { 
      event: 'transfer_failed',
      transferId,
      reason,
      duration,
      category: 'transfer'
    });
  },
  
  // API calls
  apiCall: (endpoint: string, method: string, status: number, duration: number) => {
    logEvent('system_event', { 
      event: 'api_call',
      endpoint,
      method,
      status,
      duration,
      category: 'api'
    });
  },
  
  // Error events
  error: (errorType: string, errorMessage: string, context?: Record<string, any>) => {
    logEvent('system_event', { 
      event: 'error',
      errorType,
      errorMessage,
      context,
      category: 'error'
    });
  },
  

  
  // File events
  fileReceived: (fileType: string, fileSize: number) => {
    logEvent('system_event', { 
      event: 'file_received',
      fileType,
      fileSize,
      category: 'transfer'
    });
  }
}; 