// Test setup for web app
import '@testing-library/jest-dom';

// Mock window.requestIdleCallback if not available
if (!('requestIdleCallback' in window)) {
  Object.defineProperty(window, 'requestIdleCallback', {
    value: (callback: Function) => setTimeout(callback, 0),
    writable: true,
  });
}

// Mock window.localStorage if not available
if (!('localStorage' in window)) {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });
} 