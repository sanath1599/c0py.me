#!/bin/bash

# ShareDrop Webhook Deployment Script
# This script deploys the webhook handler to the server

set -e

# Configuration
SERVER_HOST="backend.c0py.me"
SERVER_USER="root"
WEBHOOK_PORT="3002"
REMOTE_DIR="/root/sharedrop"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "🚀 Deploying ShareDrop Webhook Handler to $SERVER_HOST..."

# Check if required files exist
if [[ ! -f "scripts/webhook-handler.js" ]]; then
    print_error "webhook-handler.js not found in scripts/"
    exit 1
fi

if [[ ! -f "scripts/setup-webhook.sh" ]]; then
    print_error "setup-webhook.sh not found in scripts/"
    exit 1
fi

# Create remote directory
print_status "Creating remote directory..."
ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p $REMOTE_DIR/scripts"

# Copy webhook files
print_status "Copying webhook files..."
scp scripts/webhook-handler.js "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/scripts/"
scp scripts/setup-webhook.sh "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/scripts/"

# Make scripts executable
print_status "Setting up scripts..."
ssh "$SERVER_USER@$SERVER_HOST" "chmod +x $REMOTE_DIR/scripts/*.sh"

# Run setup script
print_status "Running setup script..."
ssh "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && ./scripts/setup-webhook.sh"

# Test webhook endpoint
print_status "Testing webhook endpoint..."
sleep 5

if curl -f "https://$SERVER_HOST/webhook/deploy" > /dev/null 2>&1; then
    print_status "✅ Webhook endpoint is accessible"
else
    print_warning "⚠️ Webhook endpoint test failed (this might be expected)"
fi

print_status "🎉 Webhook deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Configure GitHub webhook in your repository settings"
echo "2. Set the webhook URL to: https://$SERVER_HOST/webhook/deploy"
echo "3. Add the webhook secret (shown during setup)"
echo "4. Select 'Just the push event'"
echo ""
echo "🔧 Useful commands:"
echo "  Check service status: ssh $SERVER_USER@$SERVER_HOST 'systemctl status sharedrop-webhook'"
echo "  View logs: ssh $SERVER_USER@$SERVER_HOST 'journalctl -u sharedrop-webhook -f'"
echo "  Restart service: ssh $SERVER_USER@$SERVER_HOST 'systemctl restart sharedrop-webhook'" 