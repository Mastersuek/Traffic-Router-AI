import { createServer } from "http"
import { AIServiceHandler } from "../lib/ai-service-handler"
import { AIProxyMiddleware } from "../lib/ai-proxy-middleware"
import { AIRequestOptimizer } from "../lib/ai-request-optimizer"
import { GeolocationHandler } from "../lib/geolocation-handler"
import { ConnectionManager } from "../lib/connection-manager"
import { ProxyConfigManager } from "../lib/proxy-config-manager"
import { loadConfig } from "../lib/config"

export class AIProxyServer {
  private server: any
  private aiHandler!: AIServiceHandler
  private middleware!: AIProxyMiddleware
  private optimizer!: AIRequestOptimizer
  private port: number

  constructor(port = 8080) {
    this.port = port
    this.initializeComponents()
  }

  private initializeComponents(): void {
    const config = loadConfig()

    // Инициализация компонентов
    const geoHandler = new GeolocationHandler(config.virtualLocation, config.proxy)
    const proxyManager = new ProxyConfigManager()
    const connectionManager = new ConnectionManager(proxyManager, {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableCompression: true,
      userAgentRotation: true,
    })

    this.aiHandler = new AIServiceHandler(geoHandler, connectionManager)
    this.middleware = new AIProxyMiddleware(this.aiHandler)
    this.optimizer = new AIRequestOptimizer()
  }

  start(): void {
    this.server = createServer(async (req, res) => {
      try {
        // Обработка CORS preflight
        if (req.method === "OPTIONS") {
          const response = this.middleware.handlePreflight(new Request(`http://localhost${req.url}`))
          this.sendResponse(res, response)
          return
        }

        // Создание Request объекта
        const request = await this.createRequest(req)

        // Обработка через middleware
        const response = await this.middleware.handleRequest(request)

        this.sendResponse(res, response)
      } catch (error) {
        console.error("[AIProxyServer] Error:", error)
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Internal server error" }))
      }
    })

    this.server.listen(this.port, () => {
      console.log(`[AIProxyServer] AI Proxy server listening on port ${this.port}`)
      console.log(`[AIProxyServer] Health check: http://localhost:${this.port}/health`)
    })

    // Graceful shutdown
    process.on("SIGTERM", () => this.shutdown())
    process.on("SIGINT", () => this.shutdown())
  }

  private async createRequest(req: any): Promise<Request> {
    const url = `http://localhost:${this.port}${req.url}`
    const headers = new Headers()

    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers.set(key, value)
      }
    }

    let body: string | undefined
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await new Promise((resolve) => {
        let data = ""
        req.on("data", (chunk: Buffer) => {
          data += chunk.toString()
        })
        req.on("end", () => resolve(data))
      })
    }

    return new Request(url, {
      method: req.method,
      headers,
      body,
    })
  }

  private async sendResponse(res: any, response: Response): Promise<void> {
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    res.writeHead(response.status, headers)

    if (response.body) {
      const reader = response.body.getReader()
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read()
        if (done) {
          res.end()
          return
        }
        res.write(value)
        return pump()
      }
      await pump()
    } else {
      res.end()
    }
  }

  private shutdown(): void {
    console.log("[AIProxyServer] Shutting down...")
    if (this.server) {
      this.server.close(() => {
        console.log("[AIProxyServer] Server closed")
        process.exit(0)
      })
    }
  }

  // Получение статистики сервера
  getStats(): Record<string, any> {
    return {
      ai: this.aiHandler.getAIStats(),
      cache: this.optimizer.getCacheStats(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }
  }
}

// Запуск сервера если файл выполняется напрямую
if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || "8080")
  const server = new AIProxyServer(port)
  server.start()
}
