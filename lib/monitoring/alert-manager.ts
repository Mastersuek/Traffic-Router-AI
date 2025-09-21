// Система управления алертами и уведомлениями

export interface AlertRule {
  id: string
  name: string
  condition: string // Условие в виде строки, например "error_rate > 0.05"
  threshold: number
  duration: number // Время в мс, в течение которого условие должно выполняться
  severity: "low" | "medium" | "high" | "critical"
  enabled: boolean
  lastTriggered?: number
  description?: string
}

export interface Alert {
  id: string
  ruleId: string
  name: string
  severity: "low" | "medium" | "high" | "critical"
  message: string
  timestamp: number
  resolved: boolean
  resolvedAt?: number
  metadata?: Record<string, any>
}

export interface NotificationChannel {
  id: string
  type: "email" | "webhook" | "telegram" | "slack"
  config: Record<string, any>
  enabled: boolean
}

export class AlertManager {
  private rules = new Map<string, AlertRule>()
  private activeAlerts = new Map<string, Alert>()
  private alertHistory: Alert[] = []
  private channels = new Map<string, NotificationChannel>()
  private checkInterval: NodeJS.Timeout
  private metricsCollector: any

  constructor(metricsCollector: any) {
    this.metricsCollector = metricsCollector
    this.initializeDefaultRules()
    this.startAlertChecking()
  }

  private initializeDefaultRules(): void {
    // Высокая частота ошибок
    this.addRule({
      id: "high-error-rate",
      name: "Высокая частота ошибок",
      condition: "error_rate > 0.05",
      threshold: 0.05,
      duration: 300000, // 5 минут
      severity: "high",
      enabled: true,
      description: "Частота ошибок превышает 5%",
    })

    // Высокая задержка
    this.addRule({
      id: "high-latency",
      name: "Высокая задержка",
      condition: "average_latency > 5000",
      threshold: 5000,
      duration: 180000, // 3 минуты
      severity: "medium",
      enabled: true,
      description: "Средняя задержка превышает 5 секунд",
    })

    // Низкая утилизация прокси
    this.addRule({
      id: "low-proxy-utilization",
      name: "Низкая утилизация прокси",
      condition: "proxy_utilization < 0.1",
      threshold: 0.1,
      duration: 600000, // 10 минут
      severity: "low",
      enabled: true,
      description: "Утилизация прокси ниже 10%",
    })

    // Высокое использование памяти
    this.addRule({
      id: "high-memory-usage",
      name: "Высокое использование памяти",
      condition: "memory_usage > 0.85",
      threshold: 0.85,
      duration: 300000, // 5 минут
      severity: "high",
      enabled: true,
      description: "Использование памяти превышает 85%",
    })

    // Критическое количество активных соединений
    this.addRule({
      id: "too-many-connections",
      name: "Слишком много соединений",
      condition: "active_connections > 1000",
      threshold: 1000,
      duration: 120000, // 2 минуты
      severity: "critical",
      enabled: true,
      description: "Количество активных соединений превышает 1000",
    })
  }

