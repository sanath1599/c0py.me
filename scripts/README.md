# ShareDrop CI/CD Pipeline

This directory contains the CI/CD pipeline components for ShareDrop, including GitHub Actions workflow and webhook handler for automatic deployment.

## 🏗️ Architecture

```
GitHub Push → GitHub Actions → Webhook → Server → Deploy Script
```

1. **GitHub Actions** (.github/workflows/deploy.yml)
   - Triggers on push to main branch
   - Runs tests and builds
   - Calls webhook endpoint

2. **Webhook Handler** (scripts/webhook-handler.js)
   - Runs on backend.c0py.me
   - Receives GitHub webhooks
   - Executes deployment script as root

3. **Deployment Script** (/root/sharedrop.sh)
   - Your existing deployment script
   - Fetches, builds, and deploys the application

## 📁 Files

- `.github/workflows/deploy.yml` - GitHub Actions workflow
- `scripts/webhook-handler.js` - Webhook handler server
- `scripts/setup-webhook.sh` - Server setup script
- `scripts/deploy-webhook.sh` - Webhook deployment script
- `scripts/sharedrop-webhook.service` - Systemd service file

## 🚀 Quick Setup

### 1. Deploy Webhook Handler

```bash
# Make deployment script executable
chmod +x scripts/deploy-webhook.sh

# Deploy to server
./scripts/deploy-webhook.sh
```

### 2. Configure GitHub Webhook

1. Go to your GitHub repository settings
2. Navigate to "Webhooks" → "Add webhook"
3. Configure:
   - **Payload URL**: `https://backend.c0py.me/webhook/deploy`
   - **Content type**: `application/json`
   - **Secret**: Use the secret generated during setup
   - **Events**: Select "Just the push event"
   - **Active**: ✅

### 3. Test the Pipeline

```bash
# Push to main branch
git push origin main

# Check GitHub Actions
# Go to Actions tab in your repository

# Check server logs
ssh root@backend.c0py.me 'journalctl -u sharedrop-webhook -f'
```

## 🔧 Manual Setup (Alternative)

If you prefer to set up manually on the server:

### 1. Copy Files to Server

```bash
# Create directory
ssh root@backend.c0py.me 'mkdir -p /root/sharedrop/scripts'

# Copy files
scp scripts/webhook-handler.js root@backend.c0py.me:/root/sharedrop/scripts/
scp scripts/setup-webhook.sh root@backend.c0py.me:/root/sharedrop/scripts/
```

### 2. Run Setup Script

```bash
ssh root@backend.c0py.me 'cd /root/sharedrop && chmod +x scripts/setup-webhook.sh && ./scripts/setup-webhook.sh'
```

## 🔍 Monitoring

### Check Service Status

```bash
ssh root@backend.c0py.me 'systemctl status sharedrop-webhook'
```

### View Logs

```bash
# Real-time logs
ssh root@backend.c0py.me 'journalctl -u sharedrop-webhook -f'

# Recent logs
ssh root@backend.c0py.me 'journalctl -u sharedrop-webhook --since "1 hour ago"'

# Log file
ssh root@backend.c0py.me 'tail -f /var/log/sharedrop-webhook.log'
```

### Restart Service

```bash
ssh root@backend.c0py.me 'systemctl restart sharedrop-webhook'
```

## 🔒 Security

The webhook handler includes several security features:

- **Signature Verification**: Validates GitHub webhook signatures
- **Branch Filtering**: Only deploys from main branch
- **Systemd Security**: Runs with restricted permissions
- **Logging**: All activities are logged

## 🛠️ Configuration

### Environment Variables

Set these on the server:

```bash
export WEBHOOK_PORT=3002
export WEBHOOK_SECRET=your-secret-here
```

### Nginx Configuration

If using nginx, add this to your config:

```nginx
location /webhook/deploy {
    proxy_pass http://localhost:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 🐛 Troubleshooting

### Webhook Not Receiving Events

1. Check GitHub webhook configuration
2. Verify webhook URL is accessible
3. Check server logs: `journalctl -u sharedrop-webhook -f`

### Deployment Fails

1. Check your `/root/sharedrop.sh` script
2. Verify the script has execute permissions
3. Check webhook logs for error messages

### Service Won't Start

1. Check systemd status: `systemctl status sharedrop-webhook`
2. Verify Node.js is installed: `node --version`
3. Check file permissions and paths

## 📝 Logs

Logs are available in multiple locations:

- **Systemd logs**: `journalctl -u sharedrop-webhook`
- **File logs**: `/var/log/sharedrop-webhook.log`
- **GitHub Actions**: Repository Actions tab

## 🔄 Workflow

1. **Developer pushes to main branch**
2. **GitHub Actions triggers**:
   - Runs tests
   - Builds project
   - Calls webhook endpoint
3. **Webhook handler receives request**:
   - Validates signature
   - Checks branch (main only)
   - Executes deployment script
4. **Deployment script runs**:
   - Fetches latest code
   - Builds application
   - Restarts services
5. **Health check confirms deployment**

## 🎯 Success Indicators

- GitHub Actions workflow completes successfully
- Webhook receives 200 response
- Service logs show successful deployment
- Application is accessible and healthy 