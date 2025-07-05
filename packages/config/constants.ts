export const APP_CONSTANTS = {
  APP_NAME: 'ShareDrop',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'WebRTC File Sharing with MERN Stack',
} as const;

export const API_CONSTANTS = {
  BASE_URL: '/api',
  VERSION: 'v1',
  ENDPOINTS: {
    HEALTH: '/health',
    USERS: '/users',
    TRANSFERS: '/transfers',
  },
} as const;

export const WEBSOCKET_CONSTANTS = {
  EVENTS: {
    JOIN: 'join',
    USER_JOINED: 'userJoined',
    USER_LEFT: 'userLeft',
    OFFER: 'offer',
    ANSWER: 'answer',
    ICE_CANDIDATE: 'ice-candidate',
    FILE_TRANSFER_REQUEST: 'file-transfer-request',
    FILE_TRANSFER_RESPONSE: 'file-transfer-response',
  },
} as const;

export const WEBRTC_CONSTANTS = {
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  CHUNK_SIZE: 16384, // 16KB
  DATA_CHANNEL_NAME: 'fileTransfer',
} as const;

export const FILE_CONSTANTS = {
  MAX_FILE_SIZE: 1024 * 1024 * 1024, // 1GB
  SUPPORTED_TYPES: [
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'text/*',
    'application/zip',
    'application/x-rar-compressed',
  ],
} as const;

export const VALIDATION_CONSTANTS = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
  },
  FILENAME: {
    MAX_LENGTH: 255,
  },
} as const; 