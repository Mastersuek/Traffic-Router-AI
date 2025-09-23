const { MCPClient, MCPUtils } = require('../lib/mcp-client');
const { MCPServer } = require('../lib/mcp-server');
const { MemoryMCPServer } = require('../lib/mcp-memory-server');
const { SystemMonitorMCPServer } = require('../lib/mcp-system-monitor');
const fs = require('fs').promises;
const path = require('path');

describe('MCP Integration Tests', () => {
  let mcpClient;
  let testConfigPath;

  beforeAll(async () => {
    // Создание тестовой конфигурации MCP
    testConfigPath = path.join(__dirname, 'test-mcp-config.json');
    
    const testConfig = {
      mcpServers: {
        'test-traffic-router': {
          command: 'node',
          args: ['server/mcp-integration-server.js'],
          env: {
            MCP_SERVER_PORT: '3101',
            LOG_LEVEL: 'error'
          },
          disabled: false,
          autoApprove: ['check_health', 'get_logs'],
          description: 'Test Traffic Router MCP Server',
          capabilities: ['tools', 'resources', 'prompts']
        },
        'test-memory': {
          command: 'node',
          args: ['lib/mcp-memory-server.js'],
          env: {
            MEMORY_PORT: '3103',
            MEMORY_PATH: './test-memory',
            LOG_LEVEL: 'error'
          },
          disabled: false,
          autoApprove: ['read_memory', 'search_memory'],
          description: 'Test Memory MCP Server',
          capabilities: ['resources', 'tools']
        }
      },
      clientConfig: {
        autoConnect: false, // Отключаем автоподключение для тестов
        reconnectInterval: 1000,
        maxReconnectAttempts: 3,
        timeout: 10000,
        enableLogging: false,
        logLevel: 'error'
      }
    };

    await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));
  });

  afterAll(async () => {
    // Очистка тестовых файлов
    try {
      await fs.unlink(testConfigPath);
      await fs.rmdir('./test-memory', { recursive: true });
    } catch (error) {
      // Игнорируем ошибки очистки
    }
  });

  beforeEach(() => {
    mcpClient = new MCPClient(testConfigPath);
  });

  afterEach(async () => {
    if (mcpClient) {
      await mcpClient.shutdown();
    }
  });

  describe('MCP Client Initialization', () => {
    test('should initialize MCP client with configuration', async () => {
      expect(mcpClient).toBeDefined();
      
      const serverStatus = mcpClient.getServerStatus();
      expect(serverStatus).toHaveProperty('test-traffic-router');
      expect(serverStatus).toHaveProperty('test-memory');
      
      expect(serverStatus['test-traffic-router'].config.command).toBe('node');
      expect(serverStatus['test-memory'].config.command).toBe('node');
    });

    test('should handle invalid configuration gracefully', async () => {
      const invalidConfigPath = path.join(__dirname, 'invalid-config.json');
      
      await expect(async () => {
        const invalidClient = new MCPClient(invalidConfigPath);
        await new Promise(resolve => setTimeout(resolve, 100)); // Даем время на загрузку
      }).rejects.toThrow();
    });
  });

  describe('MCP Server Management', () => {
    test('should report server connection status', () => {
      const connectedServers = mcpClient.getConnectedServers();
      expect(Array.isArray(connectedServers)).toBe(true);
      
      // Изначально серверы не подключены
      expect(mcpClient.isServerConnected('test-traffic-router')).toBe(false);
      expect(mcpClient.isServerConnected('test-memory')).toBe(false);
    });

    test('should handle server connection attempts', async () => {
      // Попытка подключения к несуществующему серверу должна завершиться ошибкой
      await expect(mcpClient.connectToServer('test-traffic-router')).rejects.toThrow();
    });

    test('should handle server disconnection', async () => {
      // Отключение от несуществующего сервера не должно вызывать ошибку
      await expect(mcpClient.disconnectFromServer('test-traffic-router')).resolves.not.toThrow();
    });
  });

  describe('MCP Tools and Resources', () => {
    test('should handle tool calls when server is not connected', async () => {
      const toolCall = MCPUtils.createToolCall('check_health', {});
      
      await expect(mcpClient.callTool('test-traffic-router', toolCall))
        .rejects.toThrow('Server test-traffic-router is not connected');
    });

    test('should handle resource requests when server is not connected', async () => {
      await expect(mcpClient.getResources('test-traffic-router'))
        .rejects.toThrow('Server test-traffic-router is not connected');
      
      await expect(mcpClient.readResource('test-traffic-router', 'system://status'))
        .rejects.toThrow('Server test-traffic-router is not connected');
    });

    test('should handle prompt requests when server is not connected', async () => {
      await expect(mcpClient.getPrompts('test-traffic-router'))
        .rejects.toThrow('Server test-traffic-router is not connected');
      
      await expect(mcpClient.getPrompt('test-traffic-router', 'system_diagnosis'))
        .rejects.toThrow('Server test-traffic-router is not connected');
    });
  });

  describe('MCP Configuration Management', () => {
    test('should reload configuration', async () => {
      const originalServers = Object.keys(mcpClient.getServerStatus());
      
      // Создаем новую конфигурацию
      const newConfig = {
        mcpServers: {
          'new-test-server': {
            command: 'echo',
            args: ['test'],
            env: {},
            disabled: false,
            autoApprove: [],
            description: 'New test server'
          }
        },
        clientConfig: {
          autoConnect: false,
          reconnectInterval: 1000,
          maxReconnectAttempts: 3,
          timeout: 10000,
          enableLogging: false,
          logLevel: 'error'
        }
      };

      const newConfigPath = path.join(__dirname, 'new-test-config.json');
      await fs.writeFile(newConfigPath, JSON.stringify(newConfig, null, 2));

      await mcpClient.reloadConfiguration(newConfigPath);
      
      const newServerStatus = mcpClient.getServerStatus();
      expect(newServerStatus).toHaveProperty('new-test-server');
      expect(newServerStatus).not.toHaveProperty('test-traffic-router');

      // Очистка
      await fs.unlink(newConfigPath);
    });
  });

  describe('MCP Utils', () => {
    test('should create valid tool calls', () => {
      const toolCall = MCPUtils.createToolCall('test_tool', { param1: 'value1' });
      
      expect(toolCall).toHaveProperty('name', 'test_tool');
      expect(toolCall).toHaveProperty('arguments');
      expect(toolCall.arguments).toHaveProperty('param1', 'value1');
    });

    test('should validate MCP configuration', () => {
      const validConfig = {
        mcpServers: {
          server1: {
            command: 'node',
            args: ['test.js']
          }
        }
      };

      const invalidConfig = {
        mcpServers: {
          server1: {
            command: 'node'
            // missing args
          }
        }
      };

      expect(MCPUtils.validateConfig(validConfig)).toBe(true);
      expect(MCPUtils.validateConfig(invalidConfig)).toBe(false);
      expect(MCPUtils.validateConfig({})).toBe(false);
    });

    test('should get server info', () => {
      const serverConfig = {
        command: 'node',
        args: ['server.js', '--port', '3001'],
        description: 'Test server'
      };

      const info = MCPUtils.getServerInfo(serverConfig);
      expect(info).toContain('node server.js --port 3001');
      expect(info).toContain('Test server');
    });
  });

  describe('Event Handling', () => {
    test('should emit events for server connections', (done) => {
      let eventCount = 0;
      
      mcpClient.on('serverConnectionFailed', (data) => {
        expect(data).toHaveProperty('serverId');
        expect(data).toHaveProperty('error');
        eventCount++;
      });

      mcpClient.on('configurationReloaded', () => {
        eventCount++;
        if (eventCount >= 1) {
          done();
        }
      });

      // Попытка подключения к несуществующему серверу
      mcpClient.connectToServer('test-traffic-router').catch(() => {
        // Ожидаем ошибку
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Попытка подключения к несуществующему порту
      await expect(mcpClient.connectToServer('test-traffic-router')).rejects.toThrow();
    });

    test('should handle malformed responses', async () => {
      // Тест с некорректными данными
      const toolCall = MCPUtils.createToolCall('invalid_tool', { invalid: 'data' });
      
      await expect(mcpClient.callTool('test-traffic-router', toolCall))
        .rejects.toThrow();
    });
  });
});

