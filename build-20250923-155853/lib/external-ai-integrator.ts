import { EventEmitter } from 'events'
import { ModelAliasManager, ModelAliasConfig, ModelRequest, ModelResponse } from './model-alias-manager'
import { ModelConfigLoader } from './model-config-loader'
import winston from 'winston'
import { getErrorMessage } from './error-utils'

// Интерфейсы для интеграции с внешними AI системами
export interface ExternalAIProvider {
  name: string
  type: 'api' | 'local' | 'proxy'
  healthEndpoint?: string
  capabilities: string[]
  costTier: 'free' | 'low' | 'medium' | 'high'
  latencyTier: 'fast' | 'medium' | 'slow'
  reliabilityScore: number // 0-100
}

export interface IntelligentRoutingConfig {
  preferredProviders: string[]
  costOptimization: boolean
  latencyOptimization: boolean
  reliabilityThreshold: number
  loadBalancing: boolean
  circuitBreaker: {
    enabled: boolean
    failureThreshold: number
    recoveryTimeout: number
  }
}

export interface ProviderMetrics {
  requestCount: number
  successCount: number
  failureCount: number
  avgLatency: number
  lastFailure?: Date
  circuitBreakerOpen: boolean
  circuitBreakerOpenUntil?: Date
}

// Основной класс для интеграции с внешними AI системами
export class ExternalAIIntegrator extends EventEmitter {
  private modelManager: ModelAliasManager
  private configLoader: ModelConfigLoader
  private logger: winston.Logger
  private routingConfig: IntelligentRoutingConfig
  private providers: Map<string, ExternalAIProvider> = new Map()
  private metrics: Map<string, ProviderMetrics> = new Map()

