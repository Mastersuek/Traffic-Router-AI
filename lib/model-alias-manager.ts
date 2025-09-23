import { EventEmitter } from 'events'
import axios, { AxiosResponse } from 'axios'
import winston from 'winston'

// Интерфейсы для системы алиасов моделей
export interface ModelAliasConfig {
  alias: string
  provider: 'openai' | 'anthropic' | 'google' | 'local' | 'ollama' | 'huggingface' | 'together' | 'groq' | 'cohere' | 'replicate'
  model: string
  endpoint: string
  apiKey?: string
  priority: number
  enabled: boolean
  maxTokens?: number
  temperature?: number
  timeout?: number
  headers?: Record<string, string>
  retryConfig?: {
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
  }
}

export interface ModelRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface ModelResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  provider: string
}

export interface FallbackConfig {
  enabled: boolean
  maxRetries: number
  retryDelay: number
  fallbackOrder: string[]
}

// Конфигурация системы алиасов
export interface AliasSystemConfig {
  models: ModelAliasConfig[]
  fallback: FallbackConfig
  defaultModel: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export class ModelAliasManager extends EventEmitter {
  private models: Map<string, ModelAliasConfig> = new Map()
  private fallbackConfig: FallbackConfig
  private defaultModel: string
  private logger: winston.Logger

  constructor(config: AliasSystemConfig) {
    super()
    
    this.fallbackConfig = config.fallback
    this.defaultModel = config.defaultModel
    
    // Настройка логирования
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

    // Загрузка моделей
    this.loadModels(config.models)
    
    this.logger.info(`ModelAliasManager initialized with ${this.models.size} models`)
  }

  // Загрузка конфигурации моделей
  private loadModels(modelConfigs: ModelAliasConfig[]): void {
    this.models.clear()
    
    for (const config of modelConfigs) {
      if (config.enabled) {
        this.models.set(config.alias, config)
        this.logger.debug(`Loaded model alias: ${config.alias} -> ${config.provider}:${config.model}`)
      }
    }
  }

  // Получение модели по алиасу
  getModel(alias: string): ModelAliasConfig | undefined {
    return this.models.get(alias)
  }

  // Получение всех доступных моделей
  getAvailableModels(): ModelAliasConfig[] {
    return Array.from(this.models.values()).sort((a, b) => b.priority - a.priority)
  }

  // Основной метод для отправки запроса к модели
  async sendRequest(
    modelAlias: string, 
    request: ModelRequest
  ): Promise<ModelResponse> {
    const model = this.getModel(modelAlias)
    
    if (!model) {
      throw new Error(`Model alias '${modelAlias}' not found`)
    }

    try {
      this.logger.info(`Sending request to model: ${modelAlias} (${model.provider}:${model.model})`)
      const response = await this.callModel(model, request)
      
      this.emit('requestSuccess', { model: modelAlias, provider: model.provider })
      return response
      
    } catch (error) {
      this.logger.error(`Request failed for model ${modelAlias}:`, error)
      this.emit('requestFailed', { model: modelAlias, provider: model.provider, error })
      
      // Попытка fallback если включен
      if (this.fallbackConfig.enabled) {
        return await this.handleFallback(modelAlias, request, error as Error)
      }
      
      throw error
    }
  }

  // Обработка fallback логики
  private async handleFallback(
    originalModel: string, 
    request: ModelRequest, 
    originalError: Error
  ): Promise<ModelResponse> {
    this.logger.warn(`Attempting fallback for failed model: ${originalModel}`)
    
    const fallbackModels = this.getFallbackModels(originalModel)
    
    for (let i = 0; i < fallbackModels.length && i < this.fallbackConfig.maxRetries; i++) {
      const fallbackModel = fallbackModels[i]
      
      try {
        // Задержка перед повторной попыткой
        if (i > 0) {
          await this.delay(this.fallbackConfig.retryDelay * i)
        }
        
        this.logger.info(`Trying fallback model: ${fallbackModel.alias}`)
        const response = await this.callModel(fallbackModel, request)
        
        this.emit('fallbackSuccess', { 
          originalModel, 
          fallbackModel: fallbackModel.alias,
          attempt: i + 1 
        })
        
        return response
        
      } catch (error) {
        this.logger.warn(`Fallback model ${fallbackModel.alias} also failed:`, error)
        this.emit('fallbackFailed', { 
          originalModel, 
          fallbackModel: fallbackModel.alias, 
          attempt: i + 1, 
          error 
        })
      }
    }
    
    // Если все fallback модели не сработали
    throw new Error(`All fallback attempts failed. Original error: ${originalError.message}`)
  }

  // Получение списка fallback моделей
  private getFallbackModels(excludeModel: string): ModelAliasConfig[] {
    const availableModels = this.getAvailableModels()
      .filter(model => model.alias !== excludeModel)
    
    // Если указан порядок fallback, используем его
    if (this.fallbackConfig.fallbackOrder.length > 0) {
      const orderedModels: ModelAliasConfig[] = []
      
      for (const alias of this.fallbackConfig.fallbackOrder) {
        const model = availableModels.find(m => m.alias === alias)
        if (model) {
          orderedModels.push(model)
        }
      }
      
      // Добавляем оставшиеся модели по приоритету
      const remainingModels = availableModels.filter(
        model => !this.fallbackConfig.fallbackOrder.includes(model.alias)
      )
      
      return [...orderedModels, ...remainingModels]
    }
    
    // Иначе используем сортировку по приоритету
    return availableModels
  }

  // Вызов конкретной модели
  private async callModel(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const retryConfig = model.retryConfig || { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 }
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        switch (model.provider) {
          case 'openai':
            return await this.callOpenAI(model, request)
          case 'anthropic':
            return await this.callAnthropic(model, request)
          case 'google':
            return await this.callGoogle(model, request)
          case 'huggingface':
            return await this.callHuggingFace(model, request)
          case 'together':
            return await this.callTogether(model, request)
          case 'groq':
            return await this.callGroq(model, request)
          case 'cohere':
            return await this.callCohere(model, request)
          case 'replicate':
            return await this.callReplicate(model, request)
          case 'local':
          case 'ollama':
            return await this.callLocal(model, request)
          default:
            throw new Error(`Unsupported provider: ${model.provider}`)
        }
      } catch (error) {
        if (attempt === retryConfig.maxRetries) {
          throw error
        }
        
        const delay = retryConfig.retryDelay * Math.pow(retryConfig.backoffMultiplier, attempt)
        this.logger.warn(`Attempt ${attempt + 1} failed for ${model.alias}, retrying in ${delay}ms:`, error)
        await this.delay(delay)
      }
    }
    
