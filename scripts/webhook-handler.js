#!/usr/bin/env node

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');

// Configuration
const PORT = process.env.WEBHOOK_PORT || 3002;
const SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-here';
const DEPLOY_SCRIPT = '/root/sharedrop.sh';
const LOG_FILE = '/var/log/sharedrop-webhook.log';

// Logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage);
  
  // Write to log file
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Verify GitHub webhook signature
function verifySignature(payload, signature) {
  if (!signature) {
    log('WARNING: No signature provided');
    return false;
  }
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', SECRET)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Execute deployment script as root
function executeDeployment() {
  log('🚀 Starting deployment...');
  
  exec(`sudo ${DEPLOY_SCRIPT}`, (error, stdout, stderr) => {
    if (error) {
      log(`❌ Deployment failed: ${error.message}`);
      return;
    }
    
    if (stderr) {
      log(`⚠️ Deployment warnings: ${stderr}`);
    }
    
    log(`✅ Deployment completed successfully`);
    log(`📋 Output: ${stdout}`);
  });
}

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return;
  }
  
  if (req.url !== '/webhook/deploy') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const signature = req.headers['x-hub-signature-256'];
      
      log(`📥 Received webhook from ${req.headers['user-agent']}`);
      log(`🔗 Repository: ${payload.repository?.full_name}`);
      log(`🌿 Branch: ${payload.ref}`);
      log(`👤 Author: ${payload.head_commit?.author?.name}`);
      
      // Verify signature
      if (!verifySignature(body, signature)) {
        log('❌ Invalid signature');
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized');
        return;
      }
      
      // Check if it's a push to main branch
      if (payload.ref === 'refs/heads/main') {
        log('✅ Valid push to main branch, triggering deployment');
        executeDeployment();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'success', 
          message: 'Deployment triggered' 
        }));
      } else {
        log(`⏭️ Skipping deployment for branch: ${payload.ref}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'skipped', 
          message: 'Not main branch' 
        }));
      }
      
    } catch (error) {
      log(`❌ Error processing webhook: ${error.message}`);
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Bad request');
    }
  });
});

// Error handling
server.on('error', (error) => {
  log(`❌ Server error: ${error.message}`);
});

// Start server
server.listen(PORT, () => {
  log(`🚀 Webhook server started on port ${PORT}`);
  log(`📝 Log file: ${LOG_FILE}`);
  log(`🔧 Deploy script: ${DEPLOY_SCRIPT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('🛑 Shutting down webhook server...');
  server.close(() => {
    log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log('🛑 Received SIGTERM, shutting down...');
  server.close(() => {
    log('✅ Server closed');
    process.exit(0);
  });
}); 