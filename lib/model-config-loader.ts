import { readFileSync, existsSync, watchFile } from 'fs'
import { join } from 'path'
import { EventEmitter } from 'events'
import winston from 'winston'
import type { AliasSystemConfig, ModelAliasConfig } from './model-alias-manager'

export class ModelConfigLoader extends EventEmitter {
  private configPath: string
  private logger: winston.Logger
  private watchEnabled: boolean = false

  constructor(configPath?: string) {
    super()
    
    this.configPath = configPath || join(process.cwd(), 'config', 'model-aliases.json')
    
    this.logger = winston.createLogger({
      level: 'info',
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
  }

  // Загрузка конфигурации из файла
  loadConfig(): AliasSystemConfig {
    try {
      if (!existsSync(this.configPath)) {
        this.logger.warn(`Config file not found: ${this.configPath}, using default config`)
        return this.getDefaultConfig()
      }

      const configData = readFileSync(this.configPath, 'utf-8')
      const config = JSON.parse(configData) as AliasSystemConfig
      
      // Валидация конфигурации
      this.validateConfig(config)
      
      // Загрузка API ключей из переменных окружения
      this.loadApiKeys(config)
      
      this.logger.info(`Loaded model configuration from: ${this.configPath}`)
      return config
      
    } catch (error) {
      this.logger.error(`Failed to load config from ${this.configPath}:`, error)
      this.logger.info('Using default configuration')
      return this.getDefaultConfig()
    }
  }

  // Валидация конфигурации
  private validateConfig(config: AliasSystemConfig): void {
    if (!config.models || !Array.isArray(config.models)) {
      throw new Error('Config must have a models array')
    }

    if (!config.fallback) {
      throw new Error('Config must have fallback configuration')
    }

    if (!config.defaultModel) {
      throw new Error('Config must specify a defaultModel')
    }

    // Проверка каждой модели
    for (const model of config.models) {
      this.validateModelConfig(model)
    }

    // Проверка что defaultModel существует
    const defaultModelExists = config.models.some(m => m.alias === config.defaultModel)
    if (!defaultModelExists) {
      throw new Error(`Default model '${config.defaultModel}' not found in models list`)
    }
  }

  // Валидация конфигурации модели
  private validateModelConfig(model: ModelAliasConfig): void {
    const required = ['alias', 'provider', 'model', 'endpoint', 'priority']
    
    for (const field of required) {
      if (!(field in model)) {
        throw new Error(`Model config missing required field: ${field}`)
      }
    }

    const validProviders = ['openai', 'anthropic', 'google', 'local', 'ollama']
    if (!validProviders.includes(model.provider)) {
      throw new Error(`Invalid provider: ${model.provider}. Must be one of: ${validProviders.join(', ')}`)
    }

    if (typeof model.priority !== 'number' || model.priority < 0) {
      throw new Error(`Invalid priority for model ${model.alias}: must be a positive number`)
    }
  }

  // Загрузка API ключей из переменных окружения
  private loadApiKeys(config: AliasSystemConfig): void {
    for (const model of config.models) {
      switch (model.provider) {
        case 'openai':
          model.apiKey = process.env.OPENAI_API_KEY || model.apiKey
          break
        case 'anthropic':
          model.apiKey = process.env.ANTHROPIC_API_KEY || model.apiKey
          break
        case 'google':
          model.apiKey = process.env.GOOGLE_AI_API_KEY || model.apiKey
          break
        // local и ollama обычно не требуют API ключей
      }

      // Предупреждение если API ключ не найден для внешних провайдеров
      if (['openai', 'anthropic', 'google'].includes(model.provider) && !model.apiKey) {
        this.logger.warn(`No API key found for ${model.provider} model: ${model.alias}`)
      }
    }
  }

  // Конфигурация по умолчанию
  private getDefaultConfig(): AliasSystemConfig {
    return {
      models: [
        {
          alias: 'gpt-3.5',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          endpoint: 'https://api.openai.com/v1',
          priority: 80,
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
        fallbackOrder: ['gpt-3.5']
      },
      defaultModel: 'gpt-3.5',
      logLevel: 'info'
    }
  }

  // Включение отслеживания изменений файла конфигурации
  enableConfigWatch(): void {
    if (this.watchEnabled) {
      return
    }

    this.watchEnabled = true
    
    watchFile(this.configPath, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        this.logger.info('Config file changed, reloading...')
        
        try {
          const newConfig = this.loadConfig()
          this.emit('configChanged', newConfig)
        } catch (error) {
          this.logger.error('Failed to reload config:', error)
          this.emit('configError', error)
        }
      }
    })

    this.logger.info(`Watching config file for changes: ${this.configPath}`)
  }

  // Отключение отслеживания изменений
  disableConfigWatch(): void {
    if (this.watchEnabled) {
      // В Node.js нет прямого способа отключить watchFile, 
      // но можно удалить все слушатели
      this.removeAllListeners('configChanged')
      this.removeAllListeners('configError')
      this.watchEnabled = false
      this.logger.info('Disabled config file watching')
    }
  }

  // Сохранение конфигурации в файл
  async saveConfig(config: AliasSystemConfig): Promise<void> {
    try {
      const { writeFile } = await import('fs/promises')
      
      // Валидация перед сохранением
      this.validateConfig(config)
      
      // Удаляем API ключи перед сохранением (они должны быть в переменных окружения)
      const configToSave = JSON.parse(JSON.stringify(config))
      for (const model of configToSave.models) {
        delete model.apiKey
      }
      
      const configJson = JSON.stringify(configToSave, null, 2)
      await writeFile(this.configPath, configJson, 'utf-8')
      
      this.logger.info(`Saved config to: ${this.configPath}`)
      this.emit('configSaved', config)
      
    } catch (error) {
      this.logger.error(`Failed to save config to ${this.configPath}:`, error)
      throw error
    }
  }

  // Создание резервной копии конфигурации
  async backupConfig(): Promise<string> {
    try {
      const { copyFile } = await import('fs/promises')
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = `${this.configPath}.backup.${timestamp}`
      
      await copyFile(this.configPath, backupPath)
      
      this.logger.info(`Created config backup: ${backupPath}`)
      return backupPath
      
    } catch (error) {
      this.logger.error('Failed to create config backup:', error)
      throw error
    }
  }

  // Восстановление конфигурации из резервной копии
  async restoreConfig(backupPath: string): Promise<void> {
    try {
      const { copyFile } = await import('fs/promises')
      
      if (!existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`)
      }
      
      await copyFile(backupPath, this.configPath)
      
      this.logger.info(`Restored config from backup: ${backupPath}`)
      this.emit('configRestored', backupPath)
      
    } catch (error) {
      this.logger.error(`Failed to restore config from ${backupPath}:`, error)
      throw error
    }
  }

  // Получение пути к файлу конфигурации
  getConfigPath(): string {
    return this.configPath
  }

  // Проверка существования файла конфигурации
  configExists(): boolean {
    return existsSync(this.configPath)
  }
}