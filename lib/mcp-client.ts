import { EventEmitter } from 'events'
import axios, { AxiosResponse } from 'axios'
import winston from 'winston'
import fs from 'fs/promises'
import { spawn, ChildProcess } from 'child_process'
import { getErrorMessage } from './error-utils'

// Интерфейсы для MCP протокола
export interface MCPServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
  disabled?: boolean
  autoApprove?: string[]
  description?: string
  capabilities?: string[]
}

export interface MCPClientConfig {
  autoConnect: boolean
  reconnectInterval: number
  maxReconnectAttempts: number
  timeout: number
  enableLogging: boolean
  logLevel: string
}

export interface MCPTool {
  name: string
  description: string
  inputSchema: any
}

export interface MCPResource {
  uri: string
  name: string
  description: string
  mimeType: string
}

export interface MCPPrompt {
  name: string
  description: string
  arguments: any[]
}

export interface MCPToolCall {
  name: string
  arguments: any
}

export interface MCPToolResult {
  content: Array<{
    type: string
    text: string
  }>
}

// Основной класс MCP клиента
export class MCPClient extends EventEmitter {
  private servers: Map<string, MCPServerConfig> = new Map()
  private serverProcesses: Map<string, ChildProcess> = new Map()
  private serverConnections: Map<string, boolean> = new Map()
  private clientConfig: MCPClientConfig = {
    autoConnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 3,
    timeout: 30000,
    enableLogging: true,
    logLevel: 'info'
  }
  private logger: winston.Logger
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map()
  private reconnectAttempts: Map<string, number> = new Map()

