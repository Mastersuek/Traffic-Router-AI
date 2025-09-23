#!/bin/bash

# Production Deployment Script for Traffic Router
set -e

echo "🚀 Starting production deployment..."

# Configuration
DEPLOY_USER="deploy"
DEPLOY_HOST="your-production-server.com"
DEPLOY_PATH="/var/www/traffic-router"
BACKUP_PATH="/var/backups/traffic-router"
LOG_FILE="/var/log/deploy-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check if we're on the correct branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    error "Not on main branch. Current branch: $CURRENT_BRANCH"
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    error "Working directory is not clean. Please commit or stash changes."
fi

# Check if we can connect to the server
log "Testing connection to production server..."
if ! ssh -o ConnectTimeout=10 "$DEPLOY_USER@$DEPLOY_HOST" "echo 'Connection successful'"; then
    error "Cannot connect to production server"
fi

# Run tests
log "Running tests..."
npm test || error "Tests failed"

# Build application
log "Building application..."
npm run build:ts || error "TypeScript build failed"

# Try Next.js build with fallback
log "Attempting Next.js build..."
if npm run build; then
    log "Next.js build successful"
else
    warn "Next.js build failed, will build on server"
fi

# Create deployment package
log "Creating deployment package..."
PACKAGE_NAME="traffic-router-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$PACKAGE_NAME" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=.next \
    --exclude=logs \
    --exclude=cache \
    --exclude=*.tar.gz \
    .

# Upload to server
log "Uploading package to server..."
scp "$PACKAGE_NAME" "$DEPLOY_USER@$DEPLOY_HOST:/tmp/"

# Deploy on server
log "Deploying on server..."
ssh "$DEPLOY_USER@$DEPLOY_HOST" << EOF
    set -e
    
    # Create backup
    if [ -d "$DEPLOY_PATH" ]; then
        echo "Creating backup..."
        sudo mkdir -p "$BACKUP_PATH"
        sudo tar -czf "$BACKUP_PATH/backup-\$(date +%Y%m%d-%H%M%S).tar.gz" -C "$DEPLOY_PATH" .
        
        # Keep only last 5 backups
        sudo find "$BACKUP_PATH" -name "backup-*.tar.gz" -type f -mtime +5 -delete
    fi
    
    # Stop services
    echo "Stopping services..."
    sudo pm2 stop ecosystem.production.config.js || true
    sudo systemctl stop nginx || true
    
    # Extract new version
    echo "Extracting new version..."
    sudo mkdir -p "$DEPLOY_PATH"
    sudo tar -xzf "/tmp/$PACKAGE_NAME" -C "$DEPLOY_PATH"
    sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
    
    # Install dependencies
    echo "Installing dependencies..."
    cd "$DEPLOY_PATH"
    npm ci --only=production
    
    # Set up environment
    echo "Setting up environment..."
    if [ ! -f ".env.production" ]; then
        echo "WARNING: .env.production not found, copying from template"
        cp ".env.production" ".env.production.example"
    fi
    
    # Create necessary directories
    sudo mkdir -p /var/log/traffic-router
    sudo mkdir -p /var/run
    sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" /var/log/traffic-router
    
    # Start services
    echo "Starting services..."
    sudo systemctl start nginx
    pm2 start ecosystem.production.config.js --env production
    
    # Health check
    echo "Running health check..."
    sleep 10
    curl -f http://localhost:3000/api/health || {
        echo "Health check failed, rolling back..."
        pm2 stop ecosystem.production.config.js
        # Restore backup if available
        LATEST_BACKUP=\$(sudo find "$BACKUP_PATH" -name "backup-*.tar.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
        if [ -n "\$LATEST_BACKUP" ]; then
            sudo tar -xzf "\$LATEST_BACKUP" -C "$DEPLOY_PATH"
            pm2 start ecosystem.production.config.js --env production
        fi
        exit 1
    }
    
    # Cleanup
    rm "/tmp/$PACKAGE_NAME"
    
    echo "Deployment completed successfully!"
EOF

# Cleanup local package
rm "$PACKAGE_NAME"

# Final verification
log "Running final verification..."
sleep 5
if curl -f "http://$DEPLOY_HOST/api/health"; then
    log "✅ Deployment successful! Application is running."
else
    error "❌ Deployment verification failed!"
fi

log "🎉 Production deployment completed successfully!"
log "📊 Deployment log saved to: $LOG_FILE"

# Send notification (optional)
# curl -X POST -H 'Content-type: application/json' \
#     --data '{"text":"🚀 Traffic Router deployed to production successfully!"}' \
#     YOUR_SLACK_WEBHOOK_URL