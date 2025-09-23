export interface ProxyEndpoint {
  id: string
  host: string
  port: number
  protocol: "socks5" | "http" | "https"
  username?: string
  password?: string
  region: string
  isActive: boolean
  latency?: number
  lastChecked?: Date
  maxConnections: number
  currentConnections: number
}

export interface ProxyPool {
  name: string
  endpoints: ProxyEndpoint[]
  loadBalanceStrategy: "round-robin" | "least-connections" | "random" | "latency-based"
  healthCheckInterval: number
  failoverEnabled: boolean
}

export class ProxyConfigManager {
  private proxyPools = new Map<string, ProxyPool>()
  private currentIndexes = new Map<string, number>()
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>()

  constructor() {
    this.initializeDefaultPools()
  }

  private initializeDefaultPools(): void {
    // Основной пул для AI сервисов
    const aiPool: ProxyPool = {
      name: "ai-services",
      loadBalanceStrategy: "latency-based",
      healthCheckInterval: 30000, // 30 секунд
      failoverEnabled: true,
      endpoints: [
        {
          id: "us-east-1",
          host: "proxy-us-east.example.com",
          port: 1080,
          protocol: "socks5",
          region: "US-East",
          isActive: true,
          maxConnections: 100,
          currentConnections: 0,
        },
        {
          id: "us-west-1",
          host: "proxy-us-west.example.com",
          port: 1080,
          protocol: "socks5",
          region: "US-West",
          isActive: true,
          maxConnections: 100,
          currentConnections: 0,
        },
        {
          id: "eu-central-1",
          host: "proxy-eu.example.com",
          port: 1080,
          protocol: "socks5",
          region: "EU-Central",
          isActive: true,
          maxConnections: 80,
          currentConnections: 0,
        },
      ],
    }

    // Пул для социальных сетей
    const socialPool: ProxyPool = {
      name: "social-media",
      loadBalanceStrategy: "round-robin",
      healthCheckInterval: 60000, // 1 минута
      failoverEnabled: true,
      endpoints: [
        {
          id: "social-us-1",
          host: "social-proxy-us.example.com",
          port: 8080,
          protocol: "http",
          region: "US",
          isActive: true,
          maxConnections: 50,
          currentConnections: 0,
        },
        {
          id: "social-eu-1",
          host: "social-proxy-eu.example.com",
          port: 8080,
          protocol: "http",
          region: "EU",
          isActive: true,
          maxConnections: 50,
          currentConnections: 0,
        },
      ],
    }

    // Резервный пул
    const fallbackPool: ProxyPool = {
      name: "fallback",
      loadBalanceStrategy: "random",
      healthCheckInterval: 120000, // 2 минуты
      failoverEnabled: false,
      endpoints: [
        {
          id: "fallback-1",
          host: "fallback-proxy.example.com",
          port: 3128,
          protocol: "http",
          region: "Global",
          isActive: true,
          maxConnections: 200,
          currentConnections: 0,
        },
      ],
    }

    this.proxyPools.set("ai-services", aiPool)
    this.proxyPools.set("social-media", socialPool)
    this.proxyPools.set("fallback", fallbackPool)

    // Запускаем проверки здоровья
    this.startHealthChecks()
  }

  // Получение прокси для конкретного типа сервиса
  getProxyForService(serviceType: "ai" | "social" | "general" | "fallback"): ProxyEndpoint | null {
    const poolName = this.getPoolNameForService(serviceType)
    const pool = this.proxyPools.get(poolName)

    if (!pool) {
      console.error(`[ProxyConfigManager] Pool ${poolName} not found`)
      return null
    }

    return this.selectProxyFromPool(pool)
  }

  private getPoolNameForService(serviceType: string): string {
    switch (serviceType) {
      case "ai":
        return "ai-services"
      case "social":
        return "social-media"
      case "fallback":
        return "fallback"
      default:
        return "ai-services" // По умолчанию
    }
  }

  // Выбор прокси из пула согласно стратегии балансировки
  private selectProxyFromPool(pool: ProxyPool): ProxyEndpoint | null {
    const activeEndpoints = pool.endpoints.filter((ep) => ep.isActive && ep.currentConnections < ep.maxConnections)

    if (activeEndpoints.length === 0) {
      console.warn(`[ProxyConfigManager] No active endpoints in pool ${pool.name}`)
      return null
    }

    switch (pool.loadBalanceStrategy) {
      case "round-robin":
        return this.selectRoundRobin(pool.name, activeEndpoints)
      case "least-connections":
        return this.selectLeastConnections(activeEndpoints)
      case "random":
        return this.selectRandom(activeEndpoints)
      case "latency-based":
        return this.selectLatencyBased(activeEndpoints)
      default:
        return activeEndpoints[0]
    }
  }

  private selectRoundRobin(poolName: string, endpoints: ProxyEndpoint[]): ProxyEndpoint {
    const currentIndex = this.currentIndexes.get(poolName) || 0
    const selectedEndpoint = endpoints[currentIndex % endpoints.length]
    this.currentIndexes.set(poolName, currentIndex + 1)
    return selectedEndpoint
  }

  private selectLeastConnections(endpoints: ProxyEndpoint[]): ProxyEndpoint {
    return endpoints.reduce((min, current) => (current.currentConnections < min.currentConnections ? current : min))
  }

