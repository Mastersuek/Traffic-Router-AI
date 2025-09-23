require('dotenv').config({ path: './config.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const { MCPServer } = require('../lib/mcp-server');

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
    new winston.transports.File({ filename: 'logs/mcp-server.log' })
  ]
});

const app = express();
const port = process.env.MCP_SERVER_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize MCP Server
const mcpServer = new MCPServer({
  name: 'Traffic Router MCP Server',
  version: '1.0.0'
});

// MCP Protocol Endpoints
app.post('/mcp/initialize', async (req, res) => {
  try {
    const result = await mcpServer.initialize();
    logger.info('MCP client initialized');
    res.json(result);
  } catch (error) {
    logger.error('MCP initialization error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/resources', async (req, res) => {
  try {
    logger.debug('MCP resources list requested');
    const result = await mcpServer.listResources();
    logger.debug(`MCP resources list returned ${result.resources.length} resources`);
    res.json(result);
  } catch (error) {
    logger.error('MCP resources error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/resources/*', async (req, res) => {
  try {
    // Extract the resource path from the URL, handling nested paths like "system/status"
    const resourcePath = req.params[0]; // This gets everything after /mcp/resources/
    const decodedPath = decodeURIComponent(resourcePath);
    
    logger.debug(`MCP resource request: ${decodedPath}`);
    
    const result = await mcpServer.readResource(decodedPath);
    res.json(result);
  } catch (error) {
    logger.error(`MCP resource read error for path "${req.params[0]}":`, error);
    
    // Provide helpful error response
    if (error.message.includes('Resource not found')) {
      const availableResources = await mcpServer.listResources();
      res.status(404).json({ 
        error: error.message,
        availableResources: availableResources.resources.map(r => r.uri)
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/mcp/tools', async (req, res) => {
  try {
    const result = await mcpServer.listTools();
    res.json(result);
  } catch (error) {
    logger.error('MCP tools error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/mcp/tools/call', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    logger.debug(`MCP tool call requested: ${name}`, { arguments: args });
    
    const result = await mcpServer.callTool(name, args);
    logger.debug(`MCP tool call completed: ${name}`);
    res.json(result);
  } catch (error) {
    logger.error(`MCP tool call error for tool "${name}":`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/mcp/prompts', async (req, res) => {
  try {
    const result = await mcpServer.listPrompts();
    res.json(result);
  } catch (error) {
    logger.error('MCP prompts error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/mcp/prompts/get', async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    const result = await mcpServer.getPrompt(name, args);
    res.json(result);
  } catch (error) {
    logger.error('MCP prompt get error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'MCP Integration Server',
    port: port,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    mcp_server: {
      name: mcpServer.name,
      version: mcpServer.version,
      capabilities: mcpServer.capabilities
    },
    resources_count: mcpServer.resources.size,
    tools_count: mcpServer.tools.size,
    prompts_count: mcpServer.prompts.size
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers
  });
  
  // Provide helpful information for MCP-related 404s
  if (req.path.startsWith('/mcp/')) {
    res.status(404).json({ 
      error: 'MCP route not found',
      path: req.path,
      availableEndpoints: [
        'POST /mcp/initialize',
        'GET /mcp/resources',
        'GET /mcp/resources/{resourcePath}',
        'GET /mcp/tools',
        'POST /mcp/tools/call',
        'GET /mcp/prompts',
        'POST /mcp/prompts/get'
      ]
    });
  } else {
    res.status(404).json({ error: 'Route not found' });
  }
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    // Cleanup MCP server
    mcpServer.removeAllListeners();
    
    logger.info('MCP Integration Server shutdown completed');
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
  logger.info(`🚀 MCP Integration Server running on port ${port}`);
  logger.info(`📡 Health check: http://localhost:${port}/health`);
  logger.info(`🔧 Status: http://localhost:${port}/status`);
  logger.info(`🔌 MCP endpoints: http://localhost:${port}/mcp/*`);
});

