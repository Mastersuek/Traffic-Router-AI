require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const { AuthMiddleware } = require('../lib/auth-middleware');
const { SimpleMonitoring } = require('../lib/simple-monitoring');
const { APICache, SimpleCache } = require('../lib/simple-cache');
const { LogManager } = require('../lib/log-manager');
const { ProxyServer } = require('../lib/compiled/proxy-server'); // Will be available after TS compilation

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
    new winston.transports.File({ filename: 'logs/proxy-server.log' })
  ]
});

const app = express();
const port = process.env.AI_PROXY_PORT || 8081;

// Инициализация компонентов
const authMiddleware = new AuthMiddleware();
const monitoring = new SimpleMonitoring();
const apiCache = new APICache();
const configCache = new SimpleCache();
const logManager = new LogManager();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Безопасность
app.use(authMiddleware.securityHeaders);
app.use(authMiddleware.securityLogging);
app.use(authMiddleware.rateLimit(parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 100));

// Логирование запросов
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Инициализация прокси-сервера
// TODO: Initialize ProxyServer when TypeScript compilation is set up
logger.info('Proxy server placeholder initialized');

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const systemSummary = monitoring.getSystemSummary();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      proxy: {
        enabled: process.env.PROXY_ENABLED === 'true',
        virtualLocation: {
          country: process.env.VIRTUAL_LOCATION_COUNTRY || 'US',
          city: process.env.VIRTUAL_LOCATION_CITY || 'New York'
        }
      },
      monitoring: systemSummary,
      cache: {
        api: apiCache.getStats(),
        config: configCache.getStats()
      },
      logs: logManager.getLogSummary()
    });
  } catch (error) {
    logger.error('Health check error:', error);
    logManager.logCriticalError(error, { endpoint: '/health' });
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed'
    });
  }
});

// API endpoints
app.get('/api/stats', (req, res) => {
  res.json({
    requests: 0, // TODO: Implement request counting
    errors: 0,   // TODO: Implement error counting
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Proxy endpoints
app.all('/proxy/*', async (req, res) => {
  try {
    const targetUrl = req.url.replace('/proxy/', '');
    logger.info(`Proxying request to: ${targetUrl}`);
    
    // Здесь должна быть логика проксирования
    res.json({
      message: 'Proxy endpoint - not implemented yet',
      targetUrl,
      method: req.method
    });
  } catch (error) {
    logger.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy error' });
  }
});

// AI Services endpoints
app.post('/api/ai/openai', async (req, res) => {
  try {
    const axios = require('axios');
    
    logger.info('🤖 OpenAI API request', { 
      model: req.body.model,
      messages: req.body.messages?.length || 0 
    });
    
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-test-key') {
      return res.status(400).json({ 
        error: 'OpenAI API key not configured',
        message: 'Please set OPENAI_API_KEY in config.env' 
      });
    }
    
    // Cache key for request
    const cacheKey = JSON.stringify(req.body);
    const cachedResponse = apiCache.get(cacheKey);
    
    if (cachedResponse) {
      logger.info('📋 Returning cached OpenAI response');
      return res.json(cachedResponse);
    }
    
    // Forward request to OpenAI
    const response = await axios.post('https://api.openai.com/v1/chat/completions', req.body, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Traffic-Router-AI-Proxy/1.0'
      },
      timeout: 30000
    });
    
    // Cache successful response
    apiCache.set(cacheKey, response.data, 300000); // 5 minutes
    
    logger.info('✅ OpenAI API response received', {
      tokens: response.data.usage?.total_tokens || 0,
      model: response.data.model
    });
    
    res.json(response.data);
    
  } catch (error) {
    logger.error('❌ OpenAI API error:', error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: 'OpenAI API error',
        details: error.response.data,
        status: error.response.status
      });
    } else {
      res.status(500).json({ 
        error: 'OpenAI API connection error',
        message: error.message 
      });
    }
  }
});

app.post('/api/ai/anthropic', async (req, res) => {
  try {
    const axios = require('axios');
    
    logger.info('🧠 Anthropic API request', { 
      model: req.body.model,
      messages: req.body.messages?.length || 0 
    });
    
    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'test-key') {
      return res.status(400).json({ 
        error: 'Anthropic API key not configured',
        message: 'Please set ANTHROPIC_API_KEY in config.env' 
      });
    }
    
    // Cache key for request
    const cacheKey = 'anthropic_' + JSON.stringify(req.body);
    const cachedResponse = apiCache.get(cacheKey);
    
    if (cachedResponse) {
      logger.info('📋 Returning cached Anthropic response');
      return res.json(cachedResponse);
    }
    
    // Forward request to Anthropic
    const response = await axios.post('https://api.anthropic.com/v1/messages', req.body, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'User-Agent': 'Traffic-Router-AI-Proxy/1.0'
      },
      timeout: 30000
    });
    
    // Cache successful response
    apiCache.set(cacheKey, response.data, 300000); // 5 minutes
    
    logger.info('✅ Anthropic API response received', {
      tokens: response.data.usage?.input_tokens + response.data.usage?.output_tokens || 0,
      model: response.data.model
    });
    
    res.json(response.data);
    
  } catch (error) {
    logger.error('❌ Anthropic API error:', error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: 'Anthropic API error',
        details: error.response.data,
        status: error.response.status
      });
    } else {
      res.status(500).json({ 
        error: 'Anthropic API connection error',
        message: error.message 
      });
    }
  }
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
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    // Очищаем кэши
    apiCache.shutdown();
    configCache.shutdown();
    
    // Останавливаем мониторинг
    monitoring.shutdown();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    logManager.logCriticalError(error, { context: 'graceful_shutdown', signal });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
app.listen(port, () => {
  logger.info(`AI Proxy Server running on port ${port}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Virtual location: ${process.env.VIRTUAL_LOCATION_CITY || 'New York'}, ${process.env.VIRTUAL_LOCATION_COUNTRY || 'US'}`);
});
