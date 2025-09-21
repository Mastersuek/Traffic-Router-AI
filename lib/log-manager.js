const fs = require('fs');
const path = require('path');
const winston = require('winston');

class LogManager {
  constructor(logDir = 'logs') {
    this.logDir = logDir;
    this.ensureLogDirectory();
    this.maxLogAge = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
    this.maxSessions = 2; // Максимум 2 сессии логов
    this.sessionLogs = new Map(); // Хранение логов по сессиям
    this.setupCleanupTask();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  setupCleanupTask() {
    // Очистка логов каждые 6 часов
    setInterval(() => {
      this.cleanupOldLogs();
    }, 6 * 60 * 60 * 1000);

    // Очистка при запуске
    this.cleanupOldLogs();
  }

  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      let cleanedCount = 0;

      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        // Удаляем файлы старше 24 часов
        if (now - stats.mtime.getTime() > this.maxLogAge) {
          fs.unlinkSync(filePath);
          cleanedCount++;
          console.log(`🗑️ Removed old log file: ${file}`);
        }
      });

      // Управление сессионными логами
      this.manageSessionLogs();

      if (cleanedCount > 0) {
        console.log(`🧹 Log cleanup completed: ${cleanedCount} files removed`);
      }
    } catch (error) {
      console.error('❌ Error during log cleanup:', error);
    }
  }

  manageSessionLogs() {
    // Оставляем только последние 2 сессии
    const sessionFiles = fs.readdirSync(this.logDir)
      .filter(file => file.startsWith('session-'))
      .map(file => ({
        name: file,
        path: path.join(this.logDir, file),
        mtime: fs.statSync(path.join(this.logDir, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    // Удаляем старые сессии, оставляя только последние 2
    if (sessionFiles.length > this.maxSessions) {
      const filesToRemove = sessionFiles.slice(this.maxSessions);
      filesToRemove.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Removed old session log: ${file.name}`);
      });
    }
  }

  createSessionLogger(sessionId) {
    const sessionLogFile = path.join(this.logDir, `session-${sessionId}.log`);
    
    return winston.createLogger({
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
        new winston.transports.File({ 
          filename: sessionLogFile,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 1
        })
      ]
    });
  }

  createServiceLogger(serviceName) {
    const serviceLogFile = path.join(this.logDir, `${serviceName}.log`);
    
    return winston.createLogger({
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
        new winston.transports.File({ 
          filename: serviceLogFile,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 1
        })
      ]
    });
  }

  logCriticalError(error, context = {}) {
    const timestamp = new Date().toISOString();
    const errorId = `error-${Date.now()}`;
    const errorFile = path.join(this.logDir, `${errorId}.md`);

    const errorReport = `# Critical Error Report

## Error Information
- **Error ID**: ${errorId}
- **Timestamp**: ${timestamp}
- **Error Type**: ${error.constructor.name}
- **Message**: ${error.message}

## Stack Trace
\`\`\`
${error.stack}
\`\`\`

## Context
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

## System Information
- **Platform**: ${process.platform}
- **Node Version**: ${process.version}
- **Architecture**: ${process.arch}
- **Uptime**: ${process.uptime()}s
- **Memory Usage**: ${JSON.stringify(process.memoryUsage(), null, 2)}

## Environment Variables
\`\`\`json
${JSON.stringify({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  LOG_LEVEL: process.env.LOG_LEVEL
}, null, 2)}
\`\`\`

## Recovery Actions
1. Check system resources
2. Verify service dependencies
3. Review recent configuration changes
4. Check network connectivity
5. Validate environment variables

## Notes
${new Date().toISOString()} - Error logged for debugging
`;

    try {
      fs.writeFileSync(errorFile, errorReport, 'utf8');
      console.error(`🚨 Critical error logged to: ${errorFile}`);
      
      // Также логируем в основной лог
      console.error(`CRITICAL ERROR [${errorId}]: ${error.message}`);
      console.error(error.stack);
      
      return errorId;
    } catch (writeError) {
      console.error('❌ Failed to write critical error report:', writeError);
      return null;
    }
  }

  getLogSummary() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      
      const logFiles = files.map(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          age: now - stats.mtime.getTime()
        };
      });

      const totalSize = logFiles.reduce((sum, file) => sum + file.size, 0);
      const criticalErrors = logFiles.filter(file => file.name.startsWith('error-'));

      return {
        totalFiles: logFiles.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        criticalErrors: criticalErrors.length,
        oldestLog: Math.min(...logFiles.map(f => f.age)),
        newestLog: Math.max(...logFiles.map(f => f.age)),
        files: logFiles.sort((a, b) => b.modified - a.modified)
      };
    } catch (error) {
      console.error('❌ Error getting log summary:', error);
      return null;
    }
  }

  // Метод для очистки всех логов (использовать с осторожностью)
  clearAllLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      let clearedCount = 0;

      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        fs.unlinkSync(filePath);
        clearedCount++;
      });

      console.log(`🧹 Cleared all logs: ${clearedCount} files removed`);
      return clearedCount;
    } catch (error) {
      console.error('❌ Error clearing logs:', error);
      return 0;
    }
  }

  // Метод для архивирования логов перед очисткой
  archiveLogs() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveDir = path.join(this.logDir, 'archive', timestamp);
      
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      const files = fs.readdirSync(this.logDir).filter(file => 
        file.endsWith('.log') || file.endsWith('.md')
      );

      files.forEach(file => {
        const sourcePath = path.join(this.logDir, file);
        const destPath = path.join(archiveDir, file);
        fs.copyFileSync(sourcePath, destPath);
      });

      console.log(`📦 Logs archived to: ${archiveDir}`);
      return archiveDir;
    } catch (error) {
      console.error('❌ Error archiving logs:', error);
      return null;
    }
  }
}

module.exports = { LogManager };
