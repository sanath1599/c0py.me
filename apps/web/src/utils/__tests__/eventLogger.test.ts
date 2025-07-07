import { logEvent, flushEvents, clearEvents, logUserAction, logSystemEvent } from '../eventLogger';
import { EventEntry } from '../../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock requestIdleCallback
Object.defineProperty(window, 'requestIdleCallback', {
  value: jest.fn((callback) => setTimeout(callback, 0)),
  writable: true,
});

const waitForFlush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
};

describe('EventLogger', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('logEvent', () => {
    it('should create an event entry with correct structure', async () => {
      const mockDate = 1234567890;
      jest.spyOn(Date, 'now').mockReturnValue(mockDate);

      logEvent('test_event', { test: 'data' });
      await waitForFlush();

      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData).toHaveLength(1);
      
      const event = storedData[0];
      expect(event).toMatchObject({
        type: 'test_event',
        details: { test: 'data' },
        timestamp: mockDate,
        sessionId: expect.any(String),
      });
      expect(event.id).toBeDefined();
    });

    it('should handle errors gracefully', () => {
      // Mock localStorage.setItem to throw an error
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Should not throw
      expect(() => {
        logEvent('test_event', { test: 'data' });
      }).not.toThrow();
    });
  });

  describe('flushEvents', () => {
    it('should return empty array when no events exist', () => {
      const events = flushEvents();
      expect(events).toEqual([]);
    });

    it('should return stored events', () => {
      const mockEvents: EventEntry[] = [
        {
          id: '1',
          type: 'test',
          details: { test: 'data' },
          timestamp: 1234567890,
          sessionId: 'session-1',
        },
      ];

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockEvents));
      
      const events = flushEvents();
      expect(events).toEqual(mockEvents);
    });

    it('should handle malformed JSON gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      const events = flushEvents();
      expect(events).toEqual([]);
    });
  });

  describe('clearEvents', () => {
    it('should remove events from localStorage', () => {
      clearEvents();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('_eventLog');
    });

    it('should handle errors gracefully', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => {
        clearEvents();
      }).not.toThrow();
    });
  });

  describe('logUserAction', () => {
    it('should log world selection events', async () => {
      logUserAction.worldSelected('jungle', 'room-123');
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'user_action',
        details: { 
          action: 'world_selected',
          world: 'jungle',
          roomId: 'room-123',
          category: 'navigation'
        },
      });
    });

    it('should log file selection events', async () => {
      logUserAction.filesSelected(3, 1024000, ['image/jpeg', 'text/plain']);
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'user_action',
        details: { 
          action: 'files_selected',
          fileCount: 3,
          totalSize: 1024000,
          fileTypes: ['image/jpeg', 'text/plain'],
          category: 'file_operation'
        },
      });
    });

    it('should log transfer initiation events', async () => {
      logUserAction.transferInitiated('peer-123', 2, 2048000);
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'user_action',
        details: { 
          action: 'transfer_initiated',
          peerId: 'peer-123',
          fileCount: 2,
          totalSize: 2048000,
          category: 'file_operation'
        },
      });
    });
  });

  describe('logSystemEvent', () => {
    it('should log socket connection events', async () => {
      logSystemEvent.socketConnected('websocket', 50);
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'system_event',
        details: { 
          event: 'socket_connected',
          connectionMode: 'websocket',
          latency: 50,
          category: 'connection'
        },
      });
    });

    it('should log WebRTC events', async () => {
      logSystemEvent.webrtcConnectionEstablished('peer-123', 'transfer-456', 100);
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'system_event',
        details: { 
          event: 'webrtc_connection_established',
          peerId: 'peer-123',
          transferId: 'transfer-456',
          latency: 100,
          category: 'webrtc'
        },
      });
    });

    it('should log transfer completion events', async () => {
      logSystemEvent.transferCompleted('transfer-123', 5000, 1024000, 204800);
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'system_event',
        details: { 
          event: 'transfer_completed',
          transferId: 'transfer-123',
          duration: 5000,
          totalSize: 1024000,
          averageSpeed: 204800,
          category: 'transfer'
        },
      });
    });

    it('should log error events', async () => {
      logSystemEvent.error('NetworkError', 'Connection failed', { context: 'test' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'system_event',
        details: { 
          event: 'error',
          errorType: 'NetworkError', 
          errorMessage: 'Connection failed',
          context: { context: 'test' },
          category: 'error'
        },
      });
    });
  });
}); 