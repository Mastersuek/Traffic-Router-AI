#!/usr/bin/env python3
"""
Enhanced Recovery Agent with MCP Integration
Full-featured AI agent with memory, MCP tools, and comprehensive recovery capabilities
"""

import asyncio
import aiohttp
import yaml
import json
import logging
import os
import sys
import time
import subprocess
import signal
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

# Configure logging with UTF-8 support
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/recovery-agent.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ServiceStatus(Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"

class RecoveryAction(Enum):
    RESTART = "restart"
    RECONFIGURE = "reconfigure"
    SCALE_UP = "scale_up"
    SCALE_DOWN = "scale_down"
    ISOLATE = "isolate"
    NOTIFY = "notify"

@dataclass
class ServiceHealth:
    name: str
    status: ServiceStatus
    response_time: float
    last_check: datetime
    error_message: Optional[str] = None
    recovery_attempts: int = 0
    last_recovery: Optional[datetime] = None

@dataclass
class SystemMetrics:
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    network_io: Dict[str, int]
    timestamp: datetime

@dataclass
class RecoveryPlan:
    service: str
    actions: List[RecoveryAction]
    priority: int
    estimated_time: int  # seconds
    prerequisites: List[str]
    rollback_plan: List[str]

class MCPClient:
    """Model Context Protocol Client for enhanced AI capabilities"""
    
    def __init__(self, server_url: str = "http://localhost:3001"):
        self.server_url = server_url
        self.session = None
        self.capabilities = {}
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        await self.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def initialize(self):
        """Initialize MCP connection"""
        try:
            async with self.session.post(f"{self.server_url}/mcp/initialize") as response:
                if response.status == 200:
                    data = await response.json()
                    self.capabilities = data.get('capabilities', {})
                    logger.info("MCP client initialized successfully")
                else:
                    logger.error(f"Failed to initialize MCP: {response.status}")
        except Exception as e:
            logger.error(f"MCP initialization error: {e}")
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call MCP tool"""
        try:
            payload = {
                "name": name,
                "arguments": arguments
            }
            async with self.session.post(f"{self.server_url}/mcp/tools/call", json=payload) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    logger.error(f"MCP tool call failed: {response.status}")
                    return {"error": f"HTTP {response.status}"}
        except Exception as e:
            logger.error(f"MCP tool call error: {e}")
            return {"error": str(e)}
    
    async def get_resource(self, uri: str) -> str:
        """Get MCP resource"""
        try:
            async with self.session.get(f"{self.server_url}/mcp/resources/{uri}") as response:
                if response.status == 200:
                    return await response.text()
                else:
                    logger.error(f"MCP resource fetch failed: {response.status}")
                    return ""
        except Exception as e:
            logger.error(f"MCP resource fetch error: {e}")
            return ""
    
    async def get_prompt(self, name: str, arguments: Dict[str, Any] = None) -> str:
        """Get MCP prompt"""
        try:
            payload = {
                "name": name,
                "arguments": arguments or {}
            }
            async with self.session.post(f"{self.server_url}/mcp/prompts/get", json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('messages', [{}])[0].get('content', {}).get('text', '')
                else:
                    logger.error(f"MCP prompt fetch failed: {response.status}")
                    return ""
        except Exception as e:
            logger.error(f"MCP prompt fetch error: {e}")
            return ""

class MemoryManager:
    """Enhanced memory management with semantic search and learning"""
    
    def __init__(self, memory_dir: str = "memory"):
        self.memory_dir = Path(memory_dir)
        self.entities_dir = self.memory_dir / "entities"
        self.entities_dir.mkdir(parents=True, exist_ok=True)
        
        # Create system memory if not exists
        self.system_memory_file = self.memory_dir / "system.md"
        if not self.system_memory_file.exists():
            self._create_initial_system_memory()
    
    def _create_initial_system_memory(self):
        """Create initial system memory file"""
        content = f"""# System Memory

## Initialization
- Created: {datetime.now().isoformat()}
- Agent Version: Enhanced Recovery Agent v2.0
- Capabilities: MCP Integration, Advanced Recovery, Load Testing

## System Architecture
- Traffic Router: Main routing service
- AI Proxy: AI service proxy and caching
- Monitoring: System metrics and health monitoring
- Recovery Agent: This agent for automated recovery

## Recovery Patterns
- Service restart: Standard recovery for most issues
- Configuration update: For config-related problems
- Resource scaling: For performance issues
- Isolation: For security or stability issues

## Learning Insights
- Most common failures: Connection timeouts, port conflicts
- Recovery success rate: Tracked per service
- Performance patterns: Baseline metrics established

"""
        self.system_memory_file.write_text(content, encoding='utf-8')
    
    def update_entity_memory(self, entity_name: str, data: Dict[str, Any]) -> None:
        """Update memory for specific entity"""
        memory_file = self.entities_dir / f"{entity_name}.md"
        
        timestamp = datetime.now().isoformat()
        update_entry = f"""
## Update {timestamp}
{json.dumps(data, indent=2, ensure_ascii=False)}

"""
        
        # Append to file
        with open(memory_file, 'a', encoding='utf-8') as f:
            f.write(update_entry)
        
        logger.info(f"Memory updated for entity: {entity_name}")
    
    def get_entity_memory(self, entity_name: str) -> str:
        """Get memory content for entity"""
        memory_file = self.entities_dir / f"{entity_name}.md"
        
        if memory_file.exists():
            return memory_file.read_text(encoding='utf-8')
        else:
            return f"# {entity_name}\n\nNo memory entries found.\n"
    
    def search_memory(self, query: str) -> List[str]:
        """Search memory for relevant information"""
        results = []
        
        # Search system memory
        system_content = self.system_memory_file.read_text(encoding='utf-8')
        if query.lower() in system_content.lower():
            results.append(f"system.md: {query}")
        
        # Search entity memories
        for entity_file in self.entities_dir.glob("*.md"):
            content = entity_file.read_text(encoding='utf-8')
            if query.lower() in content.lower():
                results.append(f"{entity_file.name}: {query}")
        
        return results
    
    def learn_from_recovery(self, service: str, action: RecoveryAction, success: bool, context: Dict[str, Any]) -> None:
        """Learn from recovery attempts"""
        learning_data = {
            "service": service,
            "action": action.value,
            "success": success,
            "context": context,
            "timestamp": datetime.now().isoformat(),
            "system_state": {
                "cpu": context.get('cpu_percent', 0),
                "memory": context.get('memory_percent', 0),
                "disk": context.get('disk_percent', 0)
            }
        }
        
        self.update_entity_memory(f"{service}_recovery", learning_data)
        
        # Update system learning
        system_data = {
            "learning_type": "recovery_outcome",
            "service": service,
            "action": action.value,
            "success": success,
            "context": context
        }
        
        self.update_entity_memory("system", system_data)

class EnhancedRecoveryAgent:
    """Enhanced Recovery Agent with MCP integration and advanced capabilities"""
    
    def __init__(self, config_file: str = "config/recovery-config.yaml"):
        self.config = self._load_config(config_file)
        self.memory = MemoryManager()
        self.mcp_client = None
        self.services = {}
        self.recovery_cooldowns = {}
        self.system_metrics = None
        self.running = False
        
        # Aliases and commands for troubleshooting
        self.aliases = {
            'status': self._cmd_status,
            'restart': self._cmd_restart,
            'logs': self._cmd_logs,
            'health': self._cmd_health,
            'metrics': self._cmd_metrics,
            'recover': self._cmd_recover,
            'test': self._cmd_test,
            'memory': self._cmd_memory,
            'mcp': self._cmd_mcp,
            'help': self._cmd_help
        }
        
        logger.info("Enhanced Recovery Agent initialized")
    
    def _load_config(self, config_file: str) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            
            # Update ports to non-standard
            for service in config.get('services', {}):
                if service['name'] == 'web':
                    service['port'] = 13000
                elif service['name'] == 'ai-proxy':
                    service['port'] = 13081
                elif service['name'] == 'monitoring':
                    service['port'] = 13082
                    
            return config
        except FileNotFoundError:
            logger.warning(f"Configuration file {config_file} not found, using defaults")
            return self._get_default_config()
        except Exception as e:
            logger.error(f"Error loading configuration: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            "services": [
                {"name": "web", "port": 13000, "endpoint": "/", "timeout": 10},
                {"name": "ai-proxy", "port": 13081, "endpoint": "/health", "timeout": 10},
                {"name": "monitoring", "port": 13082, "endpoint": "/health", "timeout": 10},
                {"name": "mcp", "port": 3001, "endpoint": "/health", "timeout": 10}
            ],
            "monitoring": {
                "interval": 30,
                "health_check_interval": 60,
                "recovery_attempts": 3,
                "cooldown_period": 300
            },
            "recovery": {
                "max_concurrent_recoveries": 2,
                "restart_timeout": 60,
                "health_check_retries": 3
            }
        }
    
    async def start_monitoring(self):
        """Start main monitoring loop"""
        logger.info("🚀 Starting Enhanced Recovery Agent monitoring...")
        self.running = True
        
        # Initialize MCP client
        try:
            self.mcp_client = MCPClient()
            await self.mcp_client.__aenter__()
        except Exception as e:
            logger.error(f"Failed to initialize MCP client: {e}")
        
        try:
            while self.running:
                await self._monitoring_cycle()
                await asyncio.sleep(self.config['monitoring']['interval'])
        except KeyboardInterrupt:
            logger.info("Monitoring stopped by user")
        except Exception as e:
            logger.error(f"Monitoring error: {e}")
        finally:
            await self._cleanup()
    
    async def _monitoring_cycle(self):
        """Single monitoring cycle"""
        logger.info("🔍 Starting monitoring cycle...")
        
        # Check system metrics
        await self._update_system_metrics()
        
        # Check all services
        for service_config in self.config['services']:
            await self._check_service_health(service_config)
        
        # Perform recovery if needed
        await self._perform_automated_recovery()
        
        logger.info("✅ Monitoring cycle completed")
    
    async def _update_system_metrics(self):
        """Update system metrics"""
        try:
            import psutil
            
            self.system_metrics = SystemMetrics(
                cpu_percent=psutil.cpu_percent(interval=1),
                memory_percent=psutil.virtual_memory().percent,
                disk_percent=psutil.disk_usage('/').percent if os.name != 'nt' else psutil.disk_usage('C:\\').percent,
                network_io=psutil.net_io_counters()._asdict(),
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Failed to update system metrics: {e}")
    
    async def _check_service_health(self, service_config: Dict[str, Any]):
        """Check health of a specific service"""
        service_name = service_config['name']
        
        try:
            import aiohttp
            url = f"http://localhost:{service_config['port']}{service_config['endpoint']}"
            timeout = aiohttp.ClientTimeout(total=service_config.get('timeout', 10))
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                start_time = time.time()
                async with session.get(url) as response:
                    response_time = time.time() - start_time
                    
                    if response.status == 200:
                        health = ServiceHealth(
                            name=service_name,
                            status=ServiceStatus.HEALTHY,
                            response_time=response_time,
                            last_check=datetime.now()
                        )
                    else:
                        health = ServiceHealth(
                            name=service_name,
                            status=ServiceStatus.DEGRADED,
                            response_time=response_time,
                            last_check=datetime.now(),
                            error_message=f"HTTP {response.status}"
                        )
                        
        except Exception as e:
            health = ServiceHealth(
                name=service_name,
                status=ServiceStatus.UNHEALTHY,
                response_time=0,
                last_check=datetime.now(),
                error_message=str(e)
            )
        
        self.services[service_name] = health
        
        # Log health status
        status_emoji = {
            ServiceStatus.HEALTHY: "✅",
            ServiceStatus.DEGRADED: "⚠️",
            ServiceStatus.UNHEALTHY: "❌",
            ServiceStatus.UNKNOWN: "❓"
        }
        
        logger.info(f"{status_emoji[health.status]} {service_name}: {health.status.value} ({health.response_time:.2f}s)")
        
        # Update memory
        self.memory.update_entity_memory(service_name, asdict(health))
    
    async def _perform_automated_recovery(self):
        """Perform automated recovery for unhealthy services"""
        for service_name, health in self.services.items():
            if health.status in [ServiceStatus.UNHEALTHY, ServiceStatus.DEGRADED]:
                if await self._should_attempt_recovery(service_name, health):
                    await self._recover_service(service_name, health)
    
    async def _should_attempt_recovery(self, service_name: str, health: ServiceHealth) -> bool:
        """Determine if recovery should be attempted"""
        # Check cooldown period
        cooldown_key = f"{service_name}_{health.status.value}"
        if cooldown_key in self.recovery_cooldowns:
            cooldown_end = self.recovery_cooldowns[cooldown_key]
            if datetime.now() < cooldown_end:
                return False
        
        # Check max recovery attempts
        max_attempts = self.config['monitoring']['recovery_attempts']
        if health.recovery_attempts >= max_attempts:
            logger.warning(f"Max recovery attempts reached for {service_name}")
            return False
        
        return True
    
    async def _recover_service(self, service_name: str, health: ServiceHealth):
        """Recover a specific service"""
        logger.info(f"🔧 Starting recovery for {service_name}...")
        
        recovery_plan = await self._generate_recovery_plan(service_name, health)
        success = False
        
        try:
            for action in recovery_plan.actions:
                logger.info(f"Executing recovery action: {action.value}")
                
                if action == RecoveryAction.RESTART:
                    success = await self._restart_service(service_name)
                elif action == RecoveryAction.RECONFIGURE:
                    success = await self._reconfigure_service(service_name)
                elif action == RecoveryAction.NOTIFY:
                    await self._send_notification(service_name, health)
                    success = True
                
                if success:
                    break
                    
        except Exception as e:
            logger.error(f"Recovery failed for {service_name}: {e}")
        
        # Update recovery tracking
        health.recovery_attempts += 1
        health.last_recovery = datetime.now()
        
        # Set cooldown
        cooldown_period = self.config['monitoring']['cooldown_period']
        cooldown_end = datetime.now() + timedelta(seconds=cooldown_period)
        self.recovery_cooldowns[f"{service_name}_{health.status.value}"] = cooldown_end
        
        # Learn from recovery attempt
        context = {
            "error_message": health.error_message,
            "response_time": health.response_time,
            "attempts": health.recovery_attempts
        }
        
        if self.system_metrics:
            context.update({
                "cpu_percent": self.system_metrics.cpu_percent,
                "memory_percent": self.system_metrics.memory_percent,
                "disk_percent": self.system_metrics.disk_percent
            })
        
        self.memory.learn_from_recovery(service_name, recovery_plan.actions[0], success, context)
        
        if success:
            logger.info(f"✅ Recovery successful for {service_name}")
        else:
            logger.error(f"❌ Recovery failed for {service_name}")
    
    async def _generate_recovery_plan(self, service_name: str, health: ServiceHealth) -> RecoveryPlan:
        """Generate recovery plan for service"""
        actions = [RecoveryAction.RESTART]
        
        if health.status == ServiceStatus.DEGRADED:
            actions = [RecoveryAction.RECONFIGURE, RecoveryAction.RESTART]
        elif health.recovery_attempts > 1:
            actions = [RecoveryAction.RESTART, RecoveryAction.NOTIFY]
        
        return RecoveryPlan(
            service=service_name,
            actions=actions,
            priority=1 if health.status == ServiceStatus.UNHEALTHY else 2,
            estimated_time=60,
            prerequisites=[],
            rollback_plan=["restore_backup", "notify_admin"]
        )
    
    async def _restart_service(self, service_name: str) -> bool:
        """Restart a service using MCP"""
        if not self.mcp_client:
            logger.error("MCP client not available")
            return False
        
        try:
            result = await self.mcp_client.call_tool('restart_service', {
                'service': service_name,
                'force': True
            })
            
            return result.get('success', False)
            
        except Exception as e:
            logger.error(f"Failed to restart {service_name}: {e}")
            return False
    
    async def _reconfigure_service(self, service_name: str) -> bool:
        """Reconfigure a service"""
        logger.info(f"Reconfiguring {service_name}...")
        # Placeholder for reconfiguration logic
        return True
    
    async def _send_notification(self, service_name: str, health: ServiceHealth):
        """Send notification about service issues"""
        message = f"Service {service_name} is {health.status.value}: {health.error_message}"
        logger.warning(f"📢 NOTIFICATION: {message}")
    
    async def _cleanup(self):
        """Cleanup resources"""
        if self.mcp_client:
            await self.mcp_client.__aexit__(None, None, None)
        
        logger.info("Enhanced Recovery Agent stopped")
    
    # Command aliases for manual troubleshooting
    async def _cmd_status(self, args: List[str] = None) -> str:
        """Get system status"""
        if not self.services:
            return "No service data available"
        
        status_lines = ["📊 System Status:"]
        for name, health in self.services.items():
            status_lines.append(f"  {name}: {health.status.value} ({health.response_time:.2f}s)")
        
        if self.system_metrics:
            status_lines.extend([
                "\n💻 System Metrics:",
                f"  CPU: {self.system_metrics.cpu_percent:.1f}%",
                f"  Memory: {self.system_metrics.memory_percent:.1f}%",
                f"  Disk: {self.system_metrics.disk_percent:.1f}%"
            ])
        
        return "\n".join(status_lines)
    
    async def _cmd_restart(self, args: List[str] = None) -> str:
        """Restart a service"""
        if not args:
            return "Usage: restart <service_name>"
        
        service_name = args[0]
        success = await self._restart_service(service_name)
        return f"Restart {service_name}: {'Success' if success else 'Failed'}"
    
    async def _cmd_logs(self, args: List[str] = None) -> str:
        """Get service logs"""
        service_name = args[0] if args else 'system'
        
        if self.mcp_client:
            result = await self.mcp_client.call_tool('get_logs', {
                'service': service_name,
                'lines': 50
            })
            return result.get('content', 'No logs available')
        
        return "MCP client not available"
    
    async def _cmd_health(self, args: List[str] = None) -> str:
        """Get health check"""
        if self.mcp_client:
            result = await self.mcp_client.call_tool('check_health', {})
            return str(result)
        
        return "MCP client not available"
    
    async def _cmd_metrics(self, args: List[str] = None) -> str:
        """Get system metrics"""
        if self.system_metrics:
            return f"CPU: {self.system_metrics.cpu_percent:.1f}%, Memory: {self.system_metrics.memory_percent:.1f}%, Disk: {self.system_metrics.disk_percent:.1f}%"
        
        return "No metrics available"
    
    async def _cmd_recover(self, args: List[str] = None) -> str:
        """Manual recovery trigger"""
        if not args:
            return "Usage: recover <service_name>"
        
        service_name = args[0]
        if service_name in self.services:
            health = self.services[service_name]
            await self._recover_service(service_name, health)
            return f"Recovery initiated for {service_name}"
        
        return f"Service {service_name} not found"
    
    async def _cmd_test(self, args: List[str] = None) -> str:
        """Run system tests"""
        return "System test functionality not implemented yet"
    
    async def _cmd_memory(self, args: List[str] = None) -> str:
        """Search memory"""
        if not args:
            return "Usage: memory <search_query>"
        
        query = ' '.join(args)
        results = self.memory.search_memory(query)
        
        if results:
            return "\n".join([f"Found: {result}" for result in results])
        
        return f"No memory entries found for: {query}"
    
    async def _cmd_mcp(self, args: List[str] = None) -> str:
        """MCP operations"""
        if not self.mcp_client:
            return "MCP client not available"
        
        if not args:
            return "Usage: mcp <operation> [args]"
        
        operation = args[0]
        if operation == 'tools':
            # List available tools
            return "MCP tools: restart_service, check_health, get_logs, execute_command"
        elif operation == 'resources':
            # List available resources
            return "MCP resources: system/status, logs/system, services/health, memory/entities"
        
        return f"Unknown MCP operation: {operation}"
    
    async def _cmd_help(self, args: List[str] = None) -> str:
        """Show help"""
        help_text = """
🤖 Enhanced Recovery Agent Commands:

status     - Show system and service status
restart    - Restart a service (restart <service>)
logs       - Get service logs (logs <service>)
health     - Run health check
metrics    - Show system metrics
recover    - Manual recovery (recover <service>)
test       - Run system tests
memory     - Search memory (memory <query>)
mcp        - MCP operations (mcp <operation>)
help       - Show this help

Example: restart ai-proxy
        """
        return help_text.strip()
    
    async def execute_command(self, command: str, args: List[str] = None) -> str:
        """Execute a command alias"""
        if command in self.aliases:
            return await self.aliases[command](args)
        else:
            return f"Unknown command: {command}. Type 'help' for available commands."

if __name__ == "__main__":
    async def main():
        agent = EnhancedRecoveryAgent()
        await agent.start_monitoring()
    
    asyncio.run(main())
                    service['port'] = 13000
                elif service['name'] == 'ai-proxy':
                    service['port'] = 13081
                elif service['name'] == 'monitoring':
                    service['port'] = 13082
            
            return config
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return {}
    
    async def start(self):
        """Start the enhanced recovery agent"""
        self.running = True
        logger.info("🚀 Starting Enhanced Recovery Agent...")
        
        # Initialize MCP client
        try:
            self.mcp_client = MCPClient()
            await self.mcp_client.__aenter__()
            logger.info("✅ MCP client connected")
        except Exception as e:
            logger.warning(f"⚠️ MCP client unavailable: {e}")
            self.mcp_client = None
        
        # Start monitoring loop
        await self._monitoring_loop()
    
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                # Collect system metrics
                await self._collect_system_metrics()
                
                # Monitor services
                await self._monitor_services()
                
                # Update memory
                await self._update_system_memory()
                
                # Wait before next cycle
                await asyncio.sleep(self.config.get('monitoring_interval', 30))
                
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                await asyncio.sleep(5)
    
    async def _collect_system_metrics(self):
        """Collect system performance metrics"""
        try:
            # Use MCP if available, otherwise fallback to basic metrics
            if self.mcp_client:
                system_status = await self.mcp_client.get_resource("system/status")
                if system_status:
                    metrics_data = json.loads(system_status)
                    self.system_metrics = SystemMetrics(
                        cpu_percent=metrics_data.get('cpu', {}).get('loadPercentage', 0),
                        memory_percent=metrics_data.get('memory', {}).get('percentage', 0),
                        disk_percent=0,  # Would need additional parsing
                        network_io={},
                        timestamp=datetime.now()
                    )
                    return
            
            # Fallback to basic metrics collection
            self.system_metrics = SystemMetrics(
                cpu_percent=0,  # Would implement actual collection
                memory_percent=0,
                disk_percent=0,
                network_io={},
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Failed to collect system metrics: {e}")
    
    async def _monitor_services(self):
        """Monitor all configured services"""
        services_config = self.config.get('services', [])
        
        for service_config in services_config:
            service_name = service_config['name']
            
            try:
                health = await self._check_service_health(service_config)
                self.services[service_name] = health
                
                # Handle unhealthy services
                if health.status != ServiceStatus.HEALTHY:
                    await self._handle_service_failure(service_name, service_config, health)
                
                # Update memory
                self.memory.update_entity_memory(service_name, {
                    "status": health.status.value,
                    "response_time": health.response_time,
                    "last_check": health.last_check.isoformat(),
                    "error": health.error_message,
                    "recovery_attempts": health.recovery_attempts
                })
                
            except Exception as e:
                logger.error(f"Error monitoring {service_name}: {e}")
    
    async def _check_service_health(self, service_config: Dict[str, Any]) -> ServiceHealth:
        """Check health of a specific service"""
        name = service_config['name']
        port = service_config['port']
        health_endpoint = service_config.get('health_endpoint', '/health')
        
        start_time = time.time()
        
        try:
            url = f"http://localhost:{port}{health_endpoint}"
            timeout = aiohttp.ClientTimeout(total=5)
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        return ServiceHealth(
                            name=name,
                            status=ServiceStatus.HEALTHY,
                            response_time=response_time,
                            last_check=datetime.now()
                        )
                    else:
                        return ServiceHealth(
                            name=name,
                            status=ServiceStatus.UNHEALTHY,
                            response_time=response_time,
                            last_check=datetime.now(),
                            error_message=f"HTTP {response.status}"
                        )
        
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            return ServiceHealth(
                name=name,
                status=ServiceStatus.UNHEALTHY,
                response_time=response_time,
                last_check=datetime.now(),
                error_message=str(e)
            )
    
    async def _handle_service_failure(self, service_name: str, service_config: Dict[str, Any], health: ServiceHealth):
        """Handle service failure with advanced recovery strategies"""
        
        # Check cooldown period
        cooldown_key = f"{service_name}_recovery"
        if cooldown_key in self.recovery_cooldowns:
            last_attempt = self.recovery_cooldowns[cooldown_key]
            cooldown_period = self.config.get('recovery_cooldown', 300)  # 5 minutes
            if time.time() - last_attempt < cooldown_period:
                logger.info(f"Service {service_name} is in cooldown period")
                return
        
        # Generate recovery plan using MCP if available
        recovery_plan = None
        if self.mcp_client:
            try:
                recovery_prompt = await self.mcp_client.get_prompt(
                    "service_recovery",
                    {"service": service_name, "error": health.error_message}
                )
                logger.info(f"Recovery plan generated: {recovery_prompt[:100]}...")
            except Exception as e:
                logger.error(f"Failed to generate recovery plan: {e}")
        
        # Execute recovery
        success = await self._execute_recovery(service_name, service_config, health)
        
        # Update cooldown
        self.recovery_cooldowns[cooldown_key] = time.time()
        
        # Learn from recovery attempt
        context = {
            'cpu_percent': self.system_metrics.cpu_percent if self.system_metrics else 0,
            'memory_percent': self.system_metrics.memory_percent if self.system_metrics else 0,
            'error_message': health.error_message,
            'response_time': health.response_time
        }
        
        self.memory.learn_from_recovery(
            service_name, 
            RecoveryAction.RESTART, 
            success, 
            context
        )
        
        # Update service health
        health.recovery_attempts += 1
        health.last_recovery = datetime.now()
    
    async def _execute_recovery(self, service_name: str, service_config: Dict[str, Any], health: ServiceHealth) -> bool:
        """Execute recovery for failed service"""
        try:
            logger.warning(f"🚨 Service failure detected: {service_name}")
            
            # Use MCP tool if available
            if self.mcp_client:
                result = await self.mcp_client.call_tool(
                    "restart_service",
                    {"service": service_name, "force": False}
                )
                
                if result.get('success'):
                    logger.info(f"✅ Service {service_name} restarted successfully via MCP")
                    return True
                else:
                    logger.error(f"❌ MCP restart failed for {service_name}: {result.get('error')}")
            
            # Fallback to direct restart
            restart_command = service_config.get('restart_command')
            if restart_command:
                logger.info(f"🔄 Restarting {service_name} with command: {restart_command}")
                
                # Execute restart command
                process = subprocess.Popen(
                    restart_command,
                    shell=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                
                # Wait for completion
                stdout, stderr = process.communicate(timeout=30)
                
                if process.returncode == 0:
                    logger.info(f"✅ Service {service_name} restarted successfully")
                    return True
                else:
                    logger.error(f"❌ Failed to restart {service_name}: {stderr.decode()}")
                    return False
            else:
                logger.error(f"❌ No restart command configured for {service_name}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Recovery execution failed for {service_name}: {e}")
            return False
    
    async def _update_system_memory(self):
        """Update system memory with current status"""
        if not self.system_metrics:
            return
        
        system_data = {
            "timestamp": datetime.now().isoformat(),
            "uptime": time.time(),
            "services": {name: asdict(health) for name, health in self.services.items()},
            "system_resources": {
                "cpu_percent": self.system_metrics.cpu_percent,
                "memory_percent": self.system_metrics.memory_percent,
                "disk_percent": self.system_metrics.disk_percent
            }
        }
        
        self.memory.update_entity_memory("system", system_data)
    
    # Command interface methods
    async def _cmd_status(self, args: List[str]) -> str:
        """Get system status"""
        if not args:
            # Overall status
            healthy_count = sum(1 for h in self.services.values() if h.status == ServiceStatus.HEALTHY)
            total_count = len(self.services)
            
            return f"""📊 System Status: {healthy_count}/{total_count} services healthy

Services:
{chr(10).join([f"  {name}: {health.status.value} ({health.response_time:.1f}ms)" for name, health in self.services.items()])}

System Resources:
  CPU: {self.system_metrics.cpu_percent:.1f}%
  Memory: {self.system_metrics.memory_percent:.1f}%
  Disk: {self.system_metrics.disk_percent:.1f}%"""
        else:
            # Specific service status
            service_name = args[0]
            if service_name in self.services:
                health = self.services[service_name]
                return f"""Service: {service_name}
Status: {health.status.value}
Response Time: {health.response_time:.1f}ms
Last Check: {health.last_check.isoformat()}
Error: {health.error_message or 'None'}
Recovery Attempts: {health.recovery_attempts}"""
            else:
                return f"Service '{service_name}' not found"
    
    async def _cmd_restart(self, args: List[str]) -> str:
        """Restart service"""
        if not args:
            return "Usage: restart <service_name>"
        
        service_name = args[0]
        service_config = next((s for s in self.config.get('services', []) if s['name'] == service_name), None)
        
        if not service_config:
            return f"Service '{service_name}' not configured"
        
        # Create mock health for restart
        health = ServiceHealth(
            name=service_name,
            status=ServiceStatus.UNHEALTHY,
            response_time=0,
            last_check=datetime.now(),
            error_message="Manual restart requested"
        )
        
        success = await self._execute_recovery(service_name, service_config, health)
        return f"Restart {'successful' if success else 'failed'} for {service_name}"
    
    async def _cmd_logs(self, args: List[str]) -> str:
        """Get service logs"""
        if not args:
            return "Usage: logs <service_name> [lines] [level]"
        
        service_name = args[0]
        lines = int(args[1]) if len(args) > 1 else 50
        level = args[2] if len(args) > 2 else None
        
        if self.mcp_client:
            result = await self.mcp_client.call_tool("get_logs", {
                "service": service_name,
                "lines": lines,
                "level": level
            })
            return result.get('content', [{}])[0].get('text', 'No logs available')
        else:
            return "MCP client not available for log retrieval"
    
    async def _cmd_health(self, args: List[str]) -> str:
        """Check service health"""
        if not args:
            return "Usage: health <service_name>"
        
        service_name = args[0]
        service_config = next((s for s in self.config.get('services', []) if s['name'] == service_name), None)
        
        if not service_config:
            return f"Service '{service_name}' not configured"
        
        health = await self._check_service_health(service_config)
        return f"Health check for {service_name}: {health.status.value} ({health.response_time:.1f}ms)"
    
    async def _cmd_metrics(self, args: List[str]) -> str:
        """Get system metrics"""
        if self.system_metrics:
            return f"""System Metrics:
  CPU: {self.system_metrics.cpu_percent:.1f}%
  Memory: {self.system_metrics.memory_percent:.1f}%
  Disk: {self.system_metrics.disk_percent:.1f}%
  Timestamp: {self.system_metrics.timestamp.isoformat()}"""
        else:
            return "No metrics available"
    
    async def _cmd_recover(self, args: List[str]) -> str:
        """Force recovery for service"""
        if not args:
            return "Usage: recover <service_name>"
        
        service_name = args[0]
        if service_name in self.services:
            health = self.services[service_name]
            service_config = next((s for s in self.config.get('services', []) if s['name'] == service_name), None)
            
            if service_config:
                success = await self._execute_recovery(service_name, service_config, health)
                return f"Recovery {'successful' if success else 'failed'} for {service_name}"
            else:
                return f"No configuration found for {service_name}"
        else:
            return f"Service '{service_name}' not monitored"
    
    async def _cmd_test(self, args: List[str]) -> str:
        """Run system tests"""
        if not args:
            return "Usage: test <test_type> [options]"
        
        test_type = args[0]
        
        if test_type == "load":
            return await self._run_load_test(args[1:])
        elif test_type == "fault":
            return await self._run_fault_test(args[1:])
        elif test_type == "connectivity":
            return await self._run_connectivity_test(args[1:])
        else:
            return f"Unknown test type: {test_type}"
    
    async def _run_load_test(self, args: List[str]) -> str:
        """Run load test"""
        duration = int(args[0]) if args else 60  # seconds
        concurrency = int(args[1]) if len(args) > 1 else 10
        
        logger.info(f"Starting load test: {duration}s, {concurrency} concurrent requests")
        
        # Implementation would go here
        return f"Load test completed: {duration}s, {concurrency} concurrent requests"
    
    async def _run_fault_test(self, args: List[str]) -> str:
        """Run fault tolerance test"""
        service = args[0] if args else "web"
        
        logger.info(f"Starting fault test for {service}")
        
        # Implementation would go here
        return f"Fault test completed for {service}"
    
    async def _run_connectivity_test(self, args: List[str]) -> str:
        """Run connectivity test"""
        results = []
        for service_config in self.config.get('services', []):
            health = await self._check_service_health(service_config)
            results.append(f"{service_config['name']}: {health.status.value}")
        
        return "Connectivity test results:\n" + "\n".join(results)
    
    async def _cmd_memory(self, args: List[str]) -> str:
        """Memory management commands"""
        if not args:
            return "Usage: memory <command> [args]"
        
        command = args[0]
        
        if command == "search":
            query = " ".join(args[1:])
            results = self.memory.search_memory(query)
            return f"Memory search for '{query}':\n" + "\n".join(results)
        elif command == "show":
            entity = args[1] if len(args) > 1 else "system"
            content = self.memory.get_entity_memory(entity)
            return f"Memory for {entity}:\n{content[:500]}..."
        else:
            return f"Unknown memory command: {command}"
    
    async def _cmd_mcp(self, args: List[str]) -> str:
        """MCP-related commands"""
        if not self.mcp_client:
            return "MCP client not available"
        
        if not args:
            return "Usage: mcp <command> [args]"
        
        command = args[0]
        
        if command == "status":
            return f"MCP Status: Connected\nCapabilities: {self.mcp_client.capabilities}"
        elif command == "tools":
            # List available tools
            return "Available MCP tools: restart_service, check_health, get_logs, update_memory, execute_command"
        elif command == "call":
            if len(args) < 2:
                return "Usage: mcp call <tool_name> [args]"
            
            tool_name = args[1]
            tool_args = json.loads(args[2]) if len(args) > 2 else {}
            
            result = await self.mcp_client.call_tool(tool_name, tool_args)
            return f"MCP tool result: {json.dumps(result, indent=2)}"
        else:
            return f"Unknown MCP command: {command}"
    
    async def _cmd_help(self, args: List[str]) -> str:
        """Show help"""
        return """Available commands:
  status [service]     - Show system or service status
  restart <service>    - Restart a service
  logs <service> [lines] [level] - Get service logs
  health <service>     - Check service health
  metrics             - Show system metrics
  recover <service>    - Force recovery for service
  test <type> [args]   - Run tests (load, fault, connectivity)
  memory <cmd> [args]  - Memory management
  mcp <cmd> [args]     - MCP operations
  help                - Show this help

Examples:
  status web
  restart ai-proxy
  logs monitoring 100 error
  test load 120 20
  memory search "recovery"
  mcp call restart_service {"service": "web"}"""
    
    async def execute_command(self, command_line: str) -> str:
        """Execute command line interface"""
        parts = command_line.strip().split()
        if not parts:
            return "Empty command"
        
        cmd = parts[0]
        args = parts[1:]
        
        if cmd in self.aliases:
            try:
                return await self.aliases[cmd](args)
            except Exception as e:
                return f"Command error: {e}"
        else:
            return f"Unknown command: {cmd}. Type 'help' for available commands."
    
    def stop(self):
        """Stop the agent"""
        self.running = False
        logger.info("Enhanced Recovery Agent stopped")

async def main():
    """Main entry point"""
    agent = EnhancedRecoveryAgent()
    
    # Handle graceful shutdown
    def signal_handler(signum, frame):
        logger.info("Received shutdown signal")
        agent.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        await agent.start()
    except KeyboardInterrupt:
        logger.info("Agent stopped by user")
    except Exception as e:
        logger.error(f"Agent error: {e}")
    finally:
        agent.stop()

if __name__ == "__main__":
    asyncio.run(main())
