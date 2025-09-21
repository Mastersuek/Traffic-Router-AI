import type { GeolocationHandler } from "./geolocation-handler"
import type { ConnectionManager } from "./connection-manager"

export interface AIProvider {
  name: string
  baseUrl: string
  apiKeyHeader: string
  requiresGeolocation: boolean
  supportedRegions: string[]
  rateLimit: {
    requestsPerMinute: number
    requestsPerHour: number
  }
  specialHeaders?: Record<string, string>
}

export interface AIRequest {
  provider: string
  endpoint: string
  method: string
  headers: Record<string, string>
  body?: any
  requiresProxy: boolean
}

export class AIServiceHandler {
  private geoHandler: GeolocationHandler
  private connectionManager: ConnectionManager
  private providers = new Map<string, AIProvider>()
  private requestCounts = new Map<string, { minute: number; hour: number; lastReset: Date }>()

  constructor(geoHandler: GeolocationHandler, connectionManager: ConnectionManager) {
    this.geoHandler = geoHandler
    this.connectionManager = connectionManager
    this.initializeProviders()
    this.startRateLimitReset()
  }

  private initializeProviders(): void {
    // OpenAI
    this.providers.set("openai", {
      name: "OpenAI",
      baseUrl: "https://api.openai.com",
      apiKeyHeader: "Authorization",
      requiresGeolocation: true,
      supportedRegions: ["US", "EU"],
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
      },
      specialHeaders: {
        "OpenAI-Organization": "optional-org-id",
      },
    })

    // Anthropic Claude
    this.providers.set("anthropic", {
      name: "Anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKeyHeader: "x-api-key",
      requiresGeolocation: true,
      supportedRegions: ["US"],
      rateLimit: {
        requestsPerMinute: 50,
        requestsPerHour: 800,
      },
      specialHeaders: {
        "anthropic-version": "2023-06-01",
      },
    })

