import type { ProxyConfigManager, ProxyEndpoint } from "./proxy-config-manager"

export interface ConnectionOptions {
  timeout: number
  retryAttempts: number
  retryDelay: number
  enableCompression: boolean
  userAgentRotation: boolean
}

export class ConnectionManager {
  private proxyManager: ProxyConfigManager
  private activeConnections = new Map<string, AbortController>()
  private connectionOptions: ConnectionOptions

  constructor(proxyManager: ProxyConfigManager, options: ConnectionOptions) {
    this.proxyManager = proxyManager
    this.connectionOptions = options
  }

  // Создание подключения через прокси
  async createConnection(
    url: string,
    serviceType: "ai" | "social" | "general" | "fallback",
    requestOptions: RequestInit = {},
  ): Promise<Response> {
    const proxy = this.proxyManager.getProxyForService(serviceType)

    if (!proxy) {
      throw new Error(`No available proxy for service type: ${serviceType}`)
    }

    const connectionId = `${proxy.id}-${Date.now()}`
    const abortController = new AbortController()

    this.activeConnections.set(connectionId, abortController)
    this.proxyManager.incrementConnections(proxy.id)

    try {
      const response = await this.makeProxiedRequest(url, proxy, requestOptions, abortController)
      return response
    } catch (error) {
      console.error(`[ConnectionManager] Connection failed for ${url}:`, error)
      throw error
    } finally {
      this.activeConnections.delete(connectionId)
      this.proxyManager.decrementConnections(proxy.id)
    }
  }

  private async makeProxiedRequest(
    url: string,
    proxy: ProxyEndpoint,
    options: RequestInit,
    abortController: AbortController,
  ): Promise<Response> {
    const proxyUrl = `${proxy.protocol}://${proxy.host}:${proxy.port}`

    // Настройка заголовков для прокси
    const headers = new Headers(options.headers)

    if (this.connectionOptions.userAgentRotation) {
      headers.set("User-Agent", this.getRotatedUserAgent())
    }

    if (this.connectionOptions.enableCompression) {
      headers.set("Accept-Encoding", "gzip, deflate, br")
    }

    // Добавляем аутентификацию прокси если необходимо
    if (proxy.username && proxy.password) {
      const auth = btoa(`${proxy.username}:${proxy.password}`)
      headers.set("Proxy-Authorization", `Basic ${auth}`)
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: abortController.signal,
      // В реальной реализации здесь будет настройка прокси
    }

    // Попытки подключения с повторами
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.connectionOptions.retryAttempts; attempt++) {
      try {
        console.log(`[ConnectionManager] Attempt ${attempt} for ${url} via ${proxy.id}`)

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), this.connectionOptions.timeout)
        })

        const fetchPromise = fetch(url, requestOptions)
        const response = await Promise.race([fetchPromise, timeoutPromise])

        if (response.ok) {
          console.log(`[ConnectionManager] Success for ${url} via ${proxy.id}`)
          return response
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (error) {
        lastError = error as Error
        console.warn(`[ConnectionManager] Attempt ${attempt} failed for ${url}:`, error)

        if (attempt < this.connectionOptions.retryAttempts) {
          await this.delay(this.connectionOptions.retryDelay * attempt)
        }
      }
    }

    throw lastError || new Error("All connection attempts failed")
  }

  private getRotatedUserAgent(): string {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]

    return userAgents[Math.floor(Math.random() * userAgents.length)]
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Отмена всех активных подключений
  cancelAllConnections(): void {
    for (const [connectionId, controller] of this.activeConnections.entries()) {
      controller.abort()
      console.log(`[ConnectionManager] Cancelled connection ${connectionId}`)
    }
    this.activeConnections.clear()
  }

  // Отмена конкретного подключения
  cancelConnection(connectionId: string): void {
    const controller = this.activeConnections.get(connectionId)
    if (controller) {
      controller.abort()
      this.activeConnections.delete(connectionId)
      console.log(`[ConnectionManager] Cancelled connection ${connectionId}`)
    }
  }

  // Получение статистики подключений
  getConnectionStats(): Record<string, any> {
    return {
      activeConnections: this.activeConnections.size,
      proxyStats: this.proxyManager.getPoolStats(),
      connectionOptions: this.connectionOptions,
    }
  }
}
