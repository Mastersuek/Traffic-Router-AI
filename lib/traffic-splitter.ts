/**
 * Intelligent Traffic Splitter
 * Интеллектуальное разделение трафика на основе анализа соединений
 * 
 * Вдохновлено RustNet проектом для оптимального распределения нагрузки
 */

import { EventEmitter } from 'events';
import { connectionMonitor, ConnectionInfo, ConnectionRule } from './connection-monitor';

export interface TrafficRoute {
  id: string;
  name: string;
  type: 'direct' | 'proxy' | 'tunnel' | 'load_balance';
  endpoints: string[];
  weight: number;
  healthCheck: {
    url: string;
    interval: number;
    timeout: number;
    healthy: boolean;
    lastCheck: number;
  };
  metrics: {
    requests: number;
    errors: number;
    avgLatency: number;
    throughput: number;
  };
}

export interface SplitDecision {
  route: TrafficRoute;
  reason: string;
  confidence: number;
  alternatives: TrafficRoute[];
}

export interface LoadBalancingStrategy {
  type: 'round_robin' | 'weighted' | 'least_connections' | 'fastest_response' | 'geo_proximity';
  config: any;
}

export class TrafficSplitter extends EventEmitter {
  private routes = new Map<string, TrafficRoute>();
  private routeSelectionHistory = new Map<string, string[]>(); // domain -> route history
  private loadBalancingStrategy: LoadBalancingStrategy = {
    type: 'weighted',
    config: {}
  };
  
  private healthCheckInterval: NodeJS.Timeout;
  private metricsUpdateInterval: NodeJS.Timeout;
  
  constructor() {
    super();
    this.initializeDefaultRoutes();
    this.startHealthChecks();
    this.startMetricsUpdater();
    this.setupConnectionMonitorListeners();
  }
  
  /**
   * Инициализация маршрутов по умолчанию
   */
  private initializeDefaultRoutes(): void {
    // Прямое соединение
    this.addRoute({
      id: 'direct',
      name: 'Direct Connection',
      type: 'direct',
      endpoints: ['direct://localhost'],
      weight: 100,
      healthCheck: {
        url: 'https://www.google.com',
        interval: 30000,
        timeout: 5000,
        healthy: true,
        lastCheck: Date.now()
      },
      metrics: {
        requests: 0,
        errors: 0,
        avgLatency: 0,
        throughput: 0
      }
    });
    
    // AI Proxy сервер
    this.addRoute({
      id: 'ai_proxy',
      name: 'AI Proxy Server',
      type: 'proxy',
      endpoints: ['http://localhost:13081'],
      weight: 90,
      healthCheck: {
        url: 'http://localhost:13081/health',
        interval: 15000,
        timeout: 3000,
        healthy: true,
        lastCheck: Date.now()
      },
      metrics: {
        requests: 0,
        errors: 0,
        avgLatency: 0,
        throughput: 0
      }
    });
    
    // SOCKS5 прокси
    this.addRoute({
      id: 'socks5_proxy',
      name: 'SOCKS5 Proxy',
      type: 'proxy',
      endpoints: ['socks5://localhost:11080'],
      weight: 80,
      healthCheck: {
        url: 'https://api.openai.com/v1/models',
        interval: 20000,
        timeout: 10000,
        healthy: true,
        lastCheck: Date.now()
      },
      metrics: {
        requests: 0,
        errors: 0,
        avgLatency: 0,
        throughput: 0
      }
    });
    
    // HTTP прокси
    this.addRoute({
      id: 'http_proxy',
      name: 'HTTP Proxy',
      type: 'proxy',
      endpoints: ['http://localhost:13128'],
      weight: 70,
      healthCheck: {
        url: 'https://httpbin.org/ip',
        interval: 25000,
        timeout: 8000,
        healthy: true,
        lastCheck: Date.now()
      },
      metrics: {
        requests: 0,
        errors: 0,
        avgLatency: 0,
        throughput: 0
      }
    });
    
    // Туннель (для заблокированных ресурсов)
    this.addRoute({
      id: 'tunnel',
      name: 'Secure Tunnel',
      type: 'tunnel',
      endpoints: ['tunnel://secure-endpoint'],
      weight: 60,
      healthCheck: {
        url: 'https://www.facebook.com',
        interval: 60000,
        timeout: 15000,
        healthy: false, // По умолчанию недоступен
        lastCheck: Date.now()
      },
      metrics: {
        requests: 0,
        errors: 0,
        avgLatency: 0,
        throughput: 0
      }
    });
  }
  
