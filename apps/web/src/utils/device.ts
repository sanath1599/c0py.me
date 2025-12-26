import { INDEXEDDB_CONSTANTS } from '@sharedrop/config';

const { INDEXEDDB_MOBILE_THRESHOLD } = INDEXEDDB_CONSTANTS;

/**
 * Detect if the current device is a mobile device
 */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Determine if IndexedDB should be used for a file based on device type and file size
 */
export const shouldUseIndexedDB = (fileSize: number): boolean => {
  return isMobileDevice() && fileSize > INDEXEDDB_MOBILE_THRESHOLD;
};

