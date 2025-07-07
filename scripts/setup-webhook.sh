#!/bin/bash

# ShareDrop Webhook Setup Script
# This script sets up the webhook handler service on the server

set -e

echo "🚀 Setting up ShareDrop Webhook Handler..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

# Configuration
WEBHOOK_PORT=${WEBHOOK_PORT:-3002}
WEBHOOK_SECRET=${WEBHOOK_SECRET:-$(openssl rand -hex 32)}
SERVICE_NAME="sharedrop-webhook"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SCRIPT_DIR="/root/sharedrop/scripts"
WEBHOOK_SCRIPT="${SCRIPT_DIR}/webhook-handler.js"

print_status "Configuration:"
echo "  Port: $WEBHOOK_PORT"
echo "  Secret: $WEBHOOK_SECRET"
echo "  Service: $SERVICE_NAME"
echo "  Script: $WEBHOOK_SCRIPT"

# Create log directory
print_status "Creating log directory..."
mkdir -p /var/log
touch /var/log/sharedrop-webhook.log
chmod 644 /var/log/sharedrop-webhook.log

# Make webhook script executable
print_status "Setting up webhook script..."
if [[ ! -f "$WEBHOOK_SCRIPT" ]]; then
    print_error "Webhook script not found at $WEBHOOK_SCRIPT"
    exit 1
fi

chmod +x "$WEBHOOK_SCRIPT"

# Update service file with correct paths and secret
print_status "Creating systemd service..."
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=ShareDrop Webhook Handler
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/root
ExecStart=/usr/bin/node $WEBHOOK_SCRIPT
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=WEBHOOK_PORT=$WEBHOOK_PORT
Environment=WEBHOOK_SECRET=$WEBHOOK_SECRET

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log /root

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sharedrop-webhook

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
print_status "Enabling and starting service..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

# Check service status
if systemctl is-active --quiet "$SERVICE_NAME"; then
    print_status "✅ Service is running successfully"
else
    print_error "❌ Service failed to start"
    systemctl status "$SERVICE_NAME"
    exit 1
fi

# Setup firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    print_status "Configuring firewall..."
    ufw allow $WEBHOOK_PORT/tcp
    print_status "✅ Firewall rule added for port $WEBHOOK_PORT"
fi

# Setup nginx reverse proxy (optional)
if command -v nginx &> /dev/null; then
    print_warning "Nginx detected. You may want to set up a reverse proxy for the webhook."
    print_warning "Add this to your nginx config:"
    echo ""
    echo "location /webhook/deploy {"
    echo "    proxy_pass http://localhost:$WEBHOOK_PORT;"
    echo "    proxy_set_header Host \$host;"
    echo "    proxy_set_header X-Real-IP \$remote_addr;"
    echo "    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;"
    echo "    proxy_set_header X-Forwarded-Proto \$scheme;"
    echo "}"
    echo ""
fi

# Display final information
print_status "🎉 Webhook setup completed!"
echo ""
echo "📋 Configuration Summary:"
echo "  Service Name: $SERVICE_NAME"
echo "  Webhook URL: https://backend.c0py.me/webhook/deploy"
echo "  Port: $WEBHOOK_PORT"
echo "  Secret: $WEBHOOK_SECRET"
echo ""
echo "🔧 Management Commands:"
echo "  Check status: systemctl status $SERVICE_NAME"
echo "  View logs: journalctl -u $SERVICE_NAME -f"
echo "  Restart service: systemctl restart $SERVICE_NAME"
echo "  Stop service: systemctl stop $SERVICE_NAME"
echo ""
echo "⚠️  IMPORTANT: Update your GitHub webhook configuration with:"
echo "  URL: https://backend.c0py.me/webhook/deploy"
echo "  Secret: $WEBHOOK_SECRET"
echo "  Content type: application/json"
echo "  Events: Just the push event"
echo ""
print_status "Setup complete! 🚀" 