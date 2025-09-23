import { EventEmitter } from 'events';
import * as winston from 'winston';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
}

export class CacheManager<T = any> extends EventEmitter {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private cleanupInterval!: NodeJS.Timeout;
  private logger: winston.Logger;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0
  };

  constructor(config: Partial<CacheConfig> = {}) {
    super();
    
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTTL: config.defaultTTL || 300000, // 5 минут
      cleanupInterval: config.cleanupInterval || 60000 // 1 минута
    };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/cache.log' })
      ]
    });

    this.startCleanup();
  }

  public set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.config.defaultTTL);

    // Если кэш переполнен, удаляем старые записи
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: now,
      accessCount: 0,
      lastAccessed: now
    });

    this.stats.sets++;
    this.logger.debug(`Cache set: ${key}`, { ttl: ttl || this.config.defaultTTL });
    this.emit('set', { key, value, ttl });
  }

  public get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.logger.debug(`Cache miss: ${key}`);
      return null;
    }

    const now = Date.now();
    
    // Проверяем срок действия
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.logger.debug(`Cache expired: ${key}`);
      return null;
    }

    // Обновляем статистику доступа
    entry.accessCount++;
    entry.lastAccessed = now;
    this.stats.hits++;

    this.logger.debug(`Cache hit: ${key}`);
    this.emit('get', { key, value: entry.value });
    
    return entry.value;
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    const now = Date.now();
    
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.evictions++;
      return false;
    }

    return true;
  }

  public delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Cache delete: ${key}`);
      this.emit('delete', { key });
    }
    return deleted;
  }

  public clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cache cleared: ${size} entries removed`);
    this.emit('clear', { size });
  }

  public getStats(): any {
    const now = Date.now();
    const totalEntries = this.cache.size;
    const expiredEntries = Array.from(this.cache.values()).filter(entry => now > entry.expiresAt).length;
    
    return {
      ...this.stats,
      totalEntries,
      expiredEntries,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      memoryUsage: this.calculateMemoryUsage()
    };
  }

  public getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  public getEntries(): Array<{ key: string; entry: CacheEntry<T> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }));
  }

  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    this.cache.forEach((entry, key) => {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.logger.debug(`Cache evicted: ${oldestKey}`);
      this.emit('evict', { key: oldestKey });
    }
  }

  private calculateMemoryUsage(): number {
    // Примерная оценка использования памяти
    let size = 0;
    
    this.cache.forEach((entry, key) => {
      size += key.length * 2; // Unicode characters
      size += JSON.stringify(entry).length * 2;
    });
    
    return size;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval) as unknown as NodeJS.Timeout;
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.stats.evictions++;
    });

    if (expiredKeys.length > 0) {
      this.logger.debug(`Cache cleanup: ${expiredKeys.length} expired entries removed`);
      this.emit('cleanup', { expiredCount: expiredKeys.length });
    }
  }

  public shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.removeAllListeners();
    this.logger.info('Cache manager shutdown');
  }
}

// Специализированные кэши для разных типов данных
export class APICache extends CacheManager<any> {
  constructor() {
    super({
      maxSize: 500,
      defaultTTL: 300000, // 5 минут
      cleanupInterval: 60000
    });
  }

  public cacheAPIResponse(url: string, response: any, ttl?: number): void {
    const key = this.generateAPIKey(url);
    this.set(key, {
      data: response,
      cachedAt: new Date().toISOString(),
      url
    }, ttl);
  }

  public getCachedAPIResponse(url: string): any | null {
    const key = this.generateAPIKey(url);
    const cached = this.get(key);
    return cached ? cached.data : null;
  }

  private generateAPIKey(url: string): string {
    return `api:${Buffer.from(url).toString('base64')}`;
  }
}

export class ConfigCache extends CacheManager<any> {
  constructor() {
    super({
      maxSize: 100,
      defaultTTL: 600000, // 10 минут
      cleanupInterval: 120000
    });
  }

  public cacheConfig(service: string, config: any): void {
    this.set(`config:${service}`, {
      config,
      cachedAt: new Date().toISOString(),
      service
    });
  }

  public getCachedConfig(service: string): any | null {
    const cached = this.get(`config:${service}`);
    return cached ? cached.config : null;
  }
}
