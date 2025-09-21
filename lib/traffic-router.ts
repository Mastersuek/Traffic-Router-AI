import { GeolocationHandler } from "./geolocation-handler"
import type { RouterConfig, AIServiceConfig } from "./types"

export class TrafficRouter {
  private geoHandler: GeolocationHandler
  private config: RouterConfig
  private aiServices: AIServiceConfig[]

  constructor(config: RouterConfig) {
    this.config = config
    this.geoHandler = new GeolocationHandler(config.virtualLocation, config.proxy)
    this.aiServices = config.aiServices
  }

  // Основная функция маршрутизации
  async routeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const shouldProxy = this.geoHandler.shouldUseProxy(url)
    const isAIService = this.isAIService(url)

    console.log(`[TrafficRouter] Routing ${url}, proxy: ${shouldProxy}, AI: ${isAIService}`)

    if (shouldProxy || isAIService) {
      return this.routeThroughProxy(url, options)
    } else {
      return this.routeDirect(url, options)
    }
  }

  // Прямая маршрутизация (для российских сайтов)
  private async routeDirect(url: string, options: RequestInit): Promise<Response> {
    console.log(`[TrafficRouter] Direct route to ${url}`)
    return fetch(url, options)
  }

  // Маршрутизация через прокси
  private async routeThroughProxy(url: string, options: RequestInit): Promise<Response> {
    console.log(`[TrafficRouter] Proxy route to ${url}`)

    const proxyHeaders = {
      ...options.headers,
      ...this.geoHandler.getVirtualLocationHeaders(),
      "User-Agent": this.getRandomUserAgent(),
    }

    const proxyOptions: RequestInit = {
      ...options,
      headers: proxyHeaders,
    }

    // В реальной реализации здесь будет подключение к прокси-серверу
    // Для демонстрации используем обычный fetch с дополнительными заголовками
    return fetch(url, proxyOptions)
  }

  // Проверка, является ли сервис AI-сервисом
  private isAIService(url: string): boolean {
    const domain = new URL(url).hostname.toLowerCase()
    return this.aiServices.some((service) => service.domains.some((d) => domain.includes(d)))
  }

  // Генерация случайного User-Agent для обхода детекции
  private getRandomUserAgent(): string {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]
    return userAgents[Math.floor(Math.random() * userAgents.length)]
  }

  // Применение правил трафика
  applyTrafficRules(url: string): "direct" | "proxy" | "block" {
    const sortedRules = this.config.trafficRules.sort((a, b) => b.priority - a.priority)

    for (const rule of sortedRules) {
      if (this.matchesPattern(url, rule.pattern)) {
        console.log(`[TrafficRouter] Applied rule ${rule.id}: ${rule.action}`)
        return rule.action
      }
    }

    // По умолчанию используем геолокационную логику
    return this.geoHandler.shouldUseProxy(url) ? "proxy" : "direct"
  }

  private matchesPattern(url: string, pattern: string): boolean {
    // Простая реализация паттерн-матчинга
    const regex = new RegExp(pattern.replace(/\*/g, ".*"))
    return regex.test(url)
  }
}
