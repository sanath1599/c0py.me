#!/bin/bash

# Fix WebSocket Nginx Configuration for c0py.me
# This script updates the Nginx configuration to properly handle WebSocket connections

set -e

function log() { echo -e "\033[1;32m[INFO]\033[0m $1"; }
function warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
function err() { echo -e "\033[1;31m[ERROR]\033[0m $1"; }

DOMAIN="c0py.me"
BACKEND_NGINX_CONF="/etc/nginx/sites-available/backend.$DOMAIN"

log "Updating Nginx configuration for WebSocket support..."

# Check if the backend nginx config exists
if [ ! -f "$BACKEND_NGINX_CONF" ]; then
    err "Backend Nginx configuration not found at $BACKEND_NGINX_CONF"
    exit 1
fi

# Create backup
sudo cp "$BACKEND_NGINX_CONF" "$BACKEND_NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
log "Created backup of existing configuration"

# Update the nginx configuration with proper WebSocket support
sudo bash -c "cat > $BACKEND_NGINX_CONF" <<EOF
server {
    listen 80;
    server_name backend.$DOMAIN;

    location / {
        proxy_pass http://localhost:4001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:4001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket specific timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 86400;
        
        # Disable buffering for WebSocket
        proxy_buffering off;
        proxy_cache off;
    }

    client_max_body_size 100M;
}
EOF

log "Updated Nginx configuration with WebSocket support"

# Test the configuration
log "Testing Nginx configuration..."
if sudo nginx -t; then
    log "Nginx configuration is valid"
    
    # Reload nginx
    log "Reloading Nginx..."
    sudo systemctl reload nginx
    log "Nginx reloaded successfully"
    
    # Test WebSocket endpoint
    log "Testing WebSocket endpoint..."
    if curl -s -I "https://backend.$DOMAIN/socket.io/?EIO=4&transport=polling" | grep -q "200 OK"; then
        log "✅ WebSocket endpoint is accessible"
    else
        warn "⚠️ WebSocket endpoint test failed"
    fi
    
    log "WebSocket configuration update complete!"
    echo ""
    echo "🔧 Next steps:"
    echo "1. Update your frontend build with the correct WebSocket URL"
    echo "2. Test WebSocket connection from your application"
    echo "3. Monitor logs: sudo tail -f /var/log/nginx/error.log"
    
else
    err "Nginx configuration test failed. Restoring backup..."
    sudo cp "$BACKEND_NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)" "$BACKEND_NGINX_CONF"
    exit 1
fi