  /**
   * Добавление маршрута
   */
  addRoute(route: TrafficRoute): void {
    this.routes.set(route.id, route);
    this.emit('routeAdded', route);
  }
  
  /**
   * Удаление маршрута
   */
  removeRoute(routeId: string): boolean {
    const route = this.routes.get(routeId);
    if (route) {
      this.routes.delete(routeId);
      this.emit('routeRemoved', route);
      return true;
    }
    return false;
  }
  
  /**
   * Получение оптимального маршрута для запроса
   */
  async getOptimalRoute(destination: string, options: any = {}): Promise<SplitDecision> {
    const availableRoutes = this.getHealthyRoutes();
    
    if (availableRoutes.length === 0) {
      throw new Error('No healthy routes available');
    }
    
    // Анализируем назначение и определяем подходящие маршруты
    const suitableRoutes = this.filterSuitableRoutes(destination, availableRoutes);
    
    if (suitableRoutes.length === 0) {
      // Если нет подходящих маршрутов, используем прямое соединение
      const directRoute = this.routes.get('direct');
      if (directRoute && directRoute.healthCheck.healthy) {
        return {
          route: directRoute,
          reason: 'No suitable routes found, using direct connection',
          confidence: 0.5,
          alternatives: []
        };
      }
      throw new Error('No suitable routes available');
    }
    
    // Выбираем лучший маршрут на основе стратегии балансировки
    const selectedRoute = await this.selectBestRoute(destination, suitableRoutes);
    const alternatives = suitableRoutes.filter(r => r.id !== selectedRoute.id);
    
    // Записываем историю выбора
    this.recordRouteSelection(destination, selectedRoute.id);
    
    return {
      route: selectedRoute,
      reason: this.getSelectionReason(destination, selectedRoute),
      confidence: this.calculateConfidence(destination, selectedRoute),
      alternatives
    };
  }
  
  /**
   * Фильтрация подходящих маршрутов
   */
  private filterSuitableRoutes(destination: string, routes: TrafficRoute[]): TrafficRoute[] {
    const suitable: TrafficRoute[] = [];
    
    for (const route of routes) {
      if (this.isRouteSuitableForDestination(destination, route)) {
        suitable.push(route);
      }
    }
    
    return suitable;
  }
  
  /**
   * Проверка подходящности маршрута для назначения
   */
  private isRouteSuitableForDestination(destination: string, route: TrafficRoute): boolean {
    // AI сервисы
    const aiPatterns = [
      /openai\.com/,
      /anthropic\.com/,
      /googleapis\.com/,
      /huggingface\.co/,
      /together\.ai/,
      /groq\.com/
    ];
    
    const isAIService = aiPatterns.some(pattern => pattern.test(destination));
    
    // Российские домены
    const isRussianDomain = /\.(ru|рф)$/.test(destination);
    
    // Заблокированные сервисы
    const blockedPatterns = [
      /facebook\.com/,
      /twitter\.com/,
      /instagram\.com/,
      /telegram\.org/
    ];
    
    const isBlocked = blockedPatterns.some(pattern => pattern.test(destination));
    
    switch (route.type) {
      case 'direct':
        // Прямое соединение подходит для российских доменов и незаблокированных сервисов
        return isRussianDomain || (!isBlocked && !isAIService);
        
      case 'proxy':
        // Прокси подходит для AI сервисов и международных доменов
        return isAIService || (!isRussianDomain && !isBlocked);
        
      case 'tunnel':
        // Туннель нужен для заблокированных сервисов
        return isBlocked;
        
      case 'load_balance':
        // Балансировщик подходит для любых запросов
        return true;
        
      default:
        return false;
    }
  }
  
  /**
   * Выбор лучшего маршрута
   */
  private async selectBestRoute(destination: string, routes: TrafficRoute[]): Promise<TrafficRoute> {
    switch (this.loadBalancingStrategy.type) {
      case 'round_robin':
        return this.selectRoundRobin(destination, routes);
        
      case 'weighted':
        return this.selectWeighted(routes);
        
      case 'least_connections':
        return this.selectLeastConnections(routes);
        
      case 'fastest_response':
        return this.selectFastestResponse(routes);
        
      case 'geo_proximity':
        return this.selectGeoProximity(destination, routes);
        
      default:
        return this.selectWeighted(routes);
    }
  }
  
