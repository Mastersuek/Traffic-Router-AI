const { EventEmitter } = require('events');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');

class MCPServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.name = options.name || 'Traffic Router MCP Server';
    this.version = options.version || '1.0.0';
    this.capabilities = {
      logging: true,
      prompts: true,
      resources: true,
      tools: true
    };
    
    this.resources = new Map();
    this.tools = new Map();
    this.prompts = new Map();
    
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/mcp-server.log' })
      ]
    });
    
    this.initializeResources();
    this.initializeTools();
    this.initializePrompts();
  }

  async initializeResources() {
    // Системные ресурсы - используем простые пути как ключи и URI
    this.resources.set('system/status', {
      uri: 'system/status',
      name: 'System Status',
      description: 'Current system status and health',
      mimeType: 'application/json',
      getContent: () => this.getSystemStatus()
    });

    this.resources.set('logs/system', {
      uri: 'logs/system',
      name: 'System Logs',
      description: 'System-wide logs and metrics',
      mimeType: 'text/plain',
      getContent: () => this.getSystemLogs()
    });

    this.resources.set('services/health', {
      uri: 'services/health',
      name: 'Services Health',
      description: 'Health status of all services',
      mimeType: 'application/json',
      getContent: () => this.getServicesHealth()
    });

    this.resources.set('memory/entities', {
      uri: 'memory/entities',
      name: 'Memory Entities',
      description: 'AI agent memory entities',
      mimeType: 'text/markdown',
      getContent: () => this.getMemoryEntities()
    });
  }

  initializeTools() {
    // Инструменты для управления системой
    this.tools.set('restart_service', {
      name: 'restart_service',
      description: 'Restart a specific service',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            enum: ['web', 'ai-proxy', 'monitoring', 'traffic-router'],
            description: 'Service name to restart'
          },
          force: {
            type: 'boolean',
            default: false,
            description: 'Force restart without graceful shutdown'
          }
        },
        required: ['service']
      },
      execute: (params) => this.restartService(params.service, params.force)
    });

    this.tools.set('check_health', {
      name: 'check_health',
      description: 'Check health of a specific service or all services',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Specific service to check (optional)'
          }
        }
      },
      execute: (params) => this.checkHealth(params.service)
    });

    this.tools.set('get_logs', {
      name: 'get_logs',
      description: 'Get logs for a specific service or time range',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Service name to get logs for'
          },
          lines: {
            type: 'number',
            default: 100,
            description: 'Number of lines to retrieve'
          },
          level: {
            type: 'string',
            enum: ['error', 'warn', 'info', 'debug'],
            description: 'Log level filter'
          }
        },
        required: ['service']
      },
      execute: (params) => this.getLogs(params.service, params.lines, params.level)
    });

    this.tools.set('update_memory', {
      name: 'update_memory',
      description: 'Update AI agent memory for an entity',
      inputSchema: {
        type: 'object',
        properties: {
          entity: {
            type: 'string',
            description: 'Entity name to update'
          },
          data: {
            type: 'object',
            description: 'Data to store in memory'
          }
        },
        required: ['entity', 'data']
      },
      execute: (params) => this.updateMemory(params.entity, params.data)
    });

    this.tools.set('execute_command', {
      name: 'execute_command',
      description: 'Execute a system command',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Command to execute'
          },
          timeout: {
            type: 'number',
            default: 30000,
            description: 'Command timeout in milliseconds'
          }
        },
        required: ['command']
      },
      execute: (params) => this.executeCommand(params.command, params.timeout)
    });
  }

  initializePrompts() {
    this.prompts.set('system_diagnosis', {
      name: 'system_diagnosis',
      description: 'Diagnose system issues and provide recovery recommendations',
      arguments: [
        {
          name: 'severity',
          description: 'Issue severity level',
          required: false
        }
      ]
    });

    this.prompts.set('service_recovery', {
      name: 'service_recovery',
      description: 'Generate service recovery plan',
      arguments: [
        {
          name: 'service',
          description: 'Service name that needs recovery',
          required: true
        },
        {
          name: 'error',
          description: 'Error details',
          required: true
        }
      ]
    });

    this.prompts.set('performance_analysis', {
      name: 'performance_analysis',
      description: 'Analyze system performance and suggest optimizations',
      arguments: [
        {
          name: 'timeframe',
          description: 'Timeframe for analysis',
          required: false
        }
      ]
    });
  }

  async getSystemStatus() {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      const [memory, cpu, disk] = await Promise.all([
        execAsync('powershell "Get-WmiObject Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json"'),
        execAsync('powershell "Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object Average | ConvertTo-Json"'),
        execAsync('powershell "Get-WmiObject Win32_LogicalDisk | Select-Object Size,FreeSpace,DeviceID | ConvertTo-Json"')
      ]);

      return JSON.stringify({
        timestamp: new Date().toISOString(),
        memory: this.parseMemoryInfoJSON(memory.stdout),
        cpu: this.parseCpuInfoJSON(cpu.stdout),
        disk: this.parseDiskInfoJSON(disk.stdout),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: 'Failed to get system status',
        details: error.message
      }, null, 2);
    }
  }

  parseMemoryInfo(output) {
    const lines = output.split('\n');
    const memory = {};
    
    lines.forEach(line => {
      if (line.includes('TotalVisibleMemorySize')) {
        memory.total = parseInt(line.split('=')[1]) * 1024; // Convert KB to bytes
      } else if (line.includes('FreePhysicalMemory')) {
        memory.free = parseInt(line.split('=')[1]) * 1024;
      }
    });
    
    memory.used = memory.total - memory.free;
    memory.percentage = (memory.used / memory.total * 100).toFixed(2);
    
    return memory;
  }

  parseCpuInfo(output) {
    const lines = output.split('\n');
    let loadPercentage = 0;
    
    lines.forEach(line => {
      if (line.includes('LoadPercentage')) {
        loadPercentage = parseInt(line.split('=')[1]) || 0;
      }
    });
    
    return { loadPercentage };
  }

  parseDiskInfo(output) {
    const lines = output.split('\n');
    const disks = [];
    
    lines.forEach(line => {
      if (line.includes('FreeSpace') || line.includes('Size')) {
        // Parse disk information
        const parts = line.split('=');
        if (parts.length === 2) {
          disks.push({
            type: parts[0].trim(),
            value: parseInt(parts[1]) || 0
          });
        }
      }
    });
    
    return disks;
  }
  
  parseMemoryInfoJSON(output) {
    try {
      const data = JSON.parse(output.trim());
      const memory = {
        total: data.TotalVisibleMemorySize * 1024, // Convert KB to bytes
        free: data.FreePhysicalMemory * 1024
      };
      memory.used = memory.total - memory.free;
      memory.percentage = (memory.used / memory.total * 100).toFixed(2);
      return memory;
    } catch (error) {
      return { error: 'Failed to parse memory info', details: error.message };
    }
  }
  
  parseCpuInfoJSON(output) {
    try {
      const data = JSON.parse(output.trim());
      return { loadPercentage: data.Average || 0 };
    } catch (error) {
      return { error: 'Failed to parse CPU info', details: error.message };
    }
  }
  
  parseDiskInfoJSON(output) {
    try {
      const data = JSON.parse(output.trim());
      const disks = Array.isArray(data) ? data : [data];
      
      return disks.map(disk => ({
        deviceId: disk.DeviceID,
        size: disk.Size,
        freeSpace: disk.FreeSpace,
        usedSpace: disk.Size - disk.FreeSpace,
        usagePercent: ((disk.Size - disk.FreeSpace) / disk.Size * 100).toFixed(2)
      }));
    } catch (error) {
      return [{ error: 'Failed to parse disk info', details: error.message }];
    }
  }

  async getSystemLogs() {
    try {
      const logFiles = ['system-test.log', 'proxy-server.log', 'monitoring-server.log', 'recovery-agent.log'];
      let allLogs = '';
      
      for (const file of logFiles) {
        try {
          const logPath = path.join('logs', file);
          const content = await fs.readFile(logPath, 'utf8');
          allLogs += `\n=== ${file} ===\n${content.slice(-5000)}\n`; // Last 5000 chars
        } catch (error) {
          allLogs += `\n=== ${file} ===\nError reading file: ${error.message}\n`;
        }
      }
      
      return allLogs;
    } catch (error) {
      return `Error reading system logs: ${error.message}`;
    }
  }

  async getServicesHealth() {
    const services = ['web', 'ai-proxy', 'monitoring'];
    const health = {};
    
    for (const service of services) {
      try {
        const port = this.getServicePort(service);
        const response = await this.makeHealthRequest(`http://localhost:${port}/health`);
        health[service] = {
          status: 'healthy',
          responseTime: response.responseTime,
          details: response.data
        };
      } catch (error) {
        health[service] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }
    
    return JSON.stringify(health, null, 2);
  }

  getServicePort(service) {
    const ports = {
      'web': 13000,
      'ai-proxy': 13081,
      'monitoring': 13082
    };
    return ports[service] || 8080;
  }

  async makeHealthRequest(url) {
    const axios = require('axios');
    const startTime = Date.now();
    
    const response = await axios.get(url, { timeout: 5000 });
    const responseTime = Date.now() - startTime;
    
    return {
      data: response.data,
      responseTime
    };
  }

  async getMemoryEntities() {
    try {
      const entitiesDir = 'memory/entities';
      const files = await fs.readdir(entitiesDir);
      let memoryContent = '';
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(entitiesDir, file), 'utf8');
          memoryContent += `\n=== ${file} ===\n${content}\n`;
        }
      }
      
      return memoryContent;
    } catch (error) {
      return `Error reading memory entities: ${error.message}`;
    }
  }

  async restartService(service, force = false) {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      const commands = {
        'web': 'npm run dev',
        'ai-proxy': 'npm run dev:proxy',
        'monitoring': 'npm run dev:monitor',
        'traffic-router': 'npm run start:router'
      };

      const command = commands[service];
      if (!command) {
        throw new Error(`Unknown service: ${service}`);
      }

      this.logger.info(`Restarting service: ${service}`);
      
      if (force) {
        // Kill existing process first
        await execAsync(`taskkill /F /IM node.exe /FI "WINDOWTITLE eq ${service}*"`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Start service
      const result = await execAsync(command);
      
      this.emit('serviceRestarted', { service, force, result: result.stdout });
      
      return {
        success: true,
        service,
        message: `Service ${service} restarted successfully`,
        output: result.stdout
      };
    } catch (error) {
      this.logger.error(`Failed to restart service ${service}:`, error);
      return {
        success: false,
        service,
        error: error.message
      };
    }
  }

  async checkHealth(service = null) {
    if (service) {
      return await this.getServicesHealth();
    } else {
      const health = await this.getServicesHealth();
      return health;
    }
  }

  async getLogs(service, lines = 100, level = null) {
    try {
      const logFile = `${service}.log`;
      const logPath = path.join('logs', logFile);
      
      const content = await fs.readFile(logPath, 'utf8');
      const logLines = content.split('\n');
      
      let filteredLines = logLines.slice(-lines);
      
      if (level) {
        filteredLines = filteredLines.filter(line => 
          line.toLowerCase().includes(level.toLowerCase())
        );
      }
      
      return {
        service,
        lines: filteredLines.length,
        level,
        content: filteredLines.join('\n')
      };
    } catch (error) {
      return {
        service,
        error: `Failed to read logs: ${error.message}`
      };
    }
  }

  async updateMemory(entity, data) {
    try {
      const memoryPath = path.join('memory', 'entities', `${entity}.md`);
      const timestamp = new Date().toISOString();
      
      const memoryContent = `# ${entity}

## Update ${timestamp}
${JSON.stringify(data, null, 2)}

`;
      
      await fs.appendFile(memoryPath, memoryContent, 'utf8');
      
      this.emit('memoryUpdated', { entity, data, timestamp });
      
      return {
        success: true,
        entity,
        timestamp,
        message: `Memory updated for entity: ${entity}`
      };
    } catch (error) {
      return {
        success: false,
        entity,
        error: error.message
      };
    }
  }

  async executeCommand(command, timeout = 30000) {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      const result = await Promise.race([
        execAsync(command),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Command timeout')), timeout)
        )
      ]);
      
      this.emit('commandExecuted', { command, result: result.stdout });
      
      return {
        success: true,
        command,
        output: result.stdout,
        stderr: result.stderr
      };
    } catch (error) {
      return {
        success: false,
        command,
        error: error.message
      };
    }
  }

  // MCP Protocol Methods
  async initialize() {
    return {
      protocolVersion: '2024-11-05',
      capabilities: this.capabilities,
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
    // First try to find by exact URI match
    let resource = Array.from(this.resources.values()).find(r => r.uri === uri);
    
    // If not found, try to find by resource key (for backward compatibility)
    if (!resource) {
      resource = this.resources.get(uri);
    }
    
    // If still not found, try to match by removing protocol prefix
    if (!resource) {
      const normalizedUri = uri.replace(/^[a-z]+:\/\//, '');
      resource = Array.from(this.resources.values()).find(r => 
        r.uri.replace(/^[a-z]+:\/\//, '') === normalizedUri
      );
    }
    
    if (!resource) {
      const availableUris = Array.from(this.resources.values()).map(r => r.uri);
      const availableKeys = Array.from(this.resources.keys());
      throw new Error(`Resource not found: ${uri}. Available resources: ${[...availableUris, ...availableKeys].join(', ')}`);
    }
    
    try {
      const content = await resource.getContent();
      return {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: content
      };
    } catch (contentError) {
      throw new Error(`Failed to get content for resource ${uri}: ${contentError.message}`);
    }
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

  async listPrompts() {
    const prompts = Array.from(this.prompts.entries()).map(([key, prompt]) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }));
    
    return { prompts };
  }

  async getPrompt(name, arguments_ = {}) {
    const prompt = this.prompts.get(name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }
    
    // Generate prompt based on name and arguments
    let promptText = '';
    
    switch (name) {
      case 'system_diagnosis':
        promptText = this.generateSystemDiagnosisPrompt(arguments_);
        break;
      case 'service_recovery':
        promptText = this.generateServiceRecoveryPrompt(arguments_);
        break;
      case 'performance_analysis':
        promptText = this.generatePerformanceAnalysisPrompt(arguments_);
        break;
      default:
        promptText = `Prompt: ${prompt.description}`;
    }
    
    return {
      description: prompt.description,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: promptText
          }
        }
      ]
    };
  }

  generateSystemDiagnosisPrompt(args) {
    return `# System Diagnosis Request

Please analyze the current system status and provide:

1. **Current Issues**: Identify any problems or anomalies
2. **Root Cause Analysis**: Determine the underlying causes
3. **Recovery Recommendations**: Suggest specific actions to resolve issues
4. **Prevention Measures**: Recommend ways to prevent similar issues

Severity Level: ${args.severity || 'medium'}

Use the available tools to gather current system information before providing your analysis.`;
  }

  generateServiceRecoveryPrompt(args) {
    return `# Service Recovery Plan

Service: ${args.service}
Error: ${args.error}

Please create a comprehensive recovery plan including:

1. **Immediate Actions**: Steps to take right now
2. **Service Restart**: Proper restart sequence
3. **Health Verification**: How to confirm recovery
4. **Monitoring**: What to watch for after recovery
5. **Long-term Fixes**: Permanent solutions to prevent recurrence

Use the available tools to check current service status and execute recovery commands.`;
  }

  generatePerformanceAnalysisPrompt(args) {
    return `# Performance Analysis

Timeframe: ${args.timeframe || 'last hour'}

Please analyze system performance and provide:

1. **Performance Metrics**: Current CPU, memory, disk usage
2. **Bottlenecks**: Identify performance bottlenecks
3. **Optimization Recommendations**: Specific improvements
4. **Resource Scaling**: Suggestions for resource adjustments
5. **Monitoring Improvements**: Enhanced monitoring strategies

Use the available tools to gather performance data before analysis.`;
  }
}

module.exports = { MCPServer };
