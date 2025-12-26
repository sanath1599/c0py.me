import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import routes from './routes';
import { SocketService } from './socketService';
import redisService from './redis';
import { getEnvironmentConfig } from '../../../packages/config/env';
import logger from './logger';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

const config = getEnvironmentConfig();
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 4001;

// CORS middleware allowing all origins
app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ShareDrop API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Initialize Socket.IO service
const socketService = new SocketService(server);

// Start Redis Docker container if not running
async function ensureRedisRunning(): Promise<void> {
  try {
    logger.debug('Checking if Redis container is running...');
    
    // Check if Redis container exists and is running
    const { stdout } = await execAsync('docker ps --filter "name=sharedrop-redis" --format "{{.Names}}"');
    
    if (stdout.trim() === 'sharedrop-redis') {
      logger.info('Redis container is already running');
      return;
    }
    
    // Check if container exists but is stopped
    const { stdout: stoppedContainers } = await execAsync('docker ps -a --filter "name=sharedrop-redis" --format "{{.Names}}"');
    
    if (stoppedContainers.trim() === 'sharedrop-redis') {
      logger.info('Starting existing Redis container...');
      await execAsync('docker start sharedrop-redis');
      logger.info('Redis container started');
      return;
    }
    
    // Create and start new Redis container
    logger.info('Creating and starting Redis container...');
    await execAsync(`
      docker run -d \
        --name sharedrop-redis \
        -p 6379:6379 \
        redis:7-alpine \
        redis-server --appendonly yes
    `);
    logger.info('Redis container created and started');
    
  } catch (error) {
    logger.error('Error managing Redis container', { error });
    logger.warn('Continuing without Redis container management...');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server (SIGINT)...');
  
  try {
    await socketService.cleanup();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  
  try {
    await socketService.cleanup();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
});

// Start server
async function startServer(): Promise<void> {
  try {
    // Ensure Redis is running
    await ensureRedisRunning();
    
    // Wait a moment for Redis to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start scheduled cleanup for expired requests
    redisService.startScheduledCleanup();
    logger.info('Scheduled cleanup started (every 15 minutes)');
    
    // Start the server
    server.listen(PORT, () => {
      logger.info(`ShareDrop API Server running on port ${PORT}`);
      logger.info(`WebSocket server ready for connections`);
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
      logger.info(`API base: http://localhost:${PORT}/api`);
    });
    
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
startServer(); 