// Интеграционные тесты с реальными MCP серверами
describe('MCP Integration - Real Servers', () => {
  // Эти тесты выполняются только если MCP серверы запущены
  const testRealServers = process.env.TEST_MCP_SERVERS === 'true';
  
  if (!testRealServers) {
    test.skip('Skipping real MCP server tests - set TEST_MCP_SERVERS=true to enable', () => {});
    return;
  }

  let mcpClient;

  beforeEach(() => {
    mcpClient = new MCPClient(); // Используем реальную конфигурацию
  });

  afterEach(async () => {
    if (mcpClient) {
      await mcpClient.shutdown();
    }
  });

  test('should connect to real MCP servers', async () => {
    await mcpClient.connectAll();
    
    const connectedServers = mcpClient.getConnectedServers();
    expect(connectedServers.length).toBeGreaterThan(0);
  }, 30000);

  test('should call real tools on MCP servers', async () => {
    await mcpClient.connectAll();
    
    const connectedServers = mcpClient.getConnectedServers();
    if (connectedServers.length > 0) {
      const serverId = connectedServers[0];
      
      // Получаем список инструментов
      const tools = await mcpClient.getTools(serverId);
      expect(Array.isArray(tools)).toBe(true);
      
      if (tools.length > 0) {
        // Вызываем первый доступный инструмент
        const tool = tools[0];
        const toolCall = MCPUtils.createToolCall(tool.name, {});
        
        const result = await mcpClient.callTool(serverId, toolCall);
        expect(result).toHaveProperty('content');
      }
    }
  }, 30000);

  test('should read resources from MCP servers', async () => {
    await mcpClient.connectAll();
    
    const connectedServers = mcpClient.getConnectedServers();
    if (connectedServers.length > 0) {
      const serverId = connectedServers[0];
      
      // Получаем список ресурсов
      const resources = await mcpClient.getResources(serverId);
      expect(Array.isArray(resources)).toBe(true);
      
      if (resources.length > 0) {
        // Читаем первый доступный ресурс
        const resource = resources[0];
        const content = await mcpClient.readResource(serverId, resource.uri);
        
        expect(typeof content).toBe('string');
        expect(content.length).toBeGreaterThan(0);
      }
    }
  }, 30000);
});