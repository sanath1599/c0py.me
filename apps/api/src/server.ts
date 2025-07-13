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

const execAsync = promisify(exec);

// Load environment variables
dotenv.config();

const config = getEnvironmentConfig();
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 4001;
const allowedOrigins = config.CORS_ORIGIN.split(',').map((o: string) => o.trim());

// Robust CORS middleware for all API endpoints (including /api/logs)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow non-browser requests
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    console.log('🔍 Checking if Redis container is running...');
    
    // Check if Redis container exists and is running
    const { stdout } = await execAsync('docker ps --filter "name=sharedrop-redis" --format "{{.Names}}"');
    
    if (stdout.trim() === 'sharedrop-redis') {
      console.log('✅ Redis container is already running');
      return;
    }
    
    // Check if container exists but is stopped
    const { stdout: stoppedContainers } = await execAsync('docker ps -a --filter "name=sharedrop-redis" --format "{{.Names}}"');
    
    if (stoppedContainers.trim() === 'sharedrop-redis') {
      console.log('🔄 Starting existing Redis container...');
      await execAsync('docker start sharedrop-redis');
      console.log('✅ Redis container started');
      return;
    }
    
    // Create and start new Redis container
    console.log('🐳 Creating and starting Redis container...');
    await execAsync(`
      docker run -d \
        --name sharedrop-redis \
        -p 6379:6379 \
        redis:7-alpine \
        redis-server --appendonly yes
    `);
    console.log('✅ Redis container created and started');
    
  } catch (error) {
    console.error('❌ Error managing Redis container:', error);
    console.log('⚠️ Continuing without Redis container management...');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  
  try {
    await socketService.cleanup();
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  
  try {
    await socketService.cleanup();
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
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
    console.log('🧹 Scheduled cleanup started (every 15 minutes)');
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`🚀 ShareDrop API Server running on port ${PORT}`);
      console.log(`📡 WebSocket server ready for connections`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🌐 API base: http://localhost:${PORT}/api`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 