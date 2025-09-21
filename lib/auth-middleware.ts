import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth.log' })
  ]
});

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
}

export class AuthMiddleware {
  private apiKeys: Map<string, { role: string; permissions: string[]; lastUsed: Date }> = new Map();
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    this.loadApiKeys();
    this.startCleanupTask();
  }

  private loadApiKeys(): void {
    // Загружаем API ключи из переменных окружения
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

    logger.info(`Loaded ${this.apiKeys.size} API keys`);
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private startCleanupTask(): void {
    // Очистка rate limit каждые 5 минут
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of this.rateLimits.entries()) {
        if (data.resetTime < now) {
          this.rateLimits.delete(ip);
        }
      }
    }, 5 * 60 * 1000);
  }

  // Middleware для проверки API ключа
  public authenticateApiKey = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string || req.headers.authorization?.replace('Bearer ', '');
    
    if (!apiKey) {
      logger.warn(`API key missing for ${req.ip} - ${req.path}`);
      res.status(401).json({ error: 'API key required' });
      return;
    }

    const hashedKey = this.hashKey(apiKey);
    const keyData = this.apiKeys.get(hashedKey);

    if (!keyData) {
      logger.warn(`Invalid API key for ${req.ip} - ${req.path}`);
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Обновляем время последнего использования
    keyData.lastUsed = new Date();
    req.user = {
      id: hashedKey,
      role: keyData.role,
      permissions: keyData.permissions
    };

    logger.info(`Authenticated ${keyData.role} user for ${req.path}`);
    next();
  };

  // Middleware для проверки разрешений
  public requirePermission = (permission: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const hasPermission = req.user.permissions.includes('*') || req.user.permissions.includes(permission);
      
      if (!hasPermission) {
        logger.warn(`Permission denied for ${req.user.role} user - required: ${permission}`);
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    };
  };

  // Rate limiting middleware
  public rateLimit = (maxRequests: number = 100, windowMs: number = 60 * 1000) => {
    return (req: Request, res: Response, next: NextFunction): void => {
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
        logger.warn(`Rate limit exceeded for ${ip} - ${current.count}/${maxRequests}`);
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

  // Валидация входных данных
  public validateInput = (schema: any) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const result = schema.safeParse(req.body);
        
        if (!result.success) {
          logger.warn(`Input validation failed: ${result.error.errors}`);
          res.status(400).json({
            error: 'Invalid input data',
            details: result.error.errors
          });
          return;
        }

        req.body = result.data;
        next();
      } catch (error) {
        logger.error('Input validation error:', error);
        res.status(500).json({ error: 'Validation error' });
      }
    };
  };

  // Безопасные заголовки
  public securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
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

  // Логирование безопасности
  public securityLogging = (req: Request, res: Response, next: NextFunction): void => {
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
        logger.warn('Security event:', logData);
      } else {
        logger.info('Request completed:', logData);
      }
    });

    next();
  };
}
