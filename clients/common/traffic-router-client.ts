import type { ClientConfig, ConnectionStatus, TrafficStats } from "./client-config"

export class TrafficRouterClient {
  private config: ClientConfig
  private status: ConnectionStatus
  private stats: TrafficStats
  private eventListeners = new Map<string, Function[]>()
  private heartbeatInterval?: NodeJS.Timeout
  private statsInterval?: NodeJS.Timeout

  constructor(config: ClientConfig) {
    this.config = config
    this.status = {
      connected: false,
      serverReachable: false,
      proxyActive: false,
      currentRegion: "Unknown",
      bytesTransferred: 0,
      activeConnections: 0,
    }
    this.stats = {
      totalRequests: 0,
      proxiedRequests: 0,
      directRequests: 0,
      blockedRequests: 0,
      averageLatency: 0,
      dataTransferred: { upload: 0, download: 0 },
      topDomains: [],
    }
  }

  // Подключение к серверу
  async connect(): Promise<boolean> {
    try {
      console.log(`[TrafficRouterClient] Connecting to ${this.config.serverUrl}`)

      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: "GET",
        timeout: 5000,
      })

      if (response.ok) {
        this.status.connected = true
        this.status.serverReachable = true
        this.startHeartbeat()
        this.startStatsCollection()
        this.emit("connected")
        console.log("[TrafficRouterClient] Connected successfully")
        return true
      } else {
        throw new Error(`Server responded with status: ${response.status}`)
      }
    } catch (error) {
      console.error("[TrafficRouterClient] Connection failed:", error)
      this.status.connected = false
      this.status.serverReachable = false
      this.status.lastError = error instanceof Error ? error.message : "Unknown error"
      this.emit("connectionFailed", error)
      return false
    }
  }

  // Отключение от сервера
  disconnect(): void {
    console.log("[TrafficRouterClient] Disconnecting...")
    this.status.connected = false
    this.status.serverReachable = false
    this.status.proxyActive = false

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = undefined
    }

    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = undefined
    }

    this.emit("disconnected")
  }

  // Запуск прокси
  async startProxy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/proxy/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: this.config.proxyPort }),
      })

      if (response.ok) {
        this.status.proxyActive = true
        this.emit("proxyStarted")
        console.log("[TrafficRouterClient] Proxy started")
        return true
      } else {
        throw new Error(`Failed to start proxy: ${response.statusText}`)
      }
    } catch (error) {
      console.error("[TrafficRouterClient] Failed to start proxy:", error)
      this.status.lastError = error instanceof Error ? error.message : "Unknown error"
      this.emit("proxyError", error)
      return false
    }
  }

  // Остановка прокси
  async stopProxy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/proxy/stop`, {
        method: "POST",
      })

      if (response.ok) {
        this.status.proxyActive = false
        this.emit("proxyStopped")
        console.log("[TrafficRouterClient] Proxy stopped")
        return true
      } else {
        throw new Error(`Failed to stop proxy: ${response.statusText}`)
      }
    } catch (error) {
      console.error("[TrafficRouterClient] Failed to stop proxy:", error)
      this.status.lastError = error instanceof Error ? error.message : "Unknown error"
      return false
    }
  }

  // Получение текущего статуса
  getStatus(): ConnectionStatus {
    return { ...this.status }
  }

  // Получение статистики
  getStats(): TrafficStats {
    return { ...this.stats }
  }

  // Обновление конфигурации
  updateConfig(newConfig: Partial<ClientConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit("configUpdated", this.config)
  }

  // Добавление обработчика событий
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  // Удаление обработчика событий
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  // Генерация события
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  // Heartbeat для проверки соединения
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const response = await fetch(`${this.config.serverUrl}/health`, {
          method: "GET",
          timeout: 3000,
        })

        if (response.ok) {
          this.status.serverReachable = true
        } else {
          throw new Error("Server not reachable")
        }
      } catch (error) {
        console.warn("[TrafficRouterClient] Heartbeat failed:", error)
        this.status.serverReachable = false
        this.status.lastError = "Server not reachable"
        this.emit("connectionLost")
      }
    }, 30000) // Каждые 30 секунд
  }

  // Сбор статистики
  private startStatsCollection(): void {
    this.statsInterval = setInterval(async () => {
      try {
        const response = await fetch(`${this.config.serverUrl}/stats`)
        if (response.ok) {
          const serverStats = await response.json()
          this.updateStatsFromServer(serverStats)
          this.emit("statsUpdated", this.stats)
        }
      } catch (error) {
        console.warn("[TrafficRouterClient] Failed to fetch stats:", error)
      }
    }, 10000) // Каждые 10 секунд
  }

  private updateStatsFromServer(serverStats: any): void {
    this.stats = {
      totalRequests: serverStats.totalRequests || 0,
      proxiedRequests: serverStats.proxiedRequests || 0,
      directRequests: serverStats.directRequests || 0,
      blockedRequests: serverStats.blockedRequests || 0,
      averageLatency: serverStats.averageLatency || 0,
      dataTransferred: serverStats.dataTransferred || { upload: 0, download: 0 },
      topDomains: serverStats.topDomains || [],
    }

    this.status.activeConnections = serverStats.activeConnections || 0
    this.status.bytesTransferred = serverStats.bytesTransferred || 0
    this.status.currentRegion = serverStats.currentRegion || "Unknown"
  }

  // Тестирование соединения
  async testConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${this.config.serverUrl}/test`, {
        method: "GET",
        timeout: 10000,
      })

      const latency = Date.now() - startTime

      if (response.ok) {
        return { success: true, latency }
      } else {
        return { success: false, latency, error: `HTTP ${response.status}` }
      }
    } catch (error) {
      const latency = Date.now() - startTime
      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  // Очистка статистики
  async clearStats(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/stats/clear`, {
        method: "POST",
      })

      if (response.ok) {
        this.stats = {
          totalRequests: 0,
          proxiedRequests: 0,
          directRequests: 0,
          blockedRequests: 0,
          averageLatency: 0,
          dataTransferred: { upload: 0, download: 0 },
          topDomains: [],
        }
        this.emit("statsCleared")
        return true
      }
      return false
    } catch (error) {
      console.error("[TrafficRouterClient] Failed to clear stats:", error)
      return false
    }
  }
}
