import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import cors from 'cors';
import { getEnvironmentConfig } from '../../../../packages/config/env';

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
ensureLogsDir().catch(console.error);

const config = getEnvironmentConfig();
const allowedOrigins = config.CORS_ORIGIN.split(',').map((o: string) => o.trim());

// Robust CORS middleware for all /logs routes
router.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'), false);
  },
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
  ipAddress?: string;
  userAgent?: string;
}

// Upload logs with device information
router.post('/upload', (req: Request, res: Response) => {
  const payload: LogUploadPayload = req.body;
  const { sessionId, deviceInfo, logs, metadata } = payload;
  
  if (!sessionId || !logs || !Array.isArray(logs)) {
    res.status(400).json({
      error: 'Missing required fields: sessionId and logs array'
    });
    return;
  }

  const logId = uuid();
  const uploadedAt = new Date().toISOString();
  
  // Extract additional information from request
  const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] as string;
  const userAgent = req.headers['user-agent'];
  
  const logEntry: StoredLogEntry = {
    id: logId,
    sessionId,
    deviceInfo,
    logs,
    metadata,
    uploadedAt,
    ipAddress,
    userAgent,
  };

  // Save to JSON file
  const filename = `log_${logId}_${Date.now()}.json`;
  const filepath = path.join(LOGS_DIR, filename);
  
  ensureLogsDir()
    .then(() => fs.writeFile(filepath, JSON.stringify(logEntry, null, 2)))
    .then(() => {
      console.log(`📊 Log uploaded: ${logId} (${logs.length} events) from session ${sessionId}`);
      
      res.status(200).json({
        success: true,
        logId,
        message: 'Logs uploaded successfully',
        filename,
        eventCount: logs.length,
        uploadedAt
      });
    })
    .catch((error) => {
      console.error('Failed to upload logs:', error);
      res.status(500).json({
        error: 'Failed to upload logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    });
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
        console.warn(`Failed to read log file ${file}:`, error);
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
    console.error('Failed to fetch logs:', error);
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
          console.warn(`Failed to read log file ${file}:`, error);
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
      console.error('Failed to fetch log:', error);
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
            console.log(`🗑️ Log deleted: ${logId}`);
            return true;
          }
        } catch (error) {
          console.warn(`Failed to read log file ${file}:`, error);
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
      console.error('Failed to delete log:', error);
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
        console.warn(`Failed to read log file ${file}:`, error);
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
    console.error('Failed to get logs summary:', error);
    res.status(500).json({
      error: 'Failed to get logs summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 