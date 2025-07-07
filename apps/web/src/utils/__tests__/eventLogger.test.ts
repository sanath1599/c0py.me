import { logEvent, flushEvents, clearEvents, logUserAction, logSystemEvent, flushNow } from '../eventLogger';
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
  flushNow();
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

    it('should log process started events', async () => {
      logUserAction.processStarted('file_transfer', 'transfer_initiated', { peerId: 'peer-123' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'user_action',
        details: { 
          action: 'process_started',
          processName: 'file_transfer',
          step: 'transfer_initiated',
          context: { peerId: 'peer-123' },
          category: 'navigation'
        },
      });
    });

    it('should log process step events', async () => {
      logUserAction.processStep('file_transfer', 'sending_file', { fileName: 'test.txt' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'user_action',
        details: { 
          action: 'process_step',
          processName: 'file_transfer',
          step: 'sending_file',
          context: { fileName: 'test.txt' },
          category: 'navigation'
        },
      });
    });

    it('should log process completed events', async () => {
      logUserAction.processCompleted('file_transfer', 'transfer_sent', { fileCount: 1 });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'user_action',
        details: { 
          action: 'process_completed',
          processName: 'file_transfer',
          step: 'transfer_sent',
          context: { fileCount: 1 },
          category: 'navigation'
        },
      });
    });

    it('should log process failed events', async () => {
      logUserAction.processFailed('file_transfer', 'connection_failed', 'Network error', { peerId: 'peer-123' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'user_action',
        details: { 
          action: 'process_failed',
          processName: 'file_transfer',
          step: 'connection_failed',
          error: 'Network error',
          context: { peerId: 'peer-123' },
          category: 'navigation'
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

    it('should log system process started events', async () => {
      logSystemEvent.systemProcessStarted('webrtc_connection', 'creating_peer_connection', { peerId: 'peer-123' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'system_event',
        details: { 
          event: 'system_process_started',
          processName: 'webrtc_connection',
          step: 'creating_peer_connection',
          context: { peerId: 'peer-123' },
          category: 'connection'
        },
      });
    });

    it('should log system process step events', async () => {
      logSystemEvent.systemProcessStep('webrtc_connection', 'data_channel_opened', { transferId: 'transfer-123' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'system_event',
        details: { 
          event: 'system_process_step',
          processName: 'webrtc_connection',
          step: 'data_channel_opened',
          context: { transferId: 'transfer-123' },
          category: 'connection'
        },
      });
    });

    it('should log system process completed events', async () => {
      logSystemEvent.systemProcessCompleted('webrtc_connection', 'transfer_completed', { fileSize: 1024000 });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'system_event',
        details: { 
          event: 'system_process_completed',
          processName: 'webrtc_connection',
          step: 'transfer_completed',
          context: { fileSize: 1024000 },
          category: 'connection'
        },
      });
    });

    it('should log system process failed events', async () => {
      logSystemEvent.systemProcessFailed('webrtc_connection', 'connection_failed', 'ICE connection failed', { peerId: 'peer-123' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'system_event',
        details: { 
          event: 'system_process_failed',
          processName: 'webrtc_connection',
          step: 'connection_failed',
          error: 'ICE connection failed',
          context: { peerId: 'peer-123' },
          category: 'error'
        },
      });
    });
  });
}); 