  /**
   * Round Robin выбор
   */
  private selectRoundRobin(destination: string, routes: TrafficRoute[]): TrafficRoute {
    const history = this.routeSelectionHistory.get(destination) || [];
    const lastUsedIndex = routes.findIndex(r => r.id === history[history.length - 1]);
    const nextIndex = (lastUsedIndex + 1) % routes.length;
    return routes[nextIndex];
  }
  
  /**
   * Взвешенный выбор
   */
  private selectWeighted(routes: TrafficRoute[]): TrafficRoute {
    // Учитываем вес, здоровье и производительность
    const scoredRoutes = routes.map(route => ({
      route,
      score: this.calculateRouteScore(route)
    }));
    
    scoredRoutes.sort((a, b) => b.score - a.score);
    return scoredRoutes[0].route;
  }
  
  /**
   * Выбор с наименьшим количеством соединений
   */
  private selectLeastConnections(routes: TrafficRoute[]): TrafficRoute {
    const routeConnections = routes.map(route => ({
      route,
      connections: this.getActiveConnectionsForRoute(route.id)
    }));
    
    routeConnections.sort((a, b) => a.connections - b.connections);
    return routeConnections[0].route;
  }
  
  /**
   * Выбор с наименьшим временем отклика
   */
  private selectFastestResponse(routes: TrafficRoute[]): TrafficRoute {
    const sortedByLatency = routes.sort((a, b) => a.metrics.avgLatency - b.metrics.avgLatency);
    return sortedByLatency[0];
  }
  
  /**
   * Выбор по географической близости
   */
  private selectGeoProximity(destination: string, routes: TrafficRoute[]): TrafficRoute {
    // Упрощенная логика - в реальности нужна GeoIP база
    const isRussianDomain = /\.(ru|рф)$/.test(destination);
    
    if (isRussianDomain) {
      // Для российских доменов предпочитаем прямое соединение
      const directRoute = routes.find(r => r.type === 'direct');
      if (directRoute) return directRoute;
    }
    
    // Для остальных используем взвешенный выбор
    return this.selectWeighted(routes);
  }
  
  /**
   * Расчет оценки маршрута
   */
  private calculateRouteScore(route: TrafficRoute): number {
    let score = route.weight;
    
    // Штраф за высокую задержку
    if (route.metrics.avgLatency > 1000) {
      score -= 20;
    }
    
    // Штраф за ошибки
    const errorRate = route.metrics.requests > 0 
      ? (route.metrics.errors / route.metrics.requests) * 100 
      : 0;
    
    score -= errorRate * 2;
    
    // Бонус за высокую пропускную способность
    if (route.metrics.throughput > 1000000) { // > 1MB/s
      score += 10;
    }
    
    // Штраф за нездоровое состояние
    if (!route.healthCheck.healthy) {
      score -= 50;
    }
    
    return Math.max(0, score);
  }
  
  /**
   * Получение количества активных соединений для маршрута
   */
  private getActiveConnectionsForRoute(routeId: string): number {
    const connections = connectionMonitor.getActiveConnections();
    return connections.filter(conn => {
      // Упрощенная логика сопоставления соединения с маршрутом
      switch (routeId) {
        case 'direct':
          return conn.type === 'direct';
        case 'ai_proxy':
        case 'socks5_proxy':
        case 'http_proxy':
          return conn.type === 'proxy';
        case 'tunnel':
          return conn.type === 'tunnel';
        default:
          return false;
      }
    }).length;
  }
  
  /**
   * Получение здоровых маршрутов
   */
  private getHealthyRoutes(): TrafficRoute[] {
    return Array.from(this.routes.values())
      .filter(route => route.healthCheck.healthy);
  }
  
  /**
   * Запись выбора маршрута в историю
   */
  private recordRouteSelection(destination: string, routeId: string): void {
    const history = this.routeSelectionHistory.get(destination) || [];
    history.push(routeId);
    
    // Ограничиваем историю последними 10 записями
    if (history.length > 10) {
      history.shift();
    }
    
    this.routeSelectionHistory.set(destination, history);
  }
  
