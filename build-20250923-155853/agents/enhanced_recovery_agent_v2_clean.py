#!/usr/bin/env python3
"""
Enhanced Recovery Agent v2.0 with MCP Integration
Автоматический агент восстановления сервисов с интеграцией MCP протокола
"""

import asyncio
import logging
import signal
import sys
import os
import json
import yaml
import time
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path

# Import MCP integration
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
try:
    # Import from the actual filename (with hyphens)
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "mcp_ai_agent_integration", 
        os.path.join(os.path.dirname(__file__), '..', 'lib', 'mcp-ai-agent-integration.py')
    )
    mcp_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mcp_module)
    MCPAIAgentIntegration = mcp_module.MCPAIAgentIntegration
    MCPConnectionManager = mcp_module.MCPConnectionManager
    logger = logging.getLogger(__name__)
    logger.info("✅ MCP AI Agent Integration imported successfully")
except Exception as e:
    logger = logging.getLogger(__name__)
    logger.warning(f"MCP AI Agent Integration not available, using legacy mode: {e}")
    MCPAIAgentIntegration = None
    MCPConnectionManager = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('logs/enhanced_recovery_agent.log', encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)

@dataclass
class ServiceHealth:
    """Состояние здоровья сервиса"""
    name: str
    status: str
    response_time: float
    last_check: datetime
    error_message: Optional[str] = None
    recovery_attempts: int = 0
    last_recovery: Optional[datetime] = None
    model_in_use: Optional[str] = None

@dataclass
class SystemMetrics:
    """Системные метрики"""
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    network_io: Dict[str, int]
    timestamp: datetime
    active_connections: int = 0
    model_requests: int = 0

class EnhancedRecoveryAgent:
    """Enhanced Recovery Agent с интеграцией MCP протокола"""
    
    def __init__(self, config_path: str = "config/recovery-config.yaml"):
        self.config_path = config_path
        self.config = self._load_config()
        self.running = False
        self.services: Dict[str, ServiceHealth] = {}
        self.system_metrics: Optional[SystemMetrics] = None
        
        # MCP Integration
        self.mcp_integration: Optional[MCPAIAgentIntegration] = None
        
        # Model information
        self.available_models: List[Dict[str, Any]] = []
        self.model_health: Dict[str, bool] = {}
        
        logger.info("Enhanced Recovery Agent v2.0 initialized with MCP integration")
    
    def _load_config(self) -> Dict[str, Any]:
        """Загрузка конфигурации"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return yaml.safe_load(f)
            else:
                logger.warning(f"Config file {self.config_path} not found, using defaults")
                return self._get_default_config()
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Конфигурация по умолчанию"""
        return {
            "services": [
                {"name": "web", "port": 13000, "endpoint": "/", "timeout": 10},
                {"name": "ai-proxy", "port": 13081, "endpoint": "/health", "timeout": 10},
                {"name": "monitoring", "port": 13082, "endpoint": "/health", "timeout": 10},
                {"name": "mcp", "port": 3001, "endpoint": "/health", "timeout": 10},
                {"name": "youtube-cache", "port": 13083, "endpoint": "/health", "timeout": 10}
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
    
    async def initialize(self):
        """Инициализация агента с MCP интеграцией"""
        try:
            # Initialize MCP integration if available
            if MCPAIAgentIntegration:
                self.mcp_integration = MCPAIAgentIntegration()
                await self.mcp_integration.initialize()
                logger.info("✅ MCP AI Agent Integration initialized")
            else:
                logger.warning("⚠️ MCP integration not available, using legacy mode")
            
            logger.info("🎯 Enhanced Recovery Agent fully initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize Enhanced Recovery Agent: {e}")
            raise
    
    async def start_monitoring(self):
        \"\"\"Запуск основного цикла мониторинга\"\"\"
        logger.info(\"🚀 Starting Enhanced Recovery Agent v2.0 monitoring...\")
        self.running = True
        
        # Ensure initialization
        if not self.mcp_integration and MCPAIAgentIntegration:
            await self.initialize()
        
        try:
            while self.running:
                await self._monitoring_cycle()
                await asyncio.sleep(self.config['monitoring']['interval'])
        except KeyboardInterrupt:
            logger.info(\"Monitoring stopped by user\")
        except Exception as e:
            logger.error(f\"Monitoring error: {e}\")
        finally:
            await self._cleanup()
    
    async def _monitoring_cycle(self):
        \"\"\"Один цикл мониторинга с MCP интеграцией\"\"\"
        logger.info(\"🔍 Starting monitoring cycle...\")
        
        try:
            # Get comprehensive system status using MCP integration
            if self.mcp_integration:
                system_status = await self.mcp_integration.get_system_status()
                await self._process_mcp_system_status(system_status)
            else:
                # Fallback to legacy monitoring
                await self._legacy_monitoring_cycle()
            
            # Perform recovery if needed
            await self._perform_automated_recovery()
            
            # Update memory with current state using MCP
            await self._update_system_memory_mcp()
            
            logger.info(\"✅ Monitoring cycle completed\")
            
        except Exception as e:
            logger.error(f\"Error in monitoring cycle: {e}\")
            # Fallback to legacy monitoring on error
            await self._legacy_monitoring_cycle()
    
    async def _process_mcp_system_status(self, system_status: Dict[str, Any]):
        \"\"\"Обработка статуса системы из MCP интеграции\"\"\"
        try:
            # Update system metrics
            if 'metrics' in system_status and system_status['metrics']:
                metrics = system_status['metrics']
                self.system_metrics = SystemMetrics(
                    cpu_percent=metrics.get('cpu', {}).get('usage', 0),
                    memory_percent=metrics.get('memory', {}).get('usage', 0),
                    disk_percent=metrics.get('disk', [{}])[0].get('usage', 0) if metrics.get('disk') else 0,
                    network_io={},
                    timestamp=datetime.now(),
                    active_connections=len(self.services),
                    model_requests=len(self.available_models)
                )
            
            # Update service health
            if 'services' in system_status:
                for service_name, service_data in system_status['services'].items():
                    if isinstance(service_data, dict):
                        self.services[service_name] = ServiceHealth(
                            name=service_name,
                            status=service_data.get('status', 'unknown'),
                            response_time=service_data.get('response_time', 0),
                            last_check=datetime.now(),
                            error_message=service_data.get('error'),
                            recovery_attempts=self.services.get(service_name, ServiceHealth(service_name, 'unknown', 0, datetime.now())).recovery_attempts
                        )
            
            # Process alerts
            if 'alerts' in system_status and system_status['alerts']:
                for alert in system_status['alerts']:
                    if alert.get('severity') in ['critical', 'high']:
                        logger.warning(f\"🚨 ALERT: {alert.get('category', 'Unknown')} - {alert.get('message', 'No message')}\")
            
        except Exception as e:
            logger.error(f\"Error processing MCP system status: {e}\")
    
    async def _legacy_monitoring_cycle(self):
        \"\"\"Устаревший цикл мониторинга без MCP\"\"\"
        try:
            # Check each service
            for service_config in self.config['services']:
                await self._check_service_health(service_config)
            
            # Update system metrics
            await self._update_system_metrics()
            
        except Exception as e:
            logger.error(f\"Error in legacy monitoring cycle: {e}\")
    
    async def _check_service_health(self, service_config: Dict[str, Any]):
        \"\"\"Проверка здоровья отдельного сервиса\"\"\"
        service_name = service_config['name']
        
        try:
            url = f\"http://localhost:{service_config['port']}{service_config['endpoint']}\"
            timeout = service_config.get('timeout', 10)
            
            async with aiohttp.ClientSession() as session:
                start_time = time.time()
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                    response_time = (time.time() - start_time) * 1000  # Convert to ms
                    
                    if response.status == 200:
                        self.services[service_name] = ServiceHealth(
                            name=service_name,
                            status='healthy',
                            response_time=response_time,
                            last_check=datetime.now(),
                            recovery_attempts=self.services.get(service_name, ServiceHealth(service_name, 'unknown', 0, datetime.now())).recovery_attempts
                        )
                    else:
                        self.services[service_name] = ServiceHealth(
                            name=service_name,
                            status='unhealthy',
                            response_time=response_time,
                            last_check=datetime.now(),
                            error_message=f\"HTTP {response.status}\",
                            recovery_attempts=self.services.get(service_name, ServiceHealth(service_name, 'unknown', 0, datetime.now())).recovery_attempts
                        )
        
        except asyncio.TimeoutError:
            self.services[service_name] = ServiceHealth(
                name=service_name,
                status='unhealthy',
                response_time=timeout * 1000,
                last_check=datetime.now(),
                error_message=\"Timeout\",
                recovery_attempts=self.services.get(service_name, ServiceHealth(service_name, 'unknown', 0, datetime.now())).recovery_attempts
            )
        
        except Exception as e:
            self.services[service_name] = ServiceHealth(
                name=service_name,
                status='unhealthy',
                response_time=0,
                last_check=datetime.now(),
                error_message=str(e),
                recovery_attempts=self.services.get(service_name, ServiceHealth(service_name, 'unknown', 0, datetime.now())).recovery_attempts
            )
    
    async def _update_system_metrics(self):
        \"\"\"Обновление системных метрик\"\"\"
        try:
            # Basic metrics without external dependencies
            self.system_metrics = SystemMetrics(
                cpu_percent=0.0,
                memory_percent=0.0,
                disk_percent=0.0,
                network_io={},
                timestamp=datetime.now(),
                active_connections=len(self.services),
                model_requests=len(self.available_models)
            )
        except Exception as e:
            logger.error(f\"Failed to update system metrics: {e}\")
    
    async def _perform_automated_recovery(self):
        \"\"\"Выполнение автоматического восстановления с использованием MCP\"\"\"
        try:
            unhealthy_services = [
                name for name, health in self.services.items() 
                if health.status == 'unhealthy'
            ]
            
            if not unhealthy_services:
                return
            
            logger.info(f\"🔧 Starting recovery for unhealthy services: {unhealthy_services}\")
            
            for service_name in unhealthy_services:
                service_health = self.services[service_name]
                
                # Check cooldown period
                if (service_health.last_recovery and 
                    datetime.now() - service_health.last_recovery < timedelta(seconds=self.config['monitoring']['cooldown_period'])):
                    continue
                
                # Check max recovery attempts
                if service_health.recovery_attempts >= self.config['monitoring']['recovery_attempts']:
                    logger.warning(f\"Max recovery attempts reached for {service_name}\")
                    continue
                
                # Attempt recovery using MCP integration
                if self.mcp_integration:
                    success = await self.mcp_integration.restart_service(service_name)
                    
                    if success:
                        logger.info(f\"✅ Successfully restarted {service_name} via MCP\")
                        service_health.recovery_attempts += 1
                        service_health.last_recovery = datetime.now()
                        service_health.status = 'recovering'
                        
                        # Log recovery to memory
                        await self.mcp_integration.update_memory(
                            'recovery_actions',
                            f\"Successfully restarted service {service_name}\",
                            'success'
                        )
                    else:
                        logger.error(f\"❌ Failed to restart {service_name} via MCP\")
                        service_health.recovery_attempts += 1
                        
                        # Log failure to memory
                        await self.mcp_integration.update_memory(
                            'recovery_actions',
                            f\"Failed to restart service {service_name}\",
                            'error'
                        )
                
                # Fallback to legacy recovery
                else:
                    await self._legacy_service_recovery(service_name)
        
        except Exception as e:
            logger.error(f\"Error in automated recovery: {e}\")
    
    async def _legacy_service_recovery(self, service_name: str):
        \"\"\"Устаревший метод восстановления сервиса\"\"\"
        try:
            # Simple restart attempt
            logger.info(f\"Attempting legacy recovery for {service_name}\")
            
            # This would contain the original recovery logic
            # For now, just mark as attempted
            if service_name in self.services:
                self.services[service_name].recovery_attempts += 1
                self.services[service_name].last_recovery = datetime.now()
        
        except Exception as e:
            logger.error(f\"Legacy recovery failed for {service_name}: {e}\")
    
    async def _update_system_memory_mcp(self):
        \"\"\"Обновление системной памяти через MCP\"\"\"
        try:
            if not self.mcp_integration:
                return
            
            # Create memory entry for current system state
            memory_content = f\"\"\"# System State Update - {datetime.now().isoformat()}

## Services Status
\"\"\"
            
            for service_name, service_health in self.services.items():
                memory_content += f\"- **{service_name}**: {service_health.status}\"
                if service_health.error_message:
                    memory_content += f\" (Error: {service_health.error_message})\"
                memory_content += f\" - Response time: {service_health.response_time}ms\\n\"
            
            if self.system_metrics:
                memory_content += f\"\"\"
## System Metrics
- **CPU**: {self.system_metrics.cpu_percent}%
- **Memory**: {self.system_metrics.memory_percent}%
- **Disk**: {self.system_metrics.disk_percent}%
- **Active Connections**: {self.system_metrics.active_connections}
\"\"\"
            
            # Update memory
            await self.mcp_integration.update_memory(
                'system_state',
                memory_content,
                'fact'
            )
            
            # Update recovery statistics
            total_recoveries = sum(service.recovery_attempts for service in self.services.values())
            if total_recoveries > 0:
                await self.mcp_integration.update_memory(
                    'recovery_statistics',
                    f\"Total recovery attempts: {total_recoveries}\",
                    'fact'
                )
            
        except Exception as e:
            logger.error(f\"Failed to update system memory via MCP: {e}\")
    
    async def get_status_report(self) -> Dict[str, Any]:
        \"\"\"Получение комплексного отчета о состоянии\"\"\"
        try:
            # Use MCP integration if available
            if self.mcp_integration:
                mcp_status = await self.mcp_integration.get_system_status()
                mcp_health = await self.mcp_integration.health_check()
                
                return {
                    'timestamp': datetime.now().isoformat(),
                    'agent_version': 'Enhanced Recovery Agent v2.0',
                    'mcp_integration': True,
                    'mcp_health': mcp_health,
                    'system_status': mcp_status,
                    'services': {name: asdict(health) for name, health in self.services.items()},
                    'system_metrics': asdict(self.system_metrics) if self.system_metrics else None,
                    'available_models': len(self.available_models),
                    'model_health': self.model_health
                }
            
            # Fallback to legacy status
            else:
                return {
                    'timestamp': datetime.now().isoformat(),
                    'agent_version': 'Enhanced Recovery Agent v2.0',
                    'mcp_integration': False,
                    'services': {name: asdict(health) for name, health in self.services.items()},
                    'system_metrics': asdict(self.system_metrics) if self.system_metrics else None,
                    'available_models': len(self.available_models),
                    'model_health': self.model_health
                }
        
        except Exception as e:
            logger.error(f\"Failed to generate status report: {e}\")
            return {
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }
    
    async def process_command(self, command: str) -> str:
        \"\"\"Обработка команд пользователя с MCP интеграцией\"\"\"
        try:
            parts = command.strip().split()
            if not parts:
                return \"Пустая команда\"
            
            cmd = parts[0].lower()
            args = parts[1:] if len(parts) > 1 else []
            
            if cmd == \"status\":
                return await self._get_system_status()
            
            elif cmd == \"restart\":
                if args:
                    service = args[0]
                    if self.mcp_integration:
                        success = await self.mcp_integration.restart_service(service)
                        return f\"Сервис {service}: {'перезапущен' if success else 'ошибка перезапуска'}\"
                    else:
                        return f\"MCP недоступен для перезапуска {service}\"
                else:
                    return \"Укажите сервис для перезапуска\"
            
            elif cmd == \"health\":
                if self.mcp_integration:
                    health = await self.mcp_integration.health_check()
                    return f\"Состояние MCP: {json.dumps(health, indent=2, ensure_ascii=False)}\"
                else:
                    return \"MCP интеграция недоступна\"
            
            elif cmd == \"memory\":
                if args and self.mcp_integration:
                    query = \" \".join(args)
                    results = await self.mcp_integration.search_memory(query)
                    if results:
                        return f\"🔍 Результаты поиска для '{query}':\\n\" + \"\\n\".join([f\"  - {result}\" for result in results[:5]])
                    else:
                        return f\"Ничего не найдено для запроса: {query}\"
                else:
                    return \"Использование: memory <запрос>\"
            
            elif cmd == \"mcp\":
                return await self._handle_mcp_command(args)
            
            elif cmd == \"help\":
                return self._get_help_text()
            
            else:
                return f\"Неизвестная команда: {cmd}. Используйте 'help' для списка команд.\"
                
        except Exception as e:
            logger.error(f\"Ошибка обработки команды '{command}': {e}\")
            return f\"Ошибка выполнения команды: {e}\"
    
    async def _get_system_status(self) -> str:
        \"\"\"Получение статуса системы\"\"\"
        if not self.services:
            return \"Нет данных о сервисах. Запустите мониторинг.\"
        
        status_lines = [\"📊 Статус системы:\"]
        for name, health in self.services.items():
            model_info = f\" (model: {health.model_in_use})\" if health.model_in_use else \"\"
            status_lines.append(f\"  {name}: {health.status} ({health.response_time:.2f}ms){model_info}\")
        
        if self.system_metrics:
            status_lines.extend([
                \"\\n💻 Системные метрики:\",
                f\"  CPU: {self.system_metrics.cpu_percent:.1f}%\",
                f\"  Memory: {self.system_metrics.memory_percent:.1f}%\",
                f\"  Disk: {self.system_metrics.disk_percent:.1f}%\",
                f\"  Active Connections: {self.system_metrics.active_connections}\"
            ])
        
        return \"\\n\".join(status_lines)
    
    async def _handle_mcp_command(self, args: List[str]) -> str:
        \"\"\"Обработка MCP команд\"\"\"
        if not self.mcp_integration:
            return \"MCP интеграция недоступна\"
        
        if not args:
            return (\"Использование: mcp <операция> [аргументы]\\n\"
                   \"Операции: status, health, tools, memory\")
        
        operation = args[0].lower()
        
        try:
            if operation == \"status\":
                status = await self.mcp_integration.get_system_status()
                return f\"MCP статус: {json.dumps(status, indent=2, ensure_ascii=False)}\"
            
            elif operation == \"health\":
                health = await self.mcp_integration.health_check()
                return f\"MCP здоровье: {json.dumps(health, indent=2, ensure_ascii=False)}\"
            
            elif operation == \"tools\":
                stats = self.mcp_integration.get_tool_usage_stats()
                return f\"Статистика инструментов: {json.dumps(stats, indent=2, ensure_ascii=False)}\"
            
            elif operation == \"memory\":
                if len(args) > 1:
                    query = \" \".join(args[1:])
                    results = await self.mcp_integration.search_memory(query)
                    return f\"Результаты поиска: {json.dumps(results, indent=2, ensure_ascii=False)}\"
                else:
                    stats = await self.mcp_integration.get_memory_stats()
                    return f\"Статистика памяти: {json.dumps(stats, indent=2, ensure_ascii=False)}\"
            
            else:
                return f\"Неизвестная MCP операция: {operation}\"
        
        except Exception as e:
            logger.error(f\"Ошибка выполнения MCP команды: {e}\")
            return f\"Ошибка выполнения MCP команды: {e}\"
    
    def _get_help_text(self) -> str:
        \"\"\"Получение текста справки\"\"\"
        return \"\"\"
🤖 Enhanced Recovery Agent v2.0 - Команды:

📊 Мониторинг:
  status                 - Статус всех сервисов
  health                 - Проверка здоровья MCP системы

🔧 Управление:
  restart <сервис>       - Перезапуск сервиса через MCP

🧠 Память и MCP:
  memory <запрос>        - Поиск в памяти агента
  mcp <операция>         - MCP операции (status, health, tools, memory)

❓ Помощь:
  help                   - Эта справка

Примеры:
  restart ai-proxy
  memory \"recovery success\"
  mcp status
        \"\"\"
    
    async def _cleanup(self):
        \"\"\"Очистка ресурсов\"\"\"
        logger.info(\"🧹 Cleaning up Enhanced Recovery Agent...\")
        
        try:
            if self.mcp_integration:
                await self.mcp_integration.shutdown()
        
        except Exception as e:
            logger.error(f\"Error during cleanup: {e}\")
        
        logger.info(\"✅ Enhanced Recovery Agent cleanup completed\")
    
    def stop(self):
        \"\"\"Остановка цикла мониторинга\"\"\"
        logger.info(\"🛑 Stopping Enhanced Recovery Agent...\")
        self.running = False


# Main execution
async def main():
    \"\"\"Основная функция для запуска Enhanced Recovery Agent\"\"\"
    agent = EnhancedRecoveryAgent()
    
    # Setup signal handlers
    def signal_handler(signum, frame):
        logger.info(f\"Received signal {signum}\")
        agent.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        await agent.initialize()
        await agent.start_monitoring()
    except Exception as e:
        logger.error(f\"Fatal error: {e}\")
    finally:
        await agent._cleanup()


if __name__ == \"__main__\":
    asyncio.run(main())