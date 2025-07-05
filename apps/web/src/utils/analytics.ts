// Google Analytics utility for c0py.me
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

// Custom event tracking
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Page view tracking
export const trackPageView = (page_title: string, page_location?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-BT0EHC9WRV', {
      page_title,
      page_location: page_location || window.location.href,
    });
  }
};

// User engagement tracking
export const trackUserEngagement = (engagement_time_msec: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'user_engagement', {
      engagement_time_msec,
    });
  }
};

// File transfer events
export const trackFileTransfer = {
  started: (fileCount: number, worldType: string) => {
    trackEvent('file_transfer_started', 'file_transfer', worldType, fileCount);
  },
  completed: (fileSize: number, worldType: string) => {
    trackEvent('file_transfer_completed', 'file_transfer', worldType, fileSize);
  },
  failed: (worldType: string) => {
    trackEvent('file_transfer_failed', 'file_transfer', worldType);
  },
  cancelled: (worldType: string) => {
    trackEvent('file_transfer_cancelled', 'file_transfer', worldType);
  },
};

// World selection events
export const trackWorldSelection = {
  jungle: () => trackEvent('world_selected', 'navigation', 'jungle'),
  room: () => trackEvent('world_selected', 'navigation', 'room'),
  family: () => trackEvent('world_selected', 'navigation', 'family'),
};

// Room events
export const trackRoomEvents = {
  created: (roomId: string) => trackEvent('room_created', 'room', roomId),
  joined: (roomId: string) => trackEvent('room_joined', 'room', roomId),
  copied: (roomId: string) => trackEvent('room_code_copied', 'room', roomId),
};

// User interaction events
export const trackUserInteraction = {
  profileUpdated: () => trackEvent('profile_updated', 'user_interaction'),
  fileSelected: (fileCount: number) => {
    trackEvent('files_selected', 'user_interaction', undefined, fileCount);
  },
  peerSelected: () => trackEvent('peer_selected', 'user_interaction'),
  dragDrop: () => trackEvent('drag_drop_used', 'user_interaction'),
  searchUsed: () => trackEvent('search_used', 'user_interaction'),
};

// Error tracking
export const trackError = (errorType: string, errorMessage: string) => {
  trackEvent('error_occurred', 'error', `${errorType}: ${errorMessage}`);
};

// Performance tracking
export const trackPerformance = {
  pageLoad: (loadTime: number) => {
    trackEvent('page_load_time', 'performance', undefined, loadTime);
  },
  transferSpeed: (speed: number) => {
    trackEvent('transfer_speed', 'performance', undefined, speed);
  },
};

// Privacy-focused tracking (no personal data)
export const trackPrivacyEvents = {
  fileReceived: (fileType: string) => {
    trackEvent('file_received', 'privacy', fileType);
  },
  fileRejected: (fileType: string) => {
    trackEvent('file_rejected', 'privacy', fileType);
  },
  connectionEstablished: (worldType: string) => {
    trackEvent('connection_established', 'privacy', worldType);
  },
};

// Initialize analytics
export const initAnalytics = () => {
  if (typeof window !== 'undefined') {
    // Track initial page load
    trackPageView('c0py.me - Landing Page');
    
    // Track user engagement on page load
    const startTime = Date.now();
    window.addEventListener('beforeunload', () => {
      const engagementTime = Date.now() - startTime;
      trackUserEngagement(engagementTime);
    });
  }
}; 