    throw new Error(`All retry attempts failed for model: ${model.alias}`)
  }

  // Вызов OpenAI API
  private async callOpenAI(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const response: AxiosResponse = await axios.post(
      `${model.endpoint}/chat/completions`,
      {
        model: model.model,
        messages: request.messages,
        max_tokens: request.maxTokens || model.maxTokens || 4096,
        temperature: request.temperature || model.temperature || 0.7,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: model.timeout || 30000
      }
    )

    const choice = response.data.choices[0]
    return {
      content: choice.message.content,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens
      } : undefined,
      model: model.model,
      provider: model.provider
    }
  }

  // Вызов Anthropic API
  private async callAnthropic(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const response: AxiosResponse = await axios.post(
      `${model.endpoint}/messages`,
      {
        model: model.model,
        max_tokens: request.maxTokens || model.maxTokens || 4096,
        messages: request.messages.filter(msg => msg.role !== 'system'),
        system: request.messages.find(msg => msg.role === 'system')?.content || '',
        temperature: request.temperature || model.temperature || 0.7
      },
      {
        headers: {
          'x-api-key': model.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: model.timeout || 30000
      }
    )

    return {
      content: response.data.content[0].text,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.input_tokens,
        completionTokens: response.data.usage.output_tokens,
        totalTokens: response.data.usage.input_tokens + response.data.usage.output_tokens
      } : undefined,
      model: model.model,
      provider: model.provider
    }
  }

  // Вызов Google AI API
  private async callGoogle(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const response: AxiosResponse = await axios.post(
      `${model.endpoint}/models/${model.model}:generateContent`,
      {
        contents: request.messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
        generationConfig: {
          maxOutputTokens: request.maxTokens || model.maxTokens || 4096,
          temperature: request.temperature || model.temperature || 0.7
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: model.timeout || 30000
      }
    )

    const candidate = response.data.candidates[0]
    return {
      content: candidate.content.parts[0].text,
      usage: response.data.usageMetadata ? {
        promptTokens: response.data.usageMetadata.promptTokenCount,
        completionTokens: response.data.usageMetadata.candidatesTokenCount,
        totalTokens: response.data.usageMetadata.totalTokenCount
      } : undefined,
      model: model.model,
      provider: model.provider
    }
  }

  // Вызов HuggingFace API
  private async callHuggingFace(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const response: AxiosResponse = await axios.post(
      `${model.endpoint}/models/${model.model}`,
      {
        inputs: request.messages.map(msg => msg.content).join('\n'),
        parameters: {
          max_new_tokens: request.maxTokens || model.maxTokens || 4096,
          temperature: request.temperature || model.temperature || 0.7,
          return_full_text: false
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json',
          ...model.headers
        },
        timeout: model.timeout || 30000
      }
    )

    const result = Array.isArray(response.data) ? response.data[0] : response.data
    return {
      content: result.generated_text || result.text || '',
      model: model.model,
      provider: model.provider
    }
  }

  // Вызов Together AI API
  private async callTogether(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const response: AxiosResponse = await axios.post(
      `${model.endpoint}/chat/completions`,
      {
        model: model.model,
        messages: request.messages,
        max_tokens: request.maxTokens || model.maxTokens || 4096,
        temperature: request.temperature || model.temperature || 0.7,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json',
          ...model.headers
        },
        timeout: model.timeout || 30000
      }
    )

    const choice = response.data.choices[0]
    return {
      content: choice.message.content,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens
      } : undefined,
      model: model.model,
      provider: model.provider
    }
  }

  // Вызов Groq API
  private async callGroq(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const response: AxiosResponse = await axios.post(
      `${model.endpoint}/openai/v1/chat/completions`,
      {
        model: model.model,
        messages: request.messages,
        max_tokens: request.maxTokens || model.maxTokens || 4096,
        temperature: request.temperature || model.temperature || 0.7,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json',
          ...model.headers
        },
        timeout: model.timeout || 30000
      }
    )

    const choice = response.data.choices[0]
    return {
      content: choice.message.content,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens
      } : undefined,
      model: model.model,
      provider: model.provider
    }
  }

  // Вызов Cohere API
  private async callCohere(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const response: AxiosResponse = await axios.post(
      `${model.endpoint}/v1/chat`,
      {
        model: model.model,
        message: request.messages[request.messages.length - 1].content,
        chat_history: request.messages.slice(0, -1).map(msg => ({
          role: msg.role === 'assistant' ? 'CHATBOT' : 'USER',
          message: msg.content
        })),
        max_tokens: request.maxTokens || model.maxTokens || 4096,
        temperature: request.temperature || model.temperature || 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json',
          ...model.headers
        },
        timeout: model.timeout || 30000
      }
    )

    return {
      content: response.data.text,
      usage: response.data.meta ? {
        promptTokens: response.data.meta.billed_units?.input_tokens || 0,
        completionTokens: response.data.meta.billed_units?.output_tokens || 0,
        totalTokens: (response.data.meta.billed_units?.input_tokens || 0) + (response.data.meta.billed_units?.output_tokens || 0)
      } : undefined,
      model: model.model,
      provider: model.provider
    }
  }

  // Вызов Replicate API
  private async callReplicate(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const response: AxiosResponse = await axios.post(
      `${model.endpoint}/v1/predictions`,
      {
        version: model.model,
        input: {
          prompt: request.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n'),
          max_tokens: request.maxTokens || model.maxTokens || 4096,
          temperature: request.temperature || model.temperature || 0.7
        }
      },
      {
        headers: {
          'Authorization': `Token ${model.apiKey}`,
          'Content-Type': 'application/json',
          ...model.headers
        },
        timeout: model.timeout || 60000
      }
    )

    // Replicate может требовать polling для получения результата
    let predictionId = response.data.id
    let result = response.data
    
    while (result.status === 'starting' || result.status === 'processing') {
      await this.delay(1000)
      const statusResponse = await axios.get(
        `${model.endpoint}/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Token ${model.apiKey}`,
            ...model.headers
          }
        }
      )
      result = statusResponse.data
    }

    if (result.status === 'failed') {
      throw new Error(`Replicate prediction failed: ${result.error}`)
    }

    return {
      content: Array.isArray(result.output) ? result.output.join('') : result.output,
      model: model.model,
      provider: model.provider
    }
  }

  // Вызов локальной модели (Ollama или другой local endpoint)
  private async callLocal(model: ModelAliasConfig, request: ModelRequest): Promise<ModelResponse> {
    const response: AxiosResponse = await axios.post(
      `${model.endpoint}/api/chat`,
      {
        model: model.model,
        messages: request.messages,
        options: {
          temperature: request.temperature || model.temperature || 0.7,
          num_predict: request.maxTokens || model.maxTokens || 4096
        },
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...model.headers
        },
        timeout: model.timeout || 60000 // Локальные модели могут работать медленнее
      }
    )

    return {
      content: response.data.message.content,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.prompt_tokens || 0,
        completionTokens: response.data.usage.completion_tokens || 0,
        totalTokens: response.data.usage.total_tokens || 0
      } : undefined,
      model: model.model,
      provider: model.provider
    }
  }

  // Утилита для задержки
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Обновление конфигурации модели
  updateModel(alias: string, config: Partial<ModelAliasConfig>): void {
    const existingModel = this.models.get(alias)
    if (existingModel) {
      const updatedModel = { ...existingModel, ...config }
      this.models.set(alias, updatedModel)
      this.logger.info(`Updated model configuration: ${alias}`)
      this.emit('modelUpdated', { alias, config: updatedModel })
    } else {
      throw new Error(`Model alias '${alias}' not found`)
    }
  }

  // Добавление новой модели
  addModel(config: ModelAliasConfig): void {
    this.models.set(config.alias, config)
    this.logger.info(`Added new model: ${config.alias}`)
    this.emit('modelAdded', { alias: config.alias, config })
  }

  // Удаление модели
  removeModel(alias: string): void {
    if (this.models.delete(alias)) {
      this.logger.info(`Removed model: ${alias}`)
      this.emit('modelRemoved', { alias })
    } else {
      throw new Error(`Model alias '${alias}' not found`)
    }
  }

  // Проверка доступности модели
  async healthCheck(alias: string): Promise<boolean> {
    const model = this.getModel(alias)
    if (!model) {
      return false
    }

    try {
      const testRequest: ModelRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10
      }
      
      await this.callModel(model, testRequest)
      return true
    } catch (error) {
      this.logger.warn(`Health check failed for model ${alias}:`, error)
      return false
    }
  }

  // Получение статистики использования
  getStats(): { [alias: string]: { requests: number, failures: number, avgResponseTime: number } } {
    // Базовая реализация - в реальной системе здесь будет сбор метрик
    const stats: { [alias: string]: { requests: number, failures: number, avgResponseTime: number } } = {}
    
    for (const [alias] of this.models) {
      stats[alias] = {
        requests: 0,
        failures: 0,
        avgResponseTime: 0
      }
    }
    
    return stats
  }
}