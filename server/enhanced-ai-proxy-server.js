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
    new winston.transports.File({ filename: 'logs/enhanced-ai-proxy-server.log' })
  ]
});

const app = express();
const port = process.env.AI_PROXY_PORT || 13081;

// Глобальная переменная для фабрики моделей
let aiModelFactory = null;

// Инициализация системы алиасов моделей
async function initializeModelSystem() {
  try {
    // Динамический импорт ES модулей
    const { AIModelFactory } = await import('../lib/ai-model-factory.js');
    
    aiModelFactory = new AIModelFactory({
      enableConfigWatch: true,
      enableIntelligentRouting: true,
      logLevel: process.env.LOG_LEVEL || 'info'
    });

    // Настройка обработчиков событий
    aiModelFactory.on('initialized', () => {
      logger.info('AI Model Factory initialized successfully');
    });

    aiModelFactory.on('requestSuccess', (data) => {
      logger.info(`Successful request to model: ${data.model} (${data.provider})`);
    });

    aiModelFactory.on('requestFailed', (data) => {
      logger.warn(`Failed request to model: ${data.model} (${data.provider})`);
    });

    aiModelFactory.on('fallbackSuccess', (data) => {
      logger.info(`Successful fallback: ${data.originalModel} -> ${data.fallbackModel}`);
    });

    aiModelFactory.on('configReloaded', () => {
      logger.info('Model configuration reloaded');
    });

    await aiModelFactory.initialize();
    logger.info('Model alias system initialized');
    
  } catch (error) {
    logger.error('Failed to initialize model alias system:', error);
    // Продолжаем работу без системы алиасов
  }
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'enhanced-ai-proxy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    modelSystem: {
      initialized: aiModelFactory ? aiModelFactory.isInitialized() : false,
      modelsCount: 0,
      availableModels: []
    }
  };

  if (aiModelFactory && aiModelFactory.isInitialized()) {
    try {
      const models = aiModelFactory.getAvailableModels();
      health.modelSystem.modelsCount = models.length;
      health.modelSystem.availableModels = models.map(m => ({
        alias: m.alias,
        provider: m.provider,
        enabled: m.enabled,
        priority: m.priority
      }));
    } catch (error) {
      logger.warn('Failed to get model info for health check:', error);
    }
  }

  res.json(health);
});

// Получение списка доступных моделей
app.get('/api/models', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized',
        message: 'AI model factory is not available'
      });
    }

    const models = aiModelFactory.getAvailableModels();
    const modelsInfo = models.map(model => ({
      alias: model.alias,
      provider: model.provider,
      model: model.model,
      priority: model.priority,
      enabled: model.enabled,
      maxTokens: model.maxTokens,
      temperature: model.temperature
    }));

    res.json({
      models: modelsInfo,
      defaultModel: aiModelFactory.getCurrentConfig().defaultModel,
      totalCount: modelsInfo.length
    });

  } catch (error) {
    logger.error('Failed to get models list:', error);
    res.status(500).json({ error: 'Failed to retrieve models list' });
  }
});

// Проверка здоровья моделей
app.get('/api/models/health', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized' 
      });
    }

    const healthResults = await aiModelFactory.healthCheckAll();
    
    res.json({
      timestamp: new Date().toISOString(),
      results: healthResults,
      summary: {
        total: Object.keys(healthResults).length,
        healthy: Object.values(healthResults).filter(Boolean).length,
        unhealthy: Object.values(healthResults).filter(h => !h).length
      }
    });

  } catch (error) {
    logger.error('Failed to perform health check:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Основной endpoint для отправки запросов к AI моделям
app.post('/api/chat/completions', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized',
        message: 'AI model factory is not available'
      });
    }

    const { model, messages, max_tokens, temperature, stream } = req.body;

    // Валидация запроса
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Messages array is required and must not be empty'
      });
    }

    // Подготовка запроса
    const modelRequest = {
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      maxTokens: max_tokens,
      temperature: temperature,
      stream: stream || false
    };

    let response;
    
    if (model && model !== 'auto') {
      // Запрос к конкретной модели
      response = await aiModelFactory.sendRequest(model, modelRequest);
    } else {
      // Запрос к модели по умолчанию
      response = await aiModelFactory.sendDefaultRequest(modelRequest);
    }

    // Формирование ответа в формате OpenAI API
    const openaiResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.model,
      provider: response.provider,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.content
        },
        finish_reason: 'stop'
      }],
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    res.json(openaiResponse);

  } catch (error) {
    logger.error('Chat completion request failed:', error);
    
    res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        type: 'api_error',
        code: 'internal_error'
      }
    });
  }
});

