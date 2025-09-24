/**
 * Advanced Connection Monitor
 * Продвинутый мониторинг соединений, вдохновленный RustNet
 * 
 * Функции:
 * - Мониторинг активных соединений в реальном времени
 * - Классификация трафика (тунелированный/прямой)
 * - Анализ производительности соединений
 * - Автоматическое переключение между прокси и прямым соединением
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

export interface ConnectionInfo {
  id: string;
  destination: string;
  port: number;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  type: 'direct' | 'proxy' | 'tunnel';
  startTime: number;
  lastActivity: number;
  bytesIn: number;
  bytesOut: number;
  latency: number;
  status: 'connecting' | 'connected' | 'idle' | 'closed' | 'error';
  proxyChain?: string[];
  geoLocation?: {
    country: string;
    region: string;
    blocked: boolean;
  };
}

export interface TrafficStats {
  totalConnections: number;
  activeConnections: number;
  directConnections: number;
  proxiedConnections: number;
  tunneledConnections: number;
  totalBytesIn: number;
  totalBytesOut: number;
  averageLatency: number;
  successRate: number;
  blockedRequests: number;
}

export interface ConnectionRule {
  pattern: RegExp;
  action: 'direct' | 'proxy' | 'tunnel' | 'block';
  priority: number;
  reason: string;
  conditions?: {
    geoBlocked?: boolean;
    highLatency?: boolean;
    aiService?: boolean;
    russianDomain?: boolean;
  };
}

export class ConnectionMonitor extends EventEmitter {
  private connections = new Map<string, ConnectionInfo>();
  private rules: ConnectionRule[] = [];
  private stats: TrafficStats = {
    totalConnections: 0,
    activeConnections: 0,
    directConnections: 0,
    proxiedConnections: 0,
    tunneledConnections: 0,
    totalBytesIn: 0,
    totalBytesOut: 0,
    averageLatency: 0,
    successRate: 0,
    blockedRequests: 0
  };
  
  private cleanupInterval: NodeJS.Timeout;
  private statsUpdateInterval: NodeJS.Timeout;
  
  constructor() {
    super();
    this.initializeDefaultRules();
    this.startCleanupTimer();
    this.startStatsUpdater();
  }
  
  /**
   * Инициализация правил по умолчанию
   */
  private initializeDefaultRules(): void {
    this.rules = [
      // AI сервисы через прокси
      {
        pattern: /^(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com)/,
        action: 'proxy',
        priority: 100,
        reason: 'AI service requires proxy for geo-restrictions',
        conditions: { aiService: true, geoBlocked: true }
      },
      
      // Российские домены напрямую
      {
        pattern: /\.(ru|рф)$/,
        action: 'direct',
        priority: 90,
        reason: 'Russian domain - direct connection preferred',
        conditions: { russianDomain: true }
      },
      
      // Заблокированные домены через туннель
      {
        pattern: /^(.*\.facebook\.com|.*\.twitter\.com|.*\.instagram\.com)/,
        action: 'tunnel',
        priority: 80,
        reason: 'Blocked social media - tunnel required',
        conditions: { geoBlocked: true }
      },
      
      // YouTube через кеш-сервер
      {
        pattern: /^(.*\.youtube\.com|.*\.googlevideo\.com)/,
        action: 'proxy',
        priority: 70,
        reason: 'YouTube content - use cache server',
        conditions: { geoBlocked: false }
      },
      
      // Высокая задержка - переключение на прокси
      {
        pattern: /.*/,
        action: 'proxy',
        priority: 10,
        reason: 'High latency detected - switching to proxy',
        conditions: { highLatency: true }
      },
      
      // По умолчанию - прямое соединение
      {
        pattern: /.*/,
        action: 'direct',
        priority: 1,
        reason: 'Default rule - direct connection'
      }
    ];
  }
  
  /**
   * Создание нового соединения
   */
  createConnection(destination: string, port: number, protocol: 'http' | 'https' | 'ws' | 'wss'): string {
    const connectionId = this.generateConnectionId();
    const now = performance.now();
    
    const connection: ConnectionInfo = {
      id: connectionId,
      destination,
      port,
      protocol,
      type: this.determineConnectionType(destination),
      startTime: now,
      lastActivity: now,
      bytesIn: 0,
      bytesOut: 0,
      latency: 0,
      status: 'connecting'
    };
    
    this.connections.set(connectionId, connection);
    this.stats.totalConnections++;
    this.stats.activeConnections++;
    
    this.emit('connectionCreated', connection);
    
    return connectionId;
  }
  
  /**
   * Определение типа соединения на основе правил
   */
  private determineConnectionType(destination: string): 'direct' | 'proxy' | 'tunnel' {
    // Сортируем правила по приоритету
    const sortedRules = this.rules.sort((a, b) => b.priority - a.priority);
    
    for (const rule of sortedRules) {
      if (rule.pattern.test(destination)) {
        // Проверяем дополнительные условия
        if (this.checkRuleConditions(rule, destination)) {
          this.emit('ruleMatched', { destination, rule });
          return rule.action as 'direct' | 'proxy' | 'tunnel';
        }
      }
    }
    
    return 'direct'; // По умолчанию
  }
  
  /**
   * Проверка условий правила
   */
  private checkRuleConditions(rule: ConnectionRule, destination: string): boolean {
    if (!rule.conditions) return true;
    
    const conditions = rule.conditions;
    
    // Проверка на AI сервис
    if (conditions.aiService) {
      const aiPatterns = [
        /openai\.com/,
        /anthropic\.com/,
        /googleapis\.com/,
        /huggingface\.co/,
        /together\.ai/,
        /groq\.com/
      ];
      
      if (!aiPatterns.some(pattern => pattern.test(destination))) {
        return false;
      }
    }
    
    // Проверка на российский домен
    if (conditions.russianDomain) {
      if (!/\.(ru|рф)$/.test(destination)) {
        return false;
      }
    }
    
    // Проверка на высокую задержку
    if (conditions.highLatency) {
      const avgLatency = this.getAverageLatencyForDomain(destination);
      if (avgLatency < 1000) { // Менее 1 секунды не считается высокой задержкой
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Получение средней задержки для домена
   */
  private getAverageLatencyForDomain(domain: string): number {
    const domainConnections = Array.from(this.connections.values())
      .filter(conn => conn.destination.includes(domain));
    
    if (domainConnections.length === 0) return 0;
    
    const totalLatency = domainConnections.reduce((sum, conn) => sum + conn.latency, 0);
    return totalLatency / domainConnections.length;
  }
  
  /**
   * Обновление статистики соединения
   */
  updateConnection(connectionId: string, updates: Partial<ConnectionInfo>): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    const oldStatus = connection.status;
    Object.assign(connection, updates, { lastActivity: performance.now() });
    
    // Обновляем статистику при изменении статуса
    if (updates.status && updates.status !== oldStatus) {
      this.updateConnectionStats(connection, oldStatus);
    }
    
    this.emit('connectionUpdated', connection);
  }
  
  /**
   * Обновление статистики
   */
  private updateConnectionStats(connection: ConnectionInfo, oldStatus: string): void {
    // Обновляем счетчики по типам соединений
    if (connection.status === 'connected') {
      switch (connection.type) {
        case 'direct':
          this.stats.directConnections++;
          break;
        case 'proxy':
          this.stats.proxiedConnections++;
          break;
        case 'tunnel':
          this.stats.tunneledConnections++;
          break;
      }
    }
    
    if (connection.status === 'closed' || connection.status === 'error') {
      this.stats.activeConnections--;
    }
    
    // Обновляем общую статистику
    this.stats.totalBytesIn += connection.bytesIn;
    this.stats.totalBytesOut += connection.bytesOut;
  }
  
  /**
   * Закрытие соединения
   */
  closeConnection(connectionId: string, reason?: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    connection.status = 'closed';
    connection.lastActivity = performance.now();
    
    this.stats.activeConnections--;
    
    this.emit('connectionClosed', { connection, reason });
  }
  
  /**
   * Получение информации о соединении
   */
  getConnection(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }
  
  /**
   * Получение всех активных соединений
   */
  getActiveConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected' || conn.status === 'connecting');
  }
  
  /**
   * Получение соединений по типу
   */
  getConnectionsByType(type: 'direct' | 'proxy' | 'tunnel'): ConnectionInfo[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.type === type);
  }
  
  /**
   * Получение статистики
   */
  getStats(): TrafficStats {
    return { ...this.stats };
  }
  
  /**
   * Получение детальной статистики
   */
  getDetailedStats(): any {
    const connections = Array.from(this.connections.values());
    const now = performance.now();
    
    return {
      ...this.stats,
      connectionsByStatus: {
        connecting: connections.filter(c => c.status === 'connecting').length,
        connected: connections.filter(c => c.status === 'connected').length,
        idle: connections.filter(c => c.status === 'idle').length,
        closed: connections.filter(c => c.status === 'closed').length,
        error: connections.filter(c => c.status === 'error').length
      },
      connectionsByType: {
        direct: connections.filter(c => c.type === 'direct').length,
        proxy: connections.filter(c => c.type === 'proxy').length,
        tunnel: connections.filter(c => c.type === 'tunnel').length
      },
      topDestinations: this.getTopDestinations(),
      averageConnectionDuration: this.getAverageConnectionDuration(),
      currentTimestamp: now
    };
  }
  
  /**
   * Получение топ назначений
   */
  private getTopDestinations(): Array<{ destination: string; count: number; bytes: number }> {
    const destinationStats = new Map<string, { count: number; bytes: number }>();
    
    for (const connection of this.connections.values()) {
      const existing = destinationStats.get(connection.destination) || { count: 0, bytes: 0 };
      existing.count++;
      existing.bytes += connection.bytesIn + connection.bytesOut;
      destinationStats.set(connection.destination, existing);
    }
    
    return Array.from(destinationStats.entries())
      .map(([destination, stats]) => ({ destination, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  
  /**
   * Получение средней продолжительности соединения
   */
  private getAverageConnectionDuration(): number {
    const closedConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'closed');
    
    if (closedConnections.length === 0) return 0;
    
    const totalDuration = closedConnections.reduce((sum, conn) => {
      return sum + (conn.lastActivity - conn.startTime);
    }, 0);
    
    return totalDuration / closedConnections.length;
  }
  
  /**
   * Добавление правила маршрутизации
   */
  addRule(rule: ConnectionRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    this.emit('ruleAdded', rule);
  }
  
  /**
   * Удаление правила
   */
  removeRule(pattern: string): boolean {
    const index = this.rules.findIndex(rule => rule.pattern.source === pattern);
    if (index !== -1) {
      const removedRule = this.rules.splice(index, 1)[0];
      this.emit('ruleRemoved', removedRule);
      return true;
    }
    return false;
  }
  
  /**
   * Получение всех правил
   */
  getRules(): ConnectionRule[] {
    return [...this.rules];
  }
  
  /**
   * Анализ производительности соединений
   */
  analyzePerformance(): any {
    const connections = Array.from(this.connections.values());
    const now = performance.now();
    
    const analysis = {
      slowConnections: connections.filter(c => c.latency > 2000),
      fastConnections: connections.filter(c => c.latency < 500),
      highTrafficConnections: connections.filter(c => (c.bytesIn + c.bytesOut) > 1024 * 1024), // > 1MB
      idleConnections: connections.filter(c => (now - c.lastActivity) > 30000), // > 30 seconds
      errorConnections: connections.filter(c => c.status === 'error'),
      recommendations: []
    };
    
    // Генерируем рекомендации
    if (analysis.slowConnections.length > 0) {
      analysis.recommendations.push({
        type: 'performance',
        message: `${analysis.slowConnections.length} slow connections detected. Consider using proxy.`,
        connections: analysis.slowConnections.map(c => c.id)
      });
    }
    
    if (analysis.idleConnections.length > 5) {
      analysis.recommendations.push({
        type: 'cleanup',
        message: `${analysis.idleConnections.length} idle connections. Consider cleanup.`,
        connections: analysis.idleConnections.map(c => c.id)
      });
    }
    
    return analysis;
  }
  
  /**
   * Генерация ID соединения
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Запуск таймера очистки
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldConnections();
    }, 60000); // Каждую минуту
  }
  
  /**
   * Очистка старых соединений
   */
  private cleanupOldConnections(): void {
    const now = performance.now();
    const maxAge = 5 * 60 * 1000; // 5 минут
    
    for (const [id, connection] of this.connections.entries()) {
      if (connection.status === 'closed' && (now - connection.lastActivity) > maxAge) {
        this.connections.delete(id);
        this.emit('connectionCleanedUp', connection);
      }
    }
  }
  
  /**
   * Запуск обновления статистики
   */
  private startStatsUpdater(): void {
    this.statsUpdateInterval = setInterval(() => {
      this.updateGlobalStats();
    }, 10000); // Каждые 10 секунд
  }
  
  /**
   * Обновление глобальной статистики
   */
  private updateGlobalStats(): void {
    const connections = Array.from(this.connections.values());
    
    this.stats.activeConnections = connections.filter(c => 
      c.status === 'connected' || c.status === 'connecting'
    ).length;
    
    const totalLatency = connections.reduce((sum, conn) => sum + conn.latency, 0);
    this.stats.averageLatency = connections.length > 0 ? totalLatency / connections.length : 0;
    
    const successfulConnections = connections.filter(c => c.status === 'connected').length;
    this.stats.successRate = this.stats.totalConnections > 0 
      ? (successfulConnections / this.stats.totalConnections) * 100 
      : 0;
    
    this.emit('statsUpdated', this.stats);
  }
  
  /**
   * Очистка ресурсов
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
    }
    
    this.connections.clear();
    this.removeAllListeners();
  }
}

// Экспорт singleton instance
export const connectionMonitor = new ConnectionMonitor();