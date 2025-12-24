import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure backendLogs directory exists
const LOGS_DIR = path.join(process.cwd(), 'backendLogs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports for each log level with weekly rotation
const createLevelTransport = (level: string): DailyRotateFile => {
  return new DailyRotateFile({
    filename: path.join(LOGS_DIR, `${level}-%DATE%.log`),
    datePattern: 'YYYY-[W]ww', // Weekly rotation: YYYY-[W]ww (e.g., 2024-W01)
    maxSize: '20m',
    maxFiles: '4w', // Keep 4 weeks of logs (28 days)
    level: level,
    format: fileFormat,
    zippedArchive: true, // Compress old logs
    frequency: 'weekly', // Rotate weekly
  });
};

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'sharedrop-api' },
  transports: [
    // Console transport (all levels)
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // File transports for each level with weekly rotation
    createLevelTransport('error'),
    createLevelTransport('warn'),
    createLevelTransport('info'),
    createLevelTransport('debug'),
  ],
  // Handle exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-[W]ww',
      maxSize: '20m',
      maxFiles: '4w',
      format: fileFormat,
      zippedArchive: true,
      frequency: 'weekly',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-[W]ww',
      maxSize: '20m',
      maxFiles: '4w',
      format: fileFormat,
      zippedArchive: true,
      frequency: 'weekly',
    }),
  ],
});

export default logger;

