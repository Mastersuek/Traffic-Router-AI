// Система сбора метрик для мониторинга производительности

export interface Metric {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
  type: "counter" | "gauge" | "histogram" | "timer"
}

export interface MetricsSummary {
  totalRequests: number
  requestsPerSecond: number
  averageLatency: number
  errorRate: number
  proxyUtilization: number
  memoryUsage: number
  cpuUsage: number
  activeConnections: number
  bytesTransferred: number
}

export class MetricsCollector {
  private metrics = new Map<string, Metric[]>()
  private counters = new Map<string, number>()
  private gauges = new Map<string, number>()
  private timers = new Map<string, number[]>()
  private maxMetricsAge = 24 * 60 * 60 * 1000 // 24 часа
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    this.startCleanupTimer()
  }

  // Увеличение счетчика
  incrementCounter(name: string, value = 1, tags?: Record<string, string>): void {
    const current = this.counters.get(name) || 0
    this.counters.set(name, current + value)

    this.addMetric({
      name,
      value: current + value,
      timestamp: Date.now(),
      tags,
      type: "counter",
    })
  }

  // Установка значения gauge
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.gauges.set(name, value)

    this.addMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      type: "gauge",
    })
  }

  // Запись времени выполнения
  recordTimer(name: string, duration: number, tags?: Record<string, string>): void {
    if (!this.timers.has(name)) {
      this.timers.set(name, [])
    }
    this.timers.get(name)!.push(duration)

    this.addMetric({
      name,
      value: duration,
      timestamp: Date.now(),
      tags,
      type: "timer",
    })
  }

  // Запись гистограммы
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      type: "histogram",
    })
  }

  private addMetric(metric: Metric): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, [])
    }
    this.metrics.get(metric.name)!.push(metric)
  }

  // Получение сводки метрик
  getSummary(): MetricsSummary {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Подсчет запросов за последнюю минуту
    const recentRequests = this.getMetricValues("http.requests", oneMinuteAgo)
    const requestsPerSecond = recentRequests.length / 60

    // Средняя задержка
    const latencies = this.getMetricValues("http.latency", oneMinuteAgo)
    const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0

    // Частота ошибок
    const totalRequests = this.counters.get("http.requests") || 0
    const errorRequests = this.counters.get("http.errors") || 0
    const errorRate = totalRequests > 0 ? errorRequests / totalRequests : 0

    return {
      totalRequests,
      requestsPerSecond,
      averageLatency,
      errorRate,
      proxyUtilization: this.gauges.get("proxy.utilization") || 0,
      memoryUsage: this.gauges.get("system.memory") || 0,
      cpuUsage: this.gauges.get("system.cpu") || 0,
      activeConnections: this.gauges.get("connections.active") || 0,
      bytesTransferred: this.counters.get("bytes.transferred") || 0,
    }
  }

  // Получение значений метрики за период
  getMetricValues(name: string, since?: number): number[] {
    const metrics = this.metrics.get(name) || []
    const filtered = since ? metrics.filter((m) => m.timestamp >= since) : metrics
    return filtered.map((m) => m.value)
  }

  // Получение временного ряда метрики
  getTimeSeries(name: string, interval = 60000, points = 60): Array<{ timestamp: number; value: number }> {
    const metrics = this.metrics.get(name) || []
    const now = Date.now()
    const result: Array<{ timestamp: number; value: number }> = []

    for (let i = 0; i < points; i++) {
      const timestamp = now - i * interval
      const periodMetrics = metrics.filter((m) => m.timestamp >= timestamp - interval && m.timestamp < timestamp)

      let value = 0
      if (periodMetrics.length > 0) {
        if (metrics[0]?.type === "counter") {
          value = periodMetrics.length // Количество событий
        } else {
          value = periodMetrics.reduce((sum, m) => sum + m.value, 0) / periodMetrics.length // Среднее
        }
      }

      result.unshift({ timestamp, value })
    }

    return result
  }

  // Получение топ метрик по тегам
  getTopMetricsByTag(name: string, tagKey: string, limit = 10): Array<{ tag: string; value: number }> {
    const metrics = this.metrics.get(name) || []
    const tagCounts = new Map<string, number>()

    for (const metric of metrics) {
      if (metric.tags && metric.tags[tagKey]) {
        const tag = metric.tags[tagKey]
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + metric.value)
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, value]) => ({ tag, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
  }

  // Очистка старых метрик
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.maxMetricsAge

      for (const [name, metrics] of this.metrics.entries()) {
        const filtered = metrics.filter((m) => m.timestamp >= cutoff)
        this.metrics.set(name, filtered)
      }
    }, 60000) // Очистка каждую минуту
  }

  // Экспорт метрик в формате Prometheus
  exportPrometheus(): string {
    const lines: string[] = []

    // Счетчики
    for (const [name, value] of this.counters.entries()) {
      lines.push(`# TYPE ${name.replace(/\./g, "_")} counter`)
      lines.push(`${name.replace(/\./g, "_")} ${value}`)
    }

    // Gauges
    for (const [name, value] of this.gauges.entries()) {
      lines.push(`# TYPE ${name.replace(/\./g, "_")} gauge`)
      lines.push(`${name.replace(/\./g, "_")} ${value}`)
    }

    return lines.join("\n")
  }

  // Сброс всех метрик
  reset(): void {
    this.metrics.clear()
    this.counters.clear()
    this.gauges.clear()
    this.timers.clear()
  }

  // Остановка сборщика
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}
