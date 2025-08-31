#!/bin/bash

# Comprehensive c0py.me Deployment Script
# Deploys frontend to c0py.me and backend to backend.c0py.me
# Usage: ./deploy-c0py-me.sh

set -e

# Configuration
REPO_URL="https://github.com/sanath1599/c0py.me.git"
FRONTEND_DOMAIN="c0py.me"
BACKEND_DOMAIN="backend.c0py.me"
FRONTEND_DIR="/var/www/$FRONTEND_DOMAIN"
BACKEND_DIR="/opt/c0py-me-backend"
APP_DIR="/opt/c0py-me"
REDIS_CONTAINER_NAME="c0py-me-redis"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function log() { echo -e "${GREEN}[INFO]${NC} $1"; }
function warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
function err() { echo -e "${RED}[ERROR]${NC} $1"; }
function step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Node.js
install_nodejs() {
    if ! command_exists node; then
        step "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
        log "Node.js installed: $(node --version)"
        log "npm installed: $(npm --version)"
    else
        log "Node.js already installed: $(node --version)"
    fi
}

# Function to install nginx
install_nginx() {
    if ! command_exists nginx; then
        step "Installing nginx..."
        sudo apt-get update
        sudo apt-get install -y nginx
        sudo systemctl enable nginx
        sudo systemctl start nginx
        log "nginx installed and started"
    else
        log "nginx already installed"
    fi
}

# Function to install Docker
install_docker() {
    if ! command_exists docker; then
        step "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        sudo systemctl enable docker
        sudo systemctl start docker
        rm get-docker.sh
        log "Docker installed and started"
    else
        log "Docker already installed: $(docker --version)"
    fi
}

# Function to setup Redis
setup_redis() {
    step "Setting up Redis container..."
    
    # Stop and remove existing container if it exists
    if docker ps -a --format "{{.Names}}" | grep -q "^$REDIS_CONTAINER_NAME$"; then
        log "Removing existing Redis container..."
        docker stop $REDIS_CONTAINER_NAME || true
        docker rm $REDIS_CONTAINER_NAME || true
    fi
    
    # Start new Redis container
    docker run -d \
        --name $REDIS_CONTAINER_NAME \
        --restart unless-stopped \
        -p 6379:6379 \
        redis:7-alpine \
        redis-server --appendonly yes
    
    log "Redis container started: $REDIS_CONTAINER_NAME"
}

# Function to clone or update repository
setup_repository() {
    if [ -d "$APP_DIR" ]; then
        step "Updating existing repository..."
        cd "$APP_DIR"
        git fetch origin
        git reset --hard origin/main
        log "Repository updated"
    else
        step "Cloning repository..."
        sudo mkdir -p "$(dirname $APP_DIR)"
        sudo git clone "$REPO_URL" "$APP_DIR"
        sudo chown -R $USER:$USER "$APP_DIR"
        log "Repository cloned to $APP_DIR"
    fi
}

