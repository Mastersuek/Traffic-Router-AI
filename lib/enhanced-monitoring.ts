import { EventEmitter } from 'events';
import winston from 'winston';
import { createHash } from 'crypto';

interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram';
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  lastCheck: Date;
  responseTime?: number;
  details?: Record<string, any>;
}

interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export class EnhancedMonitoring extends EventEmitter {
  private metrics: Map<string, MetricData[]> = new Map();
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Alert[] = [];
  private logger: winston.Logger;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/monitoring.log' })
      ]
    });

    // Очистка старых метрик каждые 5 минут
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 5 * 60 * 1000);

    this.setupDefaultHealthChecks();
    this.startSystemMonitoring();
  }

  // Метрики
  public recordMetric(name: string, value: number, labels: Record<string, string> = {}, type: 'counter' | 'gauge' | 'histogram' = 'gauge'): void {
    const metric: MetricData = {
      name,
      value,
      timestamp: new Date(),
      labels,
      type
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
    
    // Ограничиваем количество метрик (последние 1000 записей)
    const metrics = this.metrics.get(name)!;
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    this.logger.debug(`Metric recorded: ${name}=${value}`, { labels, type });
    this.emit('metric', metric);
  }

  public getMetrics(name?: string, timeRange?: { start: Date; end: Date }): MetricData[] {
    if (name) {
      const metrics = this.metrics.get(name) || [];
      return timeRange ? this.filterByTimeRange(metrics, timeRange) : metrics;
    }

    const allMetrics: MetricData[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }

    return timeRange ? this.filterByTimeRange(allMetrics, timeRange) : allMetrics;
  }

  private filterByTimeRange(metrics: MetricData[], timeRange: { start: Date; end: Date }): MetricData[] {
    return metrics.filter(metric => 
      metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
    );
  }

  // Health Checks
  public registerHealthCheck(name: string, checkFunction: () => Promise<{ status: 'healthy' | 'unhealthy' | 'degraded'; message?: string; details?: any }>): void {
    this.healthChecks.set(name, {
      name,
      status: 'healthy',
      lastCheck: new Date()
    });

    // Запускаем проверку каждые 30 секунд
    setInterval(async () => {
      try {
        const startTime = Date.now();
        const result = await checkFunction();
        const responseTime = Date.now() - startTime;

        const healthCheck: HealthCheck = {
          name,
          status: result.status,
          message: result.message,
          lastCheck: new Date(),
          responseTime,
          details: result.details
        };

        this.healthChecks.set(name, healthCheck);

        if (result.status !== 'healthy') {
          this.createAlert({
            severity: result.status === 'unhealthy' ? 'critical' : 'medium',
            message: `Health check failed: ${name} - ${result.message}`,
            metadata: { healthCheck, responseTime }
          });
        }

        this.emit('healthCheck', healthCheck);
      } catch (error) {
        this.logger.error(`Health check error for ${name}:`, error);
        
        const healthCheck: HealthCheck = {
          name,
          status: 'unhealthy',
          message: `Check failed: ${error}`,
          lastCheck: new Date()
        };

        this.healthChecks.set(name, healthCheck);
        this.createAlert({
          severity: 'critical',
          message: `Health check exception: ${name} - ${error}`,
          metadata: { error: String(error) }
        });
      }
    }, 30000);
  }

  public getHealthStatus(): Record<string, HealthCheck> {
    return Object.fromEntries(this.healthChecks);
  }

  // Алерты
  public createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const newAlert: Alert = {
      ...alert,
      id: createHash('md5').update(`${alert.message}-${Date.now()}`).digest('hex').substring(0, 8),
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(newAlert);
    this.logger.warn(`Alert created: ${newAlert.severity.toUpperCase()} - ${newAlert.message}`);
    this.emit('alert', newAlert);

    // Отправляем критические алерты немедленно
    if (newAlert.severity === 'critical') {
      this.sendCriticalAlert(newAlert);
    }
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.logger.info(`Alert resolved: ${alertId} - ${alert.message}`);
      this.emit('alertResolved', alert);
      return true;
    }
    return false;
  }

  public getAlerts(resolved?: boolean): Alert[] {
    return resolved !== undefined ? this.alerts.filter(a => a.resolved === resolved) : this.alerts;
  }

  private sendCriticalAlert(alert: Alert): void {
    // Здесь можно добавить отправку в Telegram, Email, Slack и т.д.
    this.logger.error(`CRITICAL ALERT: ${alert.message}`, alert.metadata);
    
    // Отправляем в консоль для демонстрации
    console.error(`🚨 CRITICAL ALERT: ${alert.message}`);
  }

  // Системный мониторинг
  private setupDefaultHealthChecks(): void {
    // Проверка использования памяти
    this.registerHealthCheck('memory_usage', async () => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const usagePercent = (usage.heapUsed / usage.heapTotal) * 100;

      this.recordMetric('memory_heap_used_mb', heapUsedMB);
      this.recordMetric('memory_heap_total_mb', heapTotalMB);
      this.recordMetric('memory_usage_percent', usagePercent);

      if (usagePercent > 90) {
        return { status: 'unhealthy', message: `High memory usage: ${usagePercent.toFixed(1)}%` };
      } else if (usagePercent > 80) {
        return { status: 'degraded', message: `Elevated memory usage: ${usagePercent.toFixed(1)}%` };
      }

      return { status: 'healthy', details: { heapUsedMB, heapTotalMB, usagePercent } };
    });

    // Проверка CPU
    this.registerHealthCheck('cpu_usage', async () => {
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      this.recordMetric('cpu_usage_seconds', cpuPercent);

      if (cpuPercent > 100) { // 100% CPU for more than 1 second
        return { status: 'unhealthy', message: `High CPU usage: ${cpuPercent.toFixed(1)}s` };
      }

      return { status: 'healthy', details: { cpuPercent } };
    });

    // Проверка времени работы
    this.registerHealthCheck('uptime', async () => {
      const uptime = process.uptime();
      this.recordMetric('uptime_seconds', uptime);

      return { 
        status: 'healthy', 
        details: { 
          uptime: Math.round(uptime),
          uptimeFormatted: this.formatUptime(uptime)
        } 
      };
    });
  }

  private startSystemMonitoring(): void {
    // Записываем системные метрики каждые 10 секунд
    setInterval(() => {
      const usage = process.memoryUsage();
      const cpu = process.cpuUsage();
      
      this.recordMetric('memory_rss_mb', Math.round(usage.rss / 1024 / 1024));
      this.recordMetric('memory_external_mb', Math.round(usage.external / 1024 / 1024));
      this.recordMetric('cpu_user_microseconds', cpu.user);
      this.recordMetric('cpu_system_microseconds', cpu.system);
      this.recordMetric('process_uptime', process.uptime());
    }, 10000);
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 часа назад

    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(metric => metric.timestamp > cutoffTime);
      this.metrics.set(name, filtered);
    }

    // Очистка старых алертов (старше 7 дней)
    const alertCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp > alertCutoff);

    this.logger.debug('Cleaned up old metrics and alerts');
  }

  // Получение сводки
  public getSystemSummary(): any {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const healthChecks = this.getHealthStatus();
    const activeAlerts = this.getAlerts(false);
    const recentMetrics = this.getMetrics(undefined, { start: lastHour, end: now });

    return {
      timestamp: now,
      health: {
        overall: Object.values(healthChecks).every(hc => hc.status === 'healthy') ? 'healthy' : 'unhealthy',
        checks: healthChecks
      },
      alerts: {
        total: this.alerts.length,
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length
      },
      metrics: {
        total: recentMetrics.length,
        types: [...new Set(recentMetrics.map(m => m.name))]
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
      }
    };
  }

  // Graceful shutdown
  public shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.removeAllListeners();
    this.logger.info('Enhanced monitoring shutdown');
  }
}