  private selectRandom(endpoints: ProxyEndpoint[]): ProxyEndpoint {
    const randomIndex = Math.floor(Math.random() * endpoints.length)
    return endpoints[randomIndex]
  }

  private selectLatencyBased(endpoints: ProxyEndpoint[]): ProxyEndpoint {
    const endpointsWithLatency = endpoints.filter((ep) => ep.latency !== undefined)

    if (endpointsWithLatency.length === 0) {
      return this.selectRandom(endpoints)
    }

    return endpointsWithLatency.reduce((min, current) =>
      (current.latency || Number.POSITIVE_INFINITY) < (min.latency || Number.POSITIVE_INFINITY) ? current : min,
    )
  }

  // Увеличение счетчика подключений
  incrementConnections(endpointId: string): void {
    for (const pool of this.proxyPools.values()) {
      const endpoint = pool.endpoints.find((ep) => ep.id === endpointId)
      if (endpoint) {
        endpoint.currentConnections++
        break
      }
    }
  }

  // Уменьшение счетчика подключений
  decrementConnections(endpointId: string): void {
    for (const pool of this.proxyPools.values()) {
      const endpoint = pool.endpoints.find((ep) => ep.id === endpointId)
      if (endpoint && endpoint.currentConnections > 0) {
        endpoint.currentConnections--
        break
      }
    }
  }

  // Добавление нового прокси
  addProxy(poolName: string, endpoint: Omit<ProxyEndpoint, "id" | "isActive" | "currentConnections">): void {
    const pool = this.proxyPools.get(poolName)
    if (!pool) {
      console.error(`[ProxyConfigManager] Pool ${poolName} not found`)
      return
    }

    const newEndpoint: ProxyEndpoint = {
      ...endpoint,
      id: `${poolName}-${Date.now()}`,
      isActive: true,
      currentConnections: 0,
    }

    pool.endpoints.push(newEndpoint)
    console.log(`[ProxyConfigManager] Added proxy ${newEndpoint.id} to pool ${poolName}`)
  }

  // Удаление прокси
  removeProxy(endpointId: string): void {
    for (const [poolName, pool] of this.proxyPools.entries()) {
      const index = pool.endpoints.findIndex((ep) => ep.id === endpointId)
      if (index !== -1) {
        pool.endpoints.splice(index, 1)
        console.log(`[ProxyConfigManager] Removed proxy ${endpointId} from pool ${poolName}`)
        break
      }
    }
  }

  // Проверка здоровья прокси
  private async checkProxyHealth(endpoint: ProxyEndpoint): Promise<boolean> {
    try {
      const startTime = Date.now()

      // Простая проверка подключения (в реальной реализации)
      const testUrl = "http://httpbin.org/ip"
      const response = await fetch(testUrl, {
        // В реальной реализации здесь будет настройка прокси
        signal: AbortSignal.timeout(5000), // 5 секунд таймаут
      })

      if (response.ok) {
        endpoint.latency = Date.now() - startTime
        endpoint.lastChecked = new Date()
        return true
      }

      return false
    } catch (error) {
      console.error(`[ProxyConfigManager] Health check failed for ${endpoint.id}:`, error)
      return false
    }
  }

  // Запуск проверок здоровья для всех пулов
  private startHealthChecks(): void {
    for (const [poolName, pool] of this.proxyPools.entries()) {
      const interval = setInterval(async () => {
        for (const endpoint of pool.endpoints) {
          const isHealthy = await this.checkProxyHealth(endpoint)

          if (endpoint.isActive && !isHealthy) {
            console.warn(`[ProxyConfigManager] Marking ${endpoint.id} as inactive`)
            endpoint.isActive = false
          } else if (!endpoint.isActive && isHealthy) {
            console.info(`[ProxyConfigManager] Marking ${endpoint.id} as active`)
            endpoint.isActive = true
          }
        }
      }, pool.healthCheckInterval)

      this.healthCheckIntervals.set(poolName, interval as unknown as NodeJS.Timeout)
    }
  }

  // Получение статистики пулов
  getPoolStats(): Record<string, any> {
    const stats: Record<string, any> = {}

    for (const [poolName, pool] of this.proxyPools.entries()) {
      const activeEndpoints = pool.endpoints.filter((ep) => ep.isActive).length
      const totalConnections = pool.endpoints.reduce((sum, ep) => sum + ep.currentConnections, 0)
      const avgLatency = pool.endpoints
        .filter((ep) => ep.latency !== undefined)
        .reduce((sum, ep, _, arr) => sum + (ep.latency || 0) / arr.length, 0)

      stats[poolName] = {
        totalEndpoints: pool.endpoints.length,
        activeEndpoints,
        totalConnections,
        averageLatency: Math.round(avgLatency),
        loadBalanceStrategy: pool.loadBalanceStrategy,
      }
    }

    return stats
  }

  // Остановка проверок здоровья
  stopHealthChecks(): void {
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval)
    }
    this.healthCheckIntervals.clear()
  }

  // Экспорт конфигурации
  exportConfig(): Record<string, ProxyPool> {
    return Object.fromEntries(this.proxyPools.entries())
  }

  // Импорт конфигурации
  importConfig(config: Record<string, ProxyPool>): void {
    this.stopHealthChecks()
    this.proxyPools.clear()

    for (const [poolName, pool] of Object.entries(config)) {
      this.proxyPools.set(poolName, pool)
    }

    this.startHealthChecks()
    console.log("[ProxyConfigManager] Configuration imported successfully")
  }
}
