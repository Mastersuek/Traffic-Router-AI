import axios, { AxiosInstance } from 'axios';
import { AppConfig, ConnectionStatus, TrafficStats } from '../types/Config';

export class TrafficRouterService {
  private static instance: TrafficRouterService;
  private config: AppConfig;
  private httpClient: AxiosInstance;
  private status: ConnectionStatus;
  private stats: TrafficStats;
  private eventListeners = new Map<string, Function[]>();

  private constructor(config: AppConfig) {
    this.config = config;
    this.httpClient = axios.create({
      baseURL: config.serverUrl,
      timeout: 10000,
    });
    
    this.status = {
      connected: false,
      serverReachable: false,
      proxyActive: false,
      currentRegion: "Unknown",
      bytesTransferred: 0,
      activeConnections: 0,
    };

    this.stats = {
      totalRequests: 0,
      proxiedRequests: 0,
      directRequests: 0,
      blockedRequests: 0,
      averageLatency: 0,
      dataTransferred: { upload: 0, download: 0 },
      topDomains: [],
    };
  }

  static initialize(config: AppConfig): TrafficRouterService {
    if (!TrafficRouterService.instance) {
      TrafficRouterService.instance = new TrafficRouterService(config);
    }
    return TrafficRouterService.instance;
  }

  static getInstance(): TrafficRouterService {
    if (!TrafficRouterService.instance) {
      throw new Error('TrafficRouterService not initialized');
    }
    return TrafficRouterService.instance;
  }

  async connect(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health');
      
      if (response.status === 200) {
        this.status.connected = true;
        this.status.serverReachable = true;
        this.status.lastError = undefined;
        this.emit('connected');
        return true;
      }
      
      throw new Error(`Server responded with status: ${response.status}`);
    } catch (error) {
      this.status.connected = false;
      this.status.serverReachable = false;
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.emit('connectionFailed', error);
      return false;
    }
  }

  disconnect(): void {
    this.status.connected = false;
    this.status.serverReachable = false;
    this.status.proxyActive = false;
    this.emit('disconnected');
  }

  async startProxy(): Promise<boolean> {
    try {
      const response = await this.httpClient.post('/proxy/start', {
        port: this.config.proxyPort,
      });

      if (response.status === 200) {
        this.status.proxyActive = true;
        this.emit('proxyStarted');
        return true;
      }

      throw new Error(`Failed to start proxy: ${response.statusText}`);
    } catch (error) {
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.emit('proxyError', error);
      return false;
    }
  }

  async stopProxy(): Promise<boolean> {
    try {
      const response = await this.httpClient.post('/proxy/stop');

      if (response.status === 200) {
        this.status.proxyActive = false;
        this.emit('proxyStopped');
        return true;
      }

      throw new Error(`Failed to stop proxy: ${response.statusText}`);
    } catch (error) {
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  async fetchStats(): Promise<TrafficStats> {
    try {
      const response = await this.httpClient.get('/stats');
      
      if (response.status === 200) {
        this.updateStatsFromServer(response.data);
        this.emit('statsUpdated', this.stats);
        return this.stats;
      }
      
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    } catch (error) {
      console.warn('Failed to fetch stats:', error);
      return this.stats;
    }
  }

  async clearStats(): Promise<boolean> {
    try {
      const response = await this.httpClient.post('/stats/clear');

      if (response.status === 200) {
        this.stats = {
          totalRequests: 0,
          proxiedRequests: 0,
          directRequests: 0,
          blockedRequests: 0,
          averageLatency: 0,
          dataTransferred: { upload: 0, download: 0 },
          topDomains: [],
        };
        this.emit('statsCleared');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to clear stats:', error);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
    const startTime = Date.now();

    try {
      const response = await this.httpClient.get('/test');
      const latency = Date.now() - startTime;

      if (response.status === 200) {
        return { success: true, latency };
      } else {
        return { success: false, latency, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  getStats(): TrafficStats {
    return { ...this.stats };
  }

  updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update HTTP client base URL if changed
    if (newConfig.serverUrl) {
      this.httpClient.defaults.baseURL = newConfig.serverUrl;
    }
    
    this.emit('configUpdated', this.config);
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  private updateStatsFromServer(serverStats: any): void {
    this.stats = {
      totalRequests: serverStats.totalRequests || 0,
      proxiedRequests: serverStats.proxiedRequests || 0,
      directRequests: serverStats.directRequests || 0,
      blockedRequests: serverStats.blockedRequests || 0,
      averageLatency: serverStats.averageLatency || 0,
      dataTransferred: serverStats.dataTransferred || { upload: 0, download: 0 },
      topDomains: serverStats.topDomains || [],
    };

    this.status.activeConnections = serverStats.activeConnections || 0;
    this.status.bytesTransferred = serverStats.bytesTransferred || 0;
    this.status.currentRegion = serverStats.currentRegion || "Unknown";
  }
}