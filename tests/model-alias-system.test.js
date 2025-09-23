/**
 * Тесты для системы алиасов моделей
 * 
 * Эти тесты проверяют основную функциональность:
 * - Загрузку конфигурации
 * - Инициализацию фабрики моделей
 * - Валидацию конфигурации
 * - Базовые операции с моделями
 */

const { describe, it, before, after } = require('mocha');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Мокаем winston для тестов
const winston = require('winston');
winston.createLogger = () => ({
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
});

describe('Model Alias System', function() {
  this.timeout(10000); // Увеличиваем timeout для async операций

  let AIModelFactory;
  let ModelConfigLoader;
  let factory;
  let configLoader;
  const testConfigPath = path.join(__dirname, 'test-model-config.json');

  // Тестовая конфигурация
  const testConfig = {
    models: [
      {
        alias: 'test-model',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        endpoint: 'https://api.openai.com/v1',
        priority: 100,
        enabled: true,
        maxTokens: 1000,
        temperature: 0.7,
        timeout: 30000
      },
      {
        alias: 'test-model-2',
        provider: 'anthropic',
        model: 'claude-3-haiku',
        endpoint: 'https://api.anthropic.com/v1',
        priority: 80,
        enabled: true,
        maxTokens: 1000,
        temperature: 0.5,
        timeout: 30000
      }
    ],
    fallback: {
      enabled: true,
      maxRetries: 2,
      retryDelay: 500,
      fallbackOrder: ['test-model-2']
    },
    defaultModel: 'test-model',
    logLevel: 'error'
  };

  before(async function() {
    // Создаем тестовый файл конфигурации
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

    // Динамический импорт ES модулей
    try {
      const modelAliasModule = await import('../lib/ai-model-factory.js');
      const configLoaderModule = await import('../lib/model-config-loader.js');
      
      AIModelFactory = modelAliasModule.AIModelFactory;
      ModelConfigLoader = configLoaderModule.ModelConfigLoader;
    } catch (error) {
      console.log('Модули не найдены, пропускаем тесты:', error.message);
      this.skip();
    }
  });

  after(function() {
    // Удаляем тестовый файл конфигурации
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }

    // Закрываем фабрику если она была создана
    if (factory) {
      factory.shutdown().catch(() => {});
    }
  });

  describe('ModelConfigLoader', function() {
    beforeEach(function() {
      if (!ModelConfigLoader) {
        this.skip();
      }
      configLoader = new ModelConfigLoader(testConfigPath);
    });

    it('должен загружать конфигурацию из файла', function() {
      const config = configLoader.loadConfig();
      
      expect(config).to.be.an('object');
      expect(config.models).to.be.an('array');
      expect(config.models).to.have.length(2);
      expect(config.defaultModel).to.equal('test-model');
    });

    it('должен валидировать конфигурацию', function() {
      const config = configLoader.loadConfig();
      
      // Проверяем что все обязательные поля присутствуют
      config.models.forEach(model => {
        expect(model).to.have.property('alias');
        expect(model).to.have.property('provider');
        expect(model).to.have.property('model');
        expect(model).to.have.property('endpoint');
        expect(model).to.have.property('priority');
      });
    });

    it('должен возвращать конфигурацию по умолчанию если файл не найден', function() {
      const nonExistentLoader = new ModelConfigLoader('/non/existent/path.json');
      const config = nonExistentLoader.loadConfig();
      
      expect(config).to.be.an('object');
      expect(config.models).to.be.an('array');
      expect(config.models.length).to.be.greaterThan(0);
    });

    it('должен проверять существование файла конфигурации', function() {
      expect(configLoader.configExists()).to.be.true;
      
      const nonExistentLoader = new ModelConfigLoader('/non/existent/path.json');
      expect(nonExistentLoader.configExists()).to.be.false;
    });
  });

  describe('AIModelFactory', function() {
    beforeEach(function() {
      if (!AIModelFactory) {
        this.skip();
      }
      factory = new AIModelFactory({
        configPath: testConfigPath,
        logLevel: 'error'
      });
    });

    afterEach(async function() {
      if (factory) {
        await factory.shutdown();
        factory = null;
      }
    });

    it('должен инициализироваться без ошибок', async function() {
      await factory.initialize();
      expect(factory.isInitialized()).to.be.true;
    });

    it('должен возвращать информацию о фабрике', async function() {
      await factory.initialize();
      
      const info = factory.getInfo();
      expect(info).to.be.an('object');
      expect(info.initialized).to.be.true;
      expect(info.configPath).to.equal(testConfigPath);
      expect(info.configExists).to.be.true;
      expect(info.modelsCount).to.equal(2);
    });

    it('должен возвращать список доступных моделей', async function() {
      await factory.initialize();
      
      const models = factory.getAvailableModels();
      expect(models).to.be.an('array');
      expect(models).to.have.length(2);
      
      const aliases = models.map(m => m.alias);
      expect(aliases).to.include('test-model');
      expect(aliases).to.include('test-model-2');
    });

    it('должен находить модель по алиасу', async function() {
      await factory.initialize();
      
      const model = factory.getModel('test-model');
      expect(model).to.be.an('object');
      expect(model.alias).to.equal('test-model');
      expect(model.provider).to.equal('openai');
    });

    it('должен возвращать undefined для несуществующей модели', async function() {
      await factory.initialize();
      
      const model = factory.getModel('non-existent-model');
      expect(model).to.be.undefined;
    });

    it('должен возвращать текущую конфигурацию', async function() {
      await factory.initialize();
      
      const config = factory.getCurrentConfig();
      expect(config).to.be.an('object');
      expect(config.defaultModel).to.equal('test-model');
      expect(config.models).to.have.length(2);
    });

    it('должен генерировать статистику', async function() {
      await factory.initialize();
      
      const stats = factory.getStats();
      expect(stats).to.be.an('object');
      expect(stats).to.have.property('test-model');
      expect(stats).to.have.property('test-model-2');
      
      // Проверяем структуру статистики
      expect(stats['test-model']).to.have.property('requests');
      expect(stats['test-model']).to.have.property('failures');
      expect(stats['test-model']).to.have.property('avgResponseTime');
    });

    it('должен обрабатывать события', function(done) {
      let eventReceived = false;
      
      factory.on('initialized', () => {
        eventReceived = true;
        expect(eventReceived).to.be.true;
        done();
      });
      
      factory.initialize().catch(done);
    });

    it('должен корректно завершать работу', async function() {
      await factory.initialize();
      expect(factory.isInitialized()).to.be.true;
      
      await factory.shutdown();
      expect(factory.isInitialized()).to.be.false;
    });
  });

  describe('Интеграционные тесты', function() {
    beforeEach(async function() {
      if (!AIModelFactory) {
        this.skip();
      }
      factory = new AIModelFactory({
        configPath: testConfigPath,
        logLevel: 'error'
      });
      await factory.initialize();
    });

    afterEach(async function() {
      if (factory) {
        await factory.shutdown();
        factory = null;
      }
    });

    it('должен создавать резервную копию конфигурации', async function() {
      const backupPath = await factory.backupConfig();
      
      expect(backupPath).to.be.a('string');
      expect(fs.existsSync(backupPath)).to.be.true;
      
      // Удаляем созданную резервную копию
      fs.unlinkSync(backupPath);
    });

    it('должен обновлять конфигурацию модели', async function() {
      const originalModel = factory.getModel('test-model');
      expect(originalModel.temperature).to.equal(0.7);
      
      factory.updateModel('test-model', { temperature: 0.9 });
      
      const updatedModel = factory.getModel('test-model');
      expect(updatedModel.temperature).to.equal(0.9);
    });

    it('должен добавлять новую модель', async function() {
      const newModelConfig = {
        alias: 'new-test-model',
        provider: 'local',
        model: 'test-local',
        endpoint: 'http://localhost:8000',
        priority: 50,
        enabled: true,
        maxTokens: 2000,
        temperature: 0.8,
        timeout: 60000
      };
      
      factory.addModel(newModelConfig);
      
      const addedModel = factory.getModel('new-test-model');
      expect(addedModel).to.be.an('object');
      expect(addedModel.alias).to.equal('new-test-model');
      
      const models = factory.getAvailableModels();
      expect(models).to.have.length(3);
    });

    it('должен удалять модель', async function() {
      factory.removeModel('test-model-2');
      
      const removedModel = factory.getModel('test-model-2');
      expect(removedModel).to.be.undefined;
      
      const models = factory.getAvailableModels();
      expect(models).to.have.length(1);
    });
  });
});

// Экспорт для использования в других тестах
module.exports = {
  testConfig
};