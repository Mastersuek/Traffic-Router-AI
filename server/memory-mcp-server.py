#!/usr/bin/env python3
"""
MCP Memory Server
Сервер памяти для интеграции с Enhanced Recovery Agent через MCP протокол
"""

import asyncio
import json
import logging
import sys
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
import aiohttp
from aiohttp import web, ClientSession

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import from the actual filename (with hyphens)
import importlib.util
spec = importlib.util.spec_from_file_location(
    "memory_manager", 
    os.path.join(os.path.dirname(__file__), '..', 'lib', 'memory-manager.py')
)
memory_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(memory_module)
MarkdownMemoryManager = memory_module.MarkdownMemoryManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MCPMemoryServer:
    """MCP сервер для управления памятью AI агента"""
    
    def __init__(self, port: int = 3003, memory_dir: str = "memory"):
        self.port = port
        self.memory_manager = MarkdownMemoryManager(memory_dir)
        self.app = web.Application()
        self.setup_routes()
        
        # MCP protocol info
        self.protocol_version = "2024-11-05"
        self.server_info = {
            "name": "Memory MCP Server",
            "version": "1.0.0",
            "description": "AI Agent Memory Management Server"
        }
        
        # Available tools
        self.tools = {
            "update_memory": {
                "name": "update_memory",
                "description": "Update AI agent memory with new information",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "entity": {"type": "string", "description": "Entity name"},
                        "content": {"type": "string", "description": "Memory content"},
                        "type": {"type": "string", "description": "Memory type", "default": "fact"},
                        "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags"},
                        "metadata": {"type": "object", "description": "Additional metadata"},
                        "importance": {"type": "integer", "minimum": 1, "maximum": 5, "description": "Importance level"}
                    },
                    "required": ["entity", "content"]
                }
            },
            "search_memory": {
                "name": "search_memory",
                "description": "Search in AI agent memory",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "entity": {"type": "string", "description": "Specific entity to search in"},
                        "memory_type": {"type": "string", "description": "Filter by memory type"},
                        "limit": {"type": "integer", "default": 10, "description": "Maximum results"}
                    },
                    "required": ["query"]
                }
            },
            "get_memory_stats": {
                "name": "get_memory_stats",
                "description": "Get memory statistics",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            "get_entity_memory": {
                "name": "get_entity_memory",
                "description": "Get memory for specific entity",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "entity": {"type": "string", "description": "Entity name"},
                        "limit": {"type": "integer", "default": 50, "description": "Maximum entries"}
                    },
                    "required": ["entity"]
                }
            },
            "get_summary": {
                "name": "get_summary",
                "description": "Get memory summary",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "entity": {"type": "string", "description": "Specific entity (optional)"},
                        "limit": {"type": "integer", "default": 20, "description": "Maximum entries in summary"}
                    }
                }
            },
            "cleanup_memory": {
                "name": "cleanup_memory",
                "description": "Clean up old memory entries",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "days": {"type": "integer", "default": 30, "description": "Days to keep"}
                    }
                }
            },
            "export_memory": {
                "name": "export_memory",
                "description": "Export memory data",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "entity": {"type": "string", "description": "Specific entity (optional)"},
                        "format": {"type": "string", "enum": ["json", "yaml"], "default": "json"}
                    }
                }
            }
        }
        
        # Available resources
        self.resources = {
            "memory://entities": {
                "uri": "memory://entities",
                "name": "Memory Entities",
                "description": "List of all memory entities",
                "mimeType": "application/json"
            },
            "memory://stats": {
                "uri": "memory://stats",
                "name": "Memory Statistics",
                "description": "Memory usage statistics",
                "mimeType": "application/json"
            },
            "memory://summary": {
                "uri": "memory://summary",
                "name": "Memory Summary",
                "description": "Memory summary in markdown format",
                "mimeType": "text/markdown"
            }
        }
        
        logger.info(f"MCP Memory Server initialized on port {port}")
    
    def setup_routes(self):
        """Настройка маршрутов HTTP сервера"""
        # Health check
        self.app.router.add_get('/health', self.health_check)
        
        # MCP protocol endpoints
        self.app.router.add_post('/mcp/initialize', self.mcp_initialize)
        self.app.router.add_get('/mcp/tools', self.mcp_get_tools)
        self.app.router.add_post('/mcp/tools/call', self.mcp_call_tool)
        self.app.router.add_get('/mcp/resources', self.mcp_get_resources)
        self.app.router.add_get('/mcp/resources/{uri:.*}', self.mcp_get_resource)
        
        # Direct API endpoints (for testing)
        self.app.router.add_post('/api/memory/update', self.api_update_memory)
        self.app.router.add_get('/api/memory/search', self.api_search_memory)
        self.app.router.add_get('/api/memory/stats', self.api_get_stats)
    
    async def health_check(self, request):
        """Health check endpoint"""
        return web.json_response({
            "status": "healthy",
            "server": self.server_info,
            "timestamp": datetime.now().isoformat(),
            "memory_stats": {
                "entities": len(self.memory_manager.memory_index),
                "total_entries": sum(len(entries) for entries in self.memory_manager.memory_index.values())
            }
        })
    
    async def mcp_initialize(self, request):
        """MCP protocol initialization"""
        try:
            data = await request.json()
            
            client_info = data.get('clientInfo', {})
            protocol_version = data.get('protocolVersion', '')
            
            logger.info(f"MCP client connected: {client_info.get('name', 'Unknown')} v{client_info.get('version', 'Unknown')}")
            
            return web.json_response({
                "protocolVersion": self.protocol_version,
                "serverInfo": self.server_info,
                "capabilities": {
                    "tools": True,
                    "resources": True,
                    "prompts": False,
                    "logging": True
                }
            })
            
        except Exception as e:
            logger.error(f"MCP initialization error: {e}")
            return web.json_response({"error": str(e)}, status=400)
    
    async def mcp_get_tools(self, request):
        """Get available MCP tools"""
        return web.json_response({
            "tools": list(self.tools.values())
        })
    
    async def mcp_call_tool(self, request):
        """Call MCP tool"""
        try:
            data = await request.json()
            tool_name = data.get('name')
            arguments = data.get('arguments', {})
            
            if tool_name not in self.tools:
                return web.json_response({
                    "error": f"Unknown tool: {tool_name}"
                }, status=400)
            
            # Execute tool
            result = await self._execute_tool(tool_name, arguments)
            
            return web.json_response({
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result, ensure_ascii=False, indent=2)
                    }
                ]
            })
            
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return web.json_response({
                "error": str(e)
            }, status=500)
    
    async def _execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute specific tool"""
        try:
            if tool_name == "update_memory":
                entry_id = await self.memory_manager.update_memory(
                    entity=arguments['entity'],
                    content=arguments['content'],
                    memory_type=arguments.get('type', 'fact'),
                    tags=arguments.get('tags'),
                    metadata=arguments.get('metadata'),
                    importance=arguments.get('importance')
                )
                return {
                    "success": True,
                    "entry_id": entry_id,
                    "message": f"Memory updated for entity {arguments['entity']}"
                }
            
            elif tool_name == "search_memory":
                results = await self.memory_manager.search_memory(
                    query=arguments['query'],
                    entity=arguments.get('entity'),
                    memory_type=arguments.get('memory_type'),
                    limit=arguments.get('limit', 10)
                )
                return {
                    "success": True,
                    "results": results,
                    "count": len(results)
                }
            
            elif tool_name == "get_memory_stats":
                stats = await self.memory_manager.get_memory_stats()
                return {
                    "success": True,
                    "stats": {
                        "total_entries": stats.total_entries,
                        "entities_count": stats.entities_count,
                        "memory_types": stats.memory_types,
                        "storage_size_mb": stats.storage_size_mb,
                        "last_updated": stats.last_updated.isoformat()
                    }
                }
            
            elif tool_name == "get_entity_memory":
                memory = await self.memory_manager.get_entity_memory(
                    entity=arguments['entity'],
                    limit=arguments.get('limit', 50)
                )
                return {
                    "success": True,
                    "entity": arguments['entity'],
                    "memory": memory,
                    "count": len(memory)
                }
            
            elif tool_name == "get_summary":
                summary = await self.memory_manager.get_memory_summary(
                    entity=arguments.get('entity')
                )
                return {
                    "success": True,
                    "summary": summary
                }
            
            elif tool_name == "cleanup_memory":
                await self.memory_manager.cleanup_old_memories(
                    days=arguments.get('days', 30)
                )
                return {
                    "success": True,
                    "message": f"Memory cleanup completed for entries older than {arguments.get('days', 30)} days"
                }
            
            elif tool_name == "export_memory":
                export_data = await self.memory_manager.export_memory(
                    entity=arguments.get('entity'),
                    format=arguments.get('format', 'json')
                )
                return {
                    "success": True,
                    "data": export_data,
                    "format": arguments.get('format', 'json')
                }
            
            else:
                return {
                    "success": False,
                    "error": f"Unknown tool: {tool_name}"
                }
                
        except Exception as e:
            logger.error(f"Tool execution failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def mcp_get_resources(self, request):
        """Get available MCP resources"""
        return web.json_response({
            "resources": list(self.resources.values())
        })
    
    async def mcp_get_resource(self, request):
        """Get specific MCP resource"""
        uri = request.match_info['uri']
        
        try:
            if uri == "memory://entities":
                entities = list(self.memory_manager.memory_index.keys())
                return web.json_response({
                    "text": json.dumps({
                        "entities": entities,
                        "count": len(entities)
                    }, ensure_ascii=False, indent=2)
                })
            
            elif uri == "memory://stats":
                stats = await self.memory_manager.get_memory_stats()
                return web.json_response({
                    "text": json.dumps({
                        "total_entries": stats.total_entries,
                        "entities_count": stats.entities_count,
                        "memory_types": stats.memory_types,
                        "storage_size_mb": stats.storage_size_mb,
                        "last_updated": stats.last_updated.isoformat()
                    }, ensure_ascii=False, indent=2)
                })
            
            elif uri == "memory://summary":
                summary = await self.memory_manager.get_memory_summary()
                return web.json_response({
                    "text": summary
                })
            
            else:
                return web.json_response({
                    "error": f"Resource not found: {uri}"
                }, status=404)
                
        except Exception as e:
            logger.error(f"Resource access error: {e}")
            return web.json_response({
                "error": str(e)
            }, status=500)
    
    # Direct API endpoints for testing
    async def api_update_memory(self, request):
        """Direct API for updating memory"""
        try:
            data = await request.json()
            
            entry_id = await self.memory_manager.update_memory(
                entity=data['entity'],
                content=data['content'],
                memory_type=data.get('type', 'fact'),
                tags=data.get('tags'),
                metadata=data.get('metadata'),
                importance=data.get('importance')
            )
            
            return web.json_response({
                "success": True,
                "entry_id": entry_id
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": str(e)
            }, status=500)
    
    async def api_search_memory(self, request):
        """Direct API for searching memory"""
        try:
            query = request.query.get('q', '')
            entity = request.query.get('entity')
            memory_type = request.query.get('type')
            limit = int(request.query.get('limit', 10))
            
            results = await self.memory_manager.search_memory(
                query=query,
                entity=entity,
                memory_type=memory_type,
                limit=limit
            )
            
            return web.json_response({
                "success": True,
                "results": results,
                "count": len(results)
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": str(e)
            }, status=500)
    
    async def api_get_stats(self, request):
        """Direct API for getting memory stats"""
        try:
            stats = await self.memory_manager.get_memory_stats()
            
            return web.json_response({
                "success": True,
                "stats": {
                    "total_entries": stats.total_entries,
                    "entities_count": stats.entities_count,
                    "memory_types": stats.memory_types,
                    "storage_size_mb": stats.storage_size_mb,
                    "last_updated": stats.last_updated.isoformat()
                }
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": str(e)
            }, status=500)
    
    async def start_server(self):
        """Start the MCP Memory Server"""
        logger.info(f"Starting MCP Memory Server on port {self.port}...")
        
        runner = web.AppRunner(self.app)
        await runner.setup()
        
        site = web.TCPSite(runner, 'localhost', self.port)
        await site.start()
        
        logger.info(f"✅ MCP Memory Server running on http://localhost:{self.port}")
        logger.info(f"   Health check: http://localhost:{self.port}/health")
        logger.info(f"   MCP Tools: http://localhost:{self.port}/mcp/tools")
        logger.info(f"   Available tools: {list(self.tools.keys())}")
        
        return runner

async def main():
    """Main function to run the MCP Memory Server"""
    import argparse
    
    parser = argparse.ArgumentParser(description='MCP Memory Server')
    parser.add_argument('--port', type=int, default=3003, help='Server port')
    parser.add_argument('--memory-dir', default='memory', help='Memory directory')
    parser.add_argument('--log-level', default='INFO', help='Log level')
    
    args = parser.parse_args()
    
    # Set log level
    logging.getLogger().setLevel(getattr(logging, args.log_level.upper()))
    
    # Create server
    server = MCPMemoryServer(port=args.port, memory_dir=args.memory_dir)
    
    # Start server
    runner = await server.start_server()
    
    try:
        # Keep running
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down MCP Memory Server...")
    finally:
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())