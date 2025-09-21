require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');

// Настройка логирования
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/youtube-cache-server.log' })
  ]
});

const app = express();
const port = process.env.YOUTUBE_CACHE_PORT || 13083;

// Конфигурация кеша
const CACHE_CONFIG = {
  maxSizeGB: parseInt(process.env.CACHE_MAX_SIZE_GB) || 10,
  cleanupIntervalHours: parseInt(process.env.CACHE_CLEANUP_INTERVAL_HOURS) || 24,
  defaultTTLHours: parseInt(process.env.CACHE_DEFAULT_TTL_HOURS) || 168, // 7 days
  cacheDir: path.join(__dirname, '../data/video-cache'),
  qualities: {
    '480p': { height: 480, bitrate: '1000k' },
    '640p': { height: 640, bitrate: '1500k' },
    '1024p': { height: 1024, bitrate: '3000k' }
  }
};

// Создаем директорию кеша
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_CONFIG.cacheDir, { recursive: true });
    for (const quality of Object.keys(CACHE_CONFIG.qualities)) {
      await fs.mkdir(path.join(CACHE_CONFIG.cacheDir, quality), { recursive: true });
    }
  } catch (error) {
    logger.error('Failed to create cache directories:', error);
  }
}

class YouTubeCacheManager {
  constructor() {
    this.cache = new Map(); // Метаданные кеша в памяти
    this.downloadQueue = new Map(); // Очередь загрузок
    this.activeDownloads = new Set(); // Активные загрузки
    this.maxConcurrentDownloads = 3;
    
    this.init();
  }
  
  async init() {
    await ensureCacheDir();
    await this.loadCacheMetadata();
    this.startCleanupScheduler();
  }
  
  async loadCacheMetadata() {
    try {
      const metadataFile = path.join(CACHE_CONFIG.cacheDir, 'metadata.json');
      const data = await fs.readFile(metadataFile, 'utf8');
      const metadata = JSON.parse(data);
      
      for (const [key, value] of Object.entries(metadata)) {
        this.cache.set(key, {
          ...value,
          cachedAt: new Date(value.cachedAt),
          expiresAt: new Date(value.expiresAt)
        });
      }
      
      logger.info(`Loaded ${this.cache.size} cached videos metadata`);
    } catch (error) {
      logger.info('No existing cache metadata found, starting fresh');
    }
  }
  
  async saveCacheMetadata() {
    try {
      const metadataFile = path.join(CACHE_CONFIG.cacheDir, 'metadata.json');
      const metadata = {};
      
      for (const [key, value] of this.cache.entries()) {
        metadata[key] = {
          ...value,
          cachedAt: value.cachedAt.toISOString(),
          expiresAt: value.expiresAt.toISOString()
        };
      }
      
      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      logger.error('Failed to save cache metadata:', error);
    }
  }
  
  generateCacheKey(videoId, quality) {
    return `${videoId}_${quality}`;
  }
  
  async getCachedVideoPath(videoId, quality) {
    const cacheKey = this.generateCacheKey(videoId, quality);
    const cached = this.cache.get(cacheKey);
    
    if (!cached || new Date() > cached.expiresAt) {
      return null;
    }
    
    const filePath = path.join(CACHE_CONFIG.cacheDir, quality, `${videoId}.mp4`);
    
    try {
      await fs.access(filePath);
      return filePath;
    } catch (error) {
      // Файл не существует, удаляем из кеша
      this.cache.delete(cacheKey);
      await this.saveCacheMetadata();
      return null;
    }
  }
  
  async queueVideoDownload(videoId, quality, priority = 0) {
    const cacheKey = this.generateCacheKey(videoId, quality);
    
    if (this.cache.has(cacheKey) || this.downloadQueue.has(cacheKey)) {
      return false; // Уже кеширован или в очереди
    }
    
    this.downloadQueue.set(cacheKey, {
      videoId,
      quality,
      priority,
      queuedAt: new Date()
    });
    
    this.processDownloadQueue();
    return true;
  }
  
  async processDownloadQueue() {
    if (this.activeDownloads.size >= this.maxConcurrentDownloads) {
      return; // Слишком много активных загрузок
    }
    
    // Сортируем очередь по приоритету
    const sorted = Array.from(this.downloadQueue.entries())
      .sort((a, b) => b[1].priority - a[1].priority);
    
    if (sorted.length === 0) return;
    
    const [cacheKey, download] = sorted[0];
    this.downloadQueue.delete(cacheKey);
    this.activeDownloads.add(cacheKey);
    
    try {
      await this.downloadAndProcessVideo(download.videoId, download.quality);
    } catch (error) {
      logger.error(`Failed to download video ${download.videoId} in ${download.quality}:`, error);
    } finally {
      this.activeDownloads.delete(cacheKey);
      // Продолжаем обработку очереди
      setTimeout(() => this.processDownloadQueue(), 100);
    }
  }
  
  async downloadAndProcessVideo(videoId, quality) {
    logger.info(`🎬 Starting download: ${videoId} in ${quality}`);
    
    try {
      // Получаем информацию о видео
      const info = await ytdl.getInfo(videoId);
      const title = info.videoDetails.title;
      
      // Выбираем формат видео
      const format = ytdl.chooseFormat(info.formats, {
        quality: 'highest',
        filter: 'videoandaudio'
      });
      
      if (!format) {
        throw new Error('No suitable format found');
      }
      
      const tempPath = path.join(CACHE_CONFIG.cacheDir, `temp_${videoId}_${quality}.mp4`);
      const finalPath = path.join(CACHE_CONFIG.cacheDir, quality, `${videoId}.mp4`);
      
      // Скачиваем и конвертируем видео
      await this.downloadWithFFmpeg(format.url, tempPath, quality);
      
      // Перемещаем в финальную папку
      await fs.rename(tempPath, finalPath);
      
      // Получаем размер файла
      const stats = await fs.stat(finalPath);
      
      // Сохраняем в кеш метаданные
      const cacheKey = this.generateCacheKey(videoId, quality);
      this.cache.set(cacheKey, {
        videoId,
        quality,
        title,
        filePath: finalPath,
        fileSize: stats.size,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_CONFIG.defaultTTLHours * 60 * 60 * 1000),
        downloads: 0,
        lastAccessed: new Date()
      });
      
      await this.saveCacheMetadata();
      
      logger.info(`✅ Successfully cached: ${title} (${quality})`);
      
    } catch (error) {
      logger.error(`❌ Failed to cache video ${videoId}:`, error);
      throw error;
    }
  }
  
  async downloadWithFFmpeg(url, outputPath, quality) {
    return new Promise((resolve, reject) => {
      const qualityConfig = CACHE_CONFIG.qualities[quality];
      
      ffmpeg(url)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`?x${qualityConfig.height}`)
        .videoBitrate(qualityConfig.bitrate)
        .audioBitrate('128k')
        .format('mp4')
        .outputOptions([
          '-movflags +faststart', // Оптимизация для потокового воспроизведения
          '-preset fast',
          '-crf 23'
        ])
        .output(outputPath)
        .on('progress', (progress) => {
          if (progress.percent) {
            logger.info(`📊 Processing ${quality}: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          logger.info(`✅ FFmpeg processing completed for ${quality}`);
          resolve();
        })
        .on('error', (error) => {
          logger.error(`❌ FFmpeg error for ${quality}:`, error);
          reject(error);
        })
        .run();
    });
  }
  
  async cleanup() {
    logger.info('🧹 Starting cache cleanup...');
    
    const now = new Date();
    let cleanedCount = 0;
    let freedSpace = 0;
    
    for (const [cacheKey, cached] of this.cache.entries()) {
      // Удаляем просроченные файлы
      if (now > cached.expiresAt) {
        try {
          await fs.unlink(cached.filePath);
          freedSpace += cached.fileSize;
          this.cache.delete(cacheKey);
          cleanedCount++;
        } catch (error) {
          logger.warn(`Failed to delete expired file: ${cached.filePath}`);
        }
      }
    }
    
    // Проверяем общий размер кеша
    const totalSize = await this.getTotalCacheSize();
    const maxSize = CACHE_CONFIG.maxSizeGB * 1024 * 1024 * 1024;
    
    if (totalSize > maxSize) {
      // Удаляем старые файлы по принципу LRU
      const sortedByAccess = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
      
      let currentSize = totalSize;
      for (const [cacheKey, cached] of sortedByAccess) {
        if (currentSize <= maxSize) break;
        
        try {
          await fs.unlink(cached.filePath);
          currentSize -= cached.fileSize;
          freedSpace += cached.fileSize;
          this.cache.delete(cacheKey);
          cleanedCount++;
        } catch (error) {
          logger.warn(`Failed to delete LRU file: ${cached.filePath}`);
        }
      }
    }
    
    await this.saveCacheMetadata();
    
    logger.info(`🧹 Cleanup completed: ${cleanedCount} files removed, ${(freedSpace / 1024 / 1024).toFixed(2)} MB freed`);
  }
  
  async getTotalCacheSize() {
    let totalSize = 0;
    for (const cached of this.cache.values()) {
      totalSize += cached.fileSize;
    }
    return totalSize;
  }
  
  startCleanupScheduler() {
    const intervalMs = CACHE_CONFIG.cleanupIntervalHours * 60 * 60 * 1000;
    setInterval(() => {
      this.cleanup().catch(error => {
        logger.error('Scheduled cleanup failed:', error);
      });
    }, intervalMs);
    
    // Запускаем первую очистку через 5 минут после старта
    setTimeout(() => {
      this.cleanup().catch(error => {
        logger.error('Initial cleanup failed:', error);
      });
    }, 5 * 60 * 1000);
  }
  
  getStats() {
    const totalSize = Array.from(this.cache.values())
      .reduce((sum, cached) => sum + cached.fileSize, 0);
    
    const qualityStats = {};
    for (const quality of Object.keys(CACHE_CONFIG.qualities)) {
      qualityStats[quality] = Array.from(this.cache.values())
        .filter(cached => cached.quality === quality).length;
    }
    
    return {
      totalVideos: this.cache.size,
      totalSizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2),
      maxSizeGB: CACHE_CONFIG.maxSizeGB,
      activeDownloads: this.activeDownloads.size,
      queuedDownloads: this.downloadQueue.size,
      qualityStats
    };
  }
}

// Инициализация кеш-менеджера
const cacheManager = new YouTubeCacheManager();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Логирование запросов
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'youtube-cache',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: cacheManager.getStats()
  });
});

// Получить видео из кеша или запросить кеширование
app.get('/api/video/:videoId/:quality?', async (req, res) => {
  try {
    const { videoId, quality = '640p' } = req.params;
    
    if (!Object.keys(CACHE_CONFIG.qualities).includes(quality)) {
      return res.status(400).json({ 
        error: 'Invalid quality',
        availableQualities: Object.keys(CACHE_CONFIG.qualities)
      });
    }
    
    // Проверяем кеш
    const cachedPath = await cacheManager.getCachedVideoPath(videoId, quality);
    
    if (cachedPath) {
      // Обновляем время последнего доступа
      const cacheKey = cacheManager.generateCacheKey(videoId, quality);
      const cached = cacheManager.cache.get(cacheKey);
      if (cached) {
        cached.lastAccessed = new Date();
        cached.downloads++;
      }
      
      // Отправляем видео файл
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.sendFile(cachedPath);
      
    } else {
      // Добавляем в очередь для кеширования
      const queued = await cacheManager.queueVideoDownload(videoId, quality, 1);
      
      res.json({
        message: 'Video not cached, added to download queue',
        videoId,
        quality,
        queued,
        estimatedWait: cacheManager.downloadQueue.size * 2 // минуты
      });
    }
    
  } catch (error) {
    logger.error('Video request error:', error);
    res.status(500).json({ error: 'Failed to process video request' });
  }
});

// Предварительное кеширование видео
app.post('/api/cache', async (req, res) => {
  try {
    const { videoId, qualities = ['640p'], priority = 0 } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }
    
    const results = [];
    
    for (const quality of qualities) {
      if (!Object.keys(CACHE_CONFIG.qualities).includes(quality)) {
        results.push({ quality, error: 'Invalid quality' });
        continue;
      }
      
      const queued = await cacheManager.queueVideoDownload(videoId, quality, priority);
      results.push({ quality, queued });
    }
    
    res.json({
      message: 'Videos queued for caching',
      videoId,
      results,
      queuePosition: cacheManager.downloadQueue.size
    });
    
  } catch (error) {
    logger.error('Cache request error:', error);
    res.status(500).json({ error: 'Failed to queue video for caching' });
  }
});

// Статистика кеша
app.get('/api/stats', (req, res) => {
  res.json({
    ...cacheManager.getStats(),
    config: {
      maxSizeGB: CACHE_CONFIG.maxSizeGB,
      cleanupIntervalHours: CACHE_CONFIG.cleanupIntervalHours,
      defaultTTLHours: CACHE_CONFIG.defaultTTLHours,
      maxConcurrentDownloads: cacheManager.maxConcurrentDownloads
    }
  });
});

// Список кешированных видео
app.get('/api/cached', (req, res) => {
  const cached = Array.from(cacheManager.cache.values()).map(video => ({
    videoId: video.videoId,
    title: video.title,
    quality: video.quality,
    fileSize: video.fileSize,
    cachedAt: video.cachedAt,
    expiresAt: video.expiresAt,
    downloads: video.downloads,
    lastAccessed: video.lastAccessed
  }));
  
  res.json({ cached });
});

// Очистка кеша
app.post('/api/cleanup', async (req, res) => {
  try {
    await cacheManager.cleanup();
    res.json({ message: 'Cache cleanup completed' });
  } catch (error) {
    logger.error('Manual cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    await cacheManager.saveCacheMetadata();
    logger.info('YouTube Cache Server shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
app.listen(port, () => {
  logger.info(`🎬 YouTube Cache Server running on port ${port}`);
  logger.info(`📊 Cache directory: ${CACHE_CONFIG.cacheDir}`);
  logger.info(`💾 Max cache size: ${CACHE_CONFIG.maxSizeGB} GB`);
  logger.info(`🎯 Supported qualities: ${Object.keys(CACHE_CONFIG.qualities).join(', ')}`);
});