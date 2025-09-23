require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');

// Настройка логирования
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/monitoring-server.log' })
  ]
});

const app = express();
const port = process.env.MONITORING_PORT || 8082;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Логирование запросов
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'monitoring',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Metrics endpoint
app.get('/api/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    },
    services: {
      web: {
        status: 'unknown',
        port: process.env.PORT || 3000
      },
      proxy: {
        status: 'unknown',
        port: process.env.AI_PROXY_PORT || 8081
      },
      monitoring: {
        status: 'healthy',
        port: port
      }
    },
    traffic: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    }
  };
  
  res.json(metrics);
});

// Logs endpoint
app.get('/api/logs', (req, res) => {
  const logLevel = req.query.level || 'info';
  const limit = parseInt(req.query.limit) || 100;
  
  // В реальной реализации здесь будет чтение логов из файла или базы данных
  const logs = [
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Monitoring server started',
      service: 'monitoring'
    },
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Health check endpoint accessed',
      service: 'monitoring'
    }
  ];
  
  res.json({
    logs: logs.slice(0, limit),
    total: logs.length,
    level: logLevel
  });
});

// Alerts endpoint
app.get('/api/alerts', (req, res) => {
  const alerts = [
    {
      id: 'alert-001',
      type: 'warning',
      message: 'High memory usage detected',
      timestamp: new Date().toISOString(),
      resolved: false
    },
    {
      id: 'alert-002',
      type: 'info',
      message: 'Proxy server configuration updated',
      timestamp: new Date().toISOString(),
      resolved: true
    }
  ];
  
  res.json({
    alerts: alerts.filter(alert => !req.query.resolved || alert.resolved.toString() === req.query.resolved),
    total: alerts.length
  });
});

// Dashboard endpoint
app.get('/monitoring', (req, res) => {
  res.json({
    title: 'Traffic Router Monitoring Dashboard',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      metrics: '/api/metrics',
      logs: '/api/logs',
      alerts: '/api/alerts'
    },
    quickStats: {
      uptime: process.uptime(),
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      nodeVersion: process.version,
      platform: process.platform
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(port, () => {
  logger.info(`Monitoring Server running on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Dashboard available at: http://localhost:${port}/monitoring`);
});
