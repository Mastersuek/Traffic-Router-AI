import { EventEmitter } from 'events'
import winston from 'winston'
import { ModelAliasManager, type AliasSystemConfig, type ModelRequest, type ModelResponse } from './model-alias-manager'
import { ModelConfigLoader } from './model-config-loader'
import { ExternalAIIntegrator, type IntelligentRoutingConfig } from './external-ai-integrator'
import fs from 'fs/promises'
import path from 'path'

export interface AIModelFactoryConfig {
  configPath?: string
  externalAIConfigPath?: string
  enableConfigWatch?: boolean
  enableIntelligentRouting?: boolean
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
}

export class AIModelFactory extends EventEmitter {
  private configLoader: ModelConfigLoader
  private aliasManager: ModelAliasManager | null = null
  private externalAIIntegrator: ExternalAIIntegrator | null = null
  private logger: winston.Logger
  private initialized: boolean = false
  private externalAIConfigPath: string
  private enableIntelligentRouting: boolean

  constructor(config: AIModelFactoryConfig = {}) {
    super()

    this.configLoader = new ModelConfigLoader(config.configPath)
    this.externalAIConfigPath = config.externalAIConfigPath || 'config/external-ai-config.json'
    this.enableIntelligentRouting = config.enableIntelligentRouting ?? true
    
    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
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
        })
      ]
    })

    // Настройка слушателей событий конфигурации
    this.setupConfigListeners()

    // Включение отслеживания изменений конфигурации если запрошено
    if (config.enableConfigWatch) {
      this.configLoader.enableConfigWatch()
    }
  }

  // Инициализация фабрики
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AI Model Factory...')
      
      const config = this.configLoader.loadConfig()
      this.aliasManager = new ModelAliasManager(config)
      
      // Проброс событий от менеджера алиасов
      this.setupAliasManagerListeners()

      // Инициализация интеграции с внешними AI системами
      if (this.enableIntelligentRouting) {
        await this.initializeExternalAIIntegrator()
      }
      
      this.initialized = true
      this.logger.info('AI Model Factory initialized successfully')
      this.emit('initialized')
      
    } catch (error) {
      this.logger.error('Failed to initialize AI Model Factory:', error)
      this.emit('initializationFailed', error)
      throw error
    }
  }

  // Настройка слушателей событий конфигурации
  private setupConfigListeners(): void {
    this.configLoader.on('configChanged', (newConfig: AliasSystemConfig) => {
      this.logger.info('Configuration changed, reinitializing alias manager...')
      
      try {
        this.aliasManager = new ModelAliasManager(newConfig)
        this.setupAliasManagerListeners()
        this.emit('configReloaded', newConfig)
        this.logger.info('Successfully reloaded configuration')
      } catch (error) {
        this.logger.error('Failed to reload configuration:', error)
        this.emit('configReloadFailed', error)
      }
    })

    this.configLoader.on('configError', (error: Error) => {
      this.logger.error('Configuration error:', error)
      this.emit('configError', error)
    })
  }

  // Инициализация интеграции с внешними AI системами
  private async initializeExternalAIIntegrator(): Promise<void> {
    try {
      const externalConfig = await this.loadExternalAIConfig()
      
      if (this.aliasManager) {
        this.externalAIIntegrator = new ExternalAIIntegrator(
          this.aliasManager,
          this.configLoader,
          externalConfig.intelligentRouting,
          this.logger.level
        )

        // Настройка слушателей событий интегратора
        this.setupExternalAIIntegratorListeners()
        
        this.logger.info('External AI Integrator initialized successfully')
      }
    } catch (error) {
      this.logger.warn('Failed to initialize External AI Integrator:', error)
      // Продолжаем работу без интеллектуальной маршрутизации
    }
  }

  // Загрузка конфигурации внешних AI систем
  private async loadExternalAIConfig(): Promise<any> {
    try {
      const configData = await fs.readFile(this.externalAIConfigPath, 'utf-8')
      return JSON.parse(configData)
    } catch (error) {
      this.logger.warn(`Failed to load external AI config from ${this.externalAIConfigPath}:`, error)
      // Возвращаем конфигурацию по умолчанию
      return {
        intelligentRouting: {
          preferredProviders: ['groq', 'together', 'google'],
          costOptimization: true,
          latencyOptimization: true,
          reliabilityThreshold: 75,
          loadBalancing: true,
          circuitBreaker: {
            enabled: true,
            failureThreshold: 50,
            recoveryTimeout: 300000
          }
        }
      }
    }
  }

  // Настройка слушателей событий интегратора внешних AI
  private setupExternalAIIntegratorListeners(): void {
    if (!this.externalAIIntegrator) return

    this.externalAIIntegrator.on('routingSuccess', (data) => {
      this.emit('intelligentRoutingSuccess', data)
    })

    this.externalAIIntegrator.on('routingFailed', (data) => {
      this.emit('intelligentRoutingFailed', data)
    })

    this.externalAIIntegrator.on('circuitBreakerOpened', (data) => {
      this.emit('circuitBreakerOpened', data)
    })

    this.externalAIIntegrator.on('providerUnavailable', (data) => {
      this.emit('providerUnavailable', data)
    })

    this.externalAIIntegrator.on('rateLimitExceeded', (data) => {
      this.emit('rateLimitExceeded', data)
    })
  }

  // Настройка слушателей событий менеджера алиасов
  private setupAliasManagerListeners(): void {
    if (!this.aliasManager) return

    this.aliasManager.on('requestSuccess', (data) => {
      this.emit('requestSuccess', data)
    })

    this.aliasManager.on('requestFailed', (data) => {
      this.emit('requestFailed', data)
    })

    this.aliasManager.on('fallbackSuccess', (data) => {
      this.emit('fallbackSuccess', data)
    })

    this.aliasManager.on('fallbackFailed', (data) => {
      this.emit('fallbackFailed', data)
    })
  }

  // Проверка инициализации
  private ensureInitialized(): void {
    if (!this.initialized || !this.aliasManager) {
      throw new Error('AI Model Factory not initialized. Call initialize() first.')
    }
  }

  // Отправка запроса к модели
  async sendRequest(modelAlias: string, request: ModelRequest): Promise<ModelResponse> {
    this.ensureInitialized()
    
    // Использование интеллектуальной маршрутизации если доступна
    if (this.externalAIIntegrator && this.enableIntelligentRouting) {
      return await this.externalAIIntegrator.intelligentRoute(request, modelAlias)
    }
    
    return await this.aliasManager!.sendRequest(modelAlias, request)
  }

  // Отправка запроса к модели по умолчанию
  async sendDefaultRequest(request: ModelRequest): Promise<ModelResponse> {
    this.ensureInitialized()
    
    // Использование интеллектуальной маршрутизации если доступна
    if (this.externalAIIntegrator && this.enableIntelligentRouting) {
      return await this.externalAIIntegrator.intelligentRoute(request)
    }
    
    const config = this.configLoader.loadConfig()
    return await this.aliasManager!.sendRequest(config.defaultModel, request)
  }

  // Отправка запроса с интеллектуальной маршрутизацией
  async sendIntelligentRequest(request: ModelRequest, preferredModel?: string): Promise<ModelResponse> {
    this.ensureInitialized()
    
    if (!this.externalAIIntegrator) {
      throw new Error('Intelligent routing not available. External AI Integrator not initialized.')
    }
    
    return await this.externalAIIntegrator.intelligentRoute(request, preferredModel)
  }

  // Получение доступных моделей
  getAvailableModels() {
    this.ensureInitialized()
    return this.aliasManager!.getAvailableModels()
  }

  // Получение модели по алиасу
  getModel(alias: string) {
    this.ensureInitialized()
    return this.aliasManager!.getModel(alias)
  }

  // Проверка здоровья модели
  async healthCheck(alias: string): Promise<boolean> {
    this.ensureInitialized()
    return await this.aliasManager!.healthCheck(alias)
  }

  // Проверка здоровья всех моделей
  async healthCheckAll(): Promise<{ [alias: string]: boolean }> {
    this.ensureInitialized()
    
    const models = this.aliasManager!.getAvailableModels()
    const results: { [alias: string]: boolean } = {}
    
    const healthChecks = models.map(async (model) => {
      try {
        results[model.alias] = await this.aliasManager!.healthCheck(model.alias)
      } catch (error) {
        this.logger.warn(`Health check failed for ${model.alias}:`, error)
        results[model.alias] = false
      }
    })
    
    await Promise.all(healthChecks)
    return results
  }

  // Получение статистики
  getStats() {
    this.ensureInitialized()
    return this.aliasManager!.getStats()
  }

  // Добавление новой модели
  addModel(config: any): void {
    this.ensureInitialized()
    this.aliasManager!.addModel(config)
  }

  // Обновление модели
  updateModel(alias: string, config: any): void {
    this.ensureInitialized()
    this.aliasManager!.updateModel(alias, config)
  }

  // Удаление модели
  removeModel(alias: string): void {
    this.ensureInitialized()
    this.aliasManager!.removeModel(alias)
  }

  // Сохранение текущей конфигурации
  async saveConfig(): Promise<void> {
    this.ensureInitialized()
    const config = this.configLoader.loadConfig()
    await this.configLoader.saveConfig(config)
  }

  // Создание резервной копии конфигурации
  async backupConfig(): Promise<string> {
    return await this.configLoader.backupConfig()
  }

  // Восстановление конфигурации
  async restoreConfig(backupPath: string): Promise<void> {
    await this.configLoader.restoreConfig(backupPath)
    // Перезагрузка после восстановления
    await this.initialize()
  }

  // Получение текущей конфигурации
  getCurrentConfig(): AliasSystemConfig {
    return this.configLoader.loadConfig()
  }

  // Обновление конфигурации
  async updateConfig(newConfig: AliasSystemConfig): Promise<void> {
    await this.configLoader.saveConfig(newConfig)
    // Конфигурация автоматически перезагрузится через watcher
  }

  // Включение отслеживания конфигурации
  enableConfigWatch(): void {
    this.configLoader.enableConfigWatch()
  }

  // Отключение отслеживания конфигурации
  disableConfigWatch(): void {
    this.configLoader.disableConfigWatch()
  }

  // Проверка инициализации
  isInitialized(): boolean {
    return this.initialized
  }

  // Получение статистики внешних AI провайдеров
  getExternalAIStats() {
    if (!this.externalAIIntegrator) {
      return null
    }
    return this.externalAIIntegrator.getProviderStats()
  }

  // Получение рекомендаций по оптимизации
  getOptimizationRecommendations(): string[] {
    if (!this.externalAIIntegrator) {
      return ['External AI Integrator not available']
    }
    return this.externalAIIntegrator.getOptimizationRecommendations()
  }

  // Проверка здоровья внешних провайдеров
  async healthCheckExternalProviders(): Promise<{ [provider: string]: boolean }> {
    if (!this.externalAIIntegrator) {
      return {}
    }
    return await this.externalAIIntegrator.healthCheckAll()
  }

  // Сброс метрик провайдера
  resetProviderMetrics(provider: string): void {
    if (this.externalAIIntegrator) {
      this.externalAIIntegrator.resetProviderMetrics(provider)
    }
  }

  // Обновление конфигурации интеллектуальной маршрутизации
  updateIntelligentRoutingConfig(config: Partial<IntelligentRoutingConfig>): void {
    if (this.externalAIIntegrator) {
      this.externalAIIntegrator.updateRoutingConfig(config)
    }
  }

  // Включение/отключение интеллектуальной маршрутизации
  setIntelligentRouting(enabled: boolean): void {
    this.enableIntelligentRouting = enabled
    this.logger.info(`Intelligent routing ${enabled ? 'enabled' : 'disabled'}`)
  }

  // Получение информации о фабрике
  getInfo() {
    return {
      initialized: this.initialized,
      configPath: this.configLoader.getConfigPath(),
      externalAIConfigPath: this.externalAIConfigPath,
      configExists: this.configLoader.configExists(),
      modelsCount: this.initialized ? this.aliasManager!.getAvailableModels().length : 0,
      intelligentRoutingEnabled: this.enableIntelligentRouting,
      externalAIIntegratorAvailable: this.externalAIIntegrator !== null
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down AI Model Factory...')
    
    this.disableConfigWatch()
    this.removeAllListeners()
    
    if (this.aliasManager) {
      this.aliasManager.removeAllListeners()
    }

    if (this.externalAIIntegrator) {
      this.externalAIIntegrator.removeAllListeners()
    }
    
    this.initialized = false
    this.logger.info('AI Model Factory shutdown completed')
  }
}