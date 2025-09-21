#!/usr/bin/env python3
"""
AI Recovery Agent для системы маршрутизации трафика
Использует Omnara для мониторинга и автоматического восстановления сервисов
Интегрирован с Mem-Agent для человекочитаемой памяти в формате Markdown
"""

import asyncio
import json
import logging
import os
import subprocess
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import psutil
import requests
from omnara import OmnaraClient, AgentConfig
import docker
import yaml
import markdown
from pathlib import Path

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('recovery-agent.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class MemoryManager:
    """Менеджер памяти в формате Markdown по принципу Mem-Agent"""
    
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
            initial_content = """# Traffic Router System Memory

## System Information
- system_name: Traffic Router with Geolocation
- deployment_date: {date}
- last_update: {date}
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
""".format(date=datetime.now().isoformat())
            
            with open(self.main_memory_file, 'w', encoding='utf-8') as f:
                f.write(initial_content)
    
    def update_memory(self, entity: str, data: Dict[str, Any]):
        """Обновление памяти для конкретной сущности"""
        entity_file = self.entities_dir / f"{entity}.md"
        
        # Чтение существующего содержимого
        existing_content = ""
        if entity_file.exists():
            with open(entity_file, 'r', encoding='utf-8') as f:
                existing_content = f.read()
        
        # Обновление данных
        timestamp = datetime.now().isoformat()
        
        if entity == "traffic-router":
            content = f"""# Traffic Router Service

## Current Status
- status: {data.get('status', 'unknown')}
- last_check: {timestamp}
- port: {data.get('port', 8080)}
- response_time: {data.get('response_time', 'N/A')}ms

## Performance History
- average_response_time: {data.get('avg_response_time', 'N/A')}ms
- uptime_percentage: {data.get('uptime', 'N/A')}%
- total_requests: {data.get('total_requests', 0)}

## Recent Issues
{self._format_issues(data.get('issues', []))}

## Recovery Actions
{self._format_recovery_actions(data.get('recovery_actions', []))}

## Learning Insights
{self._format_insights(data.get('insights', []))}
"""
        
        elif entity == "idle-testing":
            content = f"""# Idle Testing System

## Configuration
- idle_threshold: 60 minutes
- test_interval_during_idle: 30 minutes
- last_traffic_detected: {data.get('last_traffic', 'N/A')}
- idle_since: {data.get('idle_since', 'N/A')}

## Test Results
{self._format_test_results(data.get('test_results', []))}

## Performance During Idle
- tunnel_latency: {data.get('tunnel_latency', 'N/A')}ms
- connection_stability: {data.get('connection_stability', 'N/A')}%
- resource_usage: {data.get('resource_usage', 'N/A')}%

## Optimization Insights
{self._format_optimization_insights(data.get('optimizations', []))}
"""
        
        else:
            # Общий формат для других сущностей
            content = f"""# {entity.replace('-', ' ').title()}

## Status
- last_update: {timestamp}
- status: {data.get('status', 'unknown')}

## Data
{self._format_generic_data(data)}
"""
        
        with open(entity_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        logger.info(f"Память обновлена для сущности: {entity}")
    
    def _format_issues(self, issues: List[Dict]) -> str:
        if not issues:
            return "- No recent issues"
        
        formatted = []
        for issue in issues[-5:]:  # Последние 5 проблем
            formatted.append(f"- {issue.get('timestamp', 'N/A')}: {issue.get('description', 'Unknown issue')}")
        
        return "\n".join(formatted)
    
    def _format_recovery_actions(self, actions: List[Dict]) -> str:
        if not actions:
            return "- No recovery actions taken"
        
        formatted = []
        for action in actions[-5:]:
            formatted.append(f"- {action.get('timestamp', 'N/A')}: {action.get('action', 'Unknown action')} - {action.get('result', 'Unknown result')}")
        
        return "\n".join(formatted)
    
    def _format_insights(self, insights: List[str]) -> str:
        if not insights:
            return "- No insights available"
        
        return "\n".join([f"- {insight}" for insight in insights[-10:]])
    
    def _format_test_results(self, results: List[Dict]) -> str:
        if not results:
            return "- No test results available"
        
        formatted = []
        for result in results[-10:]:
            status = "✅ PASS" if result.get('success') else "❌ FAIL"
            formatted.append(f"- {result.get('timestamp', 'N/A')}: {result.get('test_type', 'Unknown')} - {status}")
        
        return "\n".join(formatted)
    
    def _format_optimization_insights(self, optimizations: List[str]) -> str:
        if not optimizations:
            return "- No optimization insights available"
        
        return "\n".join([f"- {opt}" for opt in optimizations[-5:]])
    
    def _format_generic_data(self, data: Dict[str, Any]) -> str:
        formatted = []
        for key, value in data.items():
            if key not in ['status']:
                formatted.append(f"- {key}: {value}")
        
        return "\n".join(formatted) if formatted else "- No additional data"
    
    def get_memory_summary(self) -> str:
        """Получение краткого обзора памяти"""
        try:
            with open(self.main_memory_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Извлечение ключевых метрик
            lines = content.split('\n')
            summary = []
            
            for line in lines:
                if any(keyword in line.lower() for keyword in ['status:', 'uptime:', 'incidents:', 'success_rate:']):
                    summary.append(line.strip())
            
            return "\n".join(summary)
            
        except Exception as e:
            logger.error(f"Ошибка получения обзора памяти: {e}")
            return "Memory summary unavailable"

class IdleTestingManager:
    """Менеджер тестирования во время простоя"""
    
    def __init__(self, memory_manager: MemoryManager):
        self.memory_manager = memory_manager
        self.idle_threshold = 60 * 60  # 60 минут в секундах
        self.test_interval = 30 * 60   # 30 минут в секундах
        self.last_traffic_time = time.time()
        self.idle_testing_active = False
        self.test_results = []
    
    def update_traffic_activity(self):
        """Обновление времени последней активности трафика"""
        self.last_traffic_time = time.time()
        if self.idle_testing_active:
            self.idle_testing_active = False
            logger.info("🔄 Трафик возобновлен, отключение режима тестирования простоя")
    
    def is_system_idle(self) -> bool:
        """Проверка, находится ли система в состоянии простоя"""
        return (time.time() - self.last_traffic_time) > self.idle_threshold
    
    async def start_idle_testing(self):
        """Запуск тестирования во время простоя"""
        if not self.is_system_idle():
            return
        
        if not self.idle_testing_active:
            self.idle_testing_active = True
            idle_duration = (time.time() - self.last_traffic_time) / 60
            logger.info(f"🧪 Система в простое {idle_duration:.1f} минут, запуск тестирования")
        
        # Выполнение различных тестов
        test_results = []
        
        # Тест 1: Проверка туннельного соединения
        tunnel_test = await self._test_tunnel_connectivity()
        test_results.append(tunnel_test)
        
        # Тест 2: Проверка латентности
        latency_test = await self._test_latency()
        test_results.append(latency_test)
        
        # Тест 3: Проверка AI сервисов
        ai_test = await self._test_ai_services()
        test_results.append(ai_test)
        
        # Тест 4: Проверка геолокации
        geo_test = await self._test_geolocation()
        test_results.append(geo_test)
        
        # Тест 5: Проверка системных ресурсов
        resource_test = await self._test_system_resources()
        test_results.append(resource_test)
        
        # Сохранение результатов в память
        self.test_results.extend(test_results)
        
        # Обновление памяти
        idle_data = {
            'last_traffic': datetime.fromtimestamp(self.last_traffic_time).isoformat(),
            'idle_since': datetime.fromtimestamp(self.last_traffic_time).isoformat(),
            'test_results': test_results,
            'tunnel_latency': latency_test.get('latency', 'N/A'),
            'connection_stability': self._calculate_stability(),
            'resource_usage': resource_test.get('cpu_usage', 'N/A'),
            'optimizations': self._generate_optimization_insights(test_results)
        }
        
        self.memory_manager.update_memory('idle-testing', idle_data)
        
        # Логирование результатов
        passed_tests = sum(1 for test in test_results if test.get('success'))
        total_tests = len(test_results)
        
        logger.info(f"🧪 Тестирование завершено: {passed_tests}/{total_tests} тестов прошли успешно")
        
        return test_results
    
    async def _test_tunnel_connectivity(self) -> Dict[str, Any]:
        """Тест туннельного соединения"""
        try:
            start_time = time.time()
            
            # Тестирование различных туннельных соединений
            test_urls = [
                "https://httpbin.org/ip",
                "https://api.ipify.org",
                "https://ifconfig.me/ip"
            ]
            
            successful_connections = 0
            total_response_time = 0
            
            for url in test_urls:
                try:
                    response = requests.get(url, timeout=10)
                    if response.status_code == 200:
                        successful_connections += 1
                        total_response_time += response.elapsed.total_seconds()
                except:
                    pass
            
            success = successful_connections > 0
            avg_response_time = total_response_time / max(successful_connections, 1)
            
            return {
                'test_type': 'tunnel_connectivity',
                'timestamp': datetime.now().isoformat(),
                'success': success,
                'successful_connections': successful_connections,
                'total_tested': len(test_urls),
                'average_response_time': avg_response_time,
                'details': f"Успешных соединений: {successful_connections}/{len(test_urls)}"
            }
            
        except Exception as e:
            return {
                'test_type': 'tunnel_connectivity',
                'timestamp': datetime.now().isoformat(),
                'success': False,
                'error': str(e)
            }
    
    async def _test_latency(self) -> Dict[str, Any]:
        """Тест латентности"""
        try:
            # Тестирование латентности до различных серверов
            test_hosts = [
                "8.8.8.8",
                "1.1.1.1", 
                "208.67.222.222"
            ]
            
            latencies = []
            
            for host in test_hosts:
                try:
                    start_time = time.time()
                    response = requests.get(f"http://{host}", timeout=5)
                    latency = (time.time() - start_time) * 1000
                    latencies.append(latency)
                except:
                    # Используем ping как альтернативу
                    try:
                        result = subprocess.run(
                            ["ping", "-c", "1", "-W", "5", host],
                            capture_output=True,
                            text=True
                        )
                        if result.returncode == 0:
                            # Извлечение времени из вывода ping
                            output = result.stdout
                            if "time=" in output:
                                time_str = output.split("time=")[1].split()[0]
                                latency = float(time_str)
                                latencies.append(latency)
                    except:
                        pass
            
            if latencies:
                avg_latency = sum(latencies) / len(latencies)
                max_latency = max(latencies)
                min_latency = min(latencies)
                
                return {
                    'test_type': 'latency',
                    'timestamp': datetime.now().isoformat(),
                    'success': True,
                    'latency': avg_latency,
                    'min_latency': min_latency,
                    'max_latency': max_latency,
                    'tested_hosts': len(test_hosts),
                    'successful_tests': len(latencies)
                }
            else:
                return {
                    'test_type': 'latency',
                    'timestamp': datetime.now().isoformat(),
                    'success': False,
                    'error': 'No successful latency measurements'
                }
                
        except Exception as e:
            return {
                'test_type': 'latency',
                'timestamp': datetime.now().isoformat(),
                'success': False,
                'error': str(e)
            }
    
    async def _test_ai_services(self) -> Dict[str, Any]:
        """Тест AI сервисов"""
        try:
            # Тестирование доступности AI сервисов
            ai_endpoints = [
                "http://localhost:8081/health",
                "http://localhost:8081/api/test"
            ]
            
            successful_tests = 0
            total_response_time = 0
            
            for endpoint in ai_endpoints:
                try:
                    start_time = time.time()
                    response = requests.get(endpoint, timeout=10)
                    response_time = time.time() - start_time
                    
                    if response.status_code == 200:
                        successful_tests += 1
                        total_response_time += response_time
                except:
                    pass
            
            success = successful_tests > 0
            avg_response_time = total_response_time / max(successful_tests, 1) if successful_tests > 0 else 0
            
            return {
                'test_type': 'ai_services',
                'timestamp': datetime.now().isoformat(),
                'success': success,
                'successful_tests': successful_tests,
                'total_endpoints': len(ai_endpoints),
                'average_response_time': avg_response_time,
                'details': f"AI сервисы доступны: {successful_tests}/{len(ai_endpoints)}"
            }
            
        except Exception as e:
            return {
                'test_type': 'ai_services',
                'timestamp': datetime.now().isoformat(),
                'success': False,
                'error': str(e)
            }
    
    async def _test_geolocation(self) -> Dict[str, Any]:
        """Тест геолокации"""
        try:
            # Проверка корректности геолокации
            geo_services = [
                "https://httpbin.org/ip",
                "https://api.ipify.org?format=json",
                "https://ipapi.co/json/"
            ]
            
            detected_locations = []
            
            for service in geo_services:
                try:
                    response = requests.get(service, timeout=10)
                    if response.status_code == 200:
                        data = response.json() if 'json' in service else {'ip': response.text.strip()}
                        detected_locations.append(data)
                except:
                    pass
            
            success = len(detected_locations) > 0
            
            return {
                'test_type': 'geolocation',
                'timestamp': datetime.now().isoformat(),
                'success': success,
                'detected_locations': len(detected_locations),
                'total_services': len(geo_services),
                'details': f"Геолокация определена через {len(detected_locations)} сервисов"
            }
            
        except Exception as e:
            return {
                'test_type': 'geolocation',
                'timestamp': datetime.now().isoformat(),
                'success': False,
                'error': str(e)
            }
    
    async def _test_system_resources(self) -> Dict[str, Any]:
        """Тест системных ресурсов"""
        try:
            cpu_usage = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Определение состояния ресурсов
            resource_status = "healthy"
            if cpu_usage > 80 or memory.percent > 80 or disk.percent > 85:
                resource_status = "warning"
            if cpu_usage > 95 or memory.percent > 95 or disk.percent > 95:
                resource_status = "critical"
            
            return {
                'test_type': 'system_resources',
                'timestamp': datetime.now().isoformat(),
                'success': resource_status != "critical",
                'cpu_usage': cpu_usage,
                'memory_usage': memory.percent,
                'disk_usage': disk.percent,
                'resource_status': resource_status,
                'details': f"CPU: {cpu_usage}%, RAM: {memory.percent}%, Disk: {disk.percent}%"
            }
            
        except Exception as e:
            return {
                'test_type': 'system_resources',
                'timestamp': datetime.now().isoformat(),
                'success': False,
                'error': str(e)
            }
    
    def _calculate_stability(self) -> float:
        """Расчет стабильности соединения"""
        if not self.test_results:
            return 0.0
        
        recent_tests = self.test_results[-20:]  # Последние 20 тестов
        successful_tests = sum(1 for test in recent_tests if test.get('success'))
        
        return (successful_tests / len(recent_tests)) * 100 if recent_tests else 0.0
    
    def _generate_optimization_insights(self, test_results: List[Dict]) -> List[str]:
        """Генерация инсайтов для оптимизации"""
        insights = []
        
        # Анализ результатов тестов
        failed_tests = [test for test in test_results if not test.get('success')]
        
        if failed_tests:
            insights.append(f"Обнаружено {len(failed_tests)} неудачных тестов во время простоя")
        
        # Анализ латентности
        latency_tests = [test for test in test_results if test.get('test_type') == 'latency']
        if latency_tests:
            avg_latency = sum(test.get('latency', 0) for test in latency_tests) / len(latency_tests)
            if avg_latency > 200:
                insights.append(f"Высокая латентность во время простоя: {avg_latency:.1f}ms")
        
        # Анализ ресурсов
        resource_tests = [test for test in test_results if test.get('test_type') == 'system_resources']
        if resource_tests:
            latest_resource = resource_tests[-1]
            if latest_resource.get('cpu_usage', 0) > 50:
                insights.append("Высокое использование CPU во время простоя - возможна оптимизация")
        
        return insights

class TrafficRouterRecoveryAgent:
    """AI агент для мониторинга и восстановления системы маршрутизации трафика"""
    
    def __init__(self, config_path: str = "config/recovery-config.yaml"):
        self.config = self._load_config(config_path)
        self.omnara_client = None
        self.docker_client = docker.from_env()
        self.services_status = {}
        self.recovery_attempts = {}
        self.max_recovery_attempts = 3
        self.recovery_cooldown = 300  # 5 минут
        
        self.memory_manager = MemoryManager()
        self.idle_testing_manager = IdleTestingManager(self.memory_manager)
        
        # Инициализация Omnara клиента
        self._init_omnara_client()
    
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
                "traffic-router": {
                    "port": 8080,
                    "health_endpoint": "/health",
                    "restart_command": "npm run start:router",
                    "docker_container": "traffic-router-main"
                },
                "ai-proxy": {
                    "port": 8081,
                    "health_endpoint": "/health",
                    "restart_command": "npm run start:ai-proxy",
                    "docker_container": "traffic-router-ai-proxy"
                },
                "monitoring": {
                    "port": 8082,
                    "health_endpoint": "/metrics",
                    "restart_command": "npm run start:monitoring",
                    "docker_container": "traffic-router-monitoring"
                }
            },
            "monitoring": {
                "check_interval": 30,
                "timeout": 10,
                "cpu_threshold": 90,
                "memory_threshold": 90,
                "disk_threshold": 85
            },
            "notifications": {
                "telegram_bot_token": os.getenv("TELEGRAM_BOT_TOKEN"),
                "telegram_chat_id": os.getenv("TELEGRAM_CHAT_ID"),
                "email_enabled": True,
                "sms_enabled": False
            }
        }
    
    def _init_omnara_client(self):
        """Инициализация Omnara клиента"""
        try:
            config = AgentConfig(
                name="TrafficRouter-Recovery-Agent",
                description="AI агент для мониторинга и восстановления системы маршрутизации трафика",
                version="1.0.0",
                capabilities=[
                    "service_monitoring",
                    "automatic_recovery",
                    "performance_analysis",
                    "predictive_maintenance"
                ]
            )
            
            self.omnara_client = OmnaraClient(config)
            logger.info("Omnara клиент успешно инициализирован")
            
        except Exception as e:
            logger.error(f"Ошибка инициализации Omnara клиента: {e}")
            self.omnara_client = None
    
    async def start_monitoring(self):
        """Запуск основного цикла мониторинга"""
        logger.info("🚀 Запуск AI агента восстановления трафик-роутера с Mem-Agent памятью")
        
        if self.omnara_agent:
            await self.omnara_agent.start()
            await self.omnara_agent.log("Агент восстановления с памятью Markdown запущен и готов к работе")
        
        idle_testing_task = asyncio.create_task(self._idle_testing_loop())
        
        while True:
            try:
                await self._monitoring_cycle()
                await asyncio.sleep(self.config["monitoring"]["check_interval"])
                
            except KeyboardInterrupt:
                logger.info("Получен сигнал остановки")
                idle_testing_task.cancel()
                break
            except Exception as e:
                logger.error(f"Ошибка в цикле мониторинга: {e}")
                await asyncio.sleep(10)
    
    async def _idle_testing_loop(self):
        """Цикл тестирования во время простоя"""
        while True:
            try:
                if self.idle_testing_manager.is_system_idle():
                    test_results = await self.idle_testing_manager.start_idle_testing()
                    
                    if test_results and self.omnara_agent:
                        failed_tests = [test for test in test_results if not test.get('success')]
                        if failed_tests:
                            await self.omnara_agent.log(f"⚠️ Обнаружены проблемы во время простоя: {len(failed_tests)} тестов не прошли")
                        else:
                            await self.omnara_agent.log("✅ Все тесты во время простоя прошли успешно")
                
                # Ожидание следующего цикла тестирования
                await asyncio.sleep(self.idle_testing_manager.test_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Ошибка в цикле тестирования простоя: {e}")
                await asyncio.sleep(60)
    
    async def _monitoring_cycle(self):
        """Один цикл мониторинга всех сервисов"""
        logger.info("🔍 Выполняется проверка состояния сервисов...")
        
        # Обновление активности трафика
        self.idle_testing_manager.update_traffic_activity()
        
        # Проверка сервисов
        for service_name, service_config in self.config["services"].items():
            await self._check_service_health(service_name, service_config)
        
        # Проверка системных ресурсов
        await self._check_system_resources()
        
        # Проверка сетевой связности
        await self._check_network_connectivity()
        
        # Анализ логов на предмет ошибок
        await self._analyze_logs()
        
        # Обновление памяти после каждого цикла мониторинга
        await self._update_system_memory()
        
        # Отправка статуса в Omnara
        if self.omnara_agent:
            status_report = self._generate_status_report()
            memory_summary = self.memory_manager.get_memory_summary()
            await self.omnara_agent.log(f"Статус системы: {status_report}\n\nПамять системы:\n{memory_summary}")
    
    async def _update_system_memory(self):
        """Обновление системной памяти"""
        try:
            # Обновление памяти для каждого сервиса
            for service_name, status in self.services_status.items():
                service_data = {
                    'status': status.get('status', 'unknown'),
                    'port': self.config["services"].get(service_name, {}).get('port', 'N/A'),
                    'response_time': status.get('response_time', 'N/A'),
                    'last_check': status.get('last_check', datetime.now()).isoformat() if isinstance(status.get('last_check'), datetime) else str(status.get('last_check', 'N/A'))
                }
                
                self.memory_manager.update_memory(service_name, service_data)
            
            # Обновление общей системной памяти
            system_data = {
                'status': 'active',
                'uptime': time.time() - psutil.boot_time(),
                'cpu_usage': psutil.cpu_percent(),
                'memory_usage': psutil.virtual_memory().percent,
                'disk_usage': psutil.disk_usage('/').percent,
                'services_count': len(self.services_status),
                'healthy_services': sum(1 for status in self.services_status.values() if status.get('status') == 'healthy')
            }
            
            self.memory_manager.update_memory('system-status', system_data)
            
        except Exception as e:
            logger.error(f"Ошибка обновления памяти: {e}")
    
    async def _check_service_health(self, service_name: str, service_config: Dict[str, Any]):
        """Проверка здоровья конкретного сервиса"""
        try:
            # Проверка HTTP endpoint
            health_url = f"http://localhost:{service_config['port']}{service_config['health_endpoint']}"
            
            response = requests.get(
                health_url, 
                timeout=self.config["monitoring"]["timeout"]
            )
            
            if response.status_code == 200:
                self.services_status[service_name] = {
                    "status": "healthy",
                    "last_check": datetime.now(),
                    "response_time": response.elapsed.total_seconds()
                }
                logger.info(f"✅ {service_name}: Сервис работает нормально")
                
            else:
                await self._handle_service_failure(service_name, f"HTTP {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            await self._handle_service_failure(service_name, f"Сетевая ошибка: {e}")
        
        except Exception as e:
            await self._handle_service_failure(service_name, f"Неожиданная ошибка: {e}")
    
    async def _handle_service_failure(self, service_name: str, error_message: str):
        """Обработка отказа сервиса"""
        logger.error(f"❌ {service_name}: {error_message}")
        
        self.services_status[service_name] = {
            "status": "failed",
            "last_check": datetime.now(),
            "error": error_message
        }
        
        # Отправка уведомления в Omnara
        if self.omnara_agent:
            await self.omnara_agent.log(f"🚨 КРИТИЧНО: Сервис {service_name} недоступен - {error_message}")
            await self.omnara_agent.request_input(
                f"Сервис {service_name} недоступен. Попытаться автоматическое восстановление?",
                options=["Да, восстановить", "Нет, только уведомить", "Перезапустить всю систему"]
            )
        
        # Автоматическое восстановление
        await self._attempt_service_recovery(service_name)
    
    async def _attempt_service_recovery(self, service_name: str):
        """Попытка автоматического восстановления сервиса"""
        current_time = datetime.now()
        
        # Проверка лимита попыток восстановления
        if service_name in self.recovery_attempts:
            last_attempt, attempts = self.recovery_attempts[service_name]
            
            if current_time - last_attempt < timedelta(seconds=self.recovery_cooldown):
                if attempts >= self.max_recovery_attempts:
                    logger.warning(f"⚠️ {service_name}: Превышен лимит попыток восстановления")
                    await self._escalate_failure(service_name)
                    return
            else:
                # Сброс счетчика после периода охлаждения
                self.recovery_attempts[service_name] = (current_time, 0)
        else:
            self.recovery_attempts[service_name] = (current_time, 0)
        
        # Увеличение счетчика попыток
        last_attempt, attempts = self.recovery_attempts[service_name]
        self.recovery_attempts[service_name] = (current_time, attempts + 1)
        
        logger.info(f"🔄 {service_name}: Попытка восстановления #{attempts + 1}")
        
        if self.omnara_agent:
            await self.omnara_agent.log(f"Начинаю восстановление сервиса {service_name} (попытка #{attempts + 1})")
        
        service_config = self.config["services"][service_name]
        
        # Стратегии восстановления
        recovery_strategies = [
            self._restart_docker_container,
            self._restart_process,
            self._full_service_restart,
            self._system_cleanup_and_restart
        ]
        
        for strategy in recovery_strategies:
            try:
                success = await strategy(service_name, service_config)
                if success:
                    logger.info(f"✅ {service_name}: Сервис успешно восстановлен")
                    if self.omnara_agent:
                        await self.omnara_agent.log(f"✅ Сервис {service_name} успешно восстановлен")
                    return
                    
            except Exception as e:
                logger.error(f"❌ Ошибка стратегии восстановления для {service_name}: {e}")
        
        # Если все стратегии не сработали
        await self._escalate_failure(service_name)
    
    async def _restart_docker_container(self, service_name: str, service_config: Dict[str, Any]) -> bool:
        """Перезапуск Docker контейнера"""
        try:
            container_name = service_config.get("docker_container")
            if not container_name:
                return False
            
            logger.info(f"🐳 Перезапуск Docker контейнера {container_name}")
            
            container = self.docker_client.containers.get(container_name)
            container.restart()
            
            # Ожидание запуска
            await asyncio.sleep(10)
            
            # Проверка успешности
            container.reload()
            return container.status == "running"
            
        except docker.errors.NotFound:
            logger.warning(f"Docker контейнер {container_name} не найден")
            return False
        except Exception as e:
            logger.error(f"Ошибка перезапуска Docker контейнера: {e}")
            return False
    
    async def _restart_process(self, service_name: str, service_config: Dict[str, Any]) -> bool:
        """Перезапуск процесса через команду"""
        try:
            restart_command = service_config.get("restart_command")
            if not restart_command:
                return False
            
            logger.info(f"🔄 Выполнение команды перезапуска: {restart_command}")
            
            # Остановка существующих процессов
            await self._kill_service_processes(service_name)
            
            # Запуск нового процесса
            process = await asyncio.create_subprocess_shell(
                restart_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Ожидание запуска
            await asyncio.sleep(15)
            
            return process.returncode is None or process.returncode == 0
            
        except Exception as e:
            logger.error(f"Ошибка перезапуска процесса: {e}")
            return False
    
    async def _full_service_restart(self, service_name: str, service_config: Dict[str, Any]) -> bool:
        """Полный перезапуск сервиса с очисткой"""
        try:
            logger.info(f"🔄 Полный перезапуск сервиса {service_name}")
            
            # Очистка временных файлов
            temp_dirs = ["/tmp", "/var/tmp"]
            for temp_dir in temp_dirs:
                subprocess.run(f"find {temp_dir} -name '*{service_name}*' -delete", shell=True)
            
            # Очистка логов
            log_files = [f"logs/{service_name}.log", f"{service_name}.log"]
            for log_file in log_files:
                if os.path.exists(log_file):
                    open(log_file, 'w').close()
            
            # Перезапуск через Docker Compose
            subprocess.run("docker-compose down", shell=True)
            await asyncio.sleep(5)
            subprocess.run("docker-compose up -d", shell=True)
            
            await asyncio.sleep(30)
            return True
            
        except Exception as e:
            logger.error(f"Ошибка полного перезапуска: {e}")
            return False
    
    async def _system_cleanup_and_restart(self, service_name: str, service_config: Dict[str, Any]) -> bool:
        """Системная очистка и перезапуск"""
        try:
            logger.info("🧹 Выполнение системной очистки")
            
            # Очистка системного кэша
            subprocess.run("sync && echo 3 > /proc/sys/vm/drop_caches", shell=True)
            
            # Перезапуск сетевых интерфейсов
            subprocess.run("systemctl restart networking", shell=True)
            
            # Полный перезапуск всех сервисов
            subprocess.run("docker system prune -f", shell=True)
            subprocess.run("docker-compose down && docker-compose up -d", shell=True)
            
            await asyncio.sleep(60)
            return True
            
        except Exception as e:
            logger.error(f"Ошибка системной очистки: {e}")
            return False
    
    async def _kill_service_processes(self, service_name: str):
        """Завершение процессов сервиса"""
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                if service_name in ' '.join(proc.info['cmdline'] or []):
                    proc.terminate()
                    
        except Exception as e:
            logger.error(f"Ошибка завершения процессов: {e}")
    
    async def _escalate_failure(self, service_name: str):
        """Эскалация критической ошибки"""
        logger.critical(f"🚨 КРИТИЧЕСКАЯ ОШИБКА: Не удалось восстановить сервис {service_name}")
        
        if self.omnara_agent:
            await self.omnara_agent.log(f"🚨 КРИТИЧНО: Сервис {service_name} не может быть восстановлен автоматически")
            await self.omnara_agent.request_input(
                f"Требуется ручное вмешательство для сервиса {service_name}. Действия:",
                options=[
                    "Перезагрузить сервер",
                    "Связаться с администратором", 
                    "Переключиться на резервный сервер",
                    "Временно отключить сервис"
                ]
            )
        
        # Отправка критических уведомлений
        await self._send_critical_notification(service_name)
    
    async def _check_system_resources(self):
        """Проверка системных ресурсов"""
        try:
            # CPU
            cpu_percent = psutil.cpu_percent(interval=1)
            if cpu_percent > self.config["monitoring"]["cpu_threshold"]:
                logger.warning(f"⚠️ Высокая загрузка CPU: {cpu_percent}%")
                if self.omnara_agent:
                    await self.omnara_agent.log(f"Предупреждение: CPU загружен на {cpu_percent}%")
            
            # Memory
            memory = psutil.virtual_memory()
            if memory.percent > self.config["monitoring"]["memory_threshold"]:
                logger.warning(f"⚠️ Высокое использование памяти: {memory.percent}%")
                if self.omnara_agent:
                    await self.omnara_agent.log(f"Предупреждение: Память загружена на {memory.percent}%")
            
            # Disk
            disk = psutil.disk_usage('/')
            if disk.percent > self.config["monitoring"]["disk_threshold"]:
                logger.warning(f"⚠️ Мало места на диске: {disk.percent}%")
                if self.omnara_agent:
                    await self.omnara_agent.log(f"Предупреждение: Диск заполнен на {disk.percent}%")
                    
        except Exception as e:
            logger.error(f"Ошибка проверки системных ресурсов: {e}")
    
    async def _check_network_connectivity(self):
        """Проверка сетевой связности"""
        test_urls = [
            "https://8.8.8.8",
            "https://1.1.1.1", 
            "https://google.com",
            "https://github.com"
        ]
        
        failed_connections = 0
        
        for url in test_urls:
            try:
                response = requests.get(url, timeout=5)
                if response.status_code != 200:
                    failed_connections += 1
            except:
                failed_connections += 1
        
        if failed_connections > len(test_urls) / 2:
            logger.error("🌐 Проблемы с сетевым подключением")
            if self.omnara_agent:
                await self.omnara_agent.log("🚨 Обнаружены проблемы с сетевым подключением")
    
    async def _analyze_logs(self):
        """Анализ логов на предмет ошибок"""
        log_files = [
            "logs/traffic-router.log",
            "logs/ai-proxy.log", 
            "logs/monitoring.log",
            "/var/log/syslog"
        ]
        
        error_patterns = [
            "ERROR",
            "CRITICAL", 
            "FATAL",
            "Exception",
            "Traceback",
            "Connection refused",
            "Timeout"
        ]
        
        for log_file in log_files:
            if os.path.exists(log_file):
                try:
                    with open(log_file, 'r') as f:
                        recent_lines = f.readlines()[-100:]  # Последние 100 строк
                        
                    for line in recent_lines:
                        for pattern in error_patterns:
                            if pattern in line:
                                logger.warning(f"📋 Найдена ошибка в {log_file}: {line.strip()}")
                                if self.omnara_agent:
                                    await self.omnara_agent.log(f"Ошибка в логах: {line.strip()}")
                                break
                                
                except Exception as e:
                    logger.error(f"Ошибка анализа лога {log_file}: {e}")
    
    def _generate_status_report(self) -> Dict[str, Any]:
        """Генерация отчета о состоянии системы"""
        healthy_services = sum(1 for status in self.services_status.values() if status.get("status") == "healthy")
        total_services = len(self.services_status)
        
        return {
            "timestamp": datetime.now().isoformat(),
            "services_healthy": f"{healthy_services}/{total_services}",
            "system_load": psutil.cpu_percent(),
            "memory_usage": psutil.virtual_memory().percent,
            "disk_usage": psutil.disk_usage('/').percent,
            "uptime": time.time() - psutil.boot_time()
        }
    
    async def _send_critical_notification(self, service_name: str):
        """Отправка критических уведомлений"""
        message = f"🚨 КРИТИЧЕСКАЯ ОШИБКА: Сервис {service_name} недоступен и не может быть восстановлен автоматически"
        
        # Telegram
        if self.config["notifications"]["telegram_bot_token"]:
            try:
                telegram_url = f"https://api.telegram.org/bot{self.config['notifications']['telegram_bot_token']}/sendMessage"
                requests.post(telegram_url, {
                    "chat_id": self.config["notifications"]["telegram_chat_id"],
                    "text": message
                })
            except Exception as e:
                logger.error(f"Ошибка отправки Telegram уведомления: {e}")

if __name__ == "__main__":
    agent = TrafficRouterRecoveryAgent()
    asyncio.run(agent.start_monitoring())
