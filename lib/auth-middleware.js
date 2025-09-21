const { createHash, timingSafeEqual } = require('crypto');
const winston = require('winston');

class AuthMiddleware {
  constructor() {
    this.apiKeys = new Map();
    this.rateLimits = new Map();
    this.loadApiKeys();
    this.startCleanupTask();
  }

  loadApiKeys() {
    const keys = [
      { key: process.env.OPENAI_API_KEY, role: 'ai-user', permissions: ['ai:openai'] },
      { key: process.env.ANTHROPIC_API_KEY, role: 'ai-user', permissions: ['ai:anthropic'] },
      { key: process.env.GOOGLE_AI_API_KEY, role: 'ai-user', permissions: ['ai:google'] },
      { key: process.env.HUGGINGFACE_API_KEY, role: 'ai-user', permissions: ['ai:huggingface'] },
      { key: process.env.ADMIN_API_KEY || 'admin-key-123', role: 'admin', permissions: ['*'] },
      { key: process.env.MONITORING_API_KEY || 'monitor-key-456', role: 'monitor', permissions: ['monitoring:read'] }
    ];

    keys.forEach(({ key, role, permissions }) => {
      if (key && key !== 'sk-test-key' && key !== 'test-key') {
        this.apiKeys.set(this.hashKey(key), { role, permissions, lastUsed: new Date() });
      }
    });
  }

  hashKey(key) {
    return createHash('sha256').update(key).digest('hex');
  }

  startCleanupTask() {
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of this.rateLimits.entries()) {
        if (data.resetTime < now) {
          this.rateLimits.delete(ip);
        }
      }
    }, 5 * 60 * 1000);
  }

  authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
    
    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    const hashedKey = this.hashKey(apiKey);
    const keyData = this.apiKeys.get(hashedKey);

    if (!keyData) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    keyData.lastUsed = new Date();
    req.user = {
      id: hashedKey,
      role: keyData.role,
      permissions: keyData.permissions
    };

    next();
  };

  requirePermission = (permission) => {
    return (req, res, next) => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const hasPermission = req.user.permissions.includes('*') || req.user.permissions.includes(permission);
      
      if (!hasPermission) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    };
  };

  rateLimit = (maxRequests = 100, windowMs = 60 * 1000) => {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;

      const current = this.rateLimits.get(ip) || { count: 0, resetTime: now + windowMs };
      
      if (current.resetTime < now) {
        current.count = 0;
        current.resetTime = now + windowMs;
      }

      current.count++;

      if (current.count > maxRequests) {
        res.status(429).json({ 
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((current.resetTime - now) / 1000)
        });
        return;
      }

      this.rateLimits.set(ip, current);
      
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, maxRequests - current.count).toString(),
        'X-RateLimit-Reset': new Date(current.resetTime).toISOString()
      });

      next();
    };
  };

  securityHeaders = (req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    next();
  };

  securityLogging = (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        duration,
        timestamp: new Date().toISOString()
      };

      if (res.statusCode >= 400) {
        console.warn('Security event:', logData);
      } else {
        console.log('Request completed:', logData);
      }
    });

    next();
  };
}

module.exports = { AuthMiddleware };
