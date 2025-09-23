#!/bin/bash

# Production Environment Setup Script
set -e

echo "🔧 Setting up production environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

# Update system packages
log "Updating system packages..."
apt-get update && apt-get upgrade -y

# Install required packages
log "Installing required packages..."
apt-get install -y \
    curl \
    wget \
    git \
    nginx \
    redis-server \
    postgresql \
    postgresql-contrib \
    certbot \
    python3-certbot-nginx \
    htop \
    iotop \
    netstat-nat \
    ufw \
    fail2ban \
    logrotate

# Install Node.js 18
log "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 globally
log "Installing PM2..."
npm install -g pm2

# Create application user
log "Creating application user..."
if ! id "deploy" &>/dev/null; then
    useradd -m -s /bin/bash deploy
    usermod -aG sudo deploy
    log "Created user 'deploy'"
else
    log "User 'deploy' already exists"
fi

# Create application directories
log "Creating application directories..."
mkdir -p /var/www/traffic-router
mkdir -p /var/log/traffic-router
mkdir -p /var/backups/traffic-router
mkdir -p /etc/traffic-router

# Set permissions
chown -R deploy:deploy /var/www/traffic-router
chown -R deploy:deploy /var/log/traffic-router
chown -R deploy:deploy /var/backups/traffic-router
chmod 755 /var/www/traffic-router
chmod 755 /var/log/traffic-router
chmod 755 /var/backups/traffic-router

# Configure PostgreSQL
log "Configuring PostgreSQL..."
sudo -u postgres createuser --interactive --pwprompt traffic_router || warn "PostgreSQL user might already exist"
sudo -u postgres createdb traffic_router_prod -O traffic_router || warn "PostgreSQL database might already exist"

# Configure Redis
log "Configuring Redis..."
systemctl enable redis-server
systemctl start redis-server

# Configure Nginx
log "Configuring Nginx..."
systemctl enable nginx

# Create Nginx configuration directory
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Remove default Nginx site
rm -f /etc/nginx/sites-enabled/default

# Configure UFW firewall
log "Configuring firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw allow 80/tcp
ufw allow 443/tcp

# Configure fail2ban
log "Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Configure logrotate for application logs
log "Configuring log rotation..."
cat > /etc/logrotate.d/traffic-router << EOF
/var/log/traffic-router/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 deploy deploy
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Set up PM2 startup script
log "Setting up PM2 startup..."
sudo -u deploy pm2 startup systemd -u deploy --hp /home/deploy
systemctl enable pm2-deploy

# Create systemd service for health monitoring
log "Creating health monitoring service..."
cat > /etc/systemd/system/traffic-router-health.service << EOF
[Unit]
Description=Traffic Router Health Monitor
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/var/www/traffic-router
ExecStart=/usr/bin/node scripts/health-monitor.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=traffic-router-health

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable traffic-router-health

# Configure system limits
log "Configuring system limits..."
cat >> /etc/security/limits.conf << EOF
deploy soft nofile 65536
deploy hard nofile 65536
deploy soft nproc 32768
deploy hard nproc 32768
EOF

# Configure sysctl for better performance
log "Configuring kernel parameters..."
cat >> /etc/sysctl.conf << EOF
# Traffic Router optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 10
vm.swappiness = 10
fs.file-max = 2097152
EOF

sysctl -p

# Create environment template
log "Creating environment template..."
cat > /var/www/traffic-router/.env.production.template << EOF
# Production Environment Configuration Template
# Copy this file to .env.production and fill in the actual values

NODE_ENV=production

# Server Ports
PORT=3000
AI_PROXY_PORT=3001
MONITORING_PORT=3002
YOUTUBE_CACHE_PORT=3003
SOCKS_PROXY_PORT=1080
HTTP_PROXY_PORT=8080
MCP_SERVER_PORT=3004

# Database
DATABASE_URL=postgresql://traffic_router:YOUR_DB_PASSWORD@localhost:5432/traffic_router_prod
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# AI Services (set your actual API keys)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# External Services
SENTRY_DSN=your_sentry_dsn_here
DATADOG_API_KEY=your_datadog_api_key_here
EOF

chown deploy:deploy /var/www/traffic-router/.env.production.template

# Create SSL certificate directory
log "Creating SSL certificate directory..."
mkdir -p /etc/nginx/ssl
chown root:root /etc/nginx/ssl
chmod 700 /etc/nginx/ssl

# Install Docker (optional)
log "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker deploy
systemctl enable docker
systemctl start docker

# Install Docker Compose
log "Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create monitoring script
log "Creating monitoring script..."
cat > /var/www/traffic-router/scripts/health-monitor.js << EOF
const http = require('http');
const fs = require('fs');

const services = [
    { name: 'Main App', url: 'http://localhost:3000/api/health' },
    { name: 'AI Proxy', url: 'http://localhost:3001/health' },
    { name: 'Monitoring', url: 'http://localhost:3002/health' },
    { name: 'YouTube Cache', url: 'http://localhost:3003/health' },
    { name: 'MCP Server', url: 'http://localhost:3004/health' }
];

async function checkHealth() {
    const results = [];
    
    for (const service of services) {
        try {
            const response = await fetch(service.url);
            results.push({
                service: service.name,
                status: response.ok ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            results.push({
                service: service.name,
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // Log results
    console.log(JSON.stringify({ healthCheck: results }));
    
    // Write to health status file
    fs.writeFileSync('/tmp/traffic-router-health.json', JSON.stringify(results, null, 2));
}

// Check every 30 seconds
setInterval(checkHealth, 30000);
checkHealth(); // Initial check
EOF

chown deploy:deploy /var/www/traffic-router/scripts/health-monitor.js

log "✅ Production environment setup completed!"
log ""
log "Next steps:"
log "1. Copy .env.production.template to .env.production and fill in actual values"
log "2. Configure SSL certificates with: certbot --nginx -d your-domain.com"
log "3. Deploy your application using the deployment script"
log "4. Start services with: pm2 start ecosystem.production.config.js --env production"
log ""
log "Important files created:"
log "- /var/www/traffic-router (application directory)"
log "- /var/log/traffic-router (logs directory)"
log "- /var/backups/traffic-router (backups directory)"
log "- /etc/logrotate.d/traffic-router (log rotation config)"
log ""
log "Services configured:"
log "- Nginx (reverse proxy)"
log "- PostgreSQL (database)"
log "- Redis (cache)"
log "- PM2 (process manager)"
log "- UFW (firewall)"
log "- fail2ban (intrusion prevention)"