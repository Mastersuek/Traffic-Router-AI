require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const { EventEmitter } = require('events');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// System Monitor MCP Server для мониторинга системы в реальном времени
class SystemMonitorMCPServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.name = 'System Monitor MCP Server';
    this.version = '1.0.0';
    this.monitorInterval = options.monitorInterval || 30000; // 30 секунд
    this.alerts = [];
    this.metrics = {
      cpu: [],
      memory: [],
      disk: [],
      services: new Map()
    };
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ filename: 'logs/mcp-system-monitor.log' })
      ]
    });

    this.setupResources();
    this.setupTools();
    this.startMonitoring();
  }

  setupResources() {
    this.resources = new Map();

    // Ресурс для текущих метрик системы
    this.resources.set('system/metrics', {
      uri: 'system://metrics',
      name: 'System Metrics',
      description: 'Real-time system performance metrics',
      mimeType: 'application/json',
      getContent: () => this.getCurrentMetrics()
    });

    // Ресурс для алертов
    this.resources.set('system/alerts', {
      uri: 'system://alerts',
      name: 'System Alerts',
      description: 'Current system alerts and warnings',
      mimeType: 'application/json',
      getContent: () => this.getCurrentAlerts()
    });

    // Ресурс для статуса сервисов
    this.resources.set('system/services', {
      uri: 'system://services',
      name: 'Services Status',
      description: 'Status of all monitored services',
      mimeType: 'application/json',
      getContent: () => this.getServicesStatus()
    });
  }

  setupTools() {
    this.tools = new Map();

    // Инструмент для получения метрик
    this.tools.set('get_metrics', {
      name: 'get_metrics',
      description: 'Get current system metrics',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['cpu', 'memory', 'disk', 'all'],
            description: 'Type of metrics to retrieve'
          },
          timeframe: {
            type: 'string',
            enum: ['current', '1h', '24h'],
            default: 'current',
            description: 'Timeframe for metrics'
          }
        }
      },
      execute: (params) => this.getMetrics(params.type, params.timeframe)
    });
  }
}    /
/ Инструмент для проверки сервисов
    this.tools.set('check_services', {
      name: 'check_services',
      description: 'Check status of system services',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Specific service to check (optional)'
          }
        }
      },
      execute: (params) => this.checkServices(params.service)
    });

    // Инструмент для получения алертов
    this.tools.set('get_alerts', {
      name: 'get_alerts',
      description: 'Get current system alerts',
      inputSchema: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Filter by alert severity'
          },
          limit: {
            type: 'number',
            default: 50,
            description: 'Maximum number of alerts to return'
          }
        }
      },
      execute: (params) => this.getAlerts(params.severity, params.limit)
    });

    // Инструмент для очистки алертов
    this.tools.set('clear_alerts', {
      name: 'clear_alerts',
      description: 'Clear system alerts',
      inputSchema: {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Clear alerts of specific severity (optional)'
          }
        }
      },
      execute: (params) => this.clearAlerts(params.severity)
    });
  }

  // Запуск мониторинга
  startMonitoring() {
    this.logger.info(`Starting system monitoring with ${this.monitorInterval}ms interval`);
    
    // Первоначальный сбор метрик
    this.collectMetrics();
    
    // Периодический сбор метрик
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics();
    }, this.monitorInterval);
  }

  // Остановка мониторинга
  stopMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
      this.logger.info('System monitoring stopped');
    }
  }

  // Сбор метрик системы
  async collectMetrics() {
    try {
      const timestamp = new Date().toISOString();
      
      // Сбор метрик CPU
      const cpuMetrics = await this.getCPUMetrics();
      this.metrics.cpu.push({ timestamp, ...cpuMetrics });
      
      // Сбор метрик памяти
      const memoryMetrics = await this.getMemoryMetrics();
      this.metrics.memory.push({ timestamp, ...memoryMetrics });
      
      // Сбор метрик диска
      const diskMetrics = await this.getDiskMetrics();
      this.metrics.disk.push({ timestamp, ...diskMetrics });
      
      // Проверка сервисов
      await this.updateServicesStatus();
      
      // Проверка на алерты
      this.checkForAlerts(cpuMetrics, memoryMetrics, diskMetrics);
      
      // Ограничиваем количество сохраненных метрик (последние 1000 записей)
      this.limitMetricsHistory();
      
      this.emit('metricsCollected', { timestamp, cpu: cpuMetrics, memory: memoryMetrics, disk: diskMetrics });
      
    } catch (error) {
      this.logger.error('Failed to collect metrics:', error);
    }
  }

  // Получение метрик CPU
  async getCPUMetrics() {
    try {
      const result = await execAsync('powershell "Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object Average | ConvertTo-Json"');
      const data = JSON.parse(result.stdout.trim());
      
      return {
        usage: data.Average || 0,
        cores: require('os').cpus().length
      };
    } catch (error) {
      this.logger.warn('Failed to get CPU metrics:', error);
      return { usage: 0, cores: 1 };
    }
  }

  // Получение метрик памяти
  async getMemoryMetrics() {
    try {
      const result = await execAsync('powershell "Get-WmiObject Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json"');
      const data = JSON.parse(result.stdout.trim());
      
      const totalMB = Math.round(data.TotalVisibleMemorySize / 1024);
      const freeMB = Math.round(data.FreePhysicalMemory / 1024);
      const usedMB = totalMB - freeMB;
      const usagePercent = Math.round((usedMB / totalMB) * 100);
      
      return {
        total: totalMB,
        used: usedMB,
        free: freeMB,
        usage: usagePercent
      };
    } catch (error) {
      this.logger.warn('Failed to get memory metrics:', error);
      return { total: 0, used: 0, free: 0, usage: 0 };
    }
  }

  // Получение метрик диска
  async getDiskMetrics() {
    try {
      const result = await execAsync('powershell "Get-WmiObject Win32_LogicalDisk | Select-Object Size,FreeSpace,DeviceID | ConvertTo-Json"');
      const data = JSON.parse(result.stdout.trim());
      const disks = Array.isArray(data) ? data : [data];
      
      return disks.map(disk => ({
        device: disk.DeviceID,
        totalGB: Math.round(disk.Size / 1024 / 1024 / 1024),
        freeGB: Math.round(disk.FreeSpace / 1024 / 1024 / 1024),
        usedGB: Math.round((disk.Size - disk.FreeSpace) / 1024 / 1024 / 1024),
        usage: Math.round(((disk.Size - disk.FreeSpace) / disk.Size) * 100)
      }));
    } catch (error) {
      this.logger.warn('Failed to get disk metrics:', error);
      return [];
    }
  }

  // Обновление статуса сервисов
  async updateServicesStatus() {
    const services = ['web', 'ai-proxy', 'monitoring', 'mcp', 'youtube-cache'];
    const ports = { web: 13000, 'ai-proxy': 13081, monitoring: 13082, mcp: 3001, 'youtube-cache': 13083 };
    
    for (const service of services) {
      try {
        const port = ports[service];
        const axios = require('axios');
        
        const response = await axios.get(`http://localhost:${port}/health`, { 
          timeout: 5000,
          validateStatus: (status) => status < 500
        });
        
        this.metrics.services.set(service, {
          status: 'healthy',
          port,
          responseTime: response.headers['x-response-time'] || 'unknown',
          lastCheck: new Date().toISOString()
        });
      } catch (error) {
        this.metrics.services.set(service, {
          status: 'unhealthy',
          port: ports[service],
          error: error.message,
          lastCheck: new Date().toISOString()
        });
      }
    }
  }

  // Проверка на алерты
  checkForAlerts(cpu, memory, disk) {
    const timestamp = new Date().toISOString();
    
    // CPU алерты
    if (cpu.usage > 90) {
      this.addAlert('critical', 'CPU', `CPU usage is critically high: ${cpu.usage}%`, timestamp);
    } else if (cpu.usage > 80) {
      this.addAlert('high', 'CPU', `CPU usage is high: ${cpu.usage}%`, timestamp);
    }
    
    // Memory алерты
    if (memory.usage > 95) {
      this.addAlert('critical', 'Memory', `Memory usage is critically high: ${memory.usage}%`, timestamp);
    } else if (memory.usage > 85) {
      this.addAlert('high', 'Memory', `Memory usage is high: ${memory.usage}%`, timestamp);
    }
    
    // Disk алерты
    disk.forEach(diskInfo => {
      if (diskInfo.usage > 95) {
        this.addAlert('critical', 'Disk', `Disk ${diskInfo.device} is critically full: ${diskInfo.usage}%`, timestamp);
      } else if (diskInfo.usage > 85) {
        this.addAlert('high', 'Disk', `Disk ${diskInfo.device} is getting full: ${diskInfo.usage}%`, timestamp);
      }
    });
    
    // Service алерты
    for (const [service, status] of this.metrics.services) {
      if (status.status === 'unhealthy') {
        this.addAlert('high', 'Service', `Service ${service} is unhealthy: ${status.error}`, timestamp);
      }
    }
  }

  // Добавление алерта
  addAlert(severity, category, message, timestamp) {
    // Проверяем, не дублируется ли алерт
    const existingAlert = this.alerts.find(alert => 
      alert.category === category && 
      alert.message === message && 
      alert.severity === severity
    );
    
    if (!existingAlert) {
      this.alerts.push({
        id: Date.now().toString(),
        severity,
        category,
        message,
        timestamp,
        acknowledged: false
      });
      
      // Ограничиваем количество алертов
      if (this.alerts.length > 1000) {
        this.alerts = this.alerts.slice(-500);
      }
      
      this.emit('alertCreated', { severity, category, message, timestamp });
      this.logger.warn(`Alert [${severity}] ${category}: ${message}`);
    }
  }

  // Ограничение истории метрик
  limitMetricsHistory() {
    const maxEntries = 1000;
    
    if (this.metrics.cpu.length > maxEntries) {
      this.metrics.cpu = this.metrics.cpu.slice(-maxEntries);
    }
    if (this.metrics.memory.length > maxEntries) {
      this.metrics.memory = this.metrics.memory.slice(-maxEntries);
    }
    if (this.metrics.disk.length > maxEntries) {
      this.metrics.disk = this.metrics.disk.slice(-maxEntries);
    }
  }

  // Получение текущих метрик
  async getCurrentMetrics() {
    const latest = {
      cpu: this.metrics.cpu[this.metrics.cpu.length - 1] || null,
      memory: this.metrics.memory[this.metrics.memory.length - 1] || null,
      disk: this.metrics.disk[this.metrics.disk.length - 1] || null,
      services: Object.fromEntries(this.metrics.services),
      timestamp: new Date().toISOString()
    };
    
    return JSON.stringify(latest, null, 2);
  }

  // Получение текущих алертов
  async getCurrentAlerts() {
    return JSON.stringify({
      alerts: this.alerts.slice(-50), // Последние 50 алертов
      summary: {
        total: this.alerts.length,
        critical: this.alerts.filter(a => a.severity === 'critical').length,
        high: this.alerts.filter(a => a.severity === 'high').length,
        medium: this.alerts.filter(a => a.severity === 'medium').length,
        low: this.alerts.filter(a => a.severity === 'low').length
      }
    }, null, 2);
  }

  // Получение статуса сервисов
  async getServicesStatus() {
    return JSON.stringify({
      services: Object.fromEntries(this.metrics.services),
      summary: {
        total: this.metrics.services.size,
        healthy: Array.from(this.metrics.services.values()).filter(s => s.status === 'healthy').length,
        unhealthy: Array.from(this.metrics.services.values()).filter(s => s.status === 'unhealthy').length
      }
    }, null, 2);
  }

  // Реализация инструментов
  async getMetrics(type = 'all', timeframe = 'current') {
    try {
      let result = {};
      
      if (type === 'all' || type === 'cpu') {
        result.cpu = this.getMetricsByTimeframe(this.metrics.cpu, timeframe);
      }
      if (type === 'all' || type === 'memory') {
        result.memory = this.getMetricsByTimeframe(this.metrics.memory, timeframe);
      }
      if (type === 'all' || type === 'disk') {
        result.disk = this.getMetricsByTimeframe(this.metrics.disk, timeframe);
      }
      
      return {
        success: true,
        type,
        timeframe,
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getMetricsByTimeframe(metrics, timeframe) {
    const now = new Date();
    let cutoffTime;
    
    switch (timeframe) {
      case '1h':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      default:
        return metrics[metrics.length - 1] || null;
    }
    
    return metrics.filter(metric => new Date(metric.timestamp) >= cutoffTime);
  }

  async checkServices(service = null) {
    try {
      if (service) {
        const serviceStatus = this.metrics.services.get(service);
        return {
          success: true,
          service,
          status: serviceStatus || { status: 'unknown', message: 'Service not monitored' }
        };
      } else {
        return {
          success: true,
          services: Object.fromEntries(this.metrics.services),
          summary: {
            total: this.metrics.services.size,
            healthy: Array.from(this.metrics.services.values()).filter(s => s.status === 'healthy').length,
            unhealthy: Array.from(this.metrics.services.values()).filter(s => s.status === 'unhealthy').length
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAlerts(severity = null, limit = 50) {
    try {
      let filteredAlerts = this.alerts;
      
      if (severity) {
        filteredAlerts = this.alerts.filter(alert => alert.severity === severity);
      }
      
      return {
        success: true,
        alerts: filteredAlerts.slice(-limit),
        total: filteredAlerts.length,
        severity: severity || 'all'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async clearAlerts(severity = null) {
    try {
      const beforeCount = this.alerts.length;
      
      if (severity) {
        this.alerts = this.alerts.filter(alert => alert.severity !== severity);
      } else {
        this.alerts = [];
      }
      
      const clearedCount = beforeCount - this.alerts.length;
      
      this.emit('alertsCleared', { severity, clearedCount });
      
      return {
        success: true,
        clearedCount,
        remainingCount: this.alerts.length,
        severity: severity || 'all'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // MCP Protocol Methods
  async initialize() {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: true,
        tools: true,
        logging: true
      },
      serverInfo: {
        name: this.name,
        version: this.version
      }
    };
  }

  async listResources() {
    const resources = Array.from(this.resources.entries()).map(([key, resource]) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }));
    
    return { resources };
  }

  async readResource(uri) {
    const resource = Array.from(this.resources.values()).find(r => r.uri === uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }
    
    const content = await resource.getContent();
    return {
      uri,
      mimeType: resource.mimeType,
      text: content
    };
  }

  async listTools() {
    const tools = Array.from(this.tools.entries()).map(([key, tool]) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    return { tools };
  }

  async callTool(name, arguments_) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    const result = await tool.execute(arguments_);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
}

// Настройка и запуск сервера
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/mcp-system-monitor.log' })
  ]
});

const app = express();
const port = process.env.MONITOR_PORT || 3004;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize System Monitor MCP Server
const monitorServer = new SystemMonitorMCPServer({
  monitorInterval: parseInt(process.env.MONITOR_INTERVAL) || 30000
});

// MCP Protocol Endpoints
app.post('/mcp/initialize', async (req, res) => {
  try {
    const result = await monitorServer.initialize();
    logger.info('System Monitor MCP server initialized');
    res.json(result);
  } catch (error) {
    logger.error('System Monitor MCP initialization error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/resources', async (req, res) => {
  try {
    const result = await monitorServer.listResources();
    res.json(result);
  } catch (error) {
    logger.error('System Monitor MCP resources error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/resources/:uri', async (req, res) => {
  try {
    const uri = decodeURIComponent(req.params.uri);
    const result = await monitorServer.readResource(uri);
    res.json(result);
  } catch (error) {
    logger.error('System Monitor MCP resource read error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/tools', async (req, res) => {
  try {
    const result = await monitorServer.listTools();
    res.json(result);
  } catch (error) {
    logger.error('System Monitor MCP tools error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/mcp/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    const result = await monitorServer.callTool(name, args);
    res.json(result);
  } catch (error) {
    logger.error('System Monitor MCP tool call error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'System Monitor MCP Server',
    port: port,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    monitoring: {
      interval: monitorServer.monitorInterval,
      alertsCount: monitorServer.alerts.length,
      servicesMonitored: monitorServer.metrics.services.size
    }
  });
});

// Status endpoint
app.get('/status', async (req, res) => {
  try {
    const metrics = await monitorServer.getCurrentMetrics();
    const alerts = await monitorServer.getCurrentAlerts();
    
    res.json({
      server: {
        name: monitorServer.name,
        version: monitorServer.version,
        interval: monitorServer.monitorInterval
      },
      metrics: JSON.parse(metrics),
      alerts: JSON.parse(alerts)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    monitorServer.stopMonitoring();
    monitorServer.removeAllListeners();
    logger.info('System Monitor MCP Server shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
app.listen(port, () => {
  logger.info(`📊 System Monitor MCP Server running on port ${port}`);
  logger.info(`📊 Health check: http://localhost:${port}/health`);
  logger.info(`🔧 Status: http://localhost:${port}/status`);
  logger.info(`🔌 MCP endpoints: http://localhost:${port}/mcp/*`);
  logger.info(`⏱️ Monitoring interval: ${monitorServer.monitorInterval}ms`);
});

module.exports = { SystemMonitorMCPServer };