# c0py.me Deployment Guide

This guide covers deploying the c0py.me application to production servers with separate domains for frontend and backend.

## 🚀 Quick Start

### Option 1: Remote Deployment (Recommended)
Run from your local machine to deploy to the server:

```bash
./deploy-remote.sh YOUR_SERVER_IP
```

### Option 2: Direct Server Deployment
SSH into your server and run:

```bash
# First time setup
./deploy-c0py-me.sh

# Subsequent updates
./deploy-update.sh
```

## 📋 Prerequisites

- Ubuntu/Debian server (18.04+)
- SSH access with public key authentication
- Domain names pointing to your server:
  - `c0py.me` → Frontend
  - `backend.c0py.me` → Backend API
- Ports 80, 443, and 4001 available

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   c0py.me      │    │  backend.c0py.me │    │   Redis        │
│   (Frontend)   │◄──►│   (Backend API)  │◄──►│   (Docker)     │
│   Port: 80/443 │    │   Port: 80/443   │    │   Port: 6379   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
   ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
   │   Nginx     │       │   PM2       │       │   Docker    │
   │  (Port 80)  │       │ (Port 4001) │       │  Container  │
   └─────────────┘       └─────────────┘       └─────────────┘
```

## 📁 Directory Structure

```
/opt/c0py-me/                    # Source code repository
├── apps/
│   ├── web/                     # Frontend React app
│   └── api/                     # Backend Express API
└── packages/                     # Shared packages

/opt/c0py-me-backend/            # Production backend
├── dist/                        # Compiled backend
├── logs/                        # PM2 logs
├── ecosystem.config.js          # PM2 configuration
└── .env                         # Environment variables

/var/www/c0py.me/                # Frontend static files
└── [built React files]

/etc/nginx/sites-available/      # Nginx configurations
├── c0py.me                     # Frontend config
└── backend.c0py.me             # Backend config
```

## 🔧 What Gets Installed

### System Packages
- **Node.js 22.x** (LTS) with npm
- **nginx** (web server and reverse proxy)
- **Docker** (for Redis container)
- **PM2** (process manager for Node.js)

### Services
- **Redis** (Docker container, port 6379)
- **Nginx** (ports 80/443)
- **PM2** (manages backend on port 4001)

### Environment Files
- Backend `.env` with production settings
- Frontend `.env` with API endpoints

## 🌐 Domain Configuration

### Frontend (c0py.me)
- Serves static React files
- Handles client-side routing
- Caches static assets
- Configured for SPA (Single Page Application)

### Backend (backend.c0py.me)
- Reverse proxy to localhost:4001
- Handles WebSocket upgrades
- Forwards all API requests
- Load balanced with PM2 cluster mode

## 📊 Monitoring & Logs

### PM2 (Backend)
```bash
# View status
pm2 status

# View logs
pm2 logs c0py-me-backend

# Monitor in real-time
pm2 monit
```

### Nginx
```bash
# Check status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t
```

### Docker (Redis)
```bash
# View container status
docker ps

# View logs
docker logs c0py-me-redis

# Access Redis CLI
docker exec -it c0py-me-redis redis-cli
```

## 🔄 Update Process

### Automatic Updates
The deployment scripts automatically:
1. Pull latest code from GitHub
2. Install new dependencies
3. Build frontend and backend
4. Deploy to production directories
5. Restart services
6. Reload nginx configuration

### Manual Updates
```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Run update script
/usr/local/bin/deploy-update.sh
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using port 4001
sudo lsof -i :4001

# Kill process if needed
sudo kill -9 PID
```

#### 2. Nginx Configuration Error
```bash
# Test configuration
sudo nginx -t

# Reload if valid
sudo systemctl reload nginx
```

#### 3. PM2 Process Not Starting
```bash
# Check logs
pm2 logs c0py-me-backend

# Restart process
pm2 restart c0py-me-backend
```

#### 4. Redis Connection Issues
```bash
# Check container status
docker ps | grep redis

# Restart container
docker restart c0py-me-redis
```

### Health Checks

#### Backend Health
```bash
curl http://backend.c0py.me/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-31T02:36:36.180Z",
  "redis": "connected",
  "uptime": 16.209210834
}
```

#### Frontend
```bash
curl -I http://c0py.me
```

Expected response: `HTTP/1.1 200 OK`

## 🔐 SSL/HTTPS Setup

To enable HTTPS, uncomment the SSL setup in `deploy-c0py-me.sh`:

```bash
# In the main() function, uncomment:
# setup_ssl
```

This will:
1. Install certbot
2. Obtain Let's Encrypt certificates
3. Configure nginx for HTTPS
4. Set up automatic renewal

## 📈 Performance Optimization

### Nginx Caching
- Static assets cached for 1 year
- API responses not cached (dynamic content)
- Gzip compression enabled

### PM2 Clustering
- Backend runs in cluster mode
- Utilizes all CPU cores
- Automatic restart on crashes
- Load balancing across instances

### Redis Persistence
- AOF (Append Only File) enabled
- Data persists across container restarts
- Automatic backup on container recreation

## 🛡️ Security Considerations

- Firewall should allow only ports 80, 443, and 22
- SSH key authentication only (no password)
- Regular security updates via `apt-get update && apt-get upgrade`
- PM2 runs with limited user permissions
- Nginx configured with security headers

## 📝 Environment Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=4001
MONGODB_URI=mongodb://localhost:27017/c0py-me
CLIENT_URL=https://c0py.me
CORS_ORIGIN=https://c0py.me,https://backend.c0py.me
```

### Frontend (.env)
```env
VITE_API_URL=https://backend.c0py.me
VITE_WS_URL=wss://backend.c0py.me
```

## 🔄 Rollback Process

If deployment fails, you can rollback:

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Stop current processes
pm2 stop c0py-me-backend
sudo systemctl stop nginx

# Restore from backup (if available)
# Or manually restart previous version

# Restart services
pm2 start c0py-me-backend
sudo systemctl start nginx
```

## 📞 Support

For deployment issues:
1. Check logs: `pm2 logs` and `sudo journalctl -u nginx`
2. Verify configuration: `sudo nginx -t`
3. Check service status: `sudo systemctl status nginx`
4. Review this documentation

## 📚 Additional Resources

- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [Docker Redis](https://hub.docker.com/_/redis)
- [Let's Encrypt](https://letsencrypt.org/docs/)
