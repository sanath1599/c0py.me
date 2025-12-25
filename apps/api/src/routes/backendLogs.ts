import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import logger from '../logger';

const router: express.Router = express.Router();

// Backend logs directory
const BACKEND_LOGS_DIR = path.join(process.cwd(), 'backendLogs');

// Log levels supported
const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'exceptions', 'rejections'];

interface LogFileInfo {
  filename: string;
  level: string;
  date: string;
  size: number;
  lastModified: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  [key: string]: any;
}

// Get list of available log files
router.get('/files', async (req: Request, res: Response) => {
  try {
    // Check if backendLogs directory exists
    try {
      await fs.access(BACKEND_LOGS_DIR);
    } catch {
      res.json({
        success: true,
        files: [],
        count: 0,
        message: 'Backend logs directory does not exist'
      });
      return;
    }

    const files = await fs.readdir(BACKEND_LOGS_DIR);
    const logFiles: LogFileInfo[] = [];

    for (const file of files) {
      // Only process .log files
      if (!file.endsWith('.log')) {
        continue;
      }

      try {
        const filepath = path.join(BACKEND_LOGS_DIR, file);
        const stats = await fs.stat(filepath);
        
        // Parse filename to extract level and date
        // Format: {level}-{DATE}.log (e.g., error-2025-W52.log)
        const match = file.match(/^([a-z]+)-(.+)\.log$/);
        if (match) {
          const [, level, date] = match;
          
          logFiles.push({
            filename: file,
            level: level,
            date: date,
            size: stats.size,
            lastModified: stats.mtime.toISOString()
          });
        } else {
          // Fallback for files that don't match the pattern
          logFiles.push({
            filename: file,
            level: 'unknown',
            date: 'unknown',
            size: stats.size,
            lastModified: stats.mtime.toISOString()
          });
        }
      } catch (error) {
        logger.warn(`Failed to read file info for ${file}`, { error, file });
        continue;
      }
    }

    // Sort by last modified (newest first)
    logFiles.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );

    res.json({
      success: true,
      files: logFiles,
      count: logFiles.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to list backend log files', { error });
    res.status(500).json({
      error: 'Failed to list log files',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stream logs from a specific file with filters
router.get('/stream', async (req: Request, res: Response) => {
  const { filename, level, search, limit, offset } = req.query;

  if (!filename || typeof filename !== 'string') {
    res.status(400).json({
      error: 'Filename is required',
      message: 'Please provide a valid filename query parameter'
    });
    return;
  }

  // Security: prevent directory traversal
  const safeFilename = path.basename(filename);
  const filepath = path.join(BACKEND_LOGS_DIR, safeFilename);

  try {
    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      res.status(404).json({
        error: 'Log file not found',
        filename: safeFilename
      });
      return;
    }

    // Validate it's a .log file
    if (!safeFilename.endsWith('.log')) {
      res.status(400).json({
        error: 'Invalid file type',
        message: 'Only .log files are allowed'
      });
      return;
    }

    // Parse query parameters
    const filterLevel = level && typeof level === 'string' ? level.toLowerCase() : null;
    const searchQuery = search && typeof search === 'string' ? search.toLowerCase() : null;
    const limitNum = limit ? parseInt(limit as string, 10) : 1000;
    const offsetNum = offset ? parseInt(offset as string, 10) : 0;

    // Validate limit
    const maxLimit = 10000;
    const actualLimit = Math.min(Math.max(1, limitNum), maxLimit);
    const actualOffset = Math.max(0, offsetNum);

    // Read and parse log file
    const logEntries: LogEntry[] = [];
    const fileStream = createReadStream(filepath, { encoding: 'utf8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        // Parse JSON log entry
        const entry = JSON.parse(line) as LogEntry;
        
        // Apply level filter
        if (filterLevel && entry.level?.toLowerCase() !== filterLevel) {
          continue;
        }

        // Apply search filter
        if (searchQuery) {
          const messageMatch = entry.message?.toLowerCase().includes(searchQuery);
          const serviceMatch = entry.service?.toLowerCase().includes(searchQuery);
          const stringified = JSON.stringify(entry).toLowerCase();
          const fullMatch = stringified.includes(searchQuery);
          
          if (!messageMatch && !serviceMatch && !fullMatch) {
            continue;
          }
        }

        logEntries.push(entry);
      } catch (error) {
        // Skip invalid JSON lines (might be partial logs or errors)
        continue;
      }
    }

    // Apply pagination
    const totalEntries = logEntries.length;
    const paginatedEntries = logEntries.slice(actualOffset, actualOffset + actualLimit);

    // Sort by timestamp (newest first by default)
    paginatedEntries.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });

    res.json({
      success: true,
      filename: safeFilename,
      entries: paginatedEntries,
      pagination: {
        total: totalEntries,
        limit: actualLimit,
        offset: actualOffset,
        hasMore: actualOffset + actualLimit < totalEntries
      },
      filters: {
        level: filterLevel || 'all',
        search: searchQuery || null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to stream backend logs', { error, filename: safeFilename });
    res.status(500).json({
      error: 'Failed to stream logs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get log file statistics
router.get('/stats/:filename', async (req: Request, res: Response) => {
  const { filename } = req.params;

  // Security: prevent directory traversal
  const safeFilename = path.basename(filename);
  const filepath = path.join(BACKEND_LOGS_DIR, safeFilename);

  try {
    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      res.status(404).json({
        error: 'Log file not found',
        filename: safeFilename
      });
      return;
    }

    const stats = await fs.stat(filepath);
    const levelCounts: Record<string, number> = {};
    let totalLines = 0;

    // Count log levels
    const fileStream = createReadStream(filepath, { encoding: 'utf8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      totalLines++;

      try {
        const entry = JSON.parse(line) as LogEntry;
        const level = entry.level || 'unknown';
        levelCounts[level] = (levelCounts[level] || 0) + 1;
      } catch {
        // Count as invalid/unknown
        levelCounts['invalid'] = (levelCounts['invalid'] || 0) + 1;
      }
    }

    res.json({
      success: true,
      filename: safeFilename,
      stats: {
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        totalLines,
        levelCounts
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get log file stats', { error, filename: safeFilename });
    res.status(500).json({
      error: 'Failed to get log file stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