  // Добавление правила алерта
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule)
    console.log(`[AlertManager] Added alert rule: ${rule.name}`)
  }

  // Удаление правила алерта
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId)
    console.log(`[AlertManager] Removed alert rule: ${ruleId}`)
  }

  // Обновление правила алерта
  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId)
    if (rule) {
      this.rules.set(ruleId, { ...rule, ...updates })
      console.log(`[AlertManager] Updated alert rule: ${ruleId}`)
    }
  }

  // Добавление канала уведомлений
  addNotificationChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel)
    console.log(`[AlertManager] Added notification channel: ${channel.type}`)
  }

  // Запуск проверки алертов
  private startAlertChecking(): void {
    this.checkInterval = setInterval(() => {
      this.checkAlerts()
    }, 30000) // Проверка каждые 30 секунд
  }

  // Проверка всех правил алертов
  private async checkAlerts(): Promise<void> {
    const summary = this.metricsCollector.getSummary()

    for (const [ruleId, rule] of this.rules.entries()) {
      if (!rule.enabled) continue

      const isTriggered = this.evaluateRule(rule, summary)

      if (isTriggered) {
        await this.handleTriggeredRule(rule, summary)
      } else {
        await this.handleResolvedRule(rule)
      }
    }
  }

  // Оценка правила алерта
  private evaluateRule(rule: AlertRule, summary: any): boolean {
    switch (rule.condition) {
      case "error_rate > 0.05":
        return summary.errorRate > rule.threshold
      case "average_latency > 5000":
        return summary.averageLatency > rule.threshold
      case "proxy_utilization < 0.1":
        return summary.proxyUtilization < rule.threshold
      case "memory_usage > 0.85":
        return summary.memoryUsage > rule.threshold
      case "active_connections > 1000":
        return summary.activeConnections > rule.threshold
      default:
        return false
    }
  }

  // Обработка сработавшего правила
  private async handleTriggeredRule(rule: AlertRule, summary: any): Promise<void> {
    const now = Date.now()
    const existingAlert = this.activeAlerts.get(rule.id)

    if (existingAlert) {
      // Алерт уже активен, проверяем длительность
      if (now - existingAlert.timestamp >= rule.duration) {
        // Алерт активен достаточно долго, отправляем уведомление
        await this.sendNotification(existingAlert)
      }
    } else {
      // Новый алерт
      const alert: Alert = {
        id: `${rule.id}-${now}`,
        ruleId: rule.id,
        name: rule.name,
        severity: rule.severity,
        message: this.generateAlertMessage(rule, summary),
        timestamp: now,
        resolved: false,
        metadata: { summary },
      }

      this.activeAlerts.set(rule.id, alert)
      this.alertHistory.push(alert)

      console.log(`[AlertManager] New alert triggered: ${rule.name}`)
    }
  }

  // Обработка разрешенного правила
  private async handleResolvedRule(rule: AlertRule): Promise<void> {
    const existingAlert = this.activeAlerts.get(rule.id)

    if (existingAlert && !existingAlert.resolved) {
      existingAlert.resolved = true
      existingAlert.resolvedAt = Date.now()

      this.activeAlerts.delete(rule.id)

      // Отправляем уведомление о разрешении
      await this.sendResolutionNotification(existingAlert)

      console.log(`[AlertManager] Alert resolved: ${rule.name}`)
    }
  }

  // Генерация сообщения алерта
  private generateAlertMessage(rule: AlertRule, summary: any): string {
    const messages: Record<string, string> = {
      "high-error-rate": `Частота ошибок: ${(summary.errorRate * 100).toFixed(2)}% (порог: ${(rule.threshold * 100).toFixed(2)}%)`,
      "high-latency": `Средняя задержка: ${summary.averageLatency.toFixed(0)}ms (порог: ${rule.threshold}ms)`,
      "low-proxy-utilization": `Утилизация прокси: ${(summary.proxyUtilization * 100).toFixed(2)}% (порог: ${(rule.threshold * 100).toFixed(2)}%)`,
      "high-memory-usage": `Использование памяти: ${(summary.memoryUsage * 100).toFixed(2)}% (порог: ${(rule.threshold * 100).toFixed(2)}%)`,
      "too-many-connections": `Активных соединений: ${summary.activeConnections} (порог: ${rule.threshold})`,
    }

    return messages[rule.id] || `${rule.name}: условие ${rule.condition} выполнено`
  }

  // Отправка уведомления
  private async sendNotification(alert: Alert): Promise<void> {
    for (const [channelId, channel] of this.channels.entries()) {
      if (!channel.enabled) continue

      try {
        await this.sendToChannel(channel, alert)
        console.log(`[AlertManager] Notification sent via ${channel.type}`)
      } catch (error) {
        console.error(`[AlertManager] Failed to send notification via ${channel.type}:`, error)
      }
    }
  }

  // Отправка уведомления о разрешении
  private async sendResolutionNotification(alert: Alert): Promise<void> {
    const resolutionMessage = `✅ РАЗРЕШЕНО: ${alert.name}\nВремя разрешения: ${new Date(alert.resolvedAt!).toLocaleString()}`

    for (const [channelId, channel] of this.channels.entries()) {
      if (!channel.enabled) continue

      try {
        await this.sendToChannel(channel, { ...alert, message: resolutionMessage })
        console.log(`[AlertManager] Resolution notification sent via ${channel.type}`)
      } catch (error) {
        console.error(`[AlertManager] Failed to send resolution notification via ${channel.type}:`, error)
      }
    }
  }

  // Отправка в конкретный канал
  private async sendToChannel(channel: NotificationChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case "webhook":
        await this.sendWebhook(channel.config.url, alert)
        break
      case "telegram":
        await this.sendTelegram(channel.config.botToken, channel.config.chatId, alert)
        break
      case "email":
        await this.sendEmail(channel.config, alert)
        break
      case "slack":
        await this.sendSlack(channel.config.webhookUrl, alert)
        break
    }
  }

  private async sendWebhook(url: string, alert: Alert): Promise<void> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alert: alert.name,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
      }),
    })

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`)
    }
  }

  private async sendTelegram(botToken: string, chatId: string, alert: Alert): Promise<void> {
    const severityEmojis = {
      low: "🟡",
      medium: "🟠",
      high: "🔴",
      critical: "🚨",
    }

    const message = `${severityEmojis[alert.severity]} *${alert.name}*\n\n${alert.message}\n\nВремя: ${new Date(alert.timestamp).toLocaleString()}`

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    })

    if (!response.ok) {
      throw new Error(`Telegram failed: ${response.status}`)
    }
  }

  private async sendEmail(config: any, alert: Alert): Promise<void> {
    // Упрощенная реализация отправки email
    console.log(`[AlertManager] Email notification: ${alert.name} - ${alert.message}`)
  }

  private async sendSlack(webhookUrl: string, alert: Alert): Promise<void> {
    const colors = {
      low: "#ffeb3b",
      medium: "#ff9800",
      high: "#f44336",
      critical: "#9c27b0",
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attachments: [
          {
            color: colors[alert.severity],
            title: alert.name,
            text: alert.message,
            ts: Math.floor(alert.timestamp / 1000),
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`Slack failed: ${response.status}`)
    }
  }

  // Получение активных алертов
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
  }

  // Получение истории алертов
  getAlertHistory(limit = 100): Alert[] {
    return this.alertHistory.slice(-limit)
  }

  // Получение статистики алертов
  getAlertStats(): Record<string, any> {
    const active = this.getActiveAlerts()
    const history = this.getAlertHistory()

    const severityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }

    for (const alert of active) {
      severityCounts[alert.severity]++
    }

    return {
      activeAlerts: active.length,
      totalAlerts: history.length,
      severityBreakdown: severityCounts,
      rulesCount: this.rules.size,
      channelsCount: this.channels.size,
    }
  }

  // Остановка менеджера алертов
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
  }
}