    // Google AI
    this.providers.set("google", {
      name: "Google AI",
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKeyHeader: "Authorization",
      requiresGeolocation: true,
      supportedRegions: ["US", "EU"],
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 2000,
      },
    })

    // Hugging Face
    this.providers.set("huggingface", {
      name: "Hugging Face",
      baseUrl: "https://api-inference.huggingface.co",
      apiKeyHeader: "Authorization",
      requiresGeolocation: false,
      supportedRegions: ["GLOBAL"],
      rateLimit: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
      },
    })

    // Replicate
    this.providers.set("replicate", {
      name: "Replicate",
      baseUrl: "https://api.replicate.com",
      apiKeyHeader: "Authorization",
      requiresGeolocation: true,
      supportedRegions: ["US"],
      rateLimit: {
        requestsPerMinute: 20,
        requestsPerHour: 300,
      },
    })
  }

  // Обработка AI запроса с автоматической маршрутизацией
  async handleAIRequest(request: AIRequest): Promise<Response> {
    const provider = this.providers.get(request.provider)

    if (!provider) {
      throw new Error(`Unknown AI provider: ${request.provider}`)
    }

    // Проверка rate limit
    if (!this.checkRateLimit(request.provider)) {
      throw new Error(`Rate limit exceeded for provider: ${request.provider}`)
    }

    // Подготовка запроса
    const fullUrl = `${provider.baseUrl}${request.endpoint}`
    const headers = this.prepareHeaders(provider, request.headers)

    console.log(`[AIServiceHandler] Processing ${request.provider} request to ${request.endpoint}`)

    // Определение необходимости прокси
    const needsProxy = provider.requiresGeolocation || request.requiresProxy

    if (needsProxy) {
      return this.handleProxiedAIRequest(fullUrl, provider, request, headers)
    } else {
      return this.handleDirectAIRequest(fullUrl, request, headers)
    }
  }

  private async handleProxiedAIRequest(
    url: string,
    provider: AIProvider,
    request: AIRequest,
    headers: Record<string, string>,
  ): Promise<Response> {
    // Добавляем геолокационные заголовки
    const geoHeaders = this.geoHandler.getVirtualLocationHeaders()
    const combinedHeaders = { ...headers, ...geoHeaders }

    // Специальная обработка для разных провайдеров
    if (provider.name === "OpenAI") {
      combinedHeaders["CF-IPCountry"] = "US"
      combinedHeaders["X-Forwarded-For"] = this.generateUSIP()
    } else if (provider.name === "Anthropic") {
      combinedHeaders["CF-Ray"] = this.generateCloudflareRay()
      combinedHeaders["CF-Visitor"] = '{"scheme":"https"}'
    }

    const requestOptions: RequestInit = {
      method: request.method,
      headers: combinedHeaders,
      body: request.body ? JSON.stringify(request.body) : undefined,
    }

    return this.connectionManager.createConnection(url, "ai", requestOptions)
  }

  private async handleDirectAIRequest(
    url: string,
    request: AIRequest,
    headers: Record<string, string>,
  ): Promise<Response> {
    const requestOptions: RequestInit = {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
    }

    return fetch(url, requestOptions)
  }

  private prepareHeaders(provider: AIProvider, requestHeaders: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "TrafficRouter/1.0",
      ...requestHeaders,
    }

    // Добавляем специальные заголовки провайдера
    if (provider.specialHeaders) {
      Object.assign(headers, provider.specialHeaders)
    }

    return headers
  }

  // Проверка rate limit
  private checkRateLimit(providerId: string): boolean {
    const provider = this.providers.get(providerId)
    if (!provider) return false

    const now = new Date()
    const counts = this.requestCounts.get(providerId) || {
      minute: 0,
      hour: 0,
      lastReset: now,
    }

    // Проверяем лимиты
    if (counts.minute >= provider.rateLimit.requestsPerMinute) {
      console.warn(`[AIServiceHandler] Minute rate limit exceeded for ${providerId}`)
      return false
    }

    if (counts.hour >= provider.rateLimit.requestsPerHour) {
      console.warn(`[AIServiceHandler] Hour rate limit exceeded for ${providerId}`)
      return false
    }

    // Увеличиваем счетчики
    counts.minute++
    counts.hour++
    this.requestCounts.set(providerId, counts)

    return true
  }

  // Сброс счетчиков rate limit
  private startRateLimitReset(): void {
    // Сброс минутных счетчиков каждую минуту
    setInterval(() => {
      for (const [providerId, counts] of this.requestCounts.entries()) {
        counts.minute = 0
      }
    }, 60000)

    // Сброс часовых счетчиков каждый час
    setInterval(() => {
      for (const [providerId, counts] of this.requestCounts.entries()) {
        counts.hour = 0
      }
    }, 3600000)
  }

  // Генерация US IP адреса
  private generateUSIP(): string {
    const usRanges = ["8.8.8.", "8.8.4.", "1.1.1.", "4.4.4.", "208.67.222.", "208.67.220.", "9.9.9."]
    const range = usRanges[Math.floor(Math.random() * usRanges.length)]
    const lastOctet = Math.floor(Math.random() * 254) + 1
    return `${range}${lastOctet}`
  }

  // Генерация Cloudflare Ray ID
  private generateCloudflareRay(): string {
    const chars = "0123456789abcdef"
    let ray = ""
    for (let i = 0; i < 16; i++) {
      ray += chars[Math.floor(Math.random() * chars.length)]
    }
    return `${ray}-DFW`
  }

  // Получение статистики AI сервисов
  getAIStats(): Record<string, any> {
    const stats: Record<string, any> = {}

    for (const [providerId, provider] of this.providers.entries()) {
      const counts = this.requestCounts.get(providerId) || { minute: 0, hour: 0, lastReset: new Date() }

      stats[providerId] = {
        name: provider.name,
        requestsThisMinute: counts.minute,
        requestsThisHour: counts.hour,
        minuteLimit: provider.rateLimit.requestsPerMinute,
        hourLimit: provider.rateLimit.requestsPerHour,
        requiresGeolocation: provider.requiresGeolocation,
        supportedRegions: provider.supportedRegions,
      }
    }

    return stats
  }

  // Добавление пользовательского провайдера
  addCustomProvider(id: string, provider: AIProvider): void {
    this.providers.set(id, provider)
    console.log(`[AIServiceHandler] Added custom provider: ${provider.name}`)
  }

  // Обновление API ключа провайдера
  updateProviderApiKey(providerId: string, apiKey: string): void {
    const provider = this.providers.get(providerId)
    if (provider) {
      // В реальной реализации API ключи будут храниться отдельно
      console.log(`[AIServiceHandler] Updated API key for ${providerId}`)
    }
  }
}
