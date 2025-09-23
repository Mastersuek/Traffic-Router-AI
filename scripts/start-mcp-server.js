#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Setup logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/mcp-startup.log' })
  ]
});

const MCP_SERVER_PORT = process.env.MCP_SERVER_PORT || 3001;
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY = 5000; // 5 seconds

let restartCount = 0;
let mcpProcess = null;

function startMCPServer() {
  logger.info(`Starting MCP server on port ${MCP_SERVER_PORT} (attempt ${restartCount + 1})`);
  
  const env = { ...process.env, MCP_SERVER_PORT };
  
  mcpProcess = spawn('node', ['server/mcp-integration-server.js'], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false
  });

  mcpProcess.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      logger.info(`[MCP] ${message}`);
    }
  });

  mcpProcess.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) {
      logger.error(`[MCP] ${message}`);
    }
  });

  mcpProcess.on('error', (error) => {
    logger.error('MCP server process error:', error);
    scheduleRestart();
  });

  mcpProcess.on('exit', (code, signal) => {
    logger.warn(`MCP server exited with code ${code}, signal ${signal}`);
    
    if (code !== 0 && !signal) {
      scheduleRestart();
    }
  });

  // Reset restart count on successful start
  setTimeout(() => {
    if (mcpProcess && !mcpProcess.killed) {
      restartCount = 0;
      logger.info('MCP server started successfully');
    }
  }, 10000); // 10 seconds
}

function scheduleRestart() {
  if (restartCount >= MAX_RESTART_ATTEMPTS) {
    logger.error(`Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Stopping.`);
    process.exit(1);
  }

  restartCount++;
  logger.info(`Scheduling MCP server restart in ${RESTART_DELAY}ms (attempt ${restartCount})`);
  
  setTimeout(() => {
    startMCPServer();
  }, RESTART_DELAY);
}

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down MCP server...`);
  
  if (mcpProcess && !mcpProcess.killed) {
    mcpProcess.kill('SIGTERM');
    
    // Force kill after 10 seconds
    setTimeout(() => {
      if (!mcpProcess.killed) {
        logger.warn('Force killing MCP server process');
        mcpProcess.kill('SIGKILL');
      }
    }, 10000);
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 15000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startMCPServer();