// Мониторинг производительности системы

export interface PerformanceMetrics {
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    used: number
    total: number
    usage: number
    heap: {
      used: number
      total: number
    }
  }
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
  }
  disk: {
    used: number
    total: number
    usage: number
    readOps: number
    writeOps: number
  }
  process: {
    uptime: number
    pid: number
    threads: number
    handles: number
  }
}

export class PerformanceMonitor {
  private metricsCollector: any
  private monitoringInterval!: NodeJS.Timeout
  private lastNetworkStats = { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 }
  private lastDiskStats = { readOps: 0, writeOps: 0 }

  constructor(metricsCollector: any) {
    this.metricsCollector = metricsCollector
    this.startMonitoring()
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, 10000) as unknown as NodeJS.Timeout // Сбор метрик каждые 10 секунд
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics()

      // Записываем метрики
      this.metricsCollector.setGauge("system.cpu.usage", metrics.cpu.usage)
      this.metricsCollector.setGauge("system.cpu.load_average", metrics.cpu.loadAverage[0])

      this.metricsCollector.setGauge("system.memory.used", metrics.memory.used)
      this.metricsCollector.setGauge("system.memory.usage", metrics.memory.usage)
      this.metricsCollector.setGauge("system.memory.heap.used", metrics.memory.heap.used)

      this.metricsCollector.incrementCounter(
        "system.network.bytes_in",
        metrics.network.bytesIn - this.lastNetworkStats.bytesIn,
      )
      this.metricsCollector.incrementCounter(
        "system.network.bytes_out",
        metrics.network.bytesOut - this.lastNetworkStats.bytesOut,
      )

      this.metricsCollector.setGauge("system.disk.usage", metrics.disk.usage)
      this.metricsCollector.incrementCounter("system.disk.read_ops", metrics.disk.readOps - this.lastDiskStats.readOps)
      this.metricsCollector.incrementCounter(
        "system.disk.write_ops",
        metrics.disk.writeOps - this.lastDiskStats.writeOps,
      )

      this.metricsCollector.setGauge("process.uptime", metrics.process.uptime)
      this.metricsCollector.setGauge("process.threads", metrics.process.threads)

      // Обновляем последние значения
      this.lastNetworkStats = { ...metrics.network }
      this.lastDiskStats = { readOps: metrics.disk.readOps, writeOps: metrics.disk.writeOps }
    } catch (error) {
      console.error("[PerformanceMonitor] Error collecting metrics:", error)
    }
  }

  private async getSystemMetrics(): Promise<PerformanceMetrics> {
    // В реальной реализации здесь будет сбор системных метрик
    // Для демонстрации используем mock данные и доступные Node.js API

    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    return {
      cpu: {
        usage: this.calculateCpuUsage(cpuUsage),
        loadAverage: this.getLoadAverage(),
      },
      memory: {
        used: memUsage.rss,
        total: this.getTotalMemory(),
        usage: memUsage.rss / this.getTotalMemory(),
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
        },
      },
      network: {
        bytesIn: this.getNetworkBytesIn(),
        bytesOut: this.getNetworkBytesOut(),
        packetsIn: this.getNetworkPacketsIn(),
        packetsOut: this.getNetworkPacketsOut(),
      },
      disk: {
        used: this.getDiskUsed(),
        total: this.getDiskTotal(),
        usage: this.getDiskUsed() / this.getDiskTotal(),
        readOps: this.getDiskReadOps(),
        writeOps: this.getDiskWriteOps(),
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        threads: this.getThreadCount(),
        handles: this.getHandleCount(),
      },
    }
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Упрощенный расчет использования CPU
    const totalUsage = cpuUsage.user + cpuUsage.system
    return Math.min(totalUsage / 1000000, 1) // Нормализуем к 0-1
  }

  private getLoadAverage(): number[] {
    try {
      const os = require("os")
      return os.loadavg()
    } catch {
      return [0, 0, 0]
    }
  }

  private getTotalMemory(): number {
    try {
      const os = require("os")
      return os.totalmem()
    } catch {
      return 8 * 1024 * 1024 * 1024 // 8GB по умолчанию
    }
  }

  private getNetworkBytesIn(): number {
    // Mock данные - в реальности читаем из /proc/net/dev или используем системные API
    return Math.floor(Math.random() * 1000000)
  }

  private getNetworkBytesOut(): number {
    return Math.floor(Math.random() * 1000000)
  }

  private getNetworkPacketsIn(): number {
    return Math.floor(Math.random() * 10000)
  }

  private getNetworkPacketsOut(): number {
    return Math.floor(Math.random() * 10000)
  }

  private getDiskUsed(): number {
    // Mock данные - в реальности используем fs.statSync или системные API
    return Math.floor(Math.random() * 100 * 1024 * 1024 * 1024) // До 100GB
  }

  private getDiskTotal(): number {
    return 500 * 1024 * 1024 * 1024 // 500GB
  }

  private getDiskReadOps(): number {
    return Math.floor(Math.random() * 1000)
  }

  private getDiskWriteOps(): number {
    return Math.floor(Math.random() * 1000)
  }

  private getThreadCount(): number {
    // В Node.js нет прямого способа получить количество потоков
    return 1
  }

  private getHandleCount(): number {
    // Приблизительное количество дескрипторов
    return Math.floor(Math.random() * 100) + 10
  }

  // Получение текущих метрик производительности
  getCurrentMetrics(): Promise<PerformanceMetrics> {
    return this.getSystemMetrics()
  }

  // Получение исторических данных производительности
  getHistoricalMetrics(hours = 24): Record<string, any> {
    const metrics = ["system.cpu.usage", "system.memory.usage", "system.disk.usage", "process.uptime"]

    const result: Record<string, any> = {}

    for (const metric of metrics) {
      result[metric] = this.metricsCollector.getTimeSeries(metric, 60000, hours * 60)
    }

    return result
  }

  // Анализ производительности
  analyzePerformance(): Record<string, any> {
    const current = this.metricsCollector.getSummary()

    const analysis = {
      status: "healthy",
      issues: [] as string[],
      recommendations: [] as string[],
      score: 100,
    }

    // Анализ использования CPU
    if (current.cpuUsage > 0.8) {
      analysis.issues.push("Высокое использование CPU")
      analysis.recommendations.push("Рассмотрите масштабирование или оптимизацию")
      analysis.score -= 20
    }

    // Анализ использования памяти
    if (current.memoryUsage > 0.85) {
      analysis.issues.push("Высокое использование памяти")
      analysis.recommendations.push("Проверьте утечки памяти или увеличьте RAM")
      analysis.score -= 25
    }

    // Анализ задержки
    if (current.averageLatency > 3000) {
      analysis.issues.push("Высокая задержка ответов")
      analysis.recommendations.push("Оптимизируйте прокси-серверы или сетевое подключение")
      analysis.score -= 15
    }

    // Анализ частоты ошибок
    if (current.errorRate > 0.02) {
      analysis.issues.push("Повышенная частота ошибок")
      analysis.recommendations.push("Проверьте логи и стабильность прокси-серверов")
      analysis.score -= 30
    }

    // Определение общего статуса
    if (analysis.score >= 80) {
      analysis.status = "healthy"
    } else if (analysis.score >= 60) {
      analysis.status = "warning"
    } else {
      analysis.status = "critical"
    }

    return analysis
  }

  // Остановка мониторинга
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
  }
}
