#!/usr/bin/env python3
"""
MCP AI Agent Integration
Connects Enhanced Recovery Agent with MCP (Model Context Protocol) servers
"""

import asyncio
import aiohttp
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Callable
from dataclasses import dataclass, asdict
from pathlib import Path
import yaml

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class MCPServerConfig:
    """Configuration for MCP server connection"""
    name: str
    url: str
    enabled: bool = True
    auto_approve: List[str] = None
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: int = 5

@dataclass
class MCPToolCall:
    """MCP tool call request"""
    name: str
    arguments: Dict[str, Any]
    server: str
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class MCPToolResult:
    """MCP tool call result"""
    success: bool
    content: Any
    error: Optional[str] = None
    execution_time: float = 0.0
    server: str = ""

class MCPConnectionManager:
    """Manages connections to multiple MCP servers"""
    
    def __init__(self, config_path: str = ".kiro/settings/mcp.json"):
        self.config_path = config_path
        self.servers: Dict[str, MCPServerConfig] = {}
        self.sessions: Dict[str, aiohttp.ClientSession] = {}
        self.connection_status: Dict[str, bool] = {}
        self.last_health_check: Dict[str, datetime] = {}
        self.reconnect_tasks: Dict[str, asyncio.Task] = {}
        self.event_handlers: Dict[str, List[Callable]] = {
            'connected': [],
            'disconnected': [],
            'tool_called': [],
            'tool_failed': [],
            'error': []
        }
        
    async def initialize(self):
        """Initialize MCP connection manager"""
        try:
            await self.load_configuration()
            await self.connect_all_servers()
            logger.info("MCP Connection Manager initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize MCP Connection Manager: {e}")
            raise
    
    async def load_configuration(self):
        """Load MCP server configuration"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            self.servers.clear()
            
            for server_id, server_config in config.get('mcpServers', {}).items():
                if not server_config.get('disabled', False):
                    # Determine server URL based on environment variables
                    port = self._get_server_port(server_id, server_config)
                    url = f"http://localhost:{port}"
                    
                    self.servers[server_id] = MCPServerConfig(
                        name=server_id,
                        url=url,
                        enabled=True,
                        auto_approve=server_config.get('autoApprove', []),
                        timeout=30,
                        retry_attempts=3,
                        retry_delay=5
                    )
            
            logger.info(f"Loaded configuration for {len(self.servers)} MCP servers")
            
        except Exception as e:
            logger.error(f"Failed to load MCP configuration: {e}")
            raise
    
    def _get_server_port(self, server_id: str, config: Dict[str, Any]) -> int:
        """Get server port from configuration"""
        port_mapping = {
            'traffic-router-mcp': 3001,
            'memory-mcp': 3003,
            'system-monitor-mcp': 3004,
            'deepmcp-agent': 3002
        }
        
        # Try to get port from environment variables in config
        env_vars = config.get('env', {})
        for env_var, value in env_vars.items():
            if 'PORT' in env_var:
                try:
                    return int(value)
                except ValueError:
                    pass
        
        # Fallback to default ports
        return port_mapping.get(server_id, 3001)
    
    async def connect_all_servers(self):
        """Connect to all configured MCP servers"""
        connection_tasks = []
        
        for server_id in self.servers:
            task = asyncio.create_task(self.connect_server(server_id))
            connection_tasks.append(task)
        
        # Wait for all connections to complete
        results = await asyncio.gather(*connection_tasks, return_exceptions=True)
        
        successful_connections = 0
        for i, result in enumerate(results):
            server_id = list(self.servers.keys())[i]
            if isinstance(result, Exception):
                logger.error(f"Failed to connect to {server_id}: {result}")
            else:
                successful_connections += 1
        
        logger.info(f"Connected to {successful_connections}/{len(self.servers)} MCP servers")
    
    async def connect_server(self, server_id: str) -> bool:
        """Connect to a specific MCP server"""
        if server_id not in self.servers:
            logger.error(f"Server {server_id} not found in configuration")
            return False
        
        server_config = self.servers[server_id]
        
        try:
            # Create session if not exists
            if server_id not in self.sessions:
                self.sessions[server_id] = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=server_config.timeout)
                )
            
            session = self.sessions[server_id]
            
            # Test connection with health check
            async with session.get(f"{server_config.url}/health") as response:
                if response.status == 200:
                    # Initialize MCP protocol
                    await self._initialize_mcp_protocol(server_id, session, server_config.url)
                    
                    self.connection_status[server_id] = True
                    self.last_health_check[server_id] = datetime.now()
                    
                    logger.info(f"Successfully connected to MCP server: {server_id}")
                    await self._emit_event('connected', {'server': server_id})
                    
                    return True
                else:
                    raise Exception(f"Health check failed with status {response.status}")
        
        except Exception as e:
            logger.error(f"Failed to connect to MCP server {server_id}: {e}")
            self.connection_status[server_id] = False
            
            # Schedule reconnection
            await self._schedule_reconnection(server_id)
            await self._emit_event('disconnected', {'server': server_id, 'error': str(e)})
            
            return False
    
    async def _initialize_mcp_protocol(self, server_id: str, session: aiohttp.ClientSession, url: str):
        """Initialize MCP protocol with server"""
        init_payload = {
            "protocolVersion": "2024-11-05",
            "clientInfo": {
                "name": "Enhanced Recovery Agent MCP Client",
                "version": "2.0.0"
            }
        }
        
        async with session.post(f"{url}/mcp/initialize", json=init_payload) as response:
            if response.status == 200:
                data = await response.json()
                logger.debug(f"MCP protocol initialized for {server_id}: {data}")
            else:
                raise Exception(f"MCP initialization failed with status {response.status}")
    
    async def _schedule_reconnection(self, server_id: str):
        """Schedule automatic reconnection for failed server"""
        if server_id in self.reconnect_tasks:
            self.reconnect_tasks[server_id].cancel()
        
        async def reconnect_loop():
            server_config = self.servers[server_id]
            
            for attempt in range(server_config.retry_attempts):
                await asyncio.sleep(server_config.retry_delay * (2 ** attempt))  # Exponential backoff
                
                logger.info(f"Attempting to reconnect to {server_id} (attempt {attempt + 1})")
                
                if await self.connect_server(server_id):
                    logger.info(f"Successfully reconnected to {server_id}")
                    return
            
            logger.error(f"Failed to reconnect to {server_id} after {server_config.retry_attempts} attempts")
        
        self.reconnect_tasks[server_id] = asyncio.create_task(reconnect_loop())
    
    async def call_tool(self, server_id: str, tool_name: str, arguments: Dict[str, Any]) -> MCPToolResult:
        """Call MCP tool on specified server"""
        start_time = time.time()
        
        if server_id not in self.servers:
            return MCPToolResult(
                success=False,
                content=None,
                error=f"Server {server_id} not configured",
                server=server_id
            )
        
        if not self.connection_status.get(server_id, False):
            return MCPToolResult(
                success=False,
                content=None,
                error=f"Server {server_id} not connected",
                server=server_id
            )
        
        server_config = self.servers[server_id]
        
        # Check if tool is auto-approved
        if tool_name not in server_config.auto_approve:
            logger.warning(f"Tool {tool_name} not in auto-approve list for {server_id}")
        
        try:
            session = self.sessions[server_id]
            
            payload = {
                "name": tool_name,
                "arguments": arguments
            }
            
            async with session.post(f"{server_config.url}/mcp/tools/call", json=payload) as response:
                execution_time = time.time() - start_time
                
                if response.status == 200:
                    data = await response.json()
                    
                    result = MCPToolResult(
                        success=True,
                        content=data,
                        execution_time=execution_time,
                        server=server_id
                    )
                    
                    await self._emit_event('tool_called', {
                        'server': server_id,
                        'tool': tool_name,
                        'arguments': arguments,
                        'result': data,
                        'execution_time': execution_time
                    })
                    
                    return result
                else:
                    error_text = await response.text()
                    result = MCPToolResult(
                        success=False,
                        content=None,
                        error=f"HTTP {response.status}: {error_text}",
                        execution_time=execution_time,
                        server=server_id
                    )
                    
                    await self._emit_event('tool_failed', {
                        'server': server_id,
                        'tool': tool_name,
                        'error': result.error
                    })
                    
                    return result
        
        except Exception as e:
            execution_time = time.time() - start_time
            error_msg = str(e)
            
            result = MCPToolResult(
                success=False,
                content=None,
                error=error_msg,
                execution_time=execution_time,
                server=server_id
            )
            
            await self._emit_event('tool_failed', {
                'server': server_id,
                'tool': tool_name,
                'error': error_msg
            })
            
            # If connection error, mark server as disconnected and schedule reconnection
            if "connection" in error_msg.lower() or "timeout" in error_msg.lower():
                self.connection_status[server_id] = False
                await self._schedule_reconnection(server_id)
            
            return result
    
    async def get_resource(self, server_id: str, uri: str) -> Optional[str]:
        """Get resource from MCP server"""
        if server_id not in self.servers or not self.connection_status.get(server_id, False):
            return None
        
        try:
            session = self.sessions[server_id]
            server_config = self.servers[server_id]
            
            encoded_uri = uri.replace('://', '%3A%2F%2F')  # URL encode
            
            async with session.get(f"{server_config.url}/mcp/resources/{encoded_uri}") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('text', '')
                else:
                    logger.error(f"Failed to get resource {uri} from {server_id}: {response.status}")
                    return None
        
        except Exception as e:
            logger.error(f"Error getting resource {uri} from {server_id}: {e}")
            return None
    
    async def get_available_tools(self, server_id: str) -> List[Dict[str, Any]]:
        """Get list of available tools from MCP server"""
        if server_id not in self.servers or not self.connection_status.get(server_id, False):
            return []
        
        try:
            session = self.sessions[server_id]
            server_config = self.servers[server_id]
            
            async with session.get(f"{server_config.url}/mcp/tools") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('tools', [])
                else:
                    logger.error(f"Failed to get tools from {server_id}: {response.status}")
                    return []
        
        except Exception as e:
            logger.error(f"Error getting tools from {server_id}: {e}")
            return []
    
    async def health_check_all(self) -> Dict[str, bool]:
        """Perform health check on all connected servers"""
        results = {}
        
        for server_id in self.servers:
            try:
                if server_id in self.sessions:
                    session = self.sessions[server_id]
                    server_config = self.servers[server_id]
                    
                    async with session.get(f"{server_config.url}/health") as response:
                        results[server_id] = response.status == 200
                        
                        if response.status == 200:
                            self.connection_status[server_id] = True
                            self.last_health_check[server_id] = datetime.now()
                        else:
                            self.connection_status[server_id] = False
                else:
                    results[server_id] = False
                    self.connection_status[server_id] = False
            
            except Exception as e:
                logger.error(f"Health check failed for {server_id}: {e}")
                results[server_id] = False
                self.connection_status[server_id] = False
        
        return results
    
    def get_connection_status(self) -> Dict[str, Dict[str, Any]]:
        """Get detailed connection status for all servers"""
        status = {}
        
        for server_id, server_config in self.servers.items():
            status[server_id] = {
                'connected': self.connection_status.get(server_id, False),
                'url': server_config.url,
                'last_health_check': self.last_health_check.get(server_id),
                'auto_approve_tools': server_config.auto_approve
            }
        
        return status
    
    def add_event_handler(self, event_type: str, handler: Callable):
        """Add event handler for MCP events"""
        if event_type in self.event_handlers:
            self.event_handlers[event_type].append(handler)
    
    async def _emit_event(self, event_type: str, data: Dict[str, Any]):
        """Emit event to registered handlers"""
        if event_type in self.event_handlers:
            for handler in self.event_handlers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)
                except Exception as e:
                    logger.error(f"Error in event handler for {event_type}: {e}")
    
    async def shutdown(self):
        """Shutdown MCP connection manager"""
        logger.info("Shutting down MCP Connection Manager...")
        
        # Cancel all reconnection tasks
        for task in self.reconnect_tasks.values():
            task.cancel()
        
        # Close all sessions
        for session in self.sessions.values():
            await session.close()
        
        self.sessions.clear()
        self.connection_status.clear()
        self.reconnect_tasks.clear()
        
        logger.info("MCP Connection Manager shutdown completed")


class MCPAIAgentIntegration:
    """Main integration class for MCP with AI Agent"""
    
    def __init__(self, config_path: str = ".kiro/settings/mcp.json"):
        self.mcp_manager = MCPConnectionManager(config_path)
        self.memory_cache: Dict[str, Any] = {}
        self.tool_usage_stats: Dict[str, Dict[str, int]] = {}
        self.last_memory_sync = datetime.now()
        
    async def initialize(self):
        """Initialize MCP AI Agent Integration"""
        try:
            await self.mcp_manager.initialize()
            
            # Set up event handlers
            self.mcp_manager.add_event_handler('tool_called', self._on_tool_called)
            self.mcp_manager.add_event_handler('tool_failed', self._on_tool_failed)
            self.mcp_manager.add_event_handler('connected', self._on_server_connected)
            self.mcp_manager.add_event_handler('disconnected', self._on_server_disconnected)
            
            logger.info("MCP AI Agent Integration initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize MCP AI Agent Integration: {e}")
            raise
    
    async def _on_tool_called(self, data: Dict[str, Any]):
        """Handle successful tool calls"""
        server = data['server']
        tool = data['tool']
        
        # Update usage statistics
        if server not in self.tool_usage_stats:
            self.tool_usage_stats[server] = {}
        if tool not in self.tool_usage_stats[server]:
            self.tool_usage_stats[server][tool] = 0
        
        self.tool_usage_stats[server][tool] += 1
        
        logger.debug(f"Tool {tool} called successfully on {server}")
    
    async def _on_tool_failed(self, data: Dict[str, Any]):
        """Handle failed tool calls"""
        server = data['server']
        tool = data['tool']
        error = data['error']
        
        logger.warning(f"Tool {tool} failed on {server}: {error}")
    
    async def _on_server_connected(self, data: Dict[str, Any]):
        """Handle server connection events"""
        server = data['server']
        logger.info(f"MCP server {server} connected")
        
        # Sync memory if it's the memory server
        if server == 'memory-mcp':
            await self._sync_memory_from_server()
    
    async def _on_server_disconnected(self, data: Dict[str, Any]):
        """Handle server disconnection events"""
        server = data['server']
        logger.warning(f"MCP server {server} disconnected")
    
    # High-level AI Agent methods
    
    async def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status using MCP tools"""
        status = {
            'timestamp': datetime.now().isoformat(),
            'services': {},
            'metrics': {},
            'alerts': [],
            'mcp_servers': self.mcp_manager.get_connection_status()
        }
        
        # Get service health from traffic router MCP
        health_result = await self.mcp_manager.call_tool(
            'traffic-router-mcp', 
            'check_health', 
            {}
        )
        
        if health_result.success:
            try:
                health_data = json.loads(health_result.content['content'][0]['text'])
                status['services'] = health_data
            except (KeyError, json.JSONDecodeError) as e:
                logger.error(f"Failed to parse health data: {e}")
        
        # Get system metrics from monitor MCP
        metrics_result = await self.mcp_manager.call_tool(
            'system-monitor-mcp',
            'get_metrics',
            {'type': 'all', 'timeframe': 'current'}
        )
        
        if metrics_result.success:
            try:
                metrics_data = json.loads(metrics_result.content['content'][0]['text'])
                if metrics_data.get('success'):
                    status['metrics'] = metrics_data['data']
            except (KeyError, json.JSONDecodeError) as e:
                logger.error(f"Failed to parse metrics data: {e}")
        
        # Get alerts from monitor MCP
        alerts_result = await self.mcp_manager.call_tool(
            'system-monitor-mcp',
            'get_alerts',
            {'limit': 10}
        )
        
        if alerts_result.success:
            try:
                alerts_data = json.loads(alerts_result.content['content'][0]['text'])
                if alerts_data.get('success'):
                    status['alerts'] = alerts_data['alerts']
            except (KeyError, json.JSONDecodeError) as e:
                logger.error(f"Failed to parse alerts data: {e}")
        
        return status
    
    async def restart_service(self, service_name: str, force: bool = False) -> bool:
        """Restart service using MCP tools"""
        result = await self.mcp_manager.call_tool(
            'traffic-router-mcp',
            'restart_service',
            {'service': service_name, 'force': force}
        )
        
        if result.success:
            try:
                restart_data = json.loads(result.content['content'][0]['text'])
                return restart_data.get('success', False)
            except (KeyError, json.JSONDecodeError):
                return False
        
        return False
    
    async def update_memory(self, entity: str, content: str, memory_type: str = 'fact') -> bool:
        """Update AI agent memory using Memory MCP"""
        result = await self.mcp_manager.call_tool(
            'memory-mcp',
            'update_memory',
            {
                'entity': entity,
                'content': content,
                'type': memory_type
            }
        )
        
        if result.success:
            try:
                memory_data = json.loads(result.content['content'][0]['text'])
                success = memory_data.get('success', False)
                
                if success:
                    # Update local cache
                    self.memory_cache[entity] = {
                        'content': content,
                        'type': memory_type,
                        'timestamp': datetime.now()
                    }
                
                return success
            except (KeyError, json.JSONDecodeError):
                return False
        
        return False
    
    async def search_memory(self, query: str, entity: str = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Search AI agent memory using Memory MCP"""
        search_args = {
            'query': query,
            'limit': limit
        }
        
        if entity:
            search_args['entity'] = entity
        
        result = await self.mcp_manager.call_tool(
            'memory-mcp',
            'search_memory',
            search_args
        )
        
        if result.success:
            try:
                search_data = json.loads(result.content['content'][0]['text'])
                if search_data.get('success'):
                    return search_data.get('results', [])
            except (KeyError, json.JSONDecodeError):
                pass
        
        return []
    
    async def get_memory_stats(self) -> Dict[str, Any]:
        """Get memory statistics using Memory MCP"""
        result = await self.mcp_manager.call_tool(
            'memory-mcp',
            'get_memory_stats',
            {}
        )
        
        if result.success:
            try:
                stats_data = json.loads(result.content['content'][0]['text'])
                if stats_data.get('success'):
                    return stats_data.get('stats', {})
            except (KeyError, json.JSONDecodeError):
                pass
        
        return {}
    
    async def _sync_memory_from_server(self):
        """Sync memory cache from Memory MCP server"""
        try:
            # Get memory entities resource
            entities_content = await self.mcp_manager.get_resource('memory-mcp', 'memory://entities')
            
            if entities_content:
                # Parse and cache memory content
                # This is a simplified version - in practice, you'd parse the markdown
                self.last_memory_sync = datetime.now()
                logger.info("Memory cache synced from MCP server")
        
        except Exception as e:
            logger.error(f"Failed to sync memory from server: {e}")
    
    async def execute_recovery_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Execute recovery plan using MCP tools"""
        results = {
            'plan_id': plan.get('id', 'unknown'),
            'started_at': datetime.now().isoformat(),
            'actions': [],
            'success': True,
            'errors': []
        }
        
        for action in plan.get('actions', []):
            action_result = {
                'action': action,
                'started_at': datetime.now().isoformat(),
                'success': False,
                'error': None
            }
            
            try:
                if action['type'] == 'restart_service':
                    success = await self.restart_service(
                        action['service'], 
                        action.get('force', False)
                    )
                    action_result['success'] = success
                
                elif action['type'] == 'update_memory':
                    success = await self.update_memory(
                        action['entity'],
                        action['content'],
                        action.get('memory_type', 'fact')
                    )
                    action_result['success'] = success
                
                elif action['type'] == 'mcp_tool_call':
                    tool_result = await self.mcp_manager.call_tool(
                        action['server'],
                        action['tool'],
                        action.get('arguments', {})
                    )
                    action_result['success'] = tool_result.success
                    if not tool_result.success:
                        action_result['error'] = tool_result.error
                
                else:
                    action_result['error'] = f"Unknown action type: {action['type']}"
            
            except Exception as e:
                action_result['error'] = str(e)
                results['errors'].append(str(e))
            
            action_result['completed_at'] = datetime.now().isoformat()
            results['actions'].append(action_result)
            
            if not action_result['success']:
                results['success'] = False
        
        results['completed_at'] = datetime.now().isoformat()
        
        # Log recovery plan execution to memory
        await self.update_memory(
            'recovery_plans',
            f"Executed recovery plan {results['plan_id']}: {'SUCCESS' if results['success'] else 'FAILED'}",
            'decision'
        )
        
        return results
    
    def get_tool_usage_stats(self) -> Dict[str, Dict[str, int]]:
        """Get tool usage statistics"""
        return self.tool_usage_stats.copy()
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform comprehensive health check"""
        health_status = {
            'timestamp': datetime.now().isoformat(),
            'mcp_integration': True,
            'mcp_servers': await self.mcp_manager.health_check_all(),
            'memory_sync': {
                'last_sync': self.last_memory_sync.isoformat(),
                'cache_size': len(self.memory_cache)
            },
            'tool_usage': self.tool_usage_stats
        }
        
        # Check if critical servers are connected
        critical_servers = ['traffic-router-mcp', 'memory-mcp', 'system-monitor-mcp']
        connected_critical = sum(1 for server in critical_servers 
                               if health_status['mcp_servers'].get(server, False))
        
        health_status['critical_servers_connected'] = connected_critical
        health_status['overall_health'] = connected_critical >= 2  # At least 2 critical servers
        
        return health_status
    
    async def shutdown(self):
        """Shutdown MCP AI Agent Integration"""
        logger.info("Shutting down MCP AI Agent Integration...")
        await self.mcp_manager.shutdown()
        logger.info("MCP AI Agent Integration shutdown completed")