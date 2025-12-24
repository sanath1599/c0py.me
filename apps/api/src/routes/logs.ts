import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import cors from 'cors';
import { getEnvironmentConfig } from '../../../../packages/config/env';
import logger from '../logger';

const router: express.Router = express.Router();

// Ensure logs directory exists
const LOGS_DIR = path.join(process.cwd(), 'logs');
const ensureLogsDir = async () => {
  try {
    await fs.access(LOGS_DIR);
  } catch {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }
};

// Initialize logs directory on startup
ensureLogsDir().catch((error) => logger.error('Failed to ensure logs directory', { error }));

const config = getEnvironmentConfig();

// CORS middleware allowing all origins for /logs routes
router.use(cors({
  origin: true, // Allow all origins
  credentials: true
}));

interface LogUploadPayload {
  sessionId: string;
  deviceInfo: any;
  logs: any[];
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

interface StoredLogEntry {
  id: string;
  sessionId: string;
  deviceInfo: any;
  logs: any[];
  metadata: any;
  uploadedAt: string;
  lastUpdatedAt: string;
  userAgent?: string;
}

// Upload logs with device information
router.post('/upload', async (req: Request, res: Response) => {
  const payload: LogUploadPayload = req.body;
  const { sessionId, deviceInfo, logs, metadata } = payload;
  
  if (!sessionId || !logs || !Array.isArray(logs)) {
    res.status(400).json({
      error: 'Missing required fields: sessionId and logs array'
    });
    return;
  }

  try {
    await ensureLogsDir();
    
    // Extract additional information from request (no IP address for privacy)
    const userAgent = req.headers['user-agent'];
    const now = new Date().toISOString();
    
    // Check if log entry with this sessionId already exists
    const files = await fs.readdir(LOGS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    let existingLog: StoredLogEntry | null = null;
    let existingFilePath: string | null = null;
    
    for (const file of jsonFiles) {
      try {
        const filepath = path.join(LOGS_DIR, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const logEntry: StoredLogEntry = JSON.parse(content);
        
        if (logEntry.sessionId === sessionId) {
          existingLog = logEntry;
          existingFilePath = filepath;
          break;
        }
      } catch (error) {
        logger.warn(`Failed to read log file ${file}`, { error, file });
        continue;
      }
    }
    
    let logId: string;
    let uploadedAt: string;
    let filename: string;
    let filepath: string;
    
    if (existingLog && existingFilePath) {
      // Update existing log entry
      logId = existingLog.id;
      uploadedAt = existingLog.uploadedAt; // Keep original upload time
      
      // Merge logs (append new logs, avoiding duplicates by timestamp)
      const existingLogTimestamps = new Set(existingLog.logs.map((log: any) => log.timestamp));
      const newLogs = logs.filter((log: any) => !existingLogTimestamps.has(log.timestamp));
      const mergedLogs = [...existingLog.logs, ...newLogs];
      
      // Update log entry
      const updatedLogEntry: StoredLogEntry = {
        ...existingLog,
        deviceInfo, // Update device info with latest
        logs: mergedLogs,
        metadata, // Update metadata
        lastUpdatedAt: now,
        userAgent: userAgent || existingLog.userAgent,
      };
      
      filename = path.basename(existingFilePath);
      filepath = existingFilePath;
      
      await fs.writeFile(filepath, JSON.stringify(updatedLogEntry, null, 2));
      logger.info(`Log updated: ${logId}`, { 
        logId, 
        totalEvents: mergedLogs.length, 
        newEvents: newLogs.length, 
        sessionId 
      });
      
      res.status(200).json({
        success: true,
        logId,
        message: 'Logs updated successfully',
        filename,
        eventCount: mergedLogs.length,
        newEventsCount: newLogs.length,
        uploadedAt,
        lastUpdatedAt: now,
        isUpdate: true
      });
    } else {
      // Create new log entry
      logId = uuid();
      uploadedAt = now;
      
      const logEntry: StoredLogEntry = {
        id: logId,
        sessionId,
        deviceInfo,
        logs,
        metadata,
        uploadedAt,
        lastUpdatedAt: now,
        userAgent,
      };
      
      filename = `log_${sessionId}_${Date.now()}.json`;
      filepath = path.join(LOGS_DIR, filename);
      
      await fs.writeFile(filepath, JSON.stringify(logEntry, null, 2));
      logger.info(`Log uploaded: ${logId}`, { logId, eventCount: logs.length, sessionId });
      
      res.status(200).json({
        success: true,
        logId,
        message: 'Logs uploaded successfully',
        filename,
        eventCount: logs.length,
        uploadedAt,
        lastUpdatedAt: now,
        isUpdate: false
      });
    }
  } catch (error) {
    logger.error('Failed to upload logs', { error });
    res.status(500).json({
      error: 'Failed to upload logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all uploaded logs
router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureLogsDir();
    
    const { sessionId } = req.query;
    
    // Read all JSON files in logs directory
    const files = await fs.readdir(LOGS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const logs: StoredLogEntry[] = [];
    
    for (const file of jsonFiles) {
      try {
        const filepath = path.join(LOGS_DIR, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const logEntry: StoredLogEntry = JSON.parse(content);
        
        // Filter by sessionId if provided
        if (sessionId && logEntry.sessionId !== sessionId) {
          continue;
        }
        
        logs.push(logEntry);
      } catch (error) {
        logger.warn(`Failed to read log file ${file}`, { error, file });
        continue;
      }
    }
    
    // Sort by upload date (newest first)
    logs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    
    res.json({
      success: true,
      logs,
      count: logs.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to fetch logs', { error });
    res.status(500).json({
      error: 'Failed to fetch logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific log by ID
router.get('/:logId', (req: Request, res: Response) => {
  const { logId } = req.params;
  
  ensureLogsDir()
    .then(() => fs.readdir(LOGS_DIR))
    .then(files => {
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const readPromises = jsonFiles.map(async (file) => {
        try {
          const filepath = path.join(LOGS_DIR, file);
          const content = await fs.readFile(filepath, 'utf-8');
          const logEntry: StoredLogEntry = JSON.parse(content);
          
          if (logEntry.id === logId) {
            return logEntry;
          }
        } catch (error) {
          logger.warn(`Failed to read log file ${file}`, { error, file });
        }
        return null;
      });
      
      return Promise.all(readPromises);
    })
    .then(results => {
      const foundLog = results.find(log => log !== null);
      
      if (foundLog) {
        res.json({
          success: true,
          log: foundLog
        });
      } else {
        res.status(404).json({
          error: 'Log not found',
          logId
        });
      }
    })
    .catch(error => {
      logger.error('Failed to fetch log', { error, logId });
      res.status(500).json({
        error: 'Failed to fetch log',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
});

// Delete specific log by ID
router.delete('/:logId', (req: Request, res: Response) => {
  const { logId } = req.params;
  
  ensureLogsDir()
    .then(() => fs.readdir(LOGS_DIR))
    .then(files => {
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const findAndDeletePromises = jsonFiles.map(async (file) => {
        try {
          const filepath = path.join(LOGS_DIR, file);
          const content = await fs.readFile(filepath, 'utf-8');
          const logEntry: StoredLogEntry = JSON.parse(content);
          
          if (logEntry.id === logId) {
            await fs.unlink(filepath);
            logger.info(`Log deleted: ${logId}`, { logId });
            return true;
          }
        } catch (error) {
          logger.warn(`Failed to read log file ${file}`, { error, file });
        }
        return false;
      });
      
      return Promise.all(findAndDeletePromises);
    })
    .then(results => {
      const wasDeleted = results.some(result => result === true);
      
      if (wasDeleted) {
        res.json({
          success: true,
          message: 'Log deleted successfully',
          logId
        });
      } else {
        res.status(404).json({
          error: 'Log not found',
          logId
        });
      }
    })
    .catch(error => {
      logger.error('Failed to delete log', { error, logId });
      res.status(500).json({
        error: 'Failed to delete log',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
});

// Get logs statistics
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    await ensureLogsDir();
    
    const files = await fs.readdir(LOGS_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    let totalLogs = 0;
    let totalEvents = 0;
    let totalSessions = 0;
    const sessions = new Set<string>();
    const deviceTypes = new Map<string, number>();
    const browsers = new Map<string, number>();
    
    for (const file of jsonFiles) {
      try {
        const filepath = path.join(LOGS_DIR, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const logEntry: StoredLogEntry = JSON.parse(content);
        
        totalLogs++;
        totalEvents += logEntry.logs.length;
        sessions.add(logEntry.sessionId);
        
        // Count device types
        if (logEntry.deviceInfo?.device?.type) {
          const deviceType = logEntry.deviceInfo.device.type;
          deviceTypes.set(deviceType, (deviceTypes.get(deviceType) || 0) + 1);
        }
        
        // Count browsers (simplified)
        if (logEntry.deviceInfo?.browser?.userAgent) {
          const userAgent = logEntry.deviceInfo.browser.userAgent.toLowerCase();
          let browser = 'Unknown';
          
          if (userAgent.includes('chrome')) browser = 'Chrome';
          else if (userAgent.includes('firefox')) browser = 'Firefox';
          else if (userAgent.includes('safari')) browser = 'Safari';
          else if (userAgent.includes('edge')) browser = 'Edge';
          
          browsers.set(browser, (browsers.get(browser) || 0) + 1);
        }
        
      } catch (error) {
        logger.warn(`Failed to read log file ${file}`, { error, file });
        continue;
      }
    }
    
    totalSessions = sessions.size;
    
    res.json({
      success: true,
      summary: {
        totalLogs,
        totalEvents,
        totalSessions,
        deviceTypes: Object.fromEntries(deviceTypes),
        browsers: Object.fromEntries(browsers),
        averageEventsPerLog: totalLogs > 0 ? Math.round(totalEvents / totalLogs) : 0,
        averageEventsPerSession: totalSessions > 0 ? Math.round(totalEvents / totalSessions) : 0,
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get logs summary', { error });
    res.status(500).json({
      error: 'Failed to get logs summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 