require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

// Memory MCP Server для управления памятью AI агента в формате markdown
class MemoryMCPServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.name = 'Memory MCP Server';
    this.version = '1.0.0';
    this.memoryPath = options.memoryPath || './memory';
    this.entitiesPath = path.join(this.memoryPath, 'entities');
    this.sessionsPath = path.join(this.memoryPath, 'sessions');
    
    this.logger = winston.createLogger({
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
        new winston.transports.File({ filename: 'logs/mcp-memory-server.log' })
      ]
    });

    this.initializeMemoryStructure();
    this.setupResources();
    this.setupTools();
  }

  async initializeMemoryStructure() {
    try {
      // Создаем директории если не существуют
      await fs.mkdir(this.memoryPath, { recursive: true });
      await fs.mkdir(this.entitiesPath, { recursive: true });
      await fs.mkdir(this.sessionsPath, { recursive: true });
      
      this.logger.info('Memory structure initialized');
    } catch (error) {
      this.logger.error('Failed to initialize memory structure:', error);
    }
  }

  setupResources() {
    this.resources = new Map();

    // Ресурс для всех сущностей памяти
    this.resources.set('memory/entities', {
      uri: 'memory://entities',
      name: 'Memory Entities',
      description: 'All memory entities stored in markdown format',
      mimeType: 'text/markdown',
      getContent: () => this.getAllEntities()
    });

    // Ресурс для сессий
    this.resources.set('memory/sessions', {
      uri: 'memory://sessions',
      name: 'Memory Sessions',
      description: 'All memory sessions and conversations',
      mimeType: 'text/markdown',
      getContent: () => this.getAllSessions()
    });

    // Ресурс для поиска в памяти
    this.resources.set('memory/search', {
      uri: 'memory://search',
      name: 'Memory Search Index',
      description: 'Searchable index of all memory content',
      mimeType: 'application/json',
      getContent: () => this.getSearchIndex()
    });
  }

  setupTools() {
    this.tools = new Map();

    // Инструмент для чтения памяти сущности
    this.tools.set('read_memory', {
      name: 'read_memory',
      description: 'Read memory for a specific entity',
      inputSchema: {
        type: 'object',
        properties: {
          entity: {
            type: 'string',
            description: 'Entity name to read memory for'
          }
        },
        required: ['entity']
      },
      execute: (params) => this.readEntityMemory(params.entity)
    });

    // Инструмент для обновления памяти
    this.tools.set('update_memory', {
      name: 'update_memory',
      description: 'Update memory for an entity',
      inputSchema: {
        type: 'object',
        properties: {
          entity: {
            type: 'string',
            description: 'Entity name to update'
          },
          content: {
            type: 'string',
            description: 'Memory content in markdown format'
          },
          type: {
            type: 'string',
            enum: ['fact', 'interaction', 'decision', 'error', 'success'],
            description: 'Type of memory entry'
          }
        },
        required: ['entity', 'content']
      },
      execute: (params) => this.updateEntityMemory(params.entity, params.content, params.type)
    });

    // Инструмент для поиска в памяти
    this.tools.set('search_memory', {
      name: 'search_memory',
      description: 'Search through memory content',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query'
          },
          entity: {
            type: 'string',
            description: 'Specific entity to search in (optional)'
          },
          type: {
            type: 'string',
            description: 'Memory type filter (optional)'
          },
          limit: {
            type: 'number',
            default: 10,
            description: 'Maximum number of results'
          }
        },
        required: ['query']
      },
      execute: (params) => this.searchMemory(params.query, params.entity, params.type, params.limit)
    });

    // Инструмент для создания сессии
    this.tools.set('create_session', {
      name: 'create_session',
      description: 'Create a new memory session',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Unique session identifier'
          },
          context: {
            type: 'string',
            description: 'Session context or description'
          }
        },
        required: ['sessionId']
      },
      execute: (params) => this.createSession(params.sessionId, params.context)
    });

    // Инструмент для добавления в сессию
    this.tools.set('add_to_session', {
      name: 'add_to_session',
      description: 'Add content to an existing session',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Session identifier'
          },
          content: {
            type: 'string',
            description: 'Content to add to session'
          },
          role: {
            type: 'string',
            enum: ['user', 'assistant', 'system'],
            description: 'Role of the content author'
          }
        },
        required: ['sessionId', 'content']
      },
      execute: (params) => this.addToSession(params.sessionId, params.content, params.role)
    });

    // Инструмент для получения статистики памяти
    this.tools.set('get_memory_stats', {
      name: 'get_memory_stats',
      description: 'Get memory usage statistics',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      execute: () => this.getMemoryStats()
    });
  }

  // Чтение памяти сущности
  async readEntityMemory(entity) {
    try {
      const entityPath = path.join(this.entitiesPath, `${entity}.md`);
      
      try {
        const content = await fs.readFile(entityPath, 'utf8');
        return {
          success: true,
          entity,
          content,
          lastModified: (await fs.stat(entityPath)).mtime
        };
      } catch (error) {
        if (error.code === 'ENOENT') {
          return {
            success: true,
            entity,
            content: `# ${entity}\n\n*No memory entries yet*\n`,
            lastModified: null
          };
        }
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to read memory for entity ${entity}:`, error);
      return {
        success: false,
        entity,
        error: error.message
      };
    }
  }

  // Обновление памяти сущности
  async updateEntityMemory(entity, content, type = 'fact') {
    try {
      const entityPath = path.join(this.entitiesPath, `${entity}.md`);
      const timestamp = new Date().toISOString();
      
      // Читаем существующий контент
      let existingContent = '';
      try {
        existingContent = await fs.readFile(entityPath, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          existingContent = `# ${entity}\n\n*Memory entries for ${entity}*\n\n`;
        } else {
          throw error;
        }
      }

      // Добавляем новую запись
      const newEntry = `## ${type.toUpperCase()} - ${timestamp}\n\n${content}\n\n---\n\n`;
      const updatedContent = existingContent + newEntry;

      // Записываем обновленный контент
      await fs.writeFile(entityPath, updatedContent, 'utf8');

      this.emit('memoryUpdated', { entity, type, timestamp });
      
      return {
        success: true,
        entity,
        type,
        timestamp,
        message: `Memory updated for entity: ${entity}`
      };
    } catch (error) {
      this.logger.error(`Failed to update memory for entity ${entity}:`, error);
      return {
        success: false,
        entity,
        error: error.message
      };
    }
  }

  // Поиск в памяти
  async searchMemory(query, entity = null, type = null, limit = 10) {
    try {
      const results = [];
      const searchTerm = query.toLowerCase();

      // Определяем где искать
      const searchPaths = entity 
        ? [path.join(this.entitiesPath, `${entity}.md`)]
        : await this.getAllEntityFiles();

      for (const filePath of searchPaths) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');
          const entityName = path.basename(filePath, '.md');

          // Поиск по строкам
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.toLowerCase().includes(searchTerm)) {
              // Получаем контекст (несколько строк вокруг найденной)
              const contextStart = Math.max(0, i - 2);
              const contextEnd = Math.min(lines.length, i + 3);
              const context = lines.slice(contextStart, contextEnd).join('\n');

              // Проверяем фильтр по типу
              if (type) {
                const sectionHeader = this.findSectionHeader(lines, i);
                if (!sectionHeader || !sectionHeader.toLowerCase().includes(type.toLowerCase())) {
                  continue;
                }
              }

              results.push({
                entity: entityName,
                line: i + 1,
                match: line.trim(),
                context: context.trim(),
                relevance: this.calculateRelevance(line, searchTerm)
              });

              if (results.length >= limit) {
                break;
              }
            }
          }

          if (results.length >= limit) {
            break;
          }
        } catch (error) {
          this.logger.warn(`Failed to search in file ${filePath}:`, error);
        }
      }

      // Сортируем по релевантности
      results.sort((a, b) => b.relevance - a.relevance);

      return {
        success: true,
        query,
        results: results.slice(0, limit),
        totalFound: results.length
      };
    } catch (error) {
      this.logger.error(`Failed to search memory:`, error);
      return {
        success: false,
        query,
        error: error.message
      };
    }
  }

  // Создание сессии
  async createSession(sessionId, context = '') {
    try {
      const sessionPath = path.join(this.sessionsPath, `${sessionId}.md`);
      const timestamp = new Date().toISOString();
      
      const sessionContent = `# Session: ${sessionId}

**Created:** ${timestamp}
**Context:** ${context || 'No context provided'}

---

## Conversation

`;

      await fs.writeFile(sessionPath, sessionContent, 'utf8');

      this.emit('sessionCreated', { sessionId, timestamp });

      return {
        success: true,
        sessionId,
        timestamp,
        message: `Session ${sessionId} created successfully`
      };
    } catch (error) {
      this.logger.error(`Failed to create session ${sessionId}:`, error);
      return {
        success: false,
        sessionId,
        error: error.message
      };
    }
  }

  // Добавление в сессию
  async addToSession(sessionId, content, role = 'user') {
    try {
      const sessionPath = path.join(this.sessionsPath, `${sessionId}.md`);
      const timestamp = new Date().toISOString();
      
      // Проверяем существование сессии
      try {
        await fs.access(sessionPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Создаем сессию если не существует
          await this.createSession(sessionId, 'Auto-created session');
        } else {
          throw error;
        }
      }

      // Добавляем контент
      const entry = `### ${role.toUpperCase()} - ${timestamp}

${content}

---

`;

      await fs.appendFile(sessionPath, entry, 'utf8');

      this.emit('sessionUpdated', { sessionId, role, timestamp });

      return {
        success: true,
        sessionId,
        role,
        timestamp,
        message: `Content added to session ${sessionId}`
      };
    } catch (error) {
      this.logger.error(`Failed to add to session ${sessionId}:`, error);
      return {
        success: false,
        sessionId,
        error: error.message
      };
    }
  }

  // Получение статистики памяти
  async getMemoryStats() {
    try {
      const entityFiles = await this.getAllEntityFiles();
      const sessionFiles = await this.getAllSessionFiles();
      
      let totalEntities = 0;
      let totalSessions = 0;
      let totalSize = 0;
      let oldestEntry = null;
      let newestEntry = null;

      // Статистика сущностей
      for (const filePath of entityFiles) {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        totalEntities++;

        if (!oldestEntry || stats.mtime < oldestEntry) {
          oldestEntry = stats.mtime;
        }
        if (!newestEntry || stats.mtime > newestEntry) {
          newestEntry = stats.mtime;
        }
      }

      // Статистика сессий
      for (const filePath of sessionFiles) {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        totalSessions++;
      }

      return {
        success: true,
        stats: {
          entities: {
            count: totalEntities,
            files: entityFiles.map(f => path.basename(f, '.md'))
          },
          sessions: {
            count: totalSessions,
            files: sessionFiles.map(f => path.basename(f, '.md'))
          },
          storage: {
            totalSizeBytes: totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
          },
          timestamps: {
            oldest: oldestEntry,
            newest: newestEntry
          }
        }
      };
    } catch (error) {
      this.logger.error('Failed to get memory stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Получение всех сущностей
  async getAllEntities() {
    try {
      const entityFiles = await this.getAllEntityFiles();
      let allContent = '# All Memory Entities\n\n';

      for (const filePath of entityFiles) {
        const entityName = path.basename(filePath, '.md');
        const content = await fs.readFile(filePath, 'utf8');
        allContent += `## Entity: ${entityName}\n\n${content}\n\n---\n\n`;
      }

      return allContent;
    } catch (error) {
      return `Error reading entities: ${error.message}`;
    }
  }

  // Получение всех сессий
  async getAllSessions() {
    try {
      const sessionFiles = await this.getAllSessionFiles();
      let allContent = '# All Memory Sessions\n\n';

      for (const filePath of sessionFiles) {
        const sessionName = path.basename(filePath, '.md');
        const content = await fs.readFile(filePath, 'utf8');
        allContent += `## Session: ${sessionName}\n\n${content}\n\n---\n\n`;
      }

      return allContent;
    } catch (error) {
      return `Error reading sessions: ${error.message}`;
    }
  }

  // Получение поискового индекса
  async getSearchIndex() {
    try {
      const index = {
        entities: [],
        sessions: [],
        keywords: new Set(),
        lastUpdated: new Date().toISOString()
      };

      // Индексируем сущности
      const entityFiles = await this.getAllEntityFiles();
      for (const filePath of entityFiles) {
        const entityName = path.basename(filePath, '.md');
        const content = await fs.readFile(filePath, 'utf8');
        const stats = await fs.stat(filePath);
        
        // Извлекаем ключевые слова
        const words = content.toLowerCase().match(/\b\w+\b/g) || [];
        words.forEach(word => {
          if (word.length > 3) {
            index.keywords.add(word);
          }
        });

        index.entities.push({
          name: entityName,
          size: stats.size,
          lastModified: stats.mtime,
          wordCount: words.length
        });
      }

      // Индексируем сессии
      const sessionFiles = await this.getAllSessionFiles();
      for (const filePath of sessionFiles) {
        const sessionName = path.basename(filePath, '.md');
        const stats = await fs.stat(filePath);
        
        index.sessions.push({
          name: sessionName,
          size: stats.size,
          lastModified: stats.mtime
        });
      }

      // Конвертируем Set в Array для JSON
      index.keywords = Array.from(index.keywords);

      return JSON.stringify(index, null, 2);
    } catch (error) {
      return JSON.stringify({ error: error.message }, null, 2);
    }
  }

  // Вспомогательные методы
  async getAllEntityFiles() {
    try {
      const files = await fs.readdir(this.entitiesPath);
      return files
        .filter(file => file.endsWith('.md'))
        .map(file => path.join(this.entitiesPath, file));
    } catch (error) {
      return [];
    }
  }

  async getAllSessionFiles() {
    try {
      const files = await fs.readdir(this.sessionsPath);
      return files
        .filter(file => file.endsWith('.md'))
        .map(file => path.join(this.sessionsPath, file));
    } catch (error) {
      return [];
    }
  }

  findSectionHeader(lines, currentLine) {
    for (let i = currentLine; i >= 0; i--) {
      const line = lines[i];
      if (line.startsWith('##')) {
        return line;
      }
    }
    return null;
  }

  calculateRelevance(line, searchTerm) {
    const lowerLine = line.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    
    let relevance = 0;
    
    // Точное совпадение
    if (lowerLine.includes(lowerTerm)) {
      relevance += 10;
    }
    
    // Совпадение в начале строки
    if (lowerLine.startsWith(lowerTerm)) {
      relevance += 5;
    }
    
    // Количество вхождений
    const matches = (lowerLine.match(new RegExp(lowerTerm, 'g')) || []).length;
    relevance += matches * 2;
    
    return relevance;
  }

  // MCP Protocol Methods
  async initialize() {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: true,
        tools: true,
        logging: true
      },
      serverInfo: {
        name: this.name,
        version: this.version
      }
    };
  }

  async listResources() {
    const resources = Array.from(this.resources.entries()).map(([key, resource]) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }));
    
    return { resources };
  }

  async readResource(uri) {
    const resource = Array.from(this.resources.values()).find(r => r.uri === uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }
    
    const content = await resource.getContent();
    return {
      uri,
      mimeType: resource.mimeType,
      text: content
    };
  }

  async listTools() {
    const tools = Array.from(this.tools.entries()).map(([key, tool]) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    return { tools };
  }

  async callTool(name, arguments_) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    const result = await tool.execute(arguments_);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
}

// Настройка и запуск сервера
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
    new winston.transports.File({ filename: 'logs/mcp-memory-server.log' })
  ]
});

const app = express();
const port = process.env.MEMORY_PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Memory MCP Server
const memoryServer = new MemoryMCPServer({
  memoryPath: process.env.MEMORY_PATH || './memory'
});

// MCP Protocol Endpoints
app.post('/mcp/initialize', async (req, res) => {
  try {
    const result = await memoryServer.initialize();
    logger.info('Memory MCP server initialized');
    res.json(result);
  } catch (error) {
    logger.error('Memory MCP initialization error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/resources', async (req, res) => {
  try {
    const result = await memoryServer.listResources();
    res.json(result);
  } catch (error) {
    logger.error('Memory MCP resources error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/resources/:uri', async (req, res) => {
  try {
    const uri = decodeURIComponent(req.params.uri);
    const result = await memoryServer.readResource(uri);
    res.json(result);
  } catch (error) {
    logger.error('Memory MCP resource read error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/tools', async (req, res) => {
  try {
    const result = await memoryServer.listTools();
    res.json(result);
  } catch (error) {
    logger.error('Memory MCP tools error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/mcp/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    const result = await memoryServer.callTool(name, args);
    res.json(result);
  } catch (error) {
    logger.error('Memory MCP tool call error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Memory MCP Server',
    port: port,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Status endpoint
app.get('/status', async (req, res) => {
  try {
    const stats = await memoryServer.getMemoryStats();
    res.json({
      server: {
        name: memoryServer.name,
        version: memoryServer.version
      },
      memory: stats.success ? stats.stats : { error: stats.error }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    memoryServer.removeAllListeners();
    logger.info('Memory MCP Server shutdown completed');
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
  logger.info(`🧠 Memory MCP Server running on port ${port}`);
  logger.info(`📊 Health check: http://localhost:${port}/health`);
  logger.info(`🔧 Status: http://localhost:${port}/status`);
  logger.info(`🔌 MCP endpoints: http://localhost:${port}/mcp/*`);
  logger.info(`💾 Memory path: ${memoryServer.memoryPath}`);
});

module.exports = { MemoryMCPServer };