# Function to setup backend
setup_backend() {
    step "Setting up backend..."
    
    # Create backend directory
    sudo mkdir -p "$BACKEND_DIR"
    sudo chown -R $USER:$USER "$BACKEND_DIR"
    
    # Copy backend files
    cp -r "$APP_DIR/apps/api"/* "$BACKEND_DIR/"
    cp -r "$APP_DIR/packages" "$BACKEND_DIR/"
    
    # Install dependencies
    cd "$BACKEND_DIR"
    npm install
    
    # Create .env file
    cat > .env << EOF
NODE_ENV=production
PORT=4001
MONGODB_URI=mongodb://localhost:27017/c0py-me
CLIENT_URL=https://$FRONTEND_DOMAIN
CORS_ORIGIN=https://$FRONTEND_DOMAIN,https://$BACKEND_DOMAIN
EOF
    
    # Build backend
    npm run build
    
    log "Backend setup complete"
}

# Function to setup frontend
setup_frontend() {
    step "Setting up frontend..."
    
    cd "$APP_DIR/apps/web"
    
    # Install dependencies
    npm install
    
    # Create .env file for frontend
    cat > .env << EOF
VITE_API_URL=https://$BACKEND_DOMAIN
VITE_WS_URL=wss://$BACKEND_DOMAIN
EOF
    
    # Build frontend
    npm run build
    
    # Deploy to nginx directory
    sudo mkdir -p "$FRONTEND_DIR"
    sudo rm -rf "$FRONTEND_DIR"/*
    sudo cp -r dist/* "$FRONTEND_DIR/"
    sudo chown -R www-data:www-data "$FRONTEND_DIR"
    
    log "Frontend setup complete"
}

# Function to setup nginx configuration
setup_nginx() {
    step "Setting up nginx configuration..."
    
    # Frontend configuration
    sudo tee /etc/nginx/sites-available/$FRONTEND_DOMAIN > /dev/null << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $FRONTEND_DOMAIN www.$FRONTEND_DOMAIN;
    
    root $FRONTEND_DIR;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Backend configuration
    sudo tee /etc/nginx/sites-available/$BACKEND_DOMAIN > /dev/null << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $BACKEND_DOMAIN;
    
    location / {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    # Enable sites
    sudo ln -sf /etc/nginx/sites-available/$FRONTEND_DOMAIN /etc/nginx/sites-enabled/
    sudo ln -sf /etc/nginx/sites-available/$BACKEND_DOMAIN /etc/nginx/sites-enabled/
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    sudo nginx -t
    
    # Reload nginx
    sudo systemctl reload nginx
    
    log "nginx configuration complete"
}

# Function to setup PM2 for backend
setup_pm2() {
    step "Setting up PM2 for backend..."
    
    if ! command_exists pm2; then
        log "Installing PM2..."
        sudo npm install -g pm2
    fi
    
    # Create PM2 ecosystem file
    cat > "$BACKEND_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'c0py-me-backend',
    script: 'dist/server.js',
    cwd: '$BACKEND_DIR',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
    
    # Create logs directory
    mkdir -p "$BACKEND_DIR/logs"
    
    # Start or restart the application
    cd "$BACKEND_DIR"
    pm2 delete c0py-me-backend 2>/dev/null || true
    pm2 start ecosystem.config.js
    pm2 save
    pm2 startup
    
    log "PM2 setup complete"
}

# Function to setup SSL with Let's Encrypt
setup_ssl() {
    step "Setting up SSL certificates..."
    
    if ! command_exists certbot; then
        log "Installing certbot..."
        sudo apt-get install -y certbot python3-certbot-nginx
    fi
    
    # Get SSL certificates
    sudo certbot --nginx -d $FRONTEND_DOMAIN -d www.$FRONTEND_DOMAIN --non-interactive --agree-tos --email admin@$FRONTEND_DOMAIN
    sudo certbot --nginx -d $BACKEND_DOMAIN --non-interactive --agree-tos --email admin@$FRONTEND_DOMAIN
    
    log "SSL certificates obtained"
}

# Main deployment function
main() {
    log "Starting c0py.me deployment..."
    
    # Update system packages
    step "Updating system packages..."
    sudo apt-get update
    
    # Install required packages
    install_nodejs
    install_nginx
    install_docker
    
    # Setup Redis
    setup_redis
    
    # Setup repository
    setup_repository
    
    # Setup backend and frontend
    setup_backend
    setup_frontend
    
    # Setup nginx
    setup_nginx
    
    # Setup PM2
    setup_pm2
    
    # Setup SSL (optional - uncomment if you want SSL)
    # setup_ssl
    
    log "Deployment completed successfully!"
    log "Frontend: http://$FRONTEND_DOMAIN"
    log "Backend: http://$BACKEND_DOMAIN"
    log "Backend API: http://$BACKEND_DOMAIN/api/health"
    
    # Show status
    echo ""
    log "Current status:"
    pm2 status
    docker ps | grep redis
    sudo systemctl status nginx --no-pager -l
}

# Run main function
main "$@"