  constructor(configPath: string = '.kiro/settings/mcp.json') {
    super()
    
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
        }),
        new winston.transports.File({ filename: 'logs/mcp-client.log' })
      ]
    })

    this.loadConfiguration(configPath)
  }

  // Загрузка конфигурации MCP
  private async loadConfiguration(configPath: string): Promise<void> {
    try {
      const configData = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      
      // Загрузка серверов
      for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
        this.servers.set(serverId, serverConfig as MCPServerConfig)
        this.serverConnections.set(serverId, false)
        this.reconnectAttempts.set(serverId, 0)
      }
      
      // Загрузка конфигурации клиента
      this.clientConfig = config.clientConfig || {
        autoConnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
        timeout: 30000,
        enableLogging: true,
        logLevel: 'info'
      }
      
      this.logger.level = this.clientConfig.logLevel
      this.logger.info(`Loaded MCP configuration with ${this.servers.size} servers`)
      
      // Автоматическое подключение если включено
      if (this.clientConfig.autoConnect) {
        await this.connectAll()
      }
      
    } catch (error) {
      this.logger.error('Failed to load MCP configuration:', error)
      throw error
    }
  }

  // Подключение ко всем серверам
  async connectAll(): Promise<void> {
    this.logger.info('Connecting to all MCP servers...')
    
    const connectionPromises = Array.from(this.servers.entries())
      .filter(([_, config]) => !config.disabled)
      .map(([serverId]) => this.connectToServer(serverId))
    
    await Promise.allSettled(connectionPromises)
  }

  // Подключение к конкретному серверу
  async connectToServer(serverId: string): Promise<void> {
    const serverConfig = this.servers.get(serverId)
    if (!serverConfig || serverConfig.disabled) {
      this.logger.warn(`Server ${serverId} is disabled or not found`)
      return
    }

    try {
      this.logger.info(`Connecting to MCP server: ${serverId}`)
      
      // Запуск процесса сервера если необходимо
      await this.startServerProcess(serverId, serverConfig)
      
      // Ожидание готовности сервера
      await this.waitForServerReady(serverId)
      
      // Инициализация MCP протокола
      await this.initializeMCPProtocol(serverId)
      
      this.serverConnections.set(serverId, true)
      this.reconnectAttempts.set(serverId, 0)
      
      this.logger.info(`Successfully connected to MCP server: ${serverId}`)
      this.emit('serverConnected', { serverId, config: serverConfig })
      
    } catch (error) {
      this.logger.error(`Failed to connect to MCP server ${serverId}:`, error)
      this.serverConnections.set(serverId, false)
      
      // Планирование переподключения
      this.scheduleReconnect(serverId)
      
      this.emit('serverConnectionFailed', { serverId, error: getErrorMessage(error) })
    }
  }

  // Запуск процесса сервера
  private async startServerProcess(serverId: string, config: MCPServerConfig): Promise<void> {
    // Проверяем, не запущен ли уже процесс
    if (this.serverProcesses.has(serverId)) {
      const existingProcess = this.serverProcesses.get(serverId)
      if (existingProcess && !existingProcess.killed) {
        return // Процесс уже запущен
      }
    }

    return new Promise((resolve, reject) => {
      const env = { ...process.env, ...config.env }
      
      this.logger.debug(`Starting MCP server process: ${config.command} ${config.args.join(' ')}`)
      
      const serverProcess = spawn(config.command, config.args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      })

      // Обработка вывода процесса
      serverProcess.stdout?.on('data', (data) => {
        if (this.clientConfig.enableLogging) {
          this.logger.debug(`[${serverId}] stdout: ${data.toString().trim()}`)
        }
      })

      serverProcess.stderr?.on('data', (data) => {
        const message = data.toString().trim()
        if (message) {
          this.logger.warn(`[${serverId}] stderr: ${message}`)
        }
      })

      serverProcess.on('error', (error) => {
        this.logger.error(`[${serverId}] Process error:`, error)
        this.serverProcesses.delete(serverId)
        reject(error)
      })

      serverProcess.on('exit', (code, signal) => {
        this.logger.info(`[${serverId}] Process exited with code ${code}, signal ${signal}`)
        this.serverProcesses.delete(serverId)
        this.serverConnections.set(serverId, false)
        
        // Планирование переподключения если процесс завершился неожиданно
        if (code !== 0 && !signal) {
          this.scheduleReconnect(serverId)
        }
        
        this.emit('serverProcessExited', { serverId, code, signal })
      })

      // Сохраняем процесс
      this.serverProcesses.set(serverId, serverProcess)
      
      // Даем время на запуск
      setTimeout(() => {
        if (!serverProcess.killed) {
          resolve()
        } else {
          reject(new Error('Server process failed to start'))
        }
      }, 2000)
    })
  }

  // Ожидание готовности сервера
  private async waitForServerReady(serverId: string, maxAttempts: number = 30): Promise<void> {
    const serverConfig = this.servers.get(serverId)
    if (!serverConfig) return

    // Определяем порт сервера из переменных окружения
    const port = this.getServerPort(serverId, serverConfig)
    const healthUrl = `http://localhost:${port}/health`

    this.logger.debug(`Waiting for server ${serverId} to be ready at ${healthUrl}`)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.get(healthUrl, { 
          timeout: 5000,
          validateStatus: (status) => status < 500
        })
        
        if (response.status === 200) {
          this.logger.info(`Server ${serverId} is ready (attempt ${attempt})`)
          return
        } else {
          this.logger.debug(`Server ${serverId} returned status ${response.status} (attempt ${attempt})`)
        }
      } catch (error) {
        this.logger.debug(`Server ${serverId} not ready yet (attempt ${attempt}): ${getErrorMessage(error)}`)
      }
      
      // Ждем перед следующей попыткой с увеличивающейся задержкой
      const delay = Math.min(1000 * attempt, 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    throw new Error(`Server ${serverId} did not become ready within ${maxAttempts} seconds at ${healthUrl}`)
  }

  // Получение порта сервера
  private getServerPort(serverId: string, config: MCPServerConfig): number {
    const portEnvVars = {
      'traffic-router-mcp': 'MCP_SERVER_PORT',
      'deepmcp-agent': 'DEEPMCP_PORT', 
      'memory-mcp': 'MEMORY_PORT',
      'system-monitor-mcp': 'MONITOR_PORT'
    }
    
    const envVar = portEnvVars[serverId as keyof typeof portEnvVars]
    if (envVar && config.env?.[envVar]) {
      return parseInt(config.env[envVar])
    }
    
    // Порты по умолчанию
    const defaultPorts = {
      'traffic-router-mcp': 3001,
      'deepmcp-agent': 3002,
      'memory-mcp': 3003,
      'system-monitor-mcp': 3004
    }
    
    return defaultPorts[serverId as keyof typeof defaultPorts] || 3001
  }

  // Инициализация MCP протокола
  private async initializeMCPProtocol(serverId: string): Promise<void> {
    const serverConfig = this.servers.get(serverId)
    if (!serverConfig) return

    const port = this.getServerPort(serverId, serverConfig)
    const initUrl = `http://localhost:${port}/mcp/initialize`

    try {
      const response = await axios.post(initUrl, {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'Traffic Router MCP Client',
          version: '1.0.0'
        }
      }, { timeout: this.clientConfig.timeout })

      this.logger.debug(`MCP protocol initialized for ${serverId}:`, response.data)
      
    } catch (error) {
      throw new Error(`Failed to initialize MCP protocol for ${serverId}: ${getErrorMessage(error)}`)
    }
  }

  // Планирование переподключения
  private scheduleReconnect(serverId: string): void {
    const attempts = this.reconnectAttempts.get(serverId) || 0
    
    if (attempts >= this.clientConfig.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts reached for server ${serverId}`)
      this.emit('serverReconnectFailed', { serverId, attempts })
      return
    }

    // Очищаем предыдущий таймер если есть
    const existingTimer = this.reconnectTimers.get(serverId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Экспоненциальная задержка
    const delay = this.clientConfig.reconnectInterval * Math.pow(2, attempts)
    
    this.logger.info(`Scheduling reconnect for ${serverId} in ${delay}ms (attempt ${attempts + 1})`)
    
    const timer = setTimeout(async () => {
      this.reconnectAttempts.set(serverId, attempts + 1)
      await this.connectToServer(serverId)
    }, delay)
    
    this.reconnectTimers.set(serverId, timer as unknown as NodeJS.Timeout)
  }

  // Получение списка инструментов от сервера
  async getTools(serverId: string): Promise<MCPTool[]> {
    if (!this.isServerConnected(serverId)) {
      throw new Error(`Server ${serverId} is not connected`)
    }

    const port = this.getServerPort(serverId, this.servers.get(serverId)!)
    const toolsUrl = `http://localhost:${port}/mcp/tools`

    try {
      const response = await axios.get(toolsUrl, { 
        timeout: this.clientConfig.timeout 
      })
      
      return response.data.tools || []
    } catch (error) {
      throw new Error(`Failed to get tools from ${serverId}: ${getErrorMessage(error)}`)
    }
  }

  // Вызов инструмента на сервере
  async callTool(serverId: string, toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.isServerConnected(serverId)) {
      throw new Error(`Server ${serverId} is not connected`)
    }

    const serverConfig = this.servers.get(serverId)!
    
    // Проверка автоматического одобрения
    if (!serverConfig.autoApprove?.includes(toolCall.name)) {
      this.logger.warn(`Tool ${toolCall.name} not in auto-approve list for ${serverId}`)
      // В реальной системе здесь может быть запрос подтверждения у пользователя
    }

    const port = this.getServerPort(serverId, serverConfig)
    const callUrl = `http://localhost:${port}/mcp/tools/call`

    try {
      this.logger.info(`Calling tool ${toolCall.name} on server ${serverId}`)
      
      const response = await axios.post(callUrl, {
        name: toolCall.name,
        arguments: toolCall.arguments
      }, { timeout: this.clientConfig.timeout })
      
      this.emit('toolCalled', { serverId, toolName: toolCall.name, result: response.data })
      
      return response.data
    } catch (error) {
      this.logger.error(`Tool call failed for ${toolCall.name} on ${serverId}:`, error)
      this.emit('toolCallFailed', { serverId, toolName: toolCall.name, error: getErrorMessage(error) })
      throw new Error(`Failed to call tool ${toolCall.name} on ${serverId}: ${getErrorMessage(error)}`)
    }
  }

  // Получение ресурсов от сервера
  async getResources(serverId: string): Promise<MCPResource[]> {
    if (!this.isServerConnected(serverId)) {
      throw new Error(`Server ${serverId} is not connected`)
    }

    const port = this.getServerPort(serverId, this.servers.get(serverId)!)
    const resourcesUrl = `http://localhost:${port}/mcp/resources`

    try {
      const response = await axios.get(resourcesUrl, { 
        timeout: this.clientConfig.timeout 
      })
      
      return response.data.resources || []
    } catch (error) {
      throw new Error(`Failed to get resources from ${serverId}: ${getErrorMessage(error)}`)
    }
  }

  // Чтение ресурса
  async readResource(serverId: string, uri: string): Promise<string> {
    if (!this.isServerConnected(serverId)) {
      throw new Error(`Server ${serverId} is not connected`)
    }

    const port = this.getServerPort(serverId, this.servers.get(serverId)!)
    const resourceUrl = `http://localhost:${port}/mcp/resources/${encodeURIComponent(uri)}`

    try {
      const response = await axios.get(resourceUrl, { 
        timeout: this.clientConfig.timeout 
      })
      
      return response.data.text || response.data.content || ''
    } catch (error) {
      throw new Error(`Failed to read resource ${uri} from ${serverId}: ${getErrorMessage(error)}`)
    }
  }

  // Получение промптов от сервера
  async getPrompts(serverId: string): Promise<MCPPrompt[]> {
    if (!this.isServerConnected(serverId)) {
      throw new Error(`Server ${serverId} is not connected`)
    }

    const port = this.getServerPort(serverId, this.servers.get(serverId)!)
    const promptsUrl = `http://localhost:${port}/mcp/prompts`

    try {
      const response = await axios.get(promptsUrl, { 
        timeout: this.clientConfig.timeout 
      })
      
      return response.data.prompts || []
    } catch (error) {
      throw new Error(`Failed to get prompts from ${serverId}: ${getErrorMessage(error)}`)
    }
  }

  // Получение промпта
  async getPrompt(serverId: string, name: string, arguments_: any = {}): Promise<any> {
    if (!this.isServerConnected(serverId)) {
      throw new Error(`Server ${serverId} is not connected`)
    }

    const port = this.getServerPort(serverId, this.servers.get(serverId)!)
    const promptUrl = `http://localhost:${port}/mcp/prompts/get`

    try {
      const response = await axios.post(promptUrl, {
        name,
        arguments: arguments_
      }, { timeout: this.clientConfig.timeout })
      
      return response.data
    } catch (error) {
      throw new Error(`Failed to get prompt ${name} from ${serverId}: ${getErrorMessage(error)}`)
    }
  }

  // Проверка подключения к серверу
  isServerConnected(serverId: string): boolean {
    return this.serverConnections.get(serverId) || false
  }

  // Получение списка подключенных серверов
  getConnectedServers(): string[] {
    return Array.from(this.serverConnections.entries())
      .filter(([_, connected]) => connected)
      .map(([serverId]) => serverId)
  }

  // Получение статуса всех серверов
  getServerStatus(): { [serverId: string]: { connected: boolean, config: MCPServerConfig } } {
    const status: { [serverId: string]: { connected: boolean, config: MCPServerConfig } } = {}
    
    for (const [serverId, config] of this.servers) {
      status[serverId] = {
        connected: this.isServerConnected(serverId),
        config
      }
    }
    
    return status
  }

  // Отключение от сервера
  async disconnectFromServer(serverId: string): Promise<void> {
    this.logger.info(`Disconnecting from MCP server: ${serverId}`)
    
    // Очищаем таймер переподключения
    const timer = this.reconnectTimers.get(serverId)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(serverId)
    }
    
    // Завершаем процесс сервера
    const process = this.serverProcesses.get(serverId)
    if (process && !process.killed) {
      process.kill('SIGTERM')
      
      // Принудительное завершение через 5 секунд
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL')
        }
      }, 5000)
    }
    
    this.serverConnections.set(serverId, false)
    this.serverProcesses.delete(serverId)
    
    this.emit('serverDisconnected', { serverId })
  }

  // Отключение от всех серверов
  async disconnectAll(): Promise<void> {
    this.logger.info('Disconnecting from all MCP servers...')
    
    const disconnectPromises = Array.from(this.servers.keys())
      .map(serverId => this.disconnectFromServer(serverId))
    
    await Promise.allSettled(disconnectPromises)
  }

  // Перезагрузка конфигурации
  async reloadConfiguration(configPath: string = '.kiro/settings/mcp.json'): Promise<void> {
    this.logger.info('Reloading MCP configuration...')
    
    // Отключаемся от всех серверов
    await this.disconnectAll()
    
    // Очищаем текущую конфигурацию
    this.servers.clear()
    this.serverConnections.clear()
    this.reconnectAttempts.clear()
    
    // Загружаем новую конфигурацию
    await this.loadConfiguration(configPath)
    
    this.emit('configurationReloaded')
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down MCP client...')
    
    await this.disconnectAll()
    
    // Очищаем все таймеры
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer)
    }
    this.reconnectTimers.clear()
    
    this.removeAllListeners()
    
    this.logger.info('MCP client shutdown completed')
  }
}

// Утилитарные функции для работы с MCP
export class MCPUtils {
  // Создание стандартного tool call
  static createToolCall(name: string, arguments_: any): MCPToolCall {
    return { name, arguments: arguments_ }
  }

  // Валидация MCP конфигурации
  static validateConfig(config: any): boolean {
    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      return false
    }

    for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
      const server = serverConfig as any
      if (!server.command || !Array.isArray(server.args)) {
        return false
      }
    }

    return true
  }

  // Получение информации о MCP сервере
  static getServerInfo(config: MCPServerConfig): string {
    return `${config.command} ${config.args.join(' ')} (${config.description || 'No description'})`
  }
}