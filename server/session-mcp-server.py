#!/usr/bin/env python3
"""
MCP Session Server
Сервер управления сессиями для интеграции с Enhanced Recovery Agent через MCP протокол
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
from aiohttp import web

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import session manager
import importlib.util
spec = importlib.util.spec_from_file_location(
    "session_manager", 
    os.path.join(os.path.dirname(__file__), '..', 'lib', 'session-manager.py')
)
session_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(session_module)
SessionManager = session_module.SessionManager
ContextAwareAgent = session_module.ContextAwareAgent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MCPSessionServer:
    """MCP сервер для управления сессиями AI агента"""
    
    def __init__(self, port: int = 3004, sessions_dir: str = "sessions"):
        self.port = port
        self.session_manager = SessionManager(sessions_dir)
        self.context_agent = ContextAwareAgent(self.session_manager)
        self.app = web.Application()
        self.setup_routes()
        
        # MCP protocol info
        self.protocol_version = "2024-11-05"
        self.server_info = {
            "name": "Session MCP Server",
            "version": "1.0.0",
            "description": "AI Agent Session and Context Management Server"
        }
        
        # Available tools
        self.tools = {
            "create_session": {
                "name": "create_session",
                "description": "Create a new session",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "user_id": {"type": "string", "description": "User identifier"},
                        "initial_context": {"type": "object", "description": "Initial context data"}
                    }
                }
            },
            "get_session": {
                "name": "get_session",
                "description": "Get session information",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "session_id": {"type": "string", "description": "Session ID"}
                    },
                    "required": ["session_id"]
                }
            },
            "add_context": {
                "name": "add_context",
                "description": "Add entry to session context",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "session_id": {"type": "string", "description": "Session ID"},
                        "entry_type": {"type": "string", "description": "Entry type"},
                        "content": {"type": "string", "description": "Entry content"},
                        "metadata": {"type": "object", "description": "Entry metadata"},
                        "importance": {"type": "integer", "minimum": 1, "maximum": 5, "description": "Importance level"}
                    },
                    "required": ["session_id", "entry_type", "content"]
                }
            },
            "get_context": {
                "name": "get_context",
                "description": "Get session context",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "session_id": {"type": "string", "description": "Session ID"},
                        "limit": {"type": "integer", "default": 50, "description": "Maximum entries"}
                    },
                    "required": ["session_id"]
                }
            },
            "search_context": {
                "name": "search_context",
                "description": "Search in session context",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "session_id": {"type": "string", "description": "Session ID (optional)"},
                        "query": {"type": "string", "description": "Search query"},
                        "entry_type": {"type": "string", "description": "Filter by entry type"},
                        "limit": {"type": "integer", "default": 20, "description": "Maximum results"}
                    },
                    "required": ["query"]
                }
            },
            "close_session": {
                "name": "close_session",
                "description": "Close a session",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "session_id": {"type": "string", "description": "Session ID"},
                        "reason": {"type": "string", "default": "manual", "description": "Closure reason"}
                    },
                    "required": ["session_id"]
                }
            },
            "get_session_stats": {
                "name": "get_session_stats",
                "description": "Get session statistics",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            "export_session": {
                "name": "export_session",
                "description": "Export session data",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "session_id": {"type": "string", "description": "Session ID"},
                        "include_context": {"type": "boolean", "default": True, "description": "Include context"}
                    },
                    "required": ["session_id"]
                }
            },
            "restore_session": {
                "name": "restore_session",
                "description": "Restore session from archive",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "session_id": {"type": "string", "description": "Session ID"}
                    },
                    "required": ["session_id"]
                }
            },
            "cleanup_sessions": {
                "name": "cleanup_sessions",
                "description": "Clean up old sessions",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            }
        }
        
        # Available resources
        self.resources = {
            "sessions://active": {
                "uri": "sessions://active",
                "name": "Active Sessions",
                "description": "List of active sessions",
                "mimeType": "application/json"
            },
            "sessions://stats": {
                "uri": "sessions://stats",
                "name": "Session Statistics",
                "description": "Session usage statistics",
                "mimeType": "application/json"
            },
            "sessions://context/{session_id}": {
                "uri": "sessions://context/{session_id}",
                "name": "Session Context",
                "description": "Context for specific session",
                "mimeType": "application/json"
            }
        }
        
        logger.info(f"MCP Session Server initialized on port {port}")
    
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
        self.app.router.add_post('/api/sessions/create', self.api_create_session)
        self.app.router.add_get('/api/sessions/{session_id}', self.api_get_session)
        self.app.router.add_post('/api/sessions/{session_id}/context', self.api_add_context)
        self.app.router.add_get('/api/sessions/{session_id}/context', self.api_get_context)
        self.app.router.add_get('/api/sessions/stats', self.api_get_stats)
    
    async def health_check(self, request):
        """Health check endpoint"""
        stats = await self.session_manager.get_session_stats()
        
        return web.json_response({
            "status": "healthy",
            "server": self.server_info,
            "timestamp": datetime.now().isoformat(),
            "session_stats": stats
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
            if tool_name == "create_session":
                session_id = await self.session_manager.create_session(
                    user_id=arguments.get('user_id'),
                    initial_context=arguments.get('initial_context')
                )
                return {
                    "success": True,
                    "session_id": session_id,
                    "message": f"Session created: {session_id}"
                }
            
            elif tool_name == "get_session":
                session_info = await self.session_manager.get_session(arguments['session_id'])
                if session_info:
                    return {
                        "success": True,
                        "session": session_info.to_dict()
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Session {arguments['session_id']} not found"
                    }
            
            elif tool_name == "add_context":
                entry_id = await self.session_manager.add_context_entry(
                    session_id=arguments['session_id'],
                    entry_type=arguments['entry_type'],
                    content=arguments['content'],
                    metadata=arguments.get('metadata'),
                    importance=arguments.get('importance', 1)
                )
                return {
                    "success": True,
                    "entry_id": entry_id,
                    "message": f"Context entry added: {entry_id}"
                }
            
            elif tool_name == "get_context":
                context_entries = await self.session_manager.get_session_context(
                    session_id=arguments['session_id'],
                    limit=arguments.get('limit', 50)
                )
                return {
                    "success": True,
                    "context": [entry.to_dict() for entry in context_entries],
                    "count": len(context_entries)
                }
            
            elif tool_name == "search_context":
                results = await self.session_manager.search_context(
                    session_id=arguments.get('session_id'),
                    query=arguments['query'],
                    entry_type=arguments.get('entry_type'),
                    limit=arguments.get('limit', 20)
                )
                return {
                    "success": True,
                    "results": [entry.to_dict() for entry in results],
                    "count": len(results)
                }
            
            elif tool_name == "close_session":
                await self.session_manager.close_session(
                    session_id=arguments['session_id'],
                    reason=arguments.get('reason', 'manual')
                )
                return {
                    "success": True,
                    "message": f"Session {arguments['session_id']} closed"
                }
            
            elif tool_name == "get_session_stats":
                stats = await self.session_manager.get_session_stats()
                return {
                    "success": True,
                    "stats": stats
                }
            
            elif tool_name == "export_session":
                export_data = await self.session_manager.export_session(
                    session_id=arguments['session_id'],
                    include_context=arguments.get('include_context', True)
                )
                return {
                    "success": True,
                    "export_data": export_data
                }
            
            elif tool_name == "restore_session":
                success = await self.session_manager.restore_session(arguments['session_id'])
                return {
                    "success": success,
                    "message": f"Session {arguments['session_id']} {'restored' if success else 'not found'}"
                }
            
            elif tool_name == "cleanup_sessions":
                await self.session_manager.cleanup_old_sessions()
                return {
                    "success": True,
                    "message": "Session cleanup completed"
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
            if uri == "sessions://active":
                active_sessions = [
                    session_info.to_dict() 
                    for session_info in self.session_manager.active_sessions.values()
                ]
                return web.json_response({
                    "text": json.dumps({
                        "active_sessions": active_sessions,
                        "count": len(active_sessions)
                    }, ensure_ascii=False, indent=2)
                })
            
            elif uri == "sessions://stats":
                stats = await self.session_manager.get_session_stats()
                return web.json_response({
                    "text": json.dumps(stats, ensure_ascii=False, indent=2)
                })
            
            elif uri.startswith("sessions://context/"):
                session_id = uri.replace("sessions://context/", "")
                context_entries = await self.session_manager.get_session_context(session_id, limit=100)
                return web.json_response({
                    "text": json.dumps({
                        "session_id": session_id,
                        "context": [entry.to_dict() for entry in context_entries],
                        "count": len(context_entries)
                    }, ensure_ascii=False, indent=2)
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
    async def api_create_session(self, request):
        """Direct API for creating session"""
        try:
            data = await request.json()
            
            session_id = await self.session_manager.create_session(
                user_id=data.get('user_id'),
                initial_context=data.get('initial_context')
            )
            
            return web.json_response({
                "success": True,
                "session_id": session_id
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": str(e)
            }, status=500)
    
    async def api_get_session(self, request):
        """Direct API for getting session"""
        try:
            session_id = request.match_info['session_id']
            session_info = await self.session_manager.get_session(session_id)
            
            if session_info:
                return web.json_response({
                    "success": True,
                    "session": session_info.to_dict()
                })
            else:
                return web.json_response({
                    "success": False,
                    "error": "Session not found"
                }, status=404)
                
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": str(e)
            }, status=500)
    
    async def api_add_context(self, request):
        """Direct API for adding context"""
        try:
            session_id = request.match_info['session_id']
            data = await request.json()
            
            entry_id = await self.session_manager.add_context_entry(
                session_id=session_id,
                entry_type=data['entry_type'],
                content=data['content'],
                metadata=data.get('metadata'),
                importance=data.get('importance', 1)
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
    
    async def api_get_context(self, request):
        """Direct API for getting context"""
        try:
            session_id = request.match_info['session_id']
            limit = int(request.query.get('limit', 50))
            
            context_entries = await self.session_manager.get_session_context(session_id, limit)
            
            return web.json_response({
                "success": True,
                "context": [entry.to_dict() for entry in context_entries],
                "count": len(context_entries)
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": str(e)
            }, status=500)
    
    async def api_get_stats(self, request):
        """Direct API for getting stats"""
        try:
            stats = await self.session_manager.get_session_stats()
            
            return web.json_response({
                "success": True,
                "stats": stats
            })
            
        except Exception as e:
            return web.json_response({
                "success": False,
                "error": str(e)
            }, status=500)
    
    async def start_server(self):
        """Start the MCP Session Server"""
        logger.info(f"Starting MCP Session Server on port {self.port}...")
        
        # Start cleanup task
        asyncio.create_task(self.session_manager.start_cleanup_task())
        
        runner = web.AppRunner(self.app)
        await runner.setup()
        
        site = web.TCPSite(runner, 'localhost', self.port)
        await site.start()
        
        logger.info(f"✅ MCP Session Server running on http://localhost:{self.port}")
        logger.info(f"   Health check: http://localhost:{self.port}/health")
        logger.info(f"   MCP Tools: http://localhost:{self.port}/mcp/tools")
        logger.info(f"   Available tools: {list(self.tools.keys())}")
        
        return runner

async def main():
    """Main function to run the MCP Session Server"""
    import argparse
    
    parser = argparse.ArgumentParser(description='MCP Session Server')
    parser.add_argument('--port', type=int, default=3004, help='Server port')
    parser.add_argument('--sessions-dir', default='sessions', help='Sessions directory')
    parser.add_argument('--log-level', default='INFO', help='Log level')
    
    args = parser.parse_args()
    
    # Set log level
    logging.getLogger().setLevel(getattr(logging, args.log_level.upper()))
    
    # Create server
    server = MCPSessionServer(port=args.port, sessions_dir=args.sessions_dir)
    
    # Start server
    runner = await server.start_server()
    
    try:
        # Keep running
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down MCP Session Server...")
    finally:
        await server.session_manager.shutdown()
        await runner.cleanup()

if __name__ == "__main__":
    asyncio.run(main())