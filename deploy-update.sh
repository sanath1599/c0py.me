#!/bin/bash

# Quick Update Script for c0py.me
# Usage: ./deploy-update.sh
# This script updates an existing deployment

set -e

# Configuration
FRONTEND_DOMAIN="c0py.me"
BACKEND_DOMAIN="backend.c0py.me"
FRONTEND_DIR="/var/www/$FRONTEND_DOMAIN"
BACKEND_DIR="/opt/c0py-me-backend"
APP_DIR="/opt/c0py-me"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function log() { echo -e "${GREEN}[INFO]${NC} $1"; }
function step() { echo -e "${BLUE}[STEP]${NC} $1"; }

log "Starting quick update deployment..."

# Update repository
step "Updating repository..."
cd "$APP_DIR"
git fetch origin
git reset --hard origin/main
log "Repository updated"

# Update backend
step "Updating backend..."
cd "$BACKEND_DIR"
cp -r "$APP_DIR/apps/api"/* ./
cp -r "$APP_DIR/packages" ./
npm install
npm run build
log "Backend updated"

# Update frontend
step "Updating frontend..."
cd "$APP_DIR/apps/web"
npm install
npm run build
log "Frontend updated"

# Deploy frontend
step "Deploying frontend..."
sudo rm -rf "$FRONTEND_DIR"/*
sudo cp -r dist/* "$FRONTEND_DIR/"
sudo chown -R www-data:www-data "$FRONTEND_DIR"
log "Frontend deployed"

# Restart backend
step "Restarting backend..."
pm2 restart c0py-me-backend
log "Backend restarted"

# Reload nginx
step "Reloading nginx..."
sudo systemctl reload nginx
log "nginx reloaded"

log "Update completed successfully!"
log "Frontend: http://$FRONTEND_DOMAIN"
log "Backend: http://$BACKEND_DOMAIN"

# Show status
echo ""
log "Current status:"
pm2 status
docker ps | grep redis
