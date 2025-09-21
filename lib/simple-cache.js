const { EventEmitter } = require('events');

class SimpleCache extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTTL: config.defaultTTL || 300000, // 5 минут
      cleanupInterval: config.cleanupInterval || 60000 // 1 минута
    };

    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0
    };

    this.startCleanup();
  }

  set(key, value, ttl) {
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
    this.emit('set', { key, value, ttl });
  }

  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    
    // Проверяем срок действия
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    // Обновляем статистику доступа
    entry.accessCount++;
    entry.lastAccessed = now;
    this.stats.hits++;

    this.emit('get', { key, value: entry.value });
    
    return entry.value;
  }

  has(key) {
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

  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.emit('delete', { key });
    }
    return deleted;
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.emit('clear', { size });
  }

  getStats() {
    const now = Date.now();
    const totalEntries = this.cache.size;
    const expiredEntries = Array.from(this.cache.values()).filter(entry => now > entry.expiresAt).length;
    
    return {
      ...this.stats,
      totalEntries,
      expiredEntries,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  evictOldest() {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.emit('evict', { key: oldestKey });
    }
  }

  startCleanup() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.stats.evictions++;
    });

    if (expiredKeys.length > 0) {
      this.emit('cleanup', { expiredCount: expiredKeys.length });
    }
  }

  shutdown() {
    this.removeAllListeners();
  }
}

class APICache extends SimpleCache {
  constructor() {
    super({
      maxSize: 500,
      defaultTTL: 300000, // 5 минут
      cleanupInterval: 60000
    });
  }

  cacheAPIResponse(url, response, ttl) {
    const key = this.generateAPIKey(url);
    this.set(key, {
      data: response,
      cachedAt: new Date().toISOString(),
      url
    }, ttl);
  }

  getCachedAPIResponse(url) {
    const key = this.generateAPIKey(url);
    const cached = this.get(key);
    return cached ? cached.data : null;
  }

  generateAPIKey(url) {
    return `api:${Buffer.from(url).toString('base64')}`;
  }
}

module.exports = { SimpleCache, APICache };
