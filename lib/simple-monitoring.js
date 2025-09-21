const { EventEmitter } = require('events');
const winston = require('winston');

class SimpleMonitoring extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.healthChecks = new Map();
    this.alerts = [];
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

    this.setupDefaultHealthChecks();
    this.startSystemMonitoring();
  }

  recordMetric(name, value, labels = {}, type = 'gauge') {
    const metric = {
      name,
      value,
      timestamp: new Date(),
      labels,
      type
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name).push(metric);
    
    // Ограничиваем количество метрик (последние 1000 записей)
    const metrics = this.metrics.get(name);
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    this.emit('metric', metric);
  }

  registerHealthCheck(name, checkFunction) {
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

        const healthCheck = {
          name,
          status: result.status,
          message: result.message,
          lastCheck: new Date(),
          responseTime,
          details: result.details
        };

        this.healthChecks.set(name, healthCheck);
        this.emit('healthCheck', healthCheck);
      } catch (error) {
        const healthCheck = {
          name,
          status: 'unhealthy',
          message: `Check failed: ${error}`,
          lastCheck: new Date()
        };

        this.healthChecks.set(name, healthCheck);
        this.createAlert({
          severity: 'critical',
          message: `Health check exception: ${name} - ${error}`
        });
      }
    }, 30000);
  }

  createAlert(alert) {
    const newAlert = {
      ...alert,
      id: `alert-${Date.now()}`,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(newAlert);
    this.logger.warn(`Alert created: ${newAlert.severity.toUpperCase()} - ${newAlert.message}`);
    this.emit('alert', newAlert);

    if (newAlert.severity === 'critical') {
      console.error(`🚨 CRITICAL ALERT: ${newAlert.message}`);
    }
  }

  setupDefaultHealthChecks() {
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

  startSystemMonitoring() {
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

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    return `${days}d ${hours}h ${minutes}m`;
  }

  getSystemSummary() {
    const now = new Date();
    const healthChecks = Object.fromEntries(this.healthChecks);
    const activeAlerts = this.alerts.filter(a => !a.resolved);

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
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
      }
    };
  }

  shutdown() {
    this.removeAllListeners();
    this.logger.info('Simple monitoring shutdown');
  }
}

module.exports = { SimpleMonitoring };
