# Production Deployment Guide

This guide covers the deployment and configuration of Traffic Router AI Platform in production environment.

## 🚀 Quick Start

### Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Root access to the server
- Domain name (optional, for SSL)
- At least 4GB RAM and 2 CPU cores
- 50GB+ disk space

### 1. Initial Server Setup

Run the production setup script on your server:

```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/your-org/traffic-router/main/scripts/setup-production.sh | sudo bash

# Or if you have the repository cloned:
sudo bash scripts/setup-production.sh
```

This script will:
- Install Node.js, PM2, Nginx, PostgreSQL, Redis
- Create application user and directories
- Configure firewall and security
- Set up log rotation and monitoring
- Install Docker and Docker Compose

### 2. Environment Configuration

Copy and configure the production environment file:

```bash
cd /var/www/traffic-router
cp .env.production.template .env.production
nano .env.production
```

**Required environment variables:**

```bash
# Database
DATABASE_URL=postgresql://traffic_router:YOUR_DB_PASSWORD@localhost:5432/traffic_router_prod
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# AI Services API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn_here
ALERT_WEBHOOK_URL=your_slack_webhook_url_here
```

### 3. SSL Certificate (Optional)

If you have a domain name, set up SSL certificate:

```bash
# Install SSL certificate
sudo certbot --nginx -d your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### 4. Deploy Application

Use the deployment script:

```bash
# From your local development machine
npm run deploy:prod

# Or manually on the server
git clone https://github.com/your-org/traffic-router.git /var/www/traffic-router
cd /var/www/traffic-router
npm ci --only=production
npm run build:prod
npm run start:prod
```

## 🔧 Configuration

### Environment Files

- `.env.production` - Production environment variables
- `.env.staging` - Staging environment variables
- `config.env` - Development environment variables

### Docker Deployment

For containerized deployment:

```bash
# Build and start all services
npm run docker:build
npm run docker:run

# View logs
npm run docker:logs

# Stop services
npm run docker:stop
```

### PM2 Process Management

```bash
# Start all services
npm run start:prod

# Stop all services
npm run stop:prod

# Restart services
npm run restart:prod

# Reload services (zero-downtime)
npm run reload:prod

# View logs
npm run logs:prod

# Monitor processes
npm run monit:prod
```

## 📊 Monitoring

### Health Checks

The application provides health check endpoints:

- Main app: `http://localhost:3000/api/health`
- AI Proxy: `http://localhost:3001/health`
- Monitoring: `http://localhost:3002/health`
- YouTube Cache: `http://localhost:3003/health`
- MCP Server: `http://localhost:3004/health`

### Metrics

Prometheus metrics are available at:
- `http://localhost:9090/metrics`

### Logs

Application logs are stored in:
- `/var/log/traffic-router/app.log` - Application logs
- `/var/log/traffic-router/error.log` - Error logs
- `/var/log/traffic-router/ai-proxy.log` - AI Proxy logs
- `/var/log/traffic-router/monitoring.log` - Monitoring logs

### Alerts

Configure alerts in `config/monitoring-production.json`:

```json
{
  "alerts": {
    "channels": [
      {
        "type": "webhook",
        "url": "https://hooks.slack.com/your-webhook-url"
      }
    ],
    "rules": [
      {
        "name": "service-down",
        "condition": "service_health == 0",
        "severity": "critical"
      }
    ]
  }
}
```

## 🔒 Security

### Firewall Configuration

The setup script configures UFW firewall:

```bash
# Check firewall status
sudo ufw status

# Allow additional ports if needed
sudo ufw allow 8080/tcp
```

### SSL/TLS

- Use Let's Encrypt certificates for HTTPS
- Configure strong SSL ciphers in Nginx
- Enable HSTS headers

### API Security

- Rate limiting is enabled by default
- CORS is disabled in production
- Security headers are configured via Helmet.js

## 🚨 Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   # Check PM2 status
   pm2 status
   
   # Check logs
   pm2 logs
   
   # Restart specific service
   pm2 restart traffic-router-app
   ```

2. **Database connection issues**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Test connection
   psql -U traffic_router -d traffic_router_prod -h localhost
   ```

3. **Redis connection issues**
   ```bash
   # Check Redis status
   sudo systemctl status redis-server
   
   # Test connection
   redis-cli ping
   ```

4. **Nginx configuration issues**
   ```bash
   # Test Nginx configuration
   sudo nginx -t
   
   # Reload Nginx
   sudo systemctl reload nginx
   ```

### Performance Tuning

1. **Node.js Memory**
   ```bash
   # Increase memory limit in PM2 config
   "node_args": "--max-old-space-size=2048"
   ```

2. **Database Optimization**
   ```sql
   -- Optimize PostgreSQL settings
   ALTER SYSTEM SET shared_buffers = '256MB';
   ALTER SYSTEM SET effective_cache_size = '1GB';
   ```

3. **Redis Optimization**
   ```bash
   # Configure Redis memory policy
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

## 📈 Scaling

### Horizontal Scaling

1. **Load Balancer Setup**
   - Use Nginx as load balancer
   - Configure multiple application instances
   - Set up session affinity if needed

2. **Database Scaling**
   - Set up read replicas
   - Use connection pooling
   - Consider database sharding

3. **Cache Scaling**
   - Use Redis Cluster
   - Implement cache warming strategies
   - Monitor cache hit rates

### Vertical Scaling

1. **Increase server resources**
2. **Optimize PM2 cluster mode**
3. **Tune database parameters**

## 🔄 Backup and Recovery

### Database Backup

```bash
# Create backup
pg_dump -U traffic_router traffic_router_prod > backup.sql

# Restore backup
psql -U traffic_router traffic_router_prod < backup.sql
```

### Application Backup

```bash
# Backup application files
tar -czf backup-$(date +%Y%m%d).tar.gz /var/www/traffic-router

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz /var/log/traffic-router
```

### Automated Backups

Set up cron jobs for automated backups:

```bash
# Edit crontab
crontab -e

# Add backup jobs
0 2 * * * pg_dump -U traffic_router traffic_router_prod > /var/backups/traffic-router/db-$(date +\%Y\%m\%d).sql
0 3 * * * tar -czf /var/backups/traffic-router/app-$(date +\%Y\%m\%d).tar.gz /var/www/traffic-router
```

## 📞 Support

For production support:

1. Check application logs first
2. Verify all services are running
3. Test health check endpoints
4. Review monitoring alerts
5. Contact development team with detailed error information

## 🔗 Related Documentation

- [Development Setup](README.md)
- [API Documentation](docs/API.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Security Guidelines](docs/SECURITY.md)