  /**
   * Получение причины выбора маршрута
   */
  private getSelectionReason(destination: string, route: TrafficRoute): string {
    const reasons = [];
    
    if (route.type === 'direct' && /\.(ru|рф)$/.test(destination)) {
      reasons.push('Russian domain - direct connection preferred');
    }
    
    if (route.type === 'proxy' && this.isAIService(destination)) {
      reasons.push('AI service requires proxy for geo-restrictions');
    }
    
    if (route.type === 'tunnel' && this.isBlockedService(destination)) {
      reasons.push('Blocked service requires tunnel');
    }
    
    if (route.metrics.avgLatency < 500) {
      reasons.push('Low latency route');
    }
    
    if (route.weight > 80) {
      reasons.push('High priority route');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Best available route';
  }
  
  /**
   * Расчет уверенности в выборе
   */
  private calculateConfidence(destination: string, route: TrafficRoute): number {
    let confidence = 0.5; // Базовая уверенность
    
    // Увеличиваем уверенность для подходящих типов маршрутов
    if (route.type === 'direct' && /\.(ru|рф)$/.test(destination)) {
      confidence += 0.3;
    }
    
    if (route.type === 'proxy' && this.isAIService(destination)) {
      confidence += 0.3;
    }
    
    if (route.type === 'tunnel' && this.isBlockedService(destination)) {
      confidence += 0.4;
    }
    
    // Учитываем здоровье маршрута
    if (route.healthCheck.healthy) {
      confidence += 0.1;
    }
    
    // Учитываем производительность
    if (route.metrics.avgLatency < 500) {
      confidence += 0.1;
    }
    
    return Math.min(1.0, confidence);
  }
  
  /**
   * Проверка на AI сервис
   */
  private isAIService(destination: string): boolean {
    const aiPatterns = [
      /openai\.com/,
      /anthropic\.com/,
      /googleapis\.com/,
      /huggingface\.co/,
      /together\.ai/,
      /groq\.com/
    ];
    
    return aiPatterns.some(pattern => pattern.test(destination));
  }
  
  /**
   * Проверка на заблокированный сервис
   */
  private isBlockedService(destination: string): boolean {
    const blockedPatterns = [
      /facebook\.com/,
      /twitter\.com/,
      /instagram\.com/,
      /telegram\.org/
    ];
    
    return blockedPatterns.some(pattern => pattern.test(destination));
  }
  
  /**
   * Установка стратегии балансировки
   */
  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this.loadBalancingStrategy = strategy;
    this.emit('strategyChanged', strategy);
  }
  
  /**
   * Получение статистики маршрутов
   */
  getRouteStats(): any {
    const routes = Array.from(this.routes.values());
    
    return {
      totalRoutes: routes.length,
      healthyRoutes: routes.filter(r => r.healthCheck.healthy).length,
      routesByType: {
        direct: routes.filter(r => r.type === 'direct').length,
        proxy: routes.filter(r => r.type === 'proxy').length,
        tunnel: routes.filter(r => r.type === 'tunnel').length,
        load_balance: routes.filter(r => r.type === 'load_balance').length
      },
      totalRequests: routes.reduce((sum, r) => sum + r.metrics.requests, 0),
      totalErrors: routes.reduce((sum, r) => sum + r.metrics.errors, 0),
      averageLatency: routes.reduce((sum, r) => sum + r.metrics.avgLatency, 0) / routes.length,
      routes: routes.map(route => ({
        id: route.id,
        name: route.name,
        type: route.type,
        healthy: route.healthCheck.healthy,
        weight: route.weight,
        metrics: route.metrics
      }))
    };
  }
  
  /**
   * Настройка слушателей монитора соединений
   */
  private setupConnectionMonitorListeners(): void {
    connectionMonitor.on('connectionCreated', (connection: ConnectionInfo) => {
      this.updateRouteMetrics(connection, 'created');
    });
    
    connectionMonitor.on('connectionClosed', (data: any) => {
      this.updateRouteMetrics(data.connection, 'closed');
    });
    
    connectionMonitor.on('connectionUpdated', (connection: ConnectionInfo) => {
      this.updateRouteMetrics(connection, 'updated');
    });
  }
  
