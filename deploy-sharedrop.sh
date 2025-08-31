#!/bin/bash

# ShareDrop Deployment Script with Redis (Docker) & Nginx Setup
# Usage: ./deploy-sharedrop.sh

REPO_URL="https://github.com/sanath1599/c0py.me"
APP_DIR="/opt/c0py.me"
FRONTEND_DIR="$APP_DIR/apps/web"
FRONTEND_DEPLOY_DIR="/var/www/c0py.me"
BACKEND_DIR="$APP_DIR/apps/api"
BACKEND_PORT=3001
DOMAIN="c0py.me"
REDIS_CONTAINER_NAME="sharedrop-redis"
REDIS_PORT=6379

set -e

function log() { echo -e "\033[1;32m[INFO]\033[0m $1"; }
function warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
function err() { echo -e "\033[1;31m[ERROR]\033[0m $1"; }

# --- Redis Setup (Docker) ---
log "Checking for Redis Docker container..."
if ! command -v docker >/dev/null 2>&1; then
    err "Docker is not installed. Please install Docker and rerun this script."
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^$REDIS_CONTAINER_NAME\$"; then
    if docker ps -a --format '{{.Names}}' | grep -q "^$REDIS_CONTAINER_NAME\$"; then
        log "Redis container exists but is not running. Starting container..."
        docker start $REDIS_CONTAINER_NAME
    else
        log "Redis container not found. Creating and starting Redis container..."
        docker run -d --name $REDIS_CONTAINER_NAME -p $REDIS_PORT:6379 redis:7-alpine redis-server --appendonly yes
    fi
else
    log "Redis Docker container '$REDIS_CONTAINER_NAME' is already running."
fi

# --- Nginx Setup ---
log "Checking for Nginx installation..."
if ! command -v nginx >/dev/null 2>&1; then
    log "Nginx not found. Installing Nginx..."
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y nginx
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y epel-release
        sudo yum install -y nginx
    else
        err "Unsupported OS for automatic Nginx installation. Please install Nginx manually."
        exit 1
    fi
    sudo systemctl enable nginx
    sudo systemctl start nginx
else
    log "Nginx is already installed."
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi

# --- Nginx Configuration ---
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
NGINX_LINK="/etc/nginx/sites-enabled/$DOMAIN"
if [ ! -f "$NGINX_CONF" ]; then
    log "Creating Nginx config for $DOMAIN..."
    sudo bash -c "cat > $NGINX_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    root $FRONTEND_DEPLOY_DIR;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:$BACKEND_PORT/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:$BACKEND_PORT/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    client_max_body_size 100M;
}
EOF
    sudo ln -sf "$NGINX_CONF" "$NGINX_LINK"
    if [ -f /etc/nginx/sites-enabled/default ]; then
        sudo rm /etc/nginx/sites-enabled/default
    fi
    sudo nginx -t && sudo systemctl reload nginx
    log "Nginx configuration for $DOMAIN created and reloaded."
else
    log "Nginx config for $DOMAIN already exists."
    sudo nginx -t && sudo systemctl reload nginx
fi

# --- Application Deployment ---
log "Pulling latest code..."
cd "$APP_DIR"
git pull

log "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
pnpm install

log "Building frontend..."
pnpm build

log "Deploying frontend..."
sudo mkdir -p "$FRONTEND_DEPLOY_DIR"
sudo rm -rf "$FRONTEND_DEPLOY_DIR"/*
sudo cp -r dist/* "$FRONTEND_DEPLOY_DIR/"

# --- Backend PM2 Management ---
cd "$BACKEND_DIR"
if ! pm2 list | grep -q "sharedrop-api"; then
    log "sharedrop-api is not running. Starting backend with pm2..."
    pm2 start src/server.ts --name "sharedrop-api" -- start
else
    log "Restarting backend API server with pm2..."
    pm2 restart sharedrop-api
fi

log "Deployment complete!"