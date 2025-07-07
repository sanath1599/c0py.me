import { logEvent, flushEvents, clearEvents, logUserInteraction } from '../eventLogger';
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

  describe('logUserInteraction', () => {
    it('should log click events', async () => {
      logUserInteraction.click('test-button', { additional: 'data' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'click',
        details: { elementId: 'test-button', additional: 'data' },
      });
    });

    it('should log navigation events', async () => {
      logUserInteraction.navigation('/test-page', '/home');
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'navigation',
        details: { to: '/test-page', from: '/home' },
      });
    });

    it('should log form submit events', async () => {
      logUserInteraction.formSubmit('test-form', { field1: 'value1' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'form_submit',
        details: { formId: 'test-form', formData: { field1: 'value1' } },
      });
    });

    it('should log file action events', async () => {
      logUserInteraction.fileAction('upload', { fileName: 'test.txt', size: 1024 });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'file_action',
        details: { action: 'upload', fileName: 'test.txt', size: 1024 },
      });
    });

    it('should log peer action events', async () => {
      logUserInteraction.peerAction('connect', { peerId: 'peer-1', name: 'Test Peer' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'peer_action',
        details: { action: 'connect', peerId: 'peer-1', name: 'Test Peer' },
      });
    });

    it('should log error events', async () => {
      logUserInteraction.error('NetworkError', 'Connection failed', { context: 'test' });
      await waitForFlush();
      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(storedData[0]).toMatchObject({
        type: 'error',
        details: { 
          errorType: 'NetworkError', 
          errorMessage: 'Connection failed',
          context: 'test'
        },
      });
    });
  });
}); 