/**
 * Network Monitoring API
 * API для мониторинга сетевых соединений в реальном времени
 */

import { NextRequest, NextResponse } from 'next/server';
import { networkObserver } from '@/lib/network-observer';
import { connectionMonitor } from '@/lib/connection-monitor';
import { trafficSplitter } from '@/lib/traffic-splitter';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'snapshot';
    
    switch (action) {
      case 'snapshot':
        return handleSnapshot();
        
      case 'events':
        return handleEvents(searchParams);
        
      case 'alerts':
        return handleAlerts();
        
      case 'connections':
        return handleConnections();
        
      case 'routes':
        return handleRoutes();
        
      case 'analytics':
        return handleAnalytics(searchParams);
        
      case 'recommendations':
        return handleRecommendations();
        
      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Network monitoring API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Получение снимка сети
 */
async function handleSnapshot() {
  const snapshot = networkObserver.getNetworkSnapshot();
  
  return NextResponse.json({
    success: true,
    data: snapshot
  });
}

/**
 * Получение событий
 */
async function handleEvents(searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '50');
  const type = searchParams.get('type');
  
  let events;
  if (type) {
    events = networkObserver.getEventsByType(type as any, limit);
  } else {
    events = networkObserver.getRecentEvents(limit);
  }
  
  return NextResponse.json({
    success: true,
    data: {
      events,
      total: events.length
    }
  });
}

/**
 * Получение предупреждений
 */
async function handleAlerts() {
  const alerts = networkObserver.getActiveAlerts();
  
  return NextResponse.json({
    success: true,
    data: alerts
  });
}

/**
 * Получение информации о соединениях
 */
async function handleConnections() {
  const activeConnections = connectionMonitor.getActiveConnections();
  const stats = connectionMonitor.getDetailedStats();
  
  return NextResponse.json({
    success: true,
    data: {
      active: activeConnections,
      stats
    }
  });
}

/**
 * Получение информации о маршрутах
 */
async function handleRoutes() {
  const routeStats = trafficSplitter.getRouteStats();
  
  return NextResponse.json({
    success: true,
    data: routeStats
  });
}

/**
 * Получение аналитических данных
 */
async function handleAnalytics(searchParams: URLSearchParams) {
  const startTime = parseInt(searchParams.get('start') || '0');
  const endTime = parseInt(searchParams.get('end') || Date.now().toString());
  
  const analyticsData = networkObserver.exportAnalyticsData({
    start: startTime,
    end: endTime
  });
  
  return NextResponse.json({
    success: true,
    data: analyticsData
  });
}

/**
 * Получение рекомендаций
 */
async function handleRecommendations() {
  const recommendations = networkObserver.getOptimizationRecommendations();
  
  return NextResponse.json({
    success: true,
    data: recommendations
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'clear_alert':
        return handleClearAlert(body);
        
      case 'update_config':
        return handleUpdateConfig(body);
        
      case 'create_connection':
        return handleCreateConnection(body);
        
      case 'close_connection':
        return handleCloseConnection(body);
        
      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Network monitoring POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Очистка предупреждения
 */
async function handleClearAlert(body: any) {
  const { type, index } = body;
  
  if (!type || typeof index !== 'number') {
    return NextResponse.json(
      { error: 'Missing required parameters: type, index' },
      { status: 400 }
    );
  }
  
  const success = networkObserver.clearAlert(type, index);
  
  return NextResponse.json({
    success,
    message: success ? 'Alert cleared successfully' : 'Failed to clear alert'
  });
}

/**
 * Обновление конфигурации
 */
async function handleUpdateConfig(body: any) {
  const { config } = body;
  
  if (!config) {
    return NextResponse.json(
      { error: 'Missing config parameter' },
      { status: 400 }
    );
  }
  
  networkObserver.updateConfig(config);
  
  return NextResponse.json({
    success: true,
    message: 'Configuration updated successfully'
  });
}

/**
 * Создание соединения
 */
async function handleCreateConnection(body: any) {
  const { destination, port, protocol } = body;
  
  if (!destination || !port || !protocol) {
    return NextResponse.json(
      { error: 'Missing required parameters: destination, port, protocol' },
      { status: 400 }
    );
  }
  
  const connectionId = connectionMonitor.createConnection(destination, port, protocol);
  
  return NextResponse.json({
    success: true,
    data: { connectionId }
  });
}

/**
 * Закрытие соединения
 */
async function handleCloseConnection(body: any) {
  const { connectionId, reason } = body;
  
  if (!connectionId) {
    return NextResponse.json(
      { error: 'Missing connectionId parameter' },
      { status: 400 }
    );
  }
  
  connectionMonitor.closeConnection(connectionId, reason);
  
  return NextResponse.json({
    success: true,
    message: 'Connection closed successfully'
  });
}