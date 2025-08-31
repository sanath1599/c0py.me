#!/bin/bash

# Remote Deployment Script for c0py.me
# Run this from your local machine to deploy to the server
# Usage: ./deploy-remote.sh [server_ip]

set -e

# Configuration
SERVER_IP="${1:-your-server-ip}"  # Pass server IP as argument or set default
SERVER_USER="root"  # Change if you use a different user
REPO_URL="https://github.com/sanath1599/c0py.me.git"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

function log() { echo -e "${GREEN}[INFO]${NC} $1"; }
function step() { echo -e "${BLUE}[STEP]${NC} $1"; }
function err() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if server IP is provided
if [ "$SERVER_IP" = "your-server-ip" ]; then
    err "Please provide server IP as argument: ./deploy-remote.sh YOUR_SERVER_IP"
    exit 1
fi

log "Starting remote deployment to $SERVER_IP..."

# Test SSH connection
step "Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$SERVER_USER@$SERVER_IP" exit 2>/dev/null; then
    err "Cannot connect to server. Please check:"
    err "1. Server IP is correct: $SERVER_IP"
    err "2. SSH key is properly configured"
    err "3. Server is accessible"
    exit 1
fi
log "SSH connection successful"

# Upload deployment scripts
step "Uploading deployment scripts..."
scp deploy-c0py-me.sh "$SERVER_USER@$SERVER_IP:/tmp/"
scp deploy-update.sh "$SERVER_USER@$SERVER_IP:/tmp/"
log "Scripts uploaded"

# Make scripts executable and run deployment
step "Running deployment on server..."
ssh "$SERVER_USER@$SERVER_IP" << 'EOF'
    set -e
    
    # Move scripts to proper location
    sudo mv /tmp/deploy-c0py-me.sh /usr/local/bin/
    sudo mv /tmp/deploy-update.sh /usr/local/bin/
    sudo chmod +x /usr/local/bin/deploy-c0py-me.sh
    sudo chmod +x /usr/local/bin/deploy-update.sh
    
    # Check if this is first deployment or update
    if [ -d "/opt/c0py-me" ]; then
        log "Existing deployment found, running update..."
        /usr/local/bin/deploy-update.sh
    else
        log "First deployment, running full setup..."
        /usr/local/bin/deploy-c0py-me.sh
    fi
EOF

log "Deployment completed successfully!"
log "Your application should now be available at:"
log "- Frontend: http://c0py.me"
log "- Backend: http://backend.c0py.me"
log "- Backend Health: http://backend.c0py.me/api/health"

# Optional: Show server status
read -p "Would you like to check server status? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    step "Checking server status..."
    ssh "$SERVER_USER@$SERVER_IP" << 'EOF'
        echo "=== PM2 Status ==="
        pm2 status
        echo ""
        echo "=== Docker Status ==="
        docker ps
        echo ""
        echo "=== Nginx Status ==="
        sudo systemctl status nginx --no-pager -l
EOF
fi
