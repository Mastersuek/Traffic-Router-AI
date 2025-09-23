#!/usr/bin/env node

const axios = require('axios');
const winston = require('winston');

// Setup logging
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';

async function testMCPServer() {
  logger.info('🧪 Starting MCP Server Tests...');
  
  try {
    // Test 1: Health Check
    logger.info('📡 Testing health check...');
    const healthResponse = await axios.get(`${MCP_SERVER_URL}/health`);
    logger.info('✅ Health check passed:', healthResponse.data);
    
    // Test 2: Server Status
    logger.info('🔧 Testing server status...');
    const statusResponse = await axios.get(`${MCP_SERVER_URL}/status`);
    logger.info('✅ Status check passed:', statusResponse.data);
    
    // Test 3: MCP Initialize
    logger.info('🚀 Testing MCP initialization...');
    const initResponse = await axios.post(`${MCP_SERVER_URL}/mcp/initialize`, {
      protocolVersion: '2024-11-05',
      clientInfo: {
        name: 'Test Client',
        version: '1.0.0'
      }
    });
    logger.info('✅ MCP initialization passed:', initResponse.data);
    
    // Test 4: List Resources
    logger.info('📋 Testing resource listing...');
    const resourcesResponse = await axios.get(`${MCP_SERVER_URL}/mcp/resources`);
    logger.info('✅ Resource listing passed:', resourcesResponse.data);
    
    // Test 5: Read Specific Resources
    const resourcesToTest = ['system/status', 'logs/system', 'services/health', 'memory/entities'];
    
    for (const resourcePath of resourcesToTest) {
      logger.info(`📄 Testing resource: ${resourcePath}...`);
      try {
        const resourceResponse = await axios.get(`${MCP_SERVER_URL}/mcp/resources/${encodeURIComponent(resourcePath)}`);
        logger.info(`✅ Resource ${resourcePath} read successfully`);
        logger.debug(`Resource content preview:`, resourceResponse.data.text?.substring(0, 200) + '...');
      } catch (error) {
        logger.error(`❌ Failed to read resource ${resourcePath}:`, error.response?.data || error.message);
      }
    }
    
    // Test 6: List Tools
    logger.info('🔧 Testing tool listing...');
    const toolsResponse = await axios.get(`${MCP_SERVER_URL}/mcp/tools`);
    logger.info('✅ Tool listing passed:', toolsResponse.data);
    
    // Test 7: Call a Safe Tool
    logger.info('⚙️ Testing tool execution (check_health)...');
    try {
      const toolCallResponse = await axios.post(`${MCP_SERVER_URL}/mcp/tools/call`, {
        name: 'check_health',
        arguments: {}
      });
      logger.info('✅ Tool execution passed:', toolCallResponse.data);
    } catch (error) {
      logger.error('❌ Tool execution failed:', error.response?.data || error.message);
    }
    
    // Test 8: List Prompts
    logger.info('💬 Testing prompt listing...');
    const promptsResponse = await axios.get(`${MCP_SERVER_URL}/mcp/prompts`);
    logger.info('✅ Prompt listing passed:', promptsResponse.data);
    
    logger.info('🎉 All MCP Server tests completed!');
    
  } catch (error) {
    logger.error('❌ MCP Server test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  testMCPServer().catch(error => {
    logger.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testMCPServer };