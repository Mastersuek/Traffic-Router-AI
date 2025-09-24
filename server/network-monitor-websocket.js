/**
 * Network Monitor WebSocket Server
 * WebSocket сервер для мониторинга сети в реальном времени
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

class NetworkMonitorWebSocket extends EventEmitter {
  constructor(port = 13084) {
    super();
    this.port = port;
    this.wss = null;
    this.clients = new Set();
    this.isRunning = false;
    
    // Симуляция данных (в реальности будет интеграция с TypeScript модулями)
    this.mockData = {
      connections: new Map(),
      routes: new Map(),
      events: [],
      alerts: { performance: [], security: [] }
    };
    
    this.initializeMockData();
  }
  
  /**
   * Инициализация тестовых данных
   */
  initializeMockData() {
    // Создаем несколько тестовых соединений
    this.mockData.connections.set('conn_1', {
      id: 'conn_1',
      destination: 'api.openai.com',
      port: 443,
      protocol: 'https',
      type: 'proxy',
      status: 'connected',
      startTime: Date.now() - 30000,
      lastActivity: Date.now(),
      bytesIn: 1024 * 50,
      bytesOut: 1024 * 20,
      latency: 250
    });
    
    this.mockData.connections.set('conn_2', {
      id: 'conn_2',
      destination: 'yandex.ru',
      port: 443,
      protocol: 'https',
      type: 'direct',
      status: 'connected',
      startTime: Date.now() - 15000,
      lastActivity: Date.now() - 1000,
      bytesIn: 1024 * 30,
      bytesOut: 1024 * 10,
      latency: 45
    });
    
    // Создаем тестовые маршруты
    this.mockData.routes.set('direct', {
      id: 'direct',
      name: 'Direct Connection',
      type: 'direct',
      healthy: true,
      weight: 100,
      metrics: {
        requests: 150,
        errors: 2,
        avgLatency: 45,
        throughput: 1024 * 1024 * 2
      }
    });
    
    this.mockData.routes.set('ai_proxy', {
      id: 'ai_proxy',
      name: 'AI Proxy Server',
      type: 'proxy',
      healthy: true,
      weight: 90,
      metrics: {
        requests: 89,
        errors: 1,
        avgLatency: 250,
        throughput: 1024 * 1024 * 1.5
      }
    });
  }
  
  /**
   * Запуск WebSocket сервера
   */
  start() {
    if (this.isRunning) {
      console.log('🔄 Network Monitor WebSocket server is already running');
      return;
    }
    
    try {
      this.wss = new WebSocket.Server({ 
        port: this.port,
        perMessageDeflate: false
      });
      
      this.wss.on('connection', (ws, request) => {
        this.handleConnection(ws, request);
      });
      
      this.wss.on('error', (error) => {
        console.error('❌ WebSocket server error:', error);
        this.emit('error', error);
      });
      
      this.isRunning = true;
      
      // Запускаем генерацию тестовых данных
      this.startDataGeneration();
      
      console.log(`🚀 Network Monitor WebSocket server started on port ${this.port}`);
      console.log(`📊 Real-time network monitoring available at ws://localhost:${this.port}`);
      
      this.emit('started');
      
    } catch (error) {
      console.error('❌ Failed to start Network Monitor WebSocket server:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Обработка нового соединения
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      connectedAt: new Date(),
      subscriptions: new Set(['all']) // По умолчанию подписываемся на все события
    };
    
    this.clients.add(clientInfo);
    
    console.log(`📱 New client connected: ${clientId} from ${clientInfo.ip}`);
    
    // Отправляем приветственное сообщение
    this.sendToClient(clientInfo, {
      type: 'welcome',
      data: {
        clientId: clientId,
        serverTime: Date.now(),
        availableSubscriptions: ['all', 'connections', 'routes', 'events', 'alerts']
      }
    });
    
    // Отправляем текущее состояние
    this.sendCurrentState(clientInfo);
    
    // Обработка сообщений от клиента
    ws.on('message', (message) => {
      this.handleClientMessage(clientInfo, message);
    });
    
    // Обработка закрытия соединения
    ws.on('close', (code, reason) => {
      console.log(`📱 Client disconnected: ${clientId} (${code}: ${reason})`);
      this.clients.delete(clientInfo);
    });
    
    // Обработка ошибок
    ws.on('error', (error) => {
      console.error(`❌ Client error ${clientId}:`, error);
      this.clients.delete(clientInfo);
    });
  }
  
  /**
   * Обработка сообщений от клиента
   */
  handleClientMessage(clientInfo, message) {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'subscribe':
          this.handleSubscription(clientInfo, data.subscriptions);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(clientInfo, data.subscriptions);
          break;
          
        case 'get_snapshot':
          this.sendNetworkSnapshot(clientInfo);
          break;
          
        case 'get_connections':
          this.sendConnectionsData(clientInfo);
          break;
          
        case 'get_routes':
          this.sendRoutesData(clientInfo);
          break;
          
        case 'ping':
          this.sendToClient(clientInfo, { type: 'pong', timestamp: Date.now() });
          break;
          
        default:
          this.sendToClient(clientInfo, {
            type: 'error',
            message: `Unknown message type: ${data.type}`
          });
      }
    } catch (error) {
      console.error('Error handling client message:', error);
      this.sendToClient(clientInfo, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }
  
  /**
   * Обработка подписки
   */
  handleSubscription(clientInfo, subscriptions) {
    if (Array.isArray(subscriptions)) {
      subscriptions.forEach(sub => clientInfo.subscriptions.add(sub));
    }
    
    this.sendToClient(clientInfo, {
      type: 'subscription_updated',
      data: {
        subscriptions: Array.from(clientInfo.subscriptions)
      }
    });
  }
  
  /**
   * Обработка отписки
   */
  handleUnsubscription(clientInfo, subscriptions) {
    if (Array.isArray(subscriptions)) {
      subscriptions.forEach(sub => clientInfo.subscriptions.delete(sub));
    }
    
    this.sendToClient(clientInfo, {
      type: 'subscription_updated',
      data: {
        subscriptions: Array.from(clientInfo.subscriptions)
      }
    });
  }
  
  /**
   * Отправка текущего состояния
   */
  sendCurrentState(clientInfo) {
    this.sendNetworkSnapshot(clientInfo);
    this.sendConnectionsData(clientInfo);
    this.sendRoutesData(clientInfo);
  }
  
  /**
   * Отправка снимка сети
   */
  sendNetworkSnapshot(clientInfo) {
    const snapshot = {
      timestamp: Date.now(),
      connections: {
        total: this.mockData.connections.size,
        active: Array.from(this.mockData.connections.values()).filter(c => c.status === 'connected').length,
        byType: this.groupConnectionsByType(),
        byStatus: this.groupConnectionsByStatus()
      },
      routes: {
        total: this.mockData.routes.size,
        healthy: Array.from(this.mockData.routes.values()).filter(r => r.healthy).length,
        byType: this.groupRoutesByType()
      },
      performance: this.calculatePerformanceMetrics(),
      alerts: this.mockData.alerts
    };
    
    this.sendToClient(clientInfo, {
      type: 'network_snapshot',
      data: snapshot
    });
  }
  
  /**
   * Отправка данных о соединениях
   */
  sendConnectionsData(clientInfo) {
    const connections = Array.from(this.mockData.connections.values());
    
    this.sendToClient(clientInfo, {
      type: 'connections_data',
      data: {
        connections,
        stats: {
          total: connections.length,
          active: connections.filter(c => c.status === 'connected').length,
          byType: this.groupConnectionsByType(),
          byStatus: this.groupConnectionsByStatus()
        }
      }
    });
  }
  
  /**
   * Отправка данных о маршрутах
   */
  sendRoutesData(clientInfo) {
    const routes = Array.from(this.mockData.routes.values());
    
    this.sendToClient(clientInfo, {
      type: 'routes_data',
      data: {
        routes,
        stats: {
          total: routes.length,
          healthy: routes.filter(r => r.healthy).length,
          byType: this.groupRoutesByType()
        }
      }
    });
  }
  
  /**
   * Группировка соединений по типу
   */
  groupConnectionsByType() {
    const groups = {};
    for (const conn of this.mockData.connections.values()) {
      groups[conn.type] = (groups[conn.type] || 0) + 1;
    }
    return groups;
  }
  
  /**
   * Группировка соединений по статусу
   */
  groupConnectionsByStatus() {
    const groups = {};
    for (const conn of this.mockData.connections.values()) {
      groups[conn.status] = (groups[conn.status] || 0) + 1;
    }
    return groups;
  }
  
  /**
   * Группировка маршрутов по типу
   */
  groupRoutesByType() {
    const groups = {};
    for (const route of this.mockData.routes.values()) {
      groups[route.type] = (groups[route.type] || 0) + 1;
    }
    return groups;
  }
  
  /**
   * Расчет метрик производительности
   */
  calculatePerformanceMetrics() {
    const connections = Array.from(this.mockData.connections.values());
    const routes = Array.from(this.mockData.routes.values());
    
    const totalLatency = connections.reduce((sum, conn) => sum + conn.latency, 0);
    const avgLatency = connections.length > 0 ? totalLatency / connections.length : 0;
    
    const totalRequests = routes.reduce((sum, route) => sum + route.metrics.requests, 0);
    const totalErrors = routes.reduce((sum, route) => sum + route.metrics.errors, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    const totalThroughput = routes.reduce((sum, route) => sum + route.metrics.throughput, 0);
    
    return {
      averageLatency: Math.round(avgLatency),
      totalThroughput: Math.round(totalThroughput),
      errorRate: Math.round(errorRate * 100) / 100,
      successRate: Math.round((100 - errorRate) * 100) / 100
    };
  }
  
  /**
   * Отправка сообщения клиенту
   */
  sendToClient(clientInfo, message) {
    if (clientInfo.ws.readyState === WebSocket.OPEN) {
      try {
        clientInfo.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to client ${clientInfo.id}:`, error);
      }
    }
  }
  
  /**
   * Рассылка сообщения всем клиентам
   */
  broadcast(message, subscription = 'all') {
    for (const clientInfo of this.clients) {
      if (clientInfo.subscriptions.has(subscription) || clientInfo.subscriptions.has('all')) {
        this.sendToClient(clientInfo, message);
      }
    }
  }
  
  /**
   * Запуск генерации тестовых данных
   */
  startDataGeneration() {
    // Обновление данных каждые 5 секунд
    setInterval(() => {
      this.updateMockData();
      this.broadcastUpdates();
    }, 5000);
    
    // Генерация событий каждые 2 секунды
    setInterval(() => {
      this.generateMockEvent();
    }, 2000);
    
    // Генерация предупреждений каждые 30 секунд
    setInterval(() => {
      this.generateMockAlert();
    }, 30000);
  }
  
  /**
   * Обновление тестовых данных
   */
  updateMockData() {
    // Обновляем статистику соединений
    for (const conn of this.mockData.connections.values()) {
      conn.lastActivity = Date.now();
      conn.bytesIn += Math.floor(Math.random() * 1024 * 10);
      conn.bytesOut += Math.floor(Math.random() * 1024 * 5);
      conn.latency = Math.max(10, conn.latency + (Math.random() - 0.5) * 50);
    }
    
    // Обновляем метрики маршрутов
    for (const route of this.mockData.routes.values()) {
      route.metrics.requests += Math.floor(Math.random() * 5);
      route.metrics.errors += Math.random() > 0.9 ? 1 : 0;
      route.metrics.avgLatency = Math.max(10, route.metrics.avgLatency + (Math.random() - 0.5) * 20);
      route.metrics.throughput = Math.max(0, route.metrics.throughput + (Math.random() - 0.5) * 1024 * 100);
    }
  }
  
  /**
   * Рассылка обновлений
   */
  broadcastUpdates() {
    // Отправляем обновленный снимок сети
    const snapshot = {
      timestamp: Date.now(),
      connections: {
        total: this.mockData.connections.size,
        active: Array.from(this.mockData.connections.values()).filter(c => c.status === 'connected').length,
        byType: this.groupConnectionsByType(),
        byStatus: this.groupConnectionsByStatus()
      },
      routes: {
        total: this.mockData.routes.size,
        healthy: Array.from(this.mockData.routes.values()).filter(r => r.healthy).length,
        byType: this.groupRoutesByType()
      },
      performance: this.calculatePerformanceMetrics(),
      alerts: this.mockData.alerts
    };
    
    this.broadcast({
      type: 'network_snapshot',
      data: snapshot
    });
  }
  
  /**
   * Генерация тестового события
   */
  generateMockEvent() {
    const eventTypes = ['connection_created', 'connection_closed', 'route_changed', 'performance_alert'];
    const severities = ['info', 'warning', 'error'];
    
    const event = {
      type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      timestamp: Date.now(),
      severity: severities[Math.floor(Math.random() * severities.length)],
      data: {
        message: `Mock event generated at ${new Date().toISOString()}`,
        details: `Random event for testing purposes`
      }
    };
    
    this.mockData.events.push(event);
    
    // Ограничиваем количество событий
    if (this.mockData.events.length > 100) {
      this.mockData.events.shift();
    }
    
    this.broadcast({
      type: 'network_event',
      data: event
    }, 'events');
  }
  
  /**
   * Генерация тестового предупреждения
   */
  generateMockAlert() {
    if (Math.random() > 0.7) { // 30% вероятность
      const alertTypes = ['high_latency', 'connection_timeout', 'route_failure'];
      const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      
      const alert = {
        type: alertType,
        threshold: 1000,
        currentValue: 1500,
        affectedConnections: ['conn_1'],
        suggestedAction: 'Consider switching to a different route',
        timestamp: Date.now()
      };
      
      this.mockData.alerts.performance.push(alert);
      
      // Ограничиваем количество предупреждений
      if (this.mockData.alerts.performance.length > 10) {
        this.mockData.alerts.performance.shift();
      }
      
      this.broadcast({
        type: 'performance_alert',
        data: alert
      }, 'alerts');
    }
  }
  
  /**
   * Генерация ID клиента
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Получение статистики сервера
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      connectedClients: this.clients.size,
      mockDataStats: {
        connections: this.mockData.connections.size,
        routes: this.mockData.routes.size,
        events: this.mockData.events.length,
        performanceAlerts: this.mockData.alerts.performance.length,
        securityAlerts: this.mockData.alerts.security.length
      }
    };
  }
  
  /**
   * Остановка сервера
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Network Monitor WebSocket server is not running');
      return;
    }
    
    try {
      // Закрываем все соединения
      for (const clientInfo of this.clients) {
        clientInfo.ws.close(1000, 'Server shutting down');
      }
      
      // Закрываем сервер
      this.wss.close(() => {
        console.log('🛑 Network Monitor WebSocket server stopped');
        this.emit('stopped');
      });
      
      this.isRunning = false;
      this.clients.clear();
      
    } catch (error) {
      console.error('❌ Error stopping Network Monitor WebSocket server:', error);
      this.emit('error', error);
    }
  }
}

// Создаем и экспортируем экземпляр
const networkMonitorWS = new NetworkMonitorWebSocket();

// Автозапуск если файл запущен напрямую
if (require.main === module) {
  networkMonitorWS.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\\n🛑 Received SIGINT, shutting down gracefully...');
    networkMonitorWS.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\\n🛑 Received SIGTERM, shutting down gracefully...');
    networkMonitorWS.stop();
    process.exit(0);
  });
}

module.exports = networkMonitorWS;