  constructor(
    modelManager: ModelAliasManager,
    configLoader: ModelConfigLoader,
    routingConfig: IntelligentRoutingConfig,
    logLevel: string = 'info'
  ) {
    super()
    
    this.modelManager = modelManager
    this.configLoader = configLoader
    this.routingConfig = routingConfig
    
    // Настройка логирования
    this.logger = winston.createLogger({
      level: logLevel,
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

    this.initializeProviders()
    this.setupEventHandlers()
    
    this.logger.info('ExternalAIIntegrator initialized')
  }

  // Инициализация провайдеров
  private initializeProviders(): void {
    // OpenAI
    this.providers.set('openai', {
      name: 'OpenAI',
      type: 'api',
      healthEndpoint: 'https://api.openai.com/v1/models',
      capabilities: ['chat', 'completion', 'embedding', 'image'],
      costTier: 'medium',
      latencyTier: 'fast',
      reliabilityScore: 95
    })

    // Anthropic
    this.providers.set('anthropic', {
      name: 'Anthropic Claude',
      type: 'api',
      capabilities: ['chat', 'completion'],
      costTier: 'medium',
      latencyTier: 'fast',
      reliabilityScore: 93
    })

    // Google AI
    this.providers.set('google', {
      name: 'Google AI',
      type: 'api',
      healthEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      capabilities: ['chat', 'completion', 'embedding'],
      costTier: 'low',
      latencyTier: 'medium',
      reliabilityScore: 90
    })

    // Together AI
    this.providers.set('together', {
      name: 'Together AI',
      type: 'api',
      healthEndpoint: 'https://api.together.xyz/models',
      capabilities: ['chat', 'completion'],
      costTier: 'low',
      latencyTier: 'fast',
      reliabilityScore: 85
    })

    // Groq
    this.providers.set('groq', {
      name: 'Groq',
      type: 'api',
      capabilities: ['chat', 'completion'],
      costTier: 'free',
      latencyTier: 'fast',
      reliabilityScore: 80
    })

    // Cohere
    this.providers.set('cohere', {
      name: 'Cohere',
      type: 'api',
      capabilities: ['chat', 'completion', 'embedding'],
      costTier: 'medium',
      latencyTier: 'medium',
      reliabilityScore: 88
    })

    // HuggingFace
    this.providers.set('huggingface', {
      name: 'HuggingFace',
      type: 'api',
      capabilities: ['chat', 'completion', 'embedding'],
      costTier: 'free',
      latencyTier: 'slow',
      reliabilityScore: 75
    })

    // Replicate
    this.providers.set('replicate', {
      name: 'Replicate',
      type: 'api',
      capabilities: ['chat', 'completion', 'image'],
      costTier: 'low',
      latencyTier: 'slow',
      reliabilityScore: 82
    })

    // Ollama (Local)
    this.providers.set('ollama', {
      name: 'Ollama',
      type: 'local',
      healthEndpoint: 'http://localhost:11434/api/tags',
      capabilities: ['chat', 'completion'],
      costTier: 'free',
      latencyTier: 'medium',
      reliabilityScore: 70
    })

    // Инициализация метрик для всех провайдеров
    for (const [providerId] of this.providers) {
      this.metrics.set(providerId, {
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        avgLatency: 0,
        circuitBreakerOpen: false
      })
    }
  }

  // Настройка обработчиков событий
  private setupEventHandlers(): void {
    this.modelManager.on('requestSuccess', (data) => {
      this.updateMetrics(data.provider, true, data.latency || 0)
    })

    this.modelManager.on('requestFailed', (data) => {
      this.updateMetrics(data.provider, false, 0)
      this.handleProviderFailure(data.provider, data.error)
    })

    this.modelManager.on('fallbackSuccess', (data) => {
      this.logger.info(`Intelligent routing fallback successful: ${data.originalModel} -> ${data.fallbackModel}`)
    })
  }

  // Интеллектуальная маршрутизация запросов
  async intelligentRoute(request: ModelRequest, preferredModel?: string): Promise<ModelResponse> {
    const startTime = Date.now()
    
    try {
      // Получение оптимальной модели
      const selectedModel = await this.selectOptimalModel(request, preferredModel)
      
      this.logger.info(`Intelligent routing selected model: ${selectedModel}`)
      
      // Отправка запроса
      const response = await this.modelManager.sendRequest(selectedModel, request)
      
      const latency = Date.now() - startTime
      this.emit('routingSuccess', { 
        selectedModel, 
        latency, 
        request: this.sanitizeRequest(request) 
      })
      
      return response
      
    } catch (error) {
      const latency = Date.now() - startTime
      this.logger.error('Intelligent routing failed:', error)
      
      this.emit('routingFailed', { 
        error: getErrorMessage(error), 
        latency,
        request: this.sanitizeRequest(request)
      })
      
      throw error
    }
  }

  // Выбор оптимальной модели на основе различных критериев
  private async selectOptimalModel(request: ModelRequest, preferredModel?: string): Promise<string> {
    const availableModels = this.modelManager.getAvailableModels()
    
    // Если указана предпочтительная модель и она доступна
    if (preferredModel) {
      const model = availableModels.find(m => m.alias === preferredModel)
      if (model && this.isModelHealthy(model.provider)) {
        return preferredModel
      }
    }

    // Фильтрация здоровых моделей
    const healthyModels = availableModels.filter(model => 
      this.isModelHealthy(model.provider)
    )

    if (healthyModels.length === 0) {
      throw new Error('No healthy models available')
    }

    // Сортировка по различным критериям
    const scoredModels = healthyModels.map(model => ({
      model,
      score: this.calculateModelScore(model, request)
    }))

    // Сортировка по убыванию оценки
    scoredModels.sort((a, b) => b.score - a.score)

    // Балансировка нагрузки между топ моделями
    if (this.routingConfig.loadBalancing && scoredModels.length > 1) {
      const topModels = scoredModels.slice(0, Math.min(3, scoredModels.length))
      const randomIndex = Math.floor(Math.random() * topModels.length)
      return topModels[randomIndex].model.alias
    }

    return scoredModels[0].model.alias
  }

  // Расчет оценки модели для конкретного запроса
  private calculateModelScore(model: ModelAliasConfig, request: ModelRequest): number {
    const provider = this.providers.get(model.provider)
    const metrics = this.metrics.get(model.provider)
    
    if (!provider || !metrics) {
      return 0
    }

    let score = model.priority // Базовая оценка из приоритета

    // Надежность
    const successRate = metrics.requestCount > 0 
      ? (metrics.successCount / metrics.requestCount) * 100 
      : provider.reliabilityScore
    score += successRate * 0.3

    // Оптимизация по стоимости
    if (this.routingConfig.costOptimization) {
      const costBonus = {
        'free': 30,
        'low': 20,
        'medium': 10,
        'high': 0
      }[provider.costTier]
      score += costBonus
    }

    // Оптимизация по латентности
    if (this.routingConfig.latencyOptimization) {
      const latencyBonus = {
        'fast': 25,
        'medium': 15,
        'slow': 5
      }[provider.latencyTier]
      score += latencyBonus
    }

    // Штраф за недавние ошибки
    if (metrics.lastFailure) {
      const timeSinceFailure = Date.now() - metrics.lastFailure.getTime()
      const hoursSinceFailure = timeSinceFailure / (1000 * 60 * 60)
      if (hoursSinceFailure < 1) {
        score -= 20 // Штраф за недавние ошибки
      }
    }

    // Бонус за предпочтительных провайдеров
    if (this.routingConfig.preferredProviders.includes(model.provider)) {
      score += 15
    }

    return Math.max(0, score)
  }

  // Проверка здоровья модели
  private isModelHealthy(provider: string): boolean {
    const metrics = this.metrics.get(provider)
    if (!metrics) return false

    // Проверка circuit breaker
    if (metrics.circuitBreakerOpen) {
      if (metrics.circuitBreakerOpenUntil && Date.now() > metrics.circuitBreakerOpenUntil.getTime()) {
        // Время восстановления истекло, сбрасываем circuit breaker
        metrics.circuitBreakerOpen = false
        metrics.circuitBreakerOpenUntil = undefined
        this.logger.info(`Circuit breaker reset for provider: ${provider}`)
      } else {
        return false
      }
    }

    // Проверка порога надежности
    if (metrics.requestCount > 10) {
      const successRate = (metrics.successCount / metrics.requestCount) * 100
      return successRate >= this.routingConfig.reliabilityThreshold
    }

    return true
  }

  // Обновление метрик провайдера
  private updateMetrics(provider: string, success: boolean, latency: number): void {
    const metrics = this.metrics.get(provider)
    if (!metrics) return

    metrics.requestCount++
    
    if (success) {
      metrics.successCount++
      // Обновление средней латентности
      metrics.avgLatency = (metrics.avgLatency * (metrics.successCount - 1) + latency) / metrics.successCount
    } else {
      metrics.failureCount++
      metrics.lastFailure = new Date()
    }

    // Проверка circuit breaker
    if (this.routingConfig.circuitBreaker.enabled && metrics.requestCount >= 10) {
      const failureRate = (metrics.failureCount / metrics.requestCount) * 100
      if (failureRate >= this.routingConfig.circuitBreaker.failureThreshold && !metrics.circuitBreakerOpen) {
        metrics.circuitBreakerOpen = true
        metrics.circuitBreakerOpenUntil = new Date(Date.now() + this.routingConfig.circuitBreaker.recoveryTimeout)
        this.logger.warn(`Circuit breaker opened for provider: ${provider} (failure rate: ${failureRate}%)`)
        this.emit('circuitBreakerOpened', { provider, failureRate })
      }
    }
  }

  // Обработка ошибки провайдера
  private handleProviderFailure(provider: string, error: any): void {
    this.logger.warn(`Provider ${provider} failed:`, error)
    
    // Дополнительная логика обработки ошибок
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      this.emit('providerUnavailable', { provider, error: error.message })
    } else if (error.response?.status === 429) {
      this.emit('rateLimitExceeded', { provider, error: error.message })
    } else if (error.response?.status >= 500) {
      this.emit('serverError', { provider, status: error.response.status })
    }
  }

  // Получение статистики провайдеров
  getProviderStats(): { [provider: string]: ProviderMetrics & { provider: ExternalAIProvider } } {
    const stats: { [provider: string]: ProviderMetrics & { provider: ExternalAIProvider } } = {}
    
    for (const [providerId, metrics] of this.metrics) {
      const provider = this.providers.get(providerId)
      if (provider) {
        stats[providerId] = {
          ...metrics,
          provider
        }
      }
    }
    
    return stats
  }

  // Проверка здоровья всех провайдеров
  async healthCheckAll(): Promise<{ [provider: string]: boolean }> {
    const results: { [provider: string]: boolean } = {}
    
    for (const [providerId] of this.providers) {
      try {
        results[providerId] = await this.modelManager.healthCheck(
          this.modelManager.getAvailableModels()
            .find(m => m.provider === providerId)?.alias || ''
        )
      } catch (error) {
        results[providerId] = false
      }
    }
    
    return results
  }

  // Сброс метрик провайдера
  resetProviderMetrics(provider: string): void {
    const metrics = this.metrics.get(provider)
    if (metrics) {
      metrics.requestCount = 0
      metrics.successCount = 0
      metrics.failureCount = 0
      metrics.avgLatency = 0
      metrics.lastFailure = undefined
      metrics.circuitBreakerOpen = false
      metrics.circuitBreakerOpenUntil = undefined
      
      this.logger.info(`Reset metrics for provider: ${provider}`)
    }
  }

  // Обновление конфигурации маршрутизации
  updateRoutingConfig(config: Partial<IntelligentRoutingConfig>): void {
    this.routingConfig = { ...this.routingConfig, ...config }
    this.logger.info('Routing configuration updated')
    this.emit('configUpdated', this.routingConfig)
  }

  // Получение рекомендаций по оптимизации
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = []
    const stats = this.getProviderStats()
    
    // Анализ производительности провайдеров
    for (const [providerId, stat] of Object.entries(stats)) {
      if (stat.requestCount > 50) {
        const successRate = (stat.successCount / stat.requestCount) * 100
        
        if (successRate < 80) {
          recommendations.push(`Consider disabling ${providerId} due to low success rate (${successRate.toFixed(1)}%)`)
        }
        
        if (stat.avgLatency > 10000) {
          recommendations.push(`${providerId} has high latency (${stat.avgLatency}ms), consider deprioritizing`)
        }
      }
    }
    
    // Рекомендации по конфигурации
    if (!this.routingConfig.costOptimization) {
      recommendations.push('Enable cost optimization to prefer free/low-cost providers')
    }
    
    if (!this.routingConfig.loadBalancing) {
      recommendations.push('Enable load balancing to distribute requests across multiple providers')
    }
    
    return recommendations
  }

  // Очистка чувствительных данных из запроса для логирования
  private sanitizeRequest(request: ModelRequest): any {
    return {
      messageCount: request.messages.length,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      stream: request.stream
    }
  }
}