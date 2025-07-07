import { EventEntry } from '../types';
import { collectEnhancedDeviceInfo } from '../utils/deviceInfo';

export interface LogUploadPayload {
  sessionId: string;
  deviceInfo: any;
  logs: EventEntry[];
  metadata: {
    totalLogs: number;
    dateRange: {
      start: string;
      end: string;
    };
    uploadTimestamp: string;
    version: string;
  };
}

export interface LogUploadResponse {
  success: boolean;
  logId?: string;
  message?: string;
  error?: string;
}

class LogUploadService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001';
  }

  async uploadLogs(logs: EventEntry[], sessionId: string): Promise<LogUploadResponse> {
    try {
      // Collect device information
      const deviceInfo = await collectEnhancedDeviceInfo(sessionId);
      
      // Prepare metadata
      const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
      const metadata = {
        totalLogs: logs.length,
        dateRange: {
          start: new Date(sortedLogs[0]?.timestamp || Date.now()).toISOString(),
          end: new Date(sortedLogs[sortedLogs.length - 1]?.timestamp || Date.now()).toISOString(),
        },
        uploadTimestamp: new Date().toISOString(),
        version: '1.0.0', // You can make this dynamic based on your app version
      };

      const payload: LogUploadPayload = {
        sessionId,
        deviceInfo,
        logs,
        metadata,
      };

      const response = await fetch(`${this.baseUrl}/api/logs/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        logId: result.logId,
        message: 'Logs uploaded successfully',
      };
    } catch (error) {
      console.error('Failed to upload logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async getUploadedLogs(sessionId?: string): Promise<{ success: boolean; logs?: any[]; error?: string }> {
    try {
      const url = sessionId 
        ? `${this.baseUrl}/api/logs?sessionId=${encodeURIComponent(sessionId)}`
        : `${this.baseUrl}/api/logs`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        logs: result.logs,
      };
    } catch (error) {
      console.error('Failed to fetch uploaded logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async deleteUploadedLogs(logId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/logs/${logId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Failed to delete uploaded logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

export const logUploadService = new LogUploadService(); 