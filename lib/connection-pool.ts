import { EventEmitter } from 'events';
import winston from 'winston';
import https from 'https';
import http from 'http';

interface PoolConfig {
  maxConnections: number;
  maxConnectionsPerHost: number;
  keepAlive: boolean;
  keepAliveMsecs: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  requests: number;
  responses: number;
  errors: number;
  timeouts: number;
  retries: number;
}

export class ConnectionPool extends EventEmitter {
  private config: PoolConfig;
  private agents: Map<string, http.Agent | https.Agent> = new Map();
  private stats: ConnectionStats;
  private logger: winston.Logger;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    
    this.config = {
      maxConnections: config.maxConnections || 100,
      maxConnectionsPerHost: config.maxConnectionsPerHost || 10,
      keepAlive: config.keepAlive !== false,
      keepAliveMsecs: config.keepAliveMsecs || 1000,
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      requests: 0,
      responses: 0,
      errors: 0,
      timeouts: 0,
      retries: 0
    };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/connection-pool.log' })
      ]
    });

    this.setupDefaultAgents();
    this.startCleanup();
  }

  private setupDefaultAgents(): void {
    // HTTP Agent
    const httpAgent = new http.Agent({
      keepAlive: this.config.keepAlive,
      keepAliveMsecs: this.config.keepAliveMsecs,
      maxSockets: this.config.maxConnectionsPerHost,
      maxTotalSockets: this.config.maxConnections,
      timeout: this.config.timeout
    });

    // HTTPS Agent
    const httpsAgent = new https.Agent({
      keepAlive: this.config.keepAlive,
      keepAliveMsecs: this.config.keepAliveMsecs,
      maxSockets: this.config.maxConnectionsPerHost,
      maxTotalSockets: this.config.maxConnections,
      timeout: this.config.timeout,
      rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0'
    });

    this.agents.set('http:', httpAgent);
    this.agents.set('https:', httpsAgent);

    this.logger.info('Connection pool initialized', {
      maxConnections: this.config.maxConnections,
      maxConnectionsPerHost: this.config.maxConnectionsPerHost,
      keepAlive: this.config.keepAlive
    });
  }

  public getAgent(protocol: string): http.Agent | https.Agent {
    const agent = this.agents.get(protocol);
    if (!agent) {
      throw new Error(`Unsupported protocol: ${protocol}`);
    }
    return agent;
  }

  public async makeRequest(options: http.RequestOptions | https.RequestOptions, data?: any): Promise<{ statusCode: number; headers: any; body: any }> {
    return new Promise((resolve, reject) => {
      this.stats.requests++;
      
      const protocol = options.protocol || 'https:';
      const agent = this.getAgent(protocol);
      
      const requestOptions = {
        ...options,
        agent,
        timeout: this.config.timeout
      };

      const request = (protocol === 'https:' ? https : http).request(requestOptions, (response) => {
        this.stats.responses++;
        this.stats.activeConnections++;

        let body = '';
        
        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          this.stats.activeConnections--;
          
          try {
            const jsonBody = JSON.parse(body);
            resolve({
              statusCode: response.statusCode || 200,
              headers: response.headers,
              body: jsonBody
            });
          } catch {
            resolve({
              statusCode: response.statusCode || 200,
              headers: response.headers,
              body
            });
          }

          this.logger.debug(`Request completed: ${options.method} ${options.path}`, {
            statusCode: response.statusCode,
            responseTime: Date.now()
          });
        });

        response.on('error', (error) => {
          this.stats.errors++;
          this.stats.activeConnections--;
          this.logger.error(`Response error: ${error.message}`);
          reject(error);
        });
      });

      request.on('error', (error) => {
        this.stats.errors++;
        this.logger.error(`Request error: ${error.message}`);
        reject(error);
      });

      request.on('timeout', () => {
        this.stats.timeouts++;
        request.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        if (typeof data === 'object') {
          request.write(JSON.stringify(data));
        } else {
          request.write(data);
        }
      }

      request.end();
    });
  }

  public async makeRequestWithRetry(options: http.RequestOptions | https.RequestOptions, data?: any): Promise<{ statusCode: number; headers: any; body: any }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.makeRequest(options, data);
      } catch (error) {
        lastError = error as Error;
        this.stats.retries++;

        if (attempt < this.config.retryAttempts) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.logger.warn(`Request failed (attempt ${attempt}/${this.config.retryAttempts}), retrying in ${delay}ms: ${lastError.message}`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  public getStats(): ConnectionStats & { config: PoolConfig } {
    const agentStats = Array.from(this.agents.values()).reduce((acc, agent) => {
      if ('getTotalSocketCount' in agent) {
        acc.totalSockets += (agent as any).getTotalSocketCount();
      }
      if ('getActiveSocketCount' in agent) {
        acc.activeSockets += (agent as any).getActiveSocketCount();
      }
      if ('getIdleSocketCount' in agent) {
        acc.idleSockets += (agent as any).getIdleSocketCount();
      }
      return acc;
    }, { totalSockets: 0, activeSockets: 0, idleSockets: 0 });

    return {
      ...this.stats,
      totalConnections: agentStats.totalSockets,
      activeConnections: agentStats.activeSockets,
      idleConnections: agentStats.idleSockets,
      config: this.config
    };
  }

  public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const stats = this.getStats();
      
      // Проверяем, не превышены ли лимиты соединений
      if (stats.activeConnections > stats.config.maxConnections * 0.9) {
        return {
          status: 'unhealthy',
          details: {
            message: 'Connection pool near capacity',
            activeConnections: stats.activeConnections,
            maxConnections: stats.config.maxConnections
          }
        };
      }

      // Проверяем процент ошибок
      const errorRate = stats.requests > 0 ? stats.errors / stats.requests : 0;
      if (errorRate > 0.1) { // 10% error rate
        return {
          status: 'unhealthy',
          details: {
            message: 'High error rate',
            errorRate: errorRate,
            errors: stats.errors,
            requests: stats.requests
          }
        };
      }

      return {
        status: 'healthy',
        details: {
          stats,
          errorRate,
          utilizationRate: stats.activeConnections / stats.config.maxConnections
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          message: 'Health check failed',
          error: String(error)
        }
      };
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Каждую минуту
  }

  private cleanup(): void {
    // Принудительно закрываем неиспользуемые соединения
    for (const agent of this.agents.values()) {
      if ('destroyIdleSockets' in agent) {
        (agent as any).destroyIdleSockets();
      }
    }

    this.logger.debug('Connection pool cleanup completed');
    this.emit('cleanup');
  }

  public shutdown(): void {
    clearInterval(this.cleanupInterval);
    
    // Закрываем все соединения
    for (const agent of this.agents.values()) {
      if ('destroy' in agent) {
        (agent as any).destroy();
      }
    }

    this.agents.clear();
    this.removeAllListeners();
    this.logger.info('Connection pool shutdown');
  }
}
