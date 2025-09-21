import type { AIServiceHandler, AIRequest } from "./ai-service-handler"

export class AIProxyMiddleware {
  private aiHandler: AIServiceHandler
  private blockedRegions = new Set(["RU", "CN", "IR", "KP"])

  constructor(aiHandler: AIServiceHandler) {
    this.aiHandler = aiHandler
  }

  // Middleware для обработки AI запросов
  async handleRequest(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url)
      const provider = this.detectProvider(url.hostname)

      if (!provider) {
        return new Response("Unknown AI provider", { status: 400 })
      }

      // Проверка региональных ограничений
      const clientRegion = await this.detectClientRegion(req)
      if (this.blockedRegions.has(clientRegion)) {
        console.log(`[AIProxyMiddleware] Blocked request from region: ${clientRegion}`)
        return new Response("Service not available in your region", { status: 403 })
      }

      // Подготовка AI запроса
      const aiRequest: AIRequest = {
        provider,
        endpoint: url.pathname + url.search,
        method: req.method,
        headers: this.extractHeaders(req),
        body: req.method !== "GET" ? await req.json().catch(() => null) : undefined,
        requiresProxy: true,
      }

      // Обработка через AI handler
      const response = await this.aiHandler.handleAIRequest(aiRequest)

      // Добавляем CORS заголовки
      const corsHeaders = this.getCorsHeaders()
      const responseHeaders = new Headers(response.headers)

      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value)
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    } catch (error) {
      console.error("[AIProxyMiddleware] Error processing request:", error)
      return new Response("Internal server error", { status: 500 })
    }
  }

  private detectProvider(hostname: string): string | null {
    const providerMap: Record<string, string> = {
      "api.openai.com": "openai",
      "openai.com": "openai",
      "api.anthropic.com": "anthropic",
      "claude.ai": "anthropic",
      "generativelanguage.googleapis.com": "google",
      "ai.google.dev": "google",
      "api-inference.huggingface.co": "huggingface",
      "huggingface.co": "huggingface",
      "api.replicate.com": "replicate",
      "replicate.com": "replicate",
    }

    return providerMap[hostname.toLowerCase()] || null
  }

  private async detectClientRegion(req: Request): Promise<string> {
    // Проверяем заголовки геолокации
    const cfCountry = req.headers.get("CF-IPCountry")
    if (cfCountry) return cfCountry

    const xForwardedFor = req.headers.get("X-Forwarded-For")
    if (xForwardedFor) {
      const ip = xForwardedFor.split(",")[0].trim()
      // В реальной реализации здесь будет GeoIP lookup
      return this.mockGeoIPLookup(ip)
    }

    return "UNKNOWN"
  }

  private mockGeoIPLookup(ip: string): string {
    // Упрощенная проверка российских IP
    const russianRanges = ["5.34.", "37.9.", "77.88.", "87.250.", "93.158."]
    if (russianRanges.some((range) => ip.startsWith(range))) {
      return "RU"
    }
    return "US"
  }

  private extractHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {}

    // Копируем важные заголовки
    const importantHeaders = ["authorization", "x-api-key", "content-type", "user-agent", "accept", "accept-encoding"]

    for (const header of importantHeaders) {
      const value = req.headers.get(header)
      if (value) {
        headers[header] = value
      }
    }

    return headers
  }

  private getCorsHeaders(): Record<string, string> {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      "Access-Control-Max-Age": "86400",
    }
  }

  // Обработка preflight запросов
  handlePreflight(req: Request): Response {
    return new Response(null, {
      status: 200,
      headers: this.getCorsHeaders(),
    })
  }
}