  /**
   * Обновление метрик маршрута
   */
  private updateRouteMetrics(connection: ConnectionInfo, event: string): void {
    const routeId = this.getRouteIdForConnection(connection);
    const route = this.routes.get(routeId);
    
    if (!route) return;
    
    switch (event) {
      case 'created':
        route.metrics.requests++;
        break;
        
      case 'closed':
        if (connection.status === 'error') {
          route.metrics.errors++;
        }
        break;
        
      case 'updated':
        if (connection.latency > 0) {
          // Обновляем среднюю задержку
          route.metrics.avgLatency = (route.metrics.avgLatency + connection.latency) / 2;
        }
        
        // Обновляем пропускную способность
        const totalBytes = connection.bytesIn + connection.bytesOut;
        const duration = connection.lastActivity - connection.startTime;
        if (duration > 0) {
          route.metrics.throughput = totalBytes / (duration / 1000); // bytes per second
        }
        break;
    }
    
    this.emit('routeMetricsUpdated', { route, connection, event });
  }
  
  /**
   * Получение ID маршрута для соединения
   */
  private getRouteIdForConnection(connection: ConnectionInfo): string {
    switch (connection.type) {
      case 'direct':
        return 'direct';
      case 'proxy':
        // Определяем конкретный прокси по порту или другим признакам
        if (connection.destination.includes('openai') || connection.destination.includes('anthropic')) {
          return 'ai_proxy';
        }
        return 'socks5_proxy';
      case 'tunnel':
        return 'tunnel';
      default:
        return 'direct';
    }
  }
  
  /**
   * Запуск проверок здоровья
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 10000); // Каждые 10 секунд
  }
  
  /**
   * Выполнение проверок здоровья
   */
  private async performHealthChecks(): Promise<void> {
    const routes = Array.from(this.routes.values());
    
    for (const route of routes) {
      const now = Date.now();
      
      // Проверяем, нужна ли проверка
      if (now - route.healthCheck.lastCheck < route.healthCheck.interval) {
        continue;
      }
      
      try {
        const startTime = performance.now();
        
        // Выполняем проверку здоровья (упрощенная версия)
        const isHealthy = await this.checkRouteHealth(route);
        
        const endTime = performance.now();
        const latency = endTime - startTime;
        
        const wasHealthy = route.healthCheck.healthy;
        route.healthCheck.healthy = isHealthy;
        route.healthCheck.lastCheck = now;
        
        // Обновляем метрики
        if (route.metrics.avgLatency === 0) {
          route.metrics.avgLatency = latency;
        } else {
          route.metrics.avgLatency = (route.metrics.avgLatency + latency) / 2;
        }
        
        // Уведомляем об изменении состояния
        if (wasHealthy !== isHealthy) {
          this.emit('routeHealthChanged', { route, wasHealthy, isHealthy });
        }
        
      } catch (error) {
        route.healthCheck.healthy = false;
        route.healthCheck.lastCheck = now;
        this.emit('healthCheckError', { route, error });
      }
    }
  }
  
  /**
   * Проверка здоровья маршрута
   */
  private async checkRouteHealth(route: TrafficRoute): Promise<boolean> {
    // Упрощенная проверка - в реальности нужно делать HTTP запросы
    switch (route.type) {
      case 'direct':
        return true; // Прямое соединение всегда доступно
        
      case 'proxy':
        // Проверяем доступность прокси-сервера
        return Math.random() > 0.1; // 90% вероятность успеха
        
      case 'tunnel':
        // Туннель может быть недоступен
        return Math.random() > 0.3; // 70% вероятность успеха
        
      default:
        return true;
    }
  }
  
  /**
   * Запуск обновления метрик
   */
  private startMetricsUpdater(): void {
    this.metricsUpdateInterval = setInterval(() => {
      this.updateAllMetrics();
    }, 30000); // Каждые 30 секунд
  }
  
  /**
   * Обновление всех метрик
   */
  private updateAllMetrics(): void {
    const stats = connectionMonitor.getDetailedStats();
    
    // Обновляем метрики на основе статистики соединений
    for (const route of this.routes.values()) {
      // Здесь можно добавить более сложную логику обновления метрик
      this.emit('metricsUpdated', { route, stats });
    }
  }
  
  /**
   * Очистка ресурсов
   */
  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }
    
    this.routes.clear();
    this.routeSelectionHistory.clear();
    this.removeAllListeners();
  }
}

// Экспорт singleton instance
export const trafficSplitter = new TrafficSplitter();