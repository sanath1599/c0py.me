#!/bin/bash

# Simple ShareDrop Deployment Script
# Usage: ./deploy-sharedrop-simple.sh

REPO_URL="https://github.com/sanath1599/sharedrop"
APP_DIR="/opt/sharedrop"
FRONTEND_DIR="$APP_DIR/apps/web"
FRONTEND_DEPLOY_DIR="/var/www/c0py.me"
BACKEND_DIR="$APP_DIR/apps/api"
BACKEND_PORT=3001

set -e

function log() { echo -e "\033[1;32m[INFO]\033[0m $1"; }
function err() { echo -e "\033[1;31m[ERROR]\033[0m $1"; }

log "Pulling latest code..."
cd "$APP_DIR"
git pull

log "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

log "Creating frontend .env file..."
echo "CLIENT_URL=https://backend.c0py.me" > .env

log "Building frontend..."
npm run build

log "Deploying frontend..."
sudo mkdir -p "$FRONTEND_DEPLOY_DIR"
sudo rm -rf "$FRONTEND_DEPLOY_DIR"/*
sudo cp -r dist/* "$FRONTEND_DEPLOY_DIR/"

log "Restarting backend API server..."
cd "$BACKEND_DIR"
npm install
docker ps --filter \"name=sharedrop-redis\" --format \"{{.Names}}\" | grep sharedrop-redis || (docker ps -a --filter \"name=sharedrop-redis\" --format \"{{.Names}}\" | grep sharedrop-redis && docker start sharedrop-redis) || docker run -d --name sharedrop-redis -p 6379:6379 redis:7-alpine redis-server --appendonly yes
pm2 restart sharedrop-api
#pm2 start src/server.ts --name "sharedrop-api" -- start


log "Deployment complete!"
