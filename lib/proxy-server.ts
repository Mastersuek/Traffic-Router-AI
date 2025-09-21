import { createServer, type IncomingMessage, type ServerResponse } from "http"
import { TrafficRouter } from "./traffic-router"
import { loadConfig } from "./config"

export class ProxyServer {
  private router: TrafficRouter
  private config = loadConfig()

  constructor() {
    this.router = new TrafficRouter(this.config)
  }

  start(port = 8080): void {
    const server = createServer(this.handleRequest.bind(this))

    server.listen(port, () => {
      console.log(`[ProxyServer] Listening on port ${port}`)
      console.log(
        `[ProxyServer] Virtual location: ${this.config.virtualLocation.city}, ${this.config.virtualLocation.country}`,
      )
    })

    // Обработка HTTPS CONNECT запросов
    server.on("connect", this.handleConnect.bind(this))
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = req.url
      if (!url) {
        res.writeHead(400)
        res.end("Bad Request")
        return
      }

      console.log(`[ProxyServer] ${req.method} ${url}`)

      // Определяем полный URL
      const targetUrl = url.startsWith("http") ? url : `http://${req.headers.host}${url}`

      // Маршрутизируем запрос
      const response = await this.router.routeRequest(targetUrl, {
        method: req.method,
        headers: this.convertHeaders(req.headers),
      })

      // Передаем ответ клиенту
      res.writeHead(response.status, response.statusText, this.convertResponseHeaders(response.headers))

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
    } catch (error) {
      console.error("[ProxyServer] Error:", error)
      res.writeHead(500)
      res.end("Internal Server Error")
    }
  }

  private handleConnect(req: IncomingMessage, socket: any, head: Buffer): void {
    console.log(`[ProxyServer] CONNECT ${req.url}`)

    // Для HTTPS туннелирования
    const [host, port] = req.url!.split(":")
    const targetPort = Number.parseInt(port) || 443

    // В реальной реализации здесь будет создание туннеля
    socket.write("HTTP/1.1 200 Connection Established\r\n\r\n")
  }

  private convertHeaders(headers: IncomingMessage["headers"]): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        result[key] = value
      } else if (Array.isArray(value)) {
        result[key] = value.join(", ")
      }
    }
    return result
  }

  private convertResponseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
}
