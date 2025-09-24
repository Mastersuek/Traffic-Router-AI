/**
 * Network Observer
 * Наблюдатель за сетевыми соединениями в реальном времени
 * 
 * Интегрирует ConnectionMonitor и TrafficSplitter для полного контроля трафика
 */

import { EventEmitter } from 'events';
import { connectionMonitor, ConnectionInfo } from './connection-monitor';
import { trafficSplitter, SplitDecision, TrafficRoute } from './traffic-splitter';

export interface NetworkEvent {
  type: 'connection_created' | 'connection_closed' | 'route_changed' | 'performance_alert' | 'security_alert';
  timestamp: number;
  data: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface PerformanceAlert {
  type: 'high_latency' | 'connection_timeout' | 'route_failure' | 'bandwidth_limit';
  threshold: number;
  currentValue: number;
  affectedConnections: string[];
  suggestedAction: string;
}

export interface SecurityAlert {
  type: 'suspicious_traffic' | 'blocked_domain' | 'proxy_failure' | 'tunnel_breach';
  source: string;
  destination: string;
  details: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface NetworkSnapshot {
  timestamp: number;
  connections: {
    total: number;
    active: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  routes: {
    total: number;
    healthy: number;
    byType: Record<string, number>;
  };
  performance: {
    averageLatency: number;
    totalThroughput: number;
    errorRate: number;
    successRate: number;
  };
  alerts: {
    performance: PerformanceAlert[];
    security: SecurityAlert[];
  };
}

export class NetworkObserver extends EventEmitter {
  private events: NetworkEvent[] = [];
  private performanceAlerts: PerformanceAlert[] = [];
  private securityAlerts: SecurityAlert[] = [];
  
  private snapshotInterval: NodeJS.Timeout;
  private alertCheckInterval: NodeJS.Timeout;
  
  private config = {
    maxEvents: 1000,
    snapshotInterval: 5000, // 5 seconds
    alertCheckInterval: 10000, // 10 seconds
    performanceThresholds: {
      highLatency: 2000, // ms
      connectionTimeout: 30000, // ms
      errorRate: 10, // %
      bandwidthLimit: 1024 * 1024 * 10 // 10 MB/s
    },
    securityRules: {
      maxConnectionsPerDomain: 50,
      suspiciousPatterns: [
        /malware/i,
        /phishing/i,
        /suspicious/i
      ]
    }
  };
  
  constructor() {
    super();
    this.setupEventListeners();
    this.startPeriodicTasks();
  }
  
  /**
   * Настройка слушателей событий
   */
  private setupEventListeners(): void {
    // События монитора соединений
    connectionMonitor.on('connectionCreated', (connection: ConnectionInfo) => {
      this.handleConnectionCreated(connection);
    });
    
    connectionMonitor.on('connectionClosed', (data: any) => {
      this.handleConnectionClosed(data.connection, data.reason);
    });
    
    connectionMonitor.on('connectionUpdated', (connection: ConnectionInfo) => {
      this.handleConnectionUpdated(connection);
    });
    
    // События разделителя трафика
    trafficSplitter.on('routeHealthChanged', (data: any) => {
      this.handleRouteHealthChanged(data.route, data.wasHealthy, data.isHealthy);
    });
    
    trafficSplitter.on('routeMetricsUpdated', (data: any) => {
      this.handleRouteMetricsUpdated(data.route, data.connection);
    });
  }
  
  /**
   * Обработка создания соединения
   */
  private handleConnectionCreated(connection: ConnectionInfo): void {
    const event: NetworkEvent = {
      type: 'connection_created',
      timestamp: Date.now(),
      data: {
        connectionId: connection.id,
        destination: connection.destination,
        type: connection.type,
        protocol: connection.protocol
      },
      severity: 'info'
    };
    
    this.addEvent(event);
    
    // Проверяем на подозрительную активность
    this.checkForSuspiciousActivity(connection);
  }
  
  /**
   * Обработка закрытия соединения
   */
  private handleConnectionClosed(connection: ConnectionInfo, reason?: string): void {
    const event: NetworkEvent = {
      type: 'connection_closed',
      timestamp: Date.now(),
      data: {
        connectionId: connection.id,
        destination: connection.destination,
        duration: connection.lastActivity - connection.startTime,
        bytesTransferred: connection.bytesIn + connection.bytesOut,
        reason: reason || 'normal_close'
      },
      severity: connection.status === 'error' ? 'warning' : 'info'
    };
    
    this.addEvent(event);
  }
  
  /**
   * Обработка обновления соединения
   */
  private handleConnectionUpdated(connection: ConnectionInfo): void {
    // Проверяем производительность
    if (connection.latency > this.config.performanceThresholds.highLatency) {
      this.createPerformanceAlert({
        type: 'high_latency',
        threshold: this.config.performanceThresholds.highLatency,
        currentValue: connection.latency,
        affectedConnections: [connection.id],
        suggestedAction: 'Consider switching to a different route or proxy'
      });
    }
    
    // Проверяем таймауты
    const connectionAge = Date.now() - connection.startTime;
    if (connectionAge > this.config.performanceThresholds.connectionTimeout && 
        connection.status === 'connecting') {
      this.createPerformanceAlert({
        type: 'connection_timeout',
        threshold: this.config.performanceThresholds.connectionTimeout,
        currentValue: connectionAge,
        affectedConnections: [connection.id],
        suggestedAction: 'Connection is taking too long, consider alternative route'
      });
    }
  }
  
  /**
   * Обработка изменения здоровья маршрута
   */
  private handleRouteHealthChanged(route: TrafficRoute, wasHealthy: boolean, isHealthy: boolean): void {
    const event: NetworkEvent = {
      type: 'route_changed',
      timestamp: Date.now(),
      data: {
        routeId: route.id,
        routeName: route.name,
        wasHealthy,
        isHealthy,
        type: route.type
      },
      severity: isHealthy ? 'info' : 'warning'
    };
    
    this.addEvent(event);
    
    if (!isHealthy) {
      this.createPerformanceAlert({
        type: 'route_failure',
        threshold: 1,
        currentValue: 0,
        affectedConnections: [],
        suggestedAction: `Route ${route.name} is unhealthy, traffic will be redirected`
      });
    }
  }
  
  /**
   * Обработка обновления метрик маршрута
   */
  private handleRouteMetricsUpdated(route: TrafficRoute, connection: ConnectionInfo): void {
    // Проверяем пропускную способность
    if (route.metrics.throughput > this.config.performanceThresholds.bandwidthLimit) {
      this.createPerformanceAlert({
        type: 'bandwidth_limit',
        threshold: this.config.performanceThresholds.bandwidthLimit,
        currentValue: route.metrics.throughput,
        affectedConnections: [connection.id],
        suggestedAction: 'High bandwidth usage detected, consider load balancing'
      });
    }
  }
  
  /**
   * Проверка на подозрительную активность
   */
  private checkForSuspiciousActivity(connection: ConnectionInfo): void {
    // Проверяем паттерны в назначении
    for (const pattern of this.config.securityRules.suspiciousPatterns) {
      if (pattern.test(connection.destination)) {
        this.createSecurityAlert({
          type: 'suspicious_traffic',
          source: 'local',
          destination: connection.destination,
          details: `Suspicious pattern detected: ${pattern.source}`,
          riskLevel: 'medium'
        });
        break;
      }
    }
    
    // Проверяем количество соединений к одному домену
    const domainConnections = connectionMonitor.getActiveConnections()
      .filter(conn => conn.destination === connection.destination);
    
    if (domainConnections.length > this.config.securityRules.maxConnectionsPerDomain) {
      this.createSecurityAlert({
        type: 'suspicious_traffic',
        source: 'local',
        destination: connection.destination,
        details: `Too many connections to single domain: ${domainConnections.length}`,
        riskLevel: 'high'
      });
    }
  }
  
  /**
   * Создание предупреждения о производительности
   */
  private createPerformanceAlert(alert: PerformanceAlert): void {
    // Проверяем, нет ли уже такого предупреждения
    const existingAlert = this.performanceAlerts.find(a => 
      a.type === alert.type && 
      JSON.stringify(a.affectedConnections) === JSON.stringify(alert.affectedConnections)
    );
    
    if (existingAlert) {
      existingAlert.currentValue = alert.currentValue;
      return;
    }
    
    this.performanceAlerts.push(alert);
    
    const event: NetworkEvent = {
      type: 'performance_alert',
      timestamp: Date.now(),
      data: alert,
      severity: 'warning'
    };
    
    this.addEvent(event);
    this.emit('performanceAlert', alert);
  }
  
  /**
   * Создание предупреждения о безопасности
   */
  private createSecurityAlert(alert: SecurityAlert): void {
    this.securityAlerts.push(alert);
    
    const event: NetworkEvent = {
      type: 'security_alert',
      timestamp: Date.now(),
      data: alert,
      severity: alert.riskLevel === 'critical' ? 'critical' : 'warning'
    };
    
    this.addEvent(event);
    this.emit('securityAlert', alert);
  }
  
  /**
   * Добавление события
   */
  private addEvent(event: NetworkEvent): void {
    this.events.push(event);
    
    // Ограничиваем количество событий
    if (this.events.length > this.config.maxEvents) {
      this.events.shift();
    }
    
    this.emit('networkEvent', event);
  }
  
  /**
   * Получение снимка сети
   */
  getNetworkSnapshot(): NetworkSnapshot {
    const connectionStats = connectionMonitor.getDetailedStats();
    const routeStats = trafficSplitter.getRouteStats();
    
    return {
      timestamp: Date.now(),
      connections: {
        total: connectionStats.totalConnections || 0,
        active: connectionStats.activeConnections || 0,
        byType: connectionStats.connectionsByType || {},
        byStatus: connectionStats.connectionsByStatus || {}
      },
      routes: {
        total: routeStats.totalRoutes || 0,
        healthy: routeStats.healthyRoutes || 0,
        byType: routeStats.routesByType || {}
      },
      performance: {
        averageLatency: connectionStats.averageLatency || 0,
        totalThroughput: routeStats.routes?.reduce((sum: number, r: any) => sum + (r.metrics?.throughput || 0), 0) || 0,
        errorRate: routeStats.totalRequests > 0 ? (routeStats.totalErrors / routeStats.totalRequests) * 100 : 0,
        successRate: connectionStats.successRate || 0
      },
      alerts: {
        performance: [...this.performanceAlerts],
        security: [...this.securityAlerts]
      }
    };
  }
  
  /**
   * Получение последних событий
   */
  getRecentEvents(limit: number = 50): NetworkEvent[] {
    return this.events.slice(-limit);
  }
  
  /**
   * Получение событий по типу
   */
  getEventsByType(type: NetworkEvent['type'], limit: number = 50): NetworkEvent[] {
    return this.events
      .filter(event => event.type === type)
      .slice(-limit);
  }
  
  /**
   * Получение активных предупреждений
   */
  getActiveAlerts(): { performance: PerformanceAlert[]; security: SecurityAlert[] } {
    return {
      performance: [...this.performanceAlerts],
      security: [...this.securityAlerts]
    };
  }
  
  /**
   * Очистка предупреждения
   */
  clearAlert(type: 'performance' | 'security', index: number): boolean {
    if (type === 'performance' && index < this.performanceAlerts.length) {
      this.performanceAlerts.splice(index, 1);
      return true;
    }
    
    if (type === 'security' && index < this.securityAlerts.length) {
      this.securityAlerts.splice(index, 1);
      return true;
    }
    
    return false;
  }
  
  /**
   * Получение рекомендаций по оптимизации
   */
  getOptimizationRecommendations(): Array<{
    type: 'performance' | 'security' | 'routing';
    priority: 'low' | 'medium' | 'high';
    description: string;
    action: string;
  }> {
    const recommendations = [];
    const snapshot = this.getNetworkSnapshot();
    
    // Рекомендации по производительности
    if (snapshot.performance.averageLatency > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        description: 'High average latency detected',
        action: 'Consider optimizing routes or switching to faster proxies'
      });
    }
    
    if (snapshot.performance.errorRate > 5) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        description: 'High error rate detected',
        action: 'Review failed connections and improve route health checks'
      });
    }
    
    // Рекомендации по маршрутизации
    if (snapshot.routes.healthy < snapshot.routes.total * 0.8) {
      recommendations.push({
        type: 'routing',
        priority: 'high',
        description: 'Many routes are unhealthy',
        action: 'Check proxy servers and network connectivity'
      });
    }
    
    // Рекомендации по безопасности
    if (this.securityAlerts.length > 0) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        description: 'Security alerts detected',
        action: 'Review security alerts and take appropriate action'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Экспорт данных для анализа
   */
  exportAnalyticsData(timeRange: { start: number; end: number }): any {
    const filteredEvents = this.events.filter(event => 
      event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );
    
    return {
      timeRange,
      events: filteredEvents,
      summary: {
        totalEvents: filteredEvents.length,
        eventsByType: this.groupEventsByType(filteredEvents),
        eventsBySeverity: this.groupEventsBySeverity(filteredEvents)
      },
      performance: {
        alerts: this.performanceAlerts,
        trends: this.calculatePerformanceTrends(filteredEvents)
      },
      security: {
        alerts: this.securityAlerts,
        threats: this.analyzeThreatPatterns(filteredEvents)
      }
    };
  }
  
  /**
   * Группировка событий по типу
   */
  private groupEventsByType(events: NetworkEvent[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    for (const event of events) {
      groups[event.type] = (groups[event.type] || 0) + 1;
    }
    
    return groups;
  }
  
  /**
   * Группировка событий по серьезности
   */
  private groupEventsBySeverity(events: NetworkEvent[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    for (const event of events) {
      groups[event.severity] = (groups[event.severity] || 0) + 1;
    }
    
    return groups;
  }
  
  /**
   * Расчет трендов производительности
   */
  private calculatePerformanceTrends(events: NetworkEvent[]): any {
    const performanceEvents = events.filter(e => e.type === 'performance_alert');
    
    return {
      alertCount: performanceEvents.length,
      commonIssues: this.findCommonPerformanceIssues(performanceEvents),
      timeline: this.createPerformanceTimeline(performanceEvents)
    };
  }
  
  /**
   * Поиск общих проблем производительности
   */
  private findCommonPerformanceIssues(events: NetworkEvent[]): Array<{ issue: string; count: number }> {
    const issues: Record<string, number> = {};
    
    for (const event of events) {
      const alertType = event.data?.type || 'unknown';
      issues[alertType] = (issues[alertType] || 0) + 1;
    }
    
    return Object.entries(issues)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count);
  }
  
  /**
   * Создание временной шкалы производительности
   */
  private createPerformanceTimeline(events: NetworkEvent[]): Array<{ timestamp: number; count: number }> {
    const timeline: Record<number, number> = {};
    const interval = 60000; // 1 minute intervals
    
    for (const event of events) {
      const bucket = Math.floor(event.timestamp / interval) * interval;
      timeline[bucket] = (timeline[bucket] || 0) + 1;
    }
    
    return Object.entries(timeline)
      .map(([timestamp, count]) => ({ timestamp: parseInt(timestamp), count }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Анализ паттернов угроз
   */
  private analyzeThreatPatterns(events: NetworkEvent[]): any {
    const securityEvents = events.filter(e => e.type === 'security_alert');
    
    return {
      alertCount: securityEvents.length,
      threatTypes: this.groupThreatTypes(securityEvents),
      riskLevels: this.groupRiskLevels(securityEvents),
      topTargets: this.findTopTargets(securityEvents)
    };
  }
  
  /**
   * Группировка типов угроз
   */
  private groupThreatTypes(events: NetworkEvent[]): Record<string, number> {
    const types: Record<string, number> = {};
    
    for (const event of events) {
      const threatType = event.data?.type || 'unknown';
      types[threatType] = (types[threatType] || 0) + 1;
    }
    
    return types;
  }
  
  /**
   * Группировка уровней риска
   */
  private groupRiskLevels(events: NetworkEvent[]): Record<string, number> {
    const levels: Record<string, number> = {};
    
    for (const event of events) {
      const riskLevel = event.data?.riskLevel || 'unknown';
      levels[riskLevel] = (levels[riskLevel] || 0) + 1;
    }
    
    return levels;
  }
  
  /**
   * Поиск топ целей атак
   */
  private findTopTargets(events: NetworkEvent[]): Array<{ target: string; count: number }> {
    const targets: Record<string, number> = {};
    
    for (const event of events) {
      const target = event.data?.destination || 'unknown';
      targets[target] = (targets[target] || 0) + 1;
    }
    
    return Object.entries(targets)
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  
  /**
   * Запуск периодических задач
   */
  private startPeriodicTasks(): void {
    // Создание снимков сети
    this.snapshotInterval = setInterval(() => {
      const snapshot = this.getNetworkSnapshot();
      this.emit('networkSnapshot', snapshot);
    }, this.config.snapshotInterval);
    
    // Проверка предупреждений
    this.alertCheckInterval = setInterval(() => {
      this.performAlertMaintenance();
    }, this.config.alertCheckInterval);
  }
  
  /**
   * Обслуживание предупреждений
   */
  private performAlertMaintenance(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    // Удаляем старые предупреждения о производительности
    this.performanceAlerts = this.performanceAlerts.filter(alert => {
      // Здесь можно добавить логику определения возраста предупреждения
      return true; // Пока оставляем все
    });
    
    // Удаляем старые предупреждения о безопасности
    this.securityAlerts = this.securityAlerts.filter(alert => {
      // Здесь можно добавить логику определения возраста предупреждения
      return true; // Пока оставляем все
    });
  }
  
  /**
   * Обновление конфигурации
   */
  updateConfig(newConfig: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }
  
  /**
   * Получение конфигурации
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }
  
  /**
   * Очистка ресурсов
   */
  cleanup(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
    }
    
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }
    
    this.events = [];
    this.performanceAlerts = [];
    this.securityAlerts = [];
    this.removeAllListeners();
  }
}

// Экспорт singleton instance
export const networkObserver = new NetworkObserver();