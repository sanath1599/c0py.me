export interface DeviceInfo {
  // Screen and Window Information
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
    orientation: string;
  };
  
  // Window Information
  window: {
    width: number;
    height: number;
    innerWidth: number;
    innerHeight: number;
    outerWidth: number;
    outerHeight: number;
    devicePixelRatio: number;
  };
  
  // Browser Information
  browser: {
    userAgent: string;
    language: string;
    languages: string[];
    cookieEnabled: boolean;
    doNotTrack: string | null;
    onLine: boolean;
    platform: string;
    vendor: string;
    maxTouchPoints: number;
  };
  
  // Device Information
  device: {
    type: 'mobile' | 'tablet' | 'desktop';
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    touchSupport: boolean;
    orientation: string;
  };
  
  // Network Information
  network: {
    connectionType: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
    onLine: boolean;
  };
  
  // Performance Information
  performance: {
    memory: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    } | null;
    timing: {
      navigationStart: number;
      loadEventEnd: number;
      domContentLoadedEventEnd: number;
    } | null;
  };
  
  // Geolocation (if available)
  location: {
    timezone: string;
    timezoneOffset: number;
  };
  
  // Timestamp
  timestamp: number;
  sessionId: string;
}

export const collectDeviceInfo = (sessionId: string): DeviceInfo => {
  const screen = window.screen;
  const navigator = window.navigator;
  const performance = window.performance;
  
  // Detect device type
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent);
  const isTablet = /tablet|ipad/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;
  
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (isMobile) deviceType = 'mobile';
  else if (isTablet) deviceType = 'tablet';
  
  // Get network information
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  // Get performance memory info
  const memory = (performance as any).memory ? {
    usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
    totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
    jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
  } : null;
  
  // Get performance timing info
  const timing = performance.timing ? {
    navigationStart: performance.timing.navigationStart,
    loadEventEnd: performance.timing.loadEventEnd,
    domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd,
  } : null;
  
  return {
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      orientation: screen.orientation ? screen.orientation.type : 'unknown',
    },
    
    window: {
      width: window.innerWidth,
      height: window.innerHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: Array.from(navigator.languages || []),
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      onLine: navigator.onLine,
      platform: navigator.platform,
      vendor: navigator.vendor,
      maxTouchPoints: navigator.maxTouchPoints,
    },
    
    device: {
      type: deviceType,
      isMobile,
      isTablet,
      isDesktop,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      orientation: screen.orientation ? screen.orientation.type : 'unknown',
    },
    
    network: {
      connectionType: connection ? connection.effectiveType || connection.type || 'unknown' : 'unknown',
      effectiveType: connection ? connection.effectiveType || 'unknown' : 'unknown',
      downlink: connection ? connection.downlink || 0 : 0,
      rtt: connection ? connection.rtt || 0 : 0,
      saveData: connection ? connection.saveData || false : false,
      onLine: navigator.onLine,
    },
    
    performance: {
      memory,
      timing,
    },
    
    location: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: new Date().getTimezoneOffset(),
    },
    
    timestamp: Date.now(),
    sessionId,
  };
};

export const getIPAddress = async (): Promise<string | null> => {
  try {
    // Try multiple IP detection services
    const services = [
      'https://api.ipify.org?format=json',
      'https://api.myip.com',
      'https://ipapi.co/json/',
    ];
    
    for (const service of services) {
      try {
        const response = await fetch(service, { 
          method: 'GET',
          mode: 'cors'
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.ip || data.query || null;
        }
      } catch (error) {
        console.warn(`Failed to get IP from ${service}:`, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get IP address:', error);
    return null;
  }
};

export const collectEnhancedDeviceInfo = async (sessionId: string) => {
  const deviceInfo = collectDeviceInfo(sessionId);
  const ipAddress = await getIPAddress();
  
  return {
    ...deviceInfo,
    ipAddress,
    collectedAt: new Date().toISOString(),
  };
}; 