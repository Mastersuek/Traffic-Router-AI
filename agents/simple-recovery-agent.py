#!/usr/bin/env python3
"""
Упрощенный AI агент для мониторинга и восстановления Traffic Router
Без зависимостей от Omnara для тестирования
"""

import asyncio
import logging
import json
import time
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import psutil
import yaml
from pathlib import Path

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/recovery-agent.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SimpleMemoryManager:
    """Простой менеджер памяти в формате Markdown"""
    
    def __init__(self, memory_dir: str = "memory"):
        self.memory_dir = Path(memory_dir)
        self.memory_dir.mkdir(exist_ok=True)
        self.entities_dir = self.memory_dir / "entities"
        self.entities_dir.mkdir(exist_ok=True)
        
        # Основной файл памяти
        self.main_memory_file = self.memory_dir / "system.md"
        self._init_main_memory()
    
    def _init_main_memory(self):
        """Инициализация основного файла памяти"""
        if not self.main_memory_file.exists():
            initial_content = f"""# Traffic Router System Memory

## System Information
- system_name: Traffic Router with Geolocation
- deployment_date: {datetime.now().isoformat()}
- last_update: {datetime.now().isoformat()}
- status: active
- version: 1.0.0

## System Components
- traffic_router: [[entities/traffic-router.md]]
- ai_proxy: [[entities/ai-proxy.md]]
- monitoring_system: [[entities/monitoring.md]]
- recovery_agent: [[entities/recovery-agent.md]]

## Performance Metrics
- uptime_target: 99.9%
- response_time_target: <200ms
- recovery_time_target: <60s

## Incident History
- total_incidents: 0
- last_incident: none
- recovery_success_rate: 100%

## Learning Notes
- idle_testing_enabled: true
- idle_threshold_minutes: 60
- test_frequency_during_idle: every_30_minutes
"""
            
            with open(self.main_memory_file, 'w', encoding='utf-8') as f:
                f.write(initial_content)
    
    def update_memory(self, entity: str, data: Dict[str, Any]):
        """Обновление памяти сущности"""
        entity_file = self.entities_dir / f"{entity}.md"
        
        # Читаем существующий контент
        if entity_file.exists():
            with open(entity_file, 'r', encoding='utf-8') as f:
                content = f.read()
        else:
            content = f"# {entity.title()}\n\n"
        
        # Добавляем новые данные
        timestamp = datetime.now().isoformat()
        new_section = f"\n## Update {timestamp}\n"
        
        for key, value in data.items():
            new_section += f"- {key}: {value}\n"
        
        content += new_section
        
        # Записываем обратно
        with open(entity_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        logger.info(f"Memory updated for entity: {entity}")

class SimpleRecoveryAgent:
    """Упрощенный AI агент для мониторинга и восстановления"""
    
    def __init__(self, config_path: str = "config/recovery-config.yaml"):
        self.config = self._load_config(config_path)
        self.memory_manager = SimpleMemoryManager()
        self.services_status = {}
        self.recovery_attempts = {}
        self.max_recovery_attempts = 3
        self.recovery_cooldown = 300  # 5 минут
        
        logger.info("Simple Recovery Agent initialized")
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """Загрузка конфигурации агента"""
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            logger.warning(f"Конфигурационный файл {config_path} не найден, используем настройки по умолчанию")
            return self._default_config()
    
    def _default_config(self) -> Dict[str, Any]:
        """Конфигурация по умолчанию"""
        return {
            "services": {
                "web": {"port": 3000, "health_endpoint": "/health"},
                "proxy": {"port": 8081, "health_endpoint": "/health"},
                "monitoring": {"port": 8082, "health_endpoint": "/health"}
            },
            "monitoring": {
                "check_interval": 30,
                "timeout": 10
            }
        }
    
    async def check_service_health(self, service_name: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Проверка здоровья сервиса"""
        try:
            port = config.get('port', 8080)
            health_endpoint = config.get('health_endpoint', '/health')
            timeout = self.config.get('monitoring', {}).get('timeout', 10)
            
            url = f"http://localhost:{port}{health_endpoint}"
            
            start_time = time.time()
            response = requests.get(url, timeout=timeout)
            response_time = (time.time() - start_time) * 1000  # в миллисекундах
            
            if response.status_code == 200:
                status = "healthy"
                try:
                    health_data = response.json()
                    status = health_data.get('status', 'healthy')
                except:
                    pass
            else:
                status = "unhealthy"
            
            result = {
                "status": status,
                "response_time": response_time,
                "status_code": response.status_code,
                "last_check": datetime.now().isoformat()
            }
            
            logger.info(f"Service {service_name} health check: {status} ({response_time:.2f}ms)")
            return result
            
        except Exception as e:
            logger.error(f"Health check failed for {service_name}: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "last_check": datetime.now().isoformat()
            }
    
    async def monitor_services(self):
        """Мониторинг всех сервисов"""
        logger.info("🔍 Starting service monitoring...")
        
        services = self.config.get('services', {})
        
        for service_name, service_config in services.items():
            health_result = await self.check_service_health(service_name, service_config)
            self.services_status[service_name] = health_result
            
            # Обновляем память
            self.memory_manager.update_memory(service_name, health_result)
            
            # Проверяем, нужно ли восстановление
            if health_result['status'] == 'unhealthy':
                await self.handle_service_failure(service_name, service_config)
    
    async def handle_service_failure(self, service_name: str, service_config: Dict[str, Any]):
        """Обработка сбоя сервиса"""
        logger.warning(f"🚨 Service failure detected: {service_name}")
        
        # Проверяем cooldown
        last_attempt = self.recovery_attempts.get(service_name, {}).get('last_attempt', 0)
        if time.time() - last_attempt < self.recovery_cooldown:
            logger.info(f"Service {service_name} is in cooldown period")
            return
        
        # Проверяем количество попыток
        attempts = self.recovery_attempts.get(service_name, {}).get('count', 0)
        if attempts >= self.max_recovery_attempts:
            logger.error(f"Max recovery attempts reached for {service_name}")
            return
        
        # Пытаемся восстановить сервис
        await self.attempt_recovery(service_name, service_config)
    
    async def attempt_recovery(self, service_name: str, service_config: Dict[str, Any]):
        """Попытка восстановления сервиса"""
        logger.info(f"🔧 Attempting recovery for {service_name}")
        
        # Обновляем счетчик попыток
        if service_name not in self.recovery_attempts:
            self.recovery_attempts[service_name] = {'count': 0, 'last_attempt': 0}
        
        self.recovery_attempts[service_name]['count'] += 1
        self.recovery_attempts[service_name]['last_attempt'] = time.time()
        
        # Простое восстановление - перезапуск через HTTP запрос
        try:
            port = service_config.get('port', 8080)
            restart_endpoint = f"http://localhost:{port}/restart"
            
            # Отправляем запрос на перезапуск (если такой endpoint существует)
            response = requests.post(restart_endpoint, timeout=10)
            
            if response.status_code == 200:
                logger.info(f"✅ Recovery attempt successful for {service_name}")
                self.memory_manager.update_memory('recovery_agent', {
                    'last_recovery': datetime.now().isoformat(),
                    'service': service_name,
                    'success': True
                })
            else:
                logger.warning(f"⚠️ Recovery attempt failed for {service_name}: {response.status_code}")
                
        except Exception as e:
            logger.error(f"❌ Recovery attempt failed for {service_name}: {e}")
        
        # Обновляем память о попытке восстановления
        self.memory_manager.update_memory('recovery_agent', {
            'recovery_attempts': self.recovery_attempts,
            'last_attempt': datetime.now().isoformat()
        })
    
    async def generate_system_report(self) -> Dict[str, Any]:
        """Генерация отчета о состоянии системы"""
        system_info = {
            "timestamp": datetime.now().isoformat(),
            "uptime": time.time(),
            "services": self.services_status,
            "recovery_attempts": self.recovery_attempts,
            "system_resources": {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_percent": psutil.disk_usage('/').percent
            }
        }
        
        # Обновляем память
        self.memory_manager.update_memory('system', system_info)
        
        return system_info
    
    async def start_monitoring(self):
        """Запуск основного цикла мониторинга"""
        logger.info("🚀 Запуск Simple Recovery Agent для Traffic Router")
        
        check_interval = self.config.get('monitoring', {}).get('check_interval', 30)
        
        while True:
            try:
                # Мониторинг сервисов
                await self.monitor_services()
                
                # Генерация отчета
                report = await self.generate_system_report()
                
                # Логируем сводку
                healthy_services = sum(1 for s in self.services_status.values() if s['status'] == 'healthy')
                total_services = len(self.services_status)
                
                logger.info(f"📊 System Status: {healthy_services}/{total_services} services healthy")
                
                # Ждем до следующей проверки
                await asyncio.sleep(check_interval)
                
            except KeyboardInterrupt:
                logger.info("🛑 Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"❌ Error in monitoring loop: {e}")
                await asyncio.sleep(5)  # Короткая пауза при ошибке

async def main():
    """Главная функция"""
    agent = SimpleRecoveryAgent()
    await agent.start_monitoring()

if __name__ == "__main__":
    asyncio.run(main())
