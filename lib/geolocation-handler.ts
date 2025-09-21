import type { VirtualLocation, ProxyConfig } from "./types"
import { GeoIPDatabase } from "./geoip-database"
import { DomainClassifier } from "./domain-classifier"

export class GeolocationHandler {
  private virtualLocation: VirtualLocation
  private proxyConfig: ProxyConfig
  private geoipDb: GeoIPDatabase
  private domainClassifier: DomainClassifier
  private requestStats = new Map<string, number>()

  constructor(virtualLocation: VirtualLocation, proxyConfig: ProxyConfig) {
    this.virtualLocation = virtualLocation
    this.proxyConfig = proxyConfig
    this.geoipDb = new GeoIPDatabase()
    this.domainClassifier = new DomainClassifier()
  }

  // Определение региона по домену с улучшенной логикой
  async detectRegion(url: string): Promise<"RU" | "US" | "EU" | "CN" | "GLOBAL"> {
    try {
      const hostname = new URL(url).hostname
      const domainInfo = this.domainClassifier.classifyDomain(hostname)

      // Обновляем статистику
      this.updateStats(hostname)

      console.log(`[GeolocationHandler] ${hostname} -> ${domainInfo.region} (${domainInfo.category})`)
      return domainInfo.region
    } catch (error) {
      console.error(`[GeolocationHandler] Error detecting region for ${url}:`, error)
      return "GLOBAL"
    }
  }

  // Проверка необходимости использования прокси с учетом приоритетов
  async shouldUseProxy(url: string): Promise<boolean> {
    try {
      const hostname = new URL(url).hostname
      const domainInfo = this.domainClassifier.classifyDomain(hostname)

      // Российские домены всегда идут напрямую
      if (domainInfo.region === "RU") {
        return false
      }

      // AI сервисы и высокоприоритетные домены всегда через прокси
      if (domainInfo.category === "ai" || domainInfo.priority >= 80) {
        return true
      }

      // Остальные по настройкам
      return domainInfo.requiresProxy
    } catch (error) {
      console.error(`[GeolocationHandler] Error checking proxy requirement for ${url}:`, error)
      return true // По умолчанию через прокси для безопасности
    }
  }

  // Получение конфигурации прокси с балансировкой
  getProxyConfig(): ProxyConfig & { endpoint?: string } {
    // Простая балансировка между несколькими прокси
    const proxyEndpoints = ["proxy1.example.com:1080", "proxy2.example.com:1080", "proxy3.example.com:1080"]

    const randomEndpoint = proxyEndpoints[Math.floor(Math.random() * proxyEndpoints.length)]

    return {
      ...this.proxyConfig,
      endpoint: randomEndpoint,
    }
  }

  // Подмена геолокации для AI сервисов с ротацией
  getVirtualLocationHeaders(): Record<string, string> {
    const locations = [
      { city: "New York", country: "US", lat: 40.7128, lon: -74.006 },
      { city: "Los Angeles", country: "US", lat: 34.0522, lon: -118.2437 },
      { city: "Chicago", country: "US", lat: 41.8781, lon: -87.6298 },
    ]

    const randomLocation = locations[Math.floor(Math.random() * locations.length)]

    return {
      "X-Forwarded-For": this.generateVirtualIP(randomLocation.country),
      "GeoIP-Country": randomLocation.country,
      "CF-IPCountry": randomLocation.country,
      "X-Real-IP": this.generateVirtualIP(randomLocation.country),
      "X-Geo-City": randomLocation.city,
      "X-Geo-Lat": randomLocation.lat.toString(),
      "X-Geo-Lon": randomLocation.lon.toString(),
    }
  }

  // Генерация виртуального IP с учетом страны
  private generateVirtualIP(country: string): string {
    const ipRanges: Record<string, string[]> = {
      US: ["8.8.8.", "1.1.1.", "208.67.222.", "4.4.4."],
      EU: ["1.1.1.", "8.8.4.", "9.9.9."],
      GLOBAL: ["8.8.8.", "1.1.1."],
    }

    const ranges = ipRanges[country] || ipRanges.GLOBAL
    const randomRange = ranges[Math.floor(Math.random() * ranges.length)]
    const lastOctet = Math.floor(Math.random() * 254) + 1

    return `${randomRange}${lastOctet}`
  }

  // Обновление статистики запросов
  private updateStats(hostname: string): void {
    const current = this.requestStats.get(hostname) || 0
    this.requestStats.set(hostname, current + 1)
  }

  // Получение статистики использования
  getUsageStats(): Record<string, any> {
    const domainStats = this.domainClassifier.getStats()
    const topDomains = Array.from(this.requestStats.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)

    return {
      domainClassification: domainStats,
      topDomains: Object.fromEntries(topDomains),
      totalRequests: Array.from(this.requestStats.values()).reduce((a, b) => a + b, 0),
    }
  }

  // Добавление пользовательского правила маршрутизации
  addCustomRoutingRule(hostname: string, region: "RU" | "US" | "EU" | "CN" | "GLOBAL", requiresProxy: boolean): void {
    this.domainClassifier.addCustomRule(hostname, {
      region,
      category: "other",
      requiresProxy,
      priority: 60,
    })
  }

  // Обновление GeoIP базы данных
  async updateGeoIPDatabase(): Promise<boolean> {
    return await this.geoipDb.updateDatabase()
  }
}