// Получение статистики использования моделей
app.get('/api/models/stats', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized' 
      });
    }

    const stats = aiModelFactory.getStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      stats: stats,
      summary: {
        totalRequests: Object.values(stats).reduce((sum, stat) => sum + stat.requests, 0),
        totalFailures: Object.values(stats).reduce((sum, stat) => sum + stat.failures, 0),
        modelsCount: Object.keys(stats).length
      }
    });

  } catch (error) {
    logger.error('Failed to get model stats:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

// Управление конфигурацией моделей (только для администраторов)
app.get('/api/admin/config', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized' 
      });
    }

    const config = aiModelFactory.getCurrentConfig();
    
    // Удаляем API ключи из ответа для безопасности
    const safeConfig = {
      ...config,
      models: config.models.map(model => {
        const { apiKey, ...safeModel } = model;
        return safeModel;
      })
    };

    res.json(safeConfig);

  } catch (error) {
    logger.error('Failed to get config:', error);
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

// Создание резервной копии конфигурации
app.post('/api/admin/config/backup', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized' 
      });
    }

    const backupPath = await aiModelFactory.backupConfig();
    
    res.json({
      message: 'Configuration backup created successfully',
      backupPath: backupPath,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to create config backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Получение статистики внешних AI провайдеров
app.get('/api/external-ai/stats', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized' 
      });
    }

    const stats = aiModelFactory.getExternalAIStats();
    
    if (!stats) {
      return res.status(404).json({ 
        error: 'External AI integration not available' 
      });
    }

    res.json({
      timestamp: new Date().toISOString(),
      stats: stats,
      summary: {
        totalProviders: Object.keys(stats).length,
        healthyProviders: Object.values(stats).filter(stat => 
          stat.requestCount === 0 || (stat.successCount / stat.requestCount) > 0.8
        ).length
      }
    });

  } catch (error) {
    logger.error('Failed to get external AI stats:', error);
    res.status(500).json({ error: 'Failed to retrieve external AI statistics' });
  }
});

// Проверка здоровья внешних провайдеров
app.get('/api/external-ai/health', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized' 
      });
    }

    const healthResults = await aiModelFactory.healthCheckExternalProviders();
    
    res.json({
      timestamp: new Date().toISOString(),
      results: healthResults,
      summary: {
        total: Object.keys(healthResults).length,
        healthy: Object.values(healthResults).filter(Boolean).length,
        unhealthy: Object.values(healthResults).filter(h => !h).length
      }
    });

  } catch (error) {
    logger.error('Failed to perform external AI health check:', error);
    res.status(500).json({ error: 'External AI health check failed' });
  }
});

// Получение рекомендаций по оптимизации
app.get('/api/external-ai/recommendations', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized' 
      });
    }

    const recommendations = aiModelFactory.getOptimizationRecommendations();
    
    res.json({
      timestamp: new Date().toISOString(),
      recommendations: recommendations,
      count: recommendations.length
    });

  } catch (error) {
    logger.error('Failed to get optimization recommendations:', error);
    res.status(500).json({ error: 'Failed to retrieve recommendations' });
  }
});

// Сброс метрик провайдера
app.post('/api/external-ai/reset-metrics/:provider', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized' 
      });
    }

    const { provider } = req.params;
    aiModelFactory.resetProviderMetrics(provider);
    
    res.json({
      message: `Metrics reset successfully for provider: ${provider}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to reset provider metrics:', error);
    res.status(500).json({ error: 'Failed to reset metrics' });
  }
});

// Отправка запроса с интеллектуальной маршрутизацией
app.post('/api/chat/intelligent', async (req, res) => {
  try {
    if (!aiModelFactory || !aiModelFactory.isInitialized()) {
      return res.status(503).json({ 
        error: 'Model system not initialized',
        message: 'AI model factory is not available'
      });
    }

    const { messages, max_tokens, temperature, stream, preferred_model } = req.body;

    // Валидация запроса
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'Messages array is required and must not be empty'
      });
    }

    // Подготовка запроса
    const modelRequest = {
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      maxTokens: max_tokens,
      temperature: temperature,
      stream: stream || false
    };

    // Отправка запроса с интеллектуальной маршрутизацией
    const response = await aiModelFactory.sendIntelligentRequest(modelRequest, preferred_model);

    // Формирование ответа в формате OpenAI API
    const openaiResponse = {
      id: `chatcmpl-intelligent-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: response.model,
      provider: response.provider,
      routing: 'intelligent',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.content
        },
        finish_reason: 'stop'
      }],
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    res.json(openaiResponse);

  } catch (error) {
    logger.error('Intelligent chat completion request failed:', error);
    
    res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        type: 'intelligent_routing_error',
        code: 'routing_failed'
      }
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
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
    if (aiModelFactory) {
      await aiModelFactory.shutdown();
    }
    logger.info('Enhanced AI Proxy Server shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Инициализация и запуск сервера
async function startServer() {
  try {
    // Инициализация системы моделей
    await initializeModelSystem();
    
    // Запуск сервера
    app.listen(port, () => {
      logger.info(`🤖 Enhanced AI Proxy Server running on port ${port}`);
      logger.info(`📊 Health check: http://localhost:${port}/health`);
      logger.info(`🔧 Models API: http://localhost:${port}/api/models`);
      logger.info(`💬 Chat API: http://localhost:${port}/api/chat/completions`);
      
      if (aiModelFactory && aiModelFactory.isInitialized()) {
        const models = aiModelFactory.getAvailableModels();
        logger.info(`🎯 Loaded ${models.length} AI models`);
      }
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Запуск сервера
startServer();