// Общая конфигурация для всех клиентских приложений

export interface ClientConfig {
  serverUrl: string
  proxyPort: number
  autoStart: boolean
  minimizeToTray: boolean
  startWithSystem: boolean
  logLevel: "debug" | "info" | "warn" | "error"
  theme: "light" | "dark" | "auto"
  language: "ru" | "en"
  notifications: boolean
  updateCheck: boolean
}

export interface ConnectionStatus {
  connected: boolean
  serverReachable: boolean
  proxyActive: boolean
  currentRegion: string
  bytesTransferred: number
  activeConnections: number
  lastError?: string
}

export interface TrafficStats {
  totalRequests: number
  proxiedRequests: number
  directRequests: number
  blockedRequests: number
  averageLatency: number
  dataTransferred: {
    upload: number
    download: number
  }
  topDomains: Array<{ domain: string; requests: number }>
}

export const defaultClientConfig: ClientConfig = {
  serverUrl: "http://localhost:8080",
  proxyPort: 1080,
  autoStart: true,
  minimizeToTray: true,
  startWithSystem: false,
  logLevel: "info",
  theme: "auto",
  language: "ru",
  notifications: true,
  updateCheck: true,
}

export class ClientConfigManager {
  private config: ClientConfig
  private configPath: string

  constructor(configPath: string) {
    this.configPath = configPath
    this.config = this.loadConfig()
  }

  private loadConfig(): ClientConfig {
    try {
      // В реальной реализации загружаем из файла
      const savedConfig = this.readConfigFile()
      return { ...defaultClientConfig, ...savedConfig }
    } catch (error) {
      console.warn("[ClientConfigManager] Failed to load config, using defaults:", error)
      return defaultClientConfig
    }
  }

  private readConfigFile(): Partial<ClientConfig> {
    // Mock реализация - в реальности читаем из файла
    return {}
  }

  saveConfig(): void {
    try {
      // В реальной реализации сохраняем в файл
      console.log("[ClientConfigManager] Config saved to", this.configPath)
    } catch (error) {
      console.error("[ClientConfigManager] Failed to save config:", error)
    }
  }

  getConfig(): ClientConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<ClientConfig>): void {
    this.config = { ...this.config, ...updates }
    this.saveConfig()
  }

  resetToDefaults(): void {
    this.config = { ...defaultClientConfig }
    this.saveConfig()
  }
}
