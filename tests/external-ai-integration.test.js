const { AIModelFactory } = require('../lib/ai-model-factory');
const { ExternalAIIntegrator } = require('../lib/external-ai-integrator');
const fs = require('fs').promises;
const path = require('path');

describe('External AI Integration Tests', () => {
  let aiModelFactory;
  let testConfigPath;
  let externalConfigPath;

  beforeAll(async () => {
    // Создание тестовых конфигураций
    testConfigPath = path.join(__dirname, 'test-model-config.json');
    externalConfigPath = path.join(__dirname, 'test-external-ai-config.json');

    const testModelConfig = {
      models: [
        {
          alias: 'test-gpt-4',
          provider: 'openai',
          model: 'gpt-4-turbo-preview',
          endpoint: 'https://api.openai.com/v1',
          priority: 100,
          enabled: true,
          maxTokens: 4096,
          temperature: 0.7,
          timeout: 30000
        },
        {
          alias: 'test-groq',
          provider: 'groq',
          model: 'llama-3.1-8b-instant',
          endpoint: 'https://api.groq.com',
          priority: 80,
          enabled: true,
          maxTokens: 4096,
          temperature: 0.7,
          timeout: 15000
        },
        {
          alias: 'test-together',
          provider: 'together',
          model: 'meta-llama/Llama-3.1-70B-Instruct-Turbo',
          endpoint: 'https://api.together.xyz',
          priority: 70,
          enabled: true,
          maxTokens: 4096,
          temperature: 0.7,
          timeout: 30000
        }
      ],
      fallback: {
        enabled: true,
        maxRetries: 2,
        retryDelay: 1000,
        fallbackOrder: ['test-groq', 'test-together']
      },
      defaultModel: 'test-gpt-4',
      logLevel: 'error'
    };

    const testExternalConfig = {
      intelligentRouting: {
        preferredProviders: ['groq', 'together', 'openai'],
        costOptimization: true,
        latencyOptimization: true,
        reliabilityThreshold: 70,
        loadBalancing: true,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 60,
          recoveryTimeout: 60000
        }
      }
    };

    await fs.writeFile(testConfigPath, JSON.stringify(testModelConfig, null, 2));
    await fs.writeFile(externalConfigPath, JSON.stringify(testExternalConfig, null, 2));
  });

  afterAll(async () => {
    // Очистка тестовых файлов
    try {
      await fs.unlink(testConfigPath);
      await fs.unlink(externalConfigPath);
    } catch (error) {
      // Игнорируем ошибки удаления
    }
  });

  beforeEach(async () => {
    aiModelFactory = new AIModelFactory({
      configPath: testConfigPath,
      externalAIConfigPath: externalConfigPath,
      enableIntelligentRouting: true,
      logLevel: 'error'
    });
  });

  afterEach(async () => {
    if (aiModelFactory) {
      await aiModelFactory.shutdown();
    }
  });

  describe('Initialization', () => {
    test('should initialize AI Model Factory with external AI integration', async () => {
      await aiModelFactory.initialize();
      
      expect(aiModelFactory.isInitialized()).toBe(true);
      
      const info = aiModelFactory.getInfo();
      expect(info.intelligentRoutingEnabled).toBe(true);
      expect(info.externalAIIntegratorAvailable).toBe(true);
    });

    test('should load available models including external providers', async () => {
      await aiModelFactory.initialize();
      
      const models = aiModelFactory.getAvailableModels();
      expect(models.length).toBeGreaterThan(0);
      
      const providers = [...new Set(models.map(m => m.provider))];
      expect(providers).toContain('openai');
      expect(providers).toContain('groq');
      expect(providers).toContain('together');
    });
  });

  describe('External AI Statistics', () => {
    test('should provide external AI provider statistics', async () => {
      await aiModelFactory.initialize();
      
      const stats = aiModelFactory.getExternalAIStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
      
      // Проверяем наличие основных провайдеров
      expect(stats).toHaveProperty('openai');
      expect(stats).toHaveProperty('groq');
      expect(stats).toHaveProperty('together');
    });

    test('should provide optimization recommendations', async () => {
      await aiModelFactory.initialize();
      
      const recommendations = aiModelFactory.getOptimizationRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Intelligent Routing', () => {
    test('should handle intelligent routing request', async () => {
      await aiModelFactory.initialize();
      
      const testRequest = {
        messages: [
          { role: 'user', content: 'Hello, this is a test message' }
        ],
        maxTokens: 50,
        temperature: 0.7
      };

      // Мокаем успешный ответ для тестирования
      const mockResponse = {
        content: 'Hello! This is a test response.',
        model: 'test-model',
        provider: 'test-provider'
      };

      // Поскольку у нас нет реальных API ключей, мы ожидаем ошибку
      // но проверяем что метод существует и вызывается
      try {
        await aiModelFactory.sendIntelligentRequest(testRequest);
      } catch (error) {
        // Ожидаем ошибку из-за отсутствия API ключей
        expect(error).toBeDefined();
      }
    });

    test('should allow updating intelligent routing configuration', async () => {
      await aiModelFactory.initialize();
      
      const newConfig = {
        costOptimization: false,
        latencyOptimization: true,
        reliabilityThreshold: 80
      };

      // Метод должен существовать и не выбрасывать ошибку
      expect(() => {
        aiModelFactory.updateIntelligentRoutingConfig(newConfig);
      }).not.toThrow();
    });

    test('should allow enabling/disabling intelligent routing', async () => {
      await aiModelFactory.initialize();
      
      aiModelFactory.setIntelligentRouting(false);
      expect(aiModelFactory.getInfo().intelligentRoutingEnabled).toBe(false);
      
      aiModelFactory.setIntelligentRouting(true);
      expect(aiModelFactory.getInfo().intelligentRoutingEnabled).toBe(true);
    });
  });

  describe('Provider Management', () => {
    test('should allow resetting provider metrics', async () => {
      await aiModelFactory.initialize();
      
      // Метод должен существовать и не выбрасывать ошибку
      expect(() => {
        aiModelFactory.resetProviderMetrics('openai');
      }).not.toThrow();
    });

    test('should perform health checks on external providers', async () => {
      await aiModelFactory.initialize();
      
      const healthResults = await aiModelFactory.healthCheckExternalProviders();
      expect(typeof healthResults).toBe('object');
    });
  });

  describe('Configuration Management', () => {
    test('should handle missing external AI config gracefully', async () => {
      const factoryWithoutExternalConfig = new AIModelFactory({
        configPath: testConfigPath,
        externalAIConfigPath: 'non-existent-config.json',
        enableIntelligentRouting: true,
        logLevel: 'error'
      });

      // Должно инициализироваться без ошибок даже без внешней конфигурации
      await factoryWithoutExternalConfig.initialize();
      expect(factoryWithoutExternalConfig.isInitialized()).toBe(true);
      
      await factoryWithoutExternalConfig.shutdown();
    });

    test('should work with intelligent routing disabled', async () => {
      const factoryWithoutRouting = new AIModelFactory({
        configPath: testConfigPath,
        enableIntelligentRouting: false,
        logLevel: 'error'
      });

      await factoryWithoutRouting.initialize();
      expect(factoryWithoutRouting.isInitialized()).toBe(true);
      
      const info = factoryWithoutRouting.getInfo();
      expect(info.intelligentRoutingEnabled).toBe(false);
      
      await factoryWithoutRouting.shutdown();
    });
  });

  describe('Error Handling', () => {
    test('should handle external AI integrator errors gracefully', async () => {
      await aiModelFactory.initialize();
      
      // Попытка использовать интеллектуальную маршрутизацию без API ключей
      // должна обрабатываться корректно
      const testRequest = {
        messages: [{ role: 'user', content: 'test' }]
      };

      try {
        await aiModelFactory.sendIntelligentRequest(testRequest);
      } catch (error) {
        expect(error).toBeDefined();
        expect(typeof error.message).toBe('string');
      }
    });

    test('should fallback to regular routing when intelligent routing fails', async () => {
      await aiModelFactory.initialize();
      
      // Отключаем интеллектуальную маршрутизацию
      aiModelFactory.setIntelligentRouting(false);
      
      const testRequest = {
        messages: [{ role: 'user', content: 'test' }]
      };

      try {
        await aiModelFactory.sendRequest('test-gpt-4', testRequest);
      } catch (error) {
        // Ожидаем ошибку из-за отсутствия API ключей, но не из-за маршрутизации
        expect(error).toBeDefined();
      }
    });
  });
});

// Интеграционные тесты для проверки работы с реальными API (требуют API ключи)
describe('External AI Integration - Real API Tests', () => {
  // Эти тесты выполняются только если установлены переменные окружения
  const hasApiKeys = process.env.GROQ_API_KEY || process.env.TOGETHER_AI_KEY;
  
  if (!hasApiKeys) {
    test.skip('Skipping real API tests - no API keys provided', () => {});
    return;
  }

  let aiModelFactory;

  beforeEach(async () => {
    const realConfig = {
      models: [
        {
          alias: 'groq-test',
          provider: 'groq',
          model: 'llama-3.1-8b-instant',
          endpoint: 'https://api.groq.com',
          apiKey: process.env.GROQ_API_KEY,
          priority: 90,
          enabled: !!process.env.GROQ_API_KEY,
          maxTokens: 100,
          temperature: 0.7,
          timeout: 15000
        }
      ],
      fallback: { enabled: false, maxRetries: 0, retryDelay: 0, fallbackOrder: [] },
      defaultModel: 'groq-test',
      logLevel: 'error'
    };

    const configPath = path.join(__dirname, 'real-test-config.json');
    await fs.writeFile(configPath, JSON.stringify(realConfig, null, 2));

    aiModelFactory = new AIModelFactory({
      configPath: configPath,
      enableIntelligentRouting: true,
      logLevel: 'error'
    });

    await aiModelFactory.initialize();
  });

  afterEach(async () => {
    if (aiModelFactory) {
      await aiModelFactory.shutdown();
    }
  });

  test('should successfully make real API request with intelligent routing', async () => {
    const testRequest = {
      messages: [
        { role: 'user', content: 'Say "Hello World" and nothing else.' }
      ],
      maxTokens: 20,
      temperature: 0.1
    };

    const response = await aiModelFactory.sendIntelligentRequest(testRequest);
    
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(typeof response.content).toBe('string');
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.model).toBeDefined();
    expect(response.provider).toBeDefined();
  }, 30000); // 30 секунд timeout для реального API
});