#!/bin/bash

# ShareDrop Deployment Script
# Usage: ./deploy-sharedrop.sh setup|update

REPO_URL="https://github.com/sanath1599/sharedrop"
APP_DIR="/opt/sharedrop"
BACKEND_DIR="$APP_DIR/apps/api"
FRONTEND_DIR="$APP_DIR/apps/web"
DOMAIN="c0py.me"
BACKEND_DOMAIN="backend.c0py.me"
DOCKER_COMPOSE_FILE="$BACKEND_DIR/docker-compose.yml"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

function log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

function log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

function setup_env_file() {
    local env_file="$BACKEND_DIR/.env.prod"
    local env_example="$BACKEND_DIR/.env.prod.example"
    
    if [ ! -f "$env_file" ]; then
        log_info "Creating production environment file..."
        if [ -f "$env_example" ]; then
            cp "$env_example" "$env_file"
            log_info "Generated .env.prod from example. Please review and update secrets if needed."
        else
            log_error "Environment example file not found at $env_example"
            exit 1
        fi
    else
        log_info "Production environment file already exists."
    fi
}

function install_dependencies() {
    log_info "Installing system dependencies..."
    
    # Update package list
    sudo apt update
    
    # Install required packages
    sudo apt install -y git docker.io docker-compose nodejs npm curl
    
    # Install pnpm globally
    if ! command -v pnpm &> /dev/null; then
        log_info "Installing pnpm..."
        sudo npm install -g pnpm
    fi
    
    # Start and enable Docker service
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add current user to docker group if not already
    if ! groups $USER | grep -q docker; then
        sudo usermod -aG docker $USER
        log_warn "Added user to docker group. You may need to log out and back in."
    fi
}

function setup() {
    log_info "=== Initial ShareDrop Setup ==="
    
    # Install system dependencies
    install_dependencies
    
    # Create app directory and clone repo
    if [ ! -d "$APP_DIR" ]; then
        log_info "Cloning repository..."
        sudo git clone "$REPO_URL" "$APP_DIR"
        sudo chown -R $USER:$USER "$APP_DIR"
    else
        log_warn "App directory already exists. Skipping clone."
    fi
    
    # Setup environment file
    setup_env_file
    
    # Build frontend
    log_info "Building frontend..."
    cd "$FRONTEND_DIR"
    pnpm install
    pnpm build
    
    # Setup backend Docker Compose
    log_info "Setting up backend with Docker Compose..."
    cd "$BACKEND_DIR"
    docker-compose up -d --build
    
    # Reload Nginx to pick up new static files
    log_info "Reloading Nginx..."
    sudo systemctl reload nginx
    
    log_info "=== Setup Complete ==="
    log_info "Frontend: https://$DOMAIN"
    log_info "Backend: https://$BACKEND_DOMAIN"
    log_info "Check logs with: docker-compose logs -f (in $BACKEND_DIR)"
}

function update() {
    log_info "=== Updating ShareDrop Deployment ==="
    
    # Check if app directory exists
    if [ ! -d "$APP_DIR" ]; then
        log_error "App directory not found. Run setup first."
        exit 1
    fi
    
    # Pull latest changes
    log_info "Pulling latest changes from repository..."
    cd "$APP_DIR"
    git pull
    
    # Setup environment file (in case it was deleted)
    setup_env_file
    
    # Rebuild frontend
    log_info "Rebuilding frontend..."
    cd "$FRONTEND_DIR"
    pnpm install
    pnpm build
    
    # Rebuild/restart backend
    log_info "Rebuilding and restarting backend..."
    cd "$BACKEND_DIR"
    docker-compose pull
    docker-compose up -d --build
    
    # Reload Nginx to pick up new frontend build
    log_info "Reloading Nginx..."
    sudo systemctl reload nginx
    
    log_info "=== Update Complete ==="
}

function check_status() {
    log_info "=== Checking Deployment Status ==="
    
    # Check if containers are running
    if [ -d "$BACKEND_DIR" ]; then
        cd "$BACKEND_DIR"
        log_info "Backend containers status:"
        docker-compose ps
    fi
    
    # Check Nginx status
    log_info "Nginx status:"
    sudo systemctl status nginx --no-pager -l
    
    # Check if frontend build exists
    if [ -d "$FRONTEND_DIR/dist" ] || [ -d "$FRONTEND_DIR/build" ]; then
        log_info "Frontend build directory exists"
    else
        log_warn "Frontend build directory not found"
    fi
}

# Main script logic
case "$1" in
    setup)
        setup
        ;;
    update)
        update
        ;;
    status)
        check_status
        ;;
    *)
        echo "Usage: $0 {setup|update|status}"
        echo ""
        echo "Commands:"
        echo "  setup   - Initial deployment setup"
        echo "  update  - Update existing deployment"
        echo "  status  - Check deployment status"
        exit 1
        ;;
esac 