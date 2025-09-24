/**
 * Network Monitor Dashboard
 * Дашборд для мониторинга сетевых соединений в реальном времени
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  Globe, 
  Zap, 
  Shield, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  BarChart3,
  Network,
  Router
} from 'lucide-react';

interface NetworkSnapshot {
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
    performance: any[];
    security: any[];
  };
}

interface Connection {
  id: string;
  destination: string;
  port: number;
  protocol: string;
  type: 'direct' | 'proxy' | 'tunnel';
  status: string;
  startTime: number;
  lastActivity: number;
  bytesIn: number;
  bytesOut: number;
  latency: number;
}

interface Route {
  id: string;
  name: string;
  type: string;
  healthy: boolean;
  weight: number;
  metrics: {
    requests: number;
    errors: number;
    avgLatency: number;
    throughput: number;
  };
}

export default function NetworkMonitorDashboard() {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Подключение к WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      const websocket = new WebSocket('ws://localhost:13084');
      
      websocket.onopen = () => {
        console.log('Connected to Network Monitor WebSocket');
        setIsConnected(true);
        setWs(websocket);
      };
      
      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      websocket.onclose = () => {
        console.log('Disconnected from Network Monitor WebSocket');
        setIsConnected(false);
        setWs(null);
        
        // Переподключение через 5 секунд
        setTimeout(connectWebSocket, 5000);
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);
  
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'welcome':
        console.log('Welcome message received:', message.data);
        break;
        
      case 'network_snapshot':
        setSnapshot(message.data);
        break;
        
      case 'connections_data':
        setConnections(message.data.connections || []);
        break;
        
      case 'routes_data':
        setRoutes(message.data.routes || []);
        break;
        
      case 'network_event':
        setEvents(prev => [message.data, ...prev.slice(0, 49)]); // Последние 50 событий
        break;
        
      case 'performance_alert':
      case 'security_alert':
        // Обновляем предупреждения в снимке
        if (snapshot) {
          const updatedSnapshot = { ...snapshot };
          if (message.type === 'performance_alert') {
            updatedSnapshot.alerts.performance.push(message.data);
          } else {
            updatedSnapshot.alerts.security.push(message.data);
          }
          setSnapshot(updatedSnapshot);
        }
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }, [snapshot]);
  
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };
  
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'direct': return <Globe className="h-4 w-4" />;
      case 'proxy': return <Router className="h-4 w-4" />;
      case 'tunnel': return <Shield className="h-4 w-4" />;
      default: return <Network className="h-4 w-4" />;
    }
  };
  
  if (!snapshot) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            {isConnected ? 'Loading network data...' : 'Connecting to network monitor...'}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Network Monitor</h1>
          <p className="text-muted-foreground">
            Real-time network connections and traffic monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ws?.send(JSON.stringify({ type: 'get_snapshot' }))}
          >
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot.connections.active}</div>
            <p className="text-xs text-muted-foreground">
              of {snapshot.connections.total} total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy Routes</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot.routes.healthy}</div>
            <p className="text-xs text-muted-foreground">
              of {snapshot.routes.total} routes
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot.performance.averageLatency}ms</div>
            <p className="text-xs text-muted-foreground">
              {snapshot.performance.successRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(snapshot.performance.totalThroughput)}/s</div>
            <p className="text-xs text-muted-foreground">
              {snapshot.performance.errorRate.toFixed(1)}% error rate
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Предупреждения */}
      {(snapshot.alerts.performance.length > 0 || snapshot.alerts.security.length > 0) && (
        <div className="space-y-2">
          {snapshot.alerts.performance.map((alert, index) => (
            <Alert key={`perf-${index}`} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Performance Alert</AlertTitle>
              <AlertDescription>
                {alert.type}: {alert.suggestedAction}
              </AlertDescription>
            </Alert>
          ))}
          
          {snapshot.alerts.security.map((alert, index) => (
            <Alert key={`sec-${index}`} variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertTitle>Security Alert</AlertTitle>
              <AlertDescription>
                {alert.type}: {alert.details}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}
      
      {/* Детальная информация */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Соединения по типу */}
            <Card>
              <CardHeader>
                <CardTitle>Connections by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(snapshot.connections.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(type)}
                        <span className="capitalize">{type}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Маршруты по типу */}
            <Card>
              <CardHeader>
                <CardTitle>Routes by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(snapshot.routes.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(type)}
                        <span className="capitalize">{type}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="connections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Connections</CardTitle>
              <CardDescription>
                Real-time view of all network connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {connections.map((connection) => (
                  <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(connection.status)}`} />
                      <div>
                        <div className="font-medium">{connection.destination}:{connection.port}</div>
                        <div className="text-sm text-muted-foreground">
                          {connection.protocol.toUpperCase()} via {connection.type}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{connection.latency}ms</div>
                      <div className="text-xs text-muted-foreground">
                        ↓{formatBytes(connection.bytesIn)} ↑{formatBytes(connection.bytesOut)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {connections.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No active connections
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="routes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Routes</CardTitle>
              <CardDescription>
                Available routes and their health status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {routes.map((route) => (
                  <div key={route.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {route.healthy ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-medium">{route.name}</span>
                        <Badge variant="outline">{route.type}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Weight: {route.weight}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Requests</div>
                        <div className="font-medium">{route.metrics.requests}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Errors</div>
                        <div className="font-medium">{route.metrics.errors}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Latency</div>
                        <div className="font-medium">{Math.round(route.metrics.avgLatency)}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Throughput</div>
                        <div className="font-medium">{formatBytes(route.metrics.throughput)}/s</div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {routes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No routes available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                Real-time network events and activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {events.map((event, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 border rounded">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      event.severity === 'error' ? 'bg-red-500' :
                      event.severity === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{event.type.replace('_', ' ')}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {event.data.message || JSON.stringify(event.data)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {events.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent events
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}