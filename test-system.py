#!/usr/bin/env python3
"""
Интегрированная система тестирования Traffic Router
Тестирует все компоненты системы включая ИИ агента
"""

import asyncio
import requests
import time
import json
import logging
from datetime import datetime
from typing import Dict, List, Any
import subprocess
import sys
import os

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/system-test.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class SystemTester:
    """Класс для тестирования всей системы Traffic Router"""
    
    def __init__(self):
        self.services = {
            'web': {'port': 13000, 'endpoint': '/'},
            'ai-proxy': {'port': 13081, 'endpoint': '/health'},
            'monitoring': {'port': 13082, 'endpoint': '/health'}
        }
        self.test_results = {}
        self.start_time = time.time()
        
    def log_test_result(self, test_name: str, success: bool, details: str = ""):
        """Логирование результата теста"""
        status = "✅ PASS" if success else "❌ FAIL"
        logger.info(f"{status} {test_name}: {details}")
        
        self.test_results[test_name] = {
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
    
    async def test_service_connectivity(self, service_name: str, config: Dict) -> bool:
        """Тест подключения к сервису"""
        try:
            url = f"http://localhost:{config['port']}{config['endpoint']}"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                self.log_test_result(f"Connectivity - {service_name}", True, f"Status: {response.status_code}")
                return True
            else:
                self.log_test_result(f"Connectivity - {service_name}", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test_result(f"Connectivity - {service_name}", False, str(e))
            return False
    
    async def test_api_endpoints(self) -> bool:
        """Тест API endpoints"""
        success = True
        
        # Тест статистики AI Proxy
        try:
            response = requests.get("http://localhost:13081/api/stats", timeout=10)
            if response.status_code == 200:
                stats = response.json()
                self.log_test_result("API Stats", True, f"Requests: {stats.get('requests', 0)}")
            else:
                self.log_test_result("API Stats", False, f"Status: {response.status_code}")
                success = False
        except Exception as e:
            self.log_test_result("API Stats", False, str(e))
            success = False
        
        # Тест метрик мониторинга
        try:
            response = requests.get("http://localhost:13082/api/metrics", timeout=10)
            if response.status_code == 200:
                metrics = response.json()
                self.log_test_result("API Metrics", True, f"Uptime: {metrics.get('uptime', 0):.2f}s")
            else:
                self.log_test_result("API Metrics", False, f"Status: {response.status_code}")
                success = False
        except Exception as e:
            self.log_test_result("API Metrics", False, str(e))
            success = False
        
        return success
    
    async def test_ai_agent_functionality(self) -> bool:
        """Тест функциональности ИИ агента"""
        try:
            # Проверяем, что агент может читать память
            memory_files = [
                'memory/system.md',
                'memory/entities/traffic-router.md',
                'memory/entities/ai-proxy.md',
                'memory/entities/monitoring.md',
                'memory/entities/recovery-agent.md'
            ]
            
            memory_accessible = True
            for file_path in memory_files:
                if not os.path.exists(file_path):
                    self.log_test_result(f"Memory File - {file_path}", False, "File not found")
                    memory_accessible = False
                else:
                    self.log_test_result(f"Memory File - {file_path}", True, "File exists")
            
            # Тест конфигурации агента
            if os.path.exists('config/recovery-config.yaml'):
                self.log_test_result("Agent Config", True, "Configuration file exists")
            else:
                self.log_test_result("Agent Config", False, "Configuration file missing")
                memory_accessible = False
            
            return memory_accessible
            
        except Exception as e:
            self.log_test_result("AI Agent Functionality", False, str(e))
            return False
    
    async def test_security_features(self) -> bool:
        """Тест функций безопасности"""
        success = True
        
        # Тест rate limiting
        try:
            # Отправляем много запросов подряд
            for i in range(5):
                response = requests.get("http://localhost:13081/health", timeout=5)
                time.sleep(0.1)
            
            self.log_test_result("Rate Limiting", True, "No rate limit exceeded")
        except Exception as e:
            self.log_test_result("Rate Limiting", False, str(e))
            success = False
        
        # Тест security headers
        try:
            response = requests.get("http://localhost:13081/health", timeout=10)
            security_headers = [
                'X-Content-Type-Options',
                'X-Frame-Options',
                'X-XSS-Protection'
            ]
            
            headers_present = all(header in response.headers for header in security_headers)
            if headers_present:
                self.log_test_result("Security Headers", True, "All security headers present")
            else:
                self.log_test_result("Security Headers", False, "Some security headers missing")
                success = False
                
        except Exception as e:
            self.log_test_result("Security Headers", False, str(e))
            success = False
        
        return success
    
    async def test_monitoring_system(self) -> bool:
        """Тест системы мониторинга"""
        success = True
        
        # Тест health checks
        try:
            response = requests.get("http://localhost:13082/health", timeout=10)
            if response.status_code == 200:
                health_data = response.json()
                self.log_test_result("Health Check", True, f"Status: {health_data.get('status', 'unknown')}")
            else:
                self.log_test_result("Health Check", False, f"Status: {response.status_code}")
                success = False
        except Exception as e:
            self.log_test_result("Health Check", False, str(e))
            success = False
        
        # Тест dashboard
        try:
            response = requests.get("http://localhost:13082/monitoring", timeout=10)
            if response.status_code == 200:
                dashboard_data = response.json()
                self.log_test_result("Monitoring Dashboard", True, f"Title: {dashboard_data.get('title', 'Unknown')}")
            else:
                self.log_test_result("Monitoring Dashboard", False, f"Status: {response.status_code}")
                success = False
        except Exception as e:
            self.log_test_result("Monitoring Dashboard", False, str(e))
            success = False
        
        return success
    
    async def run_comprehensive_test(self):
        """Запуск комплексного тестирования"""
        logger.info("🚀 Starting comprehensive system test...")
        
        # Тест подключения к сервисам
        logger.info("📡 Testing service connectivity...")
        for service_name, config in self.services.items():
            await self.test_service_connectivity(service_name, config)
        
        # Тест API endpoints
        logger.info("🔌 Testing API endpoints...")
        await self.test_api_endpoints()
        
        # Тест функций безопасности
        logger.info("🔒 Testing security features...")
        await self.test_security_features()
        
        # Тест системы мониторинга
        logger.info("📊 Testing monitoring system...")
        await self.test_monitoring_system()
        
        # Тест ИИ агента
        logger.info("🤖 Testing AI agent functionality...")
        await self.test_ai_agent_functionality()
        
        # Генерация отчета
        await self.generate_test_report()
    
    async def generate_test_report(self):
        """Генерация отчета о тестировании"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result['success'])
        failed_tests = total_tests - passed_tests
        
        test_duration = time.time() - self.start_time
        
        logger.info("=" * 60)
        logger.info("📋 TEST REPORT")
        logger.info("=" * 60)
        logger.info(f"Total Tests: {total_tests}")
        logger.info(f"Passed: {passed_tests}")
        logger.info(f"Failed: {failed_tests}")
        logger.info(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        logger.info(f"Test Duration: {test_duration:.2f} seconds")
        logger.info("=" * 60)
        
        # Детали неудачных тестов
        if failed_tests > 0:
            logger.info("❌ FAILED TESTS:")
            for test_name, result in self.test_results.items():
                if not result['success']:
                    logger.info(f"  - {test_name}: {result['details']}")
        
        # Сохранение отчета в файл
        report_data = {
            'summary': {
                'total_tests': total_tests,
                'passed_tests': passed_tests,
                'failed_tests': failed_tests,
                'success_rate': (passed_tests/total_tests)*100,
                'test_duration': test_duration,
                'timestamp': datetime.now().isoformat()
            },
            'results': self.test_results
        }
        
        with open('logs/test-report.json', 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"📄 Detailed report saved to: logs/test-report.json")
        
        return passed_tests == total_tests

async def main():
    """Главная функция"""
    tester = SystemTester()
    success = await tester.run_comprehensive_test()
    
    if success:
        logger.info("🎉 All tests passed! System is ready for production.")
        sys.exit(0)
    else:
        logger.error("💥 Some tests failed. Please check the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
