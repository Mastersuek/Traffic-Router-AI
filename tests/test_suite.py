#!/usr/bin/env python3
"""
Test Suite for Enhanced Recovery Agent
Комплексный набор тестов для всех компонентов системы
"""

import asyncio
import sys
import os
import json
import tempfile
import shutil
import time
from pathlib import Path
from datetime import datetime
import logging
from typing import Dict, List, Any, Optional

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Configure logging for tests
logging.basicConfig(
    level=logging.WARNING,  # Reduce noise during tests
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class TestResult:
    """Результат выполнения теста"""
    def __init__(self, name: str, passed: bool, duration: float, error: str = None, details: Dict[str, Any] = None):
        self.name = name
        self.passed = passed
        self.duration = duration
        self.error = error
        self.details = details or {}
        self.timestamp = datetime.now()

class TestSuite:
    """Основной класс для выполнения всех тестов"""
    
    def __init__(self):
        self.results: List[TestResult] = []
        self.temp_dirs: List[str] = []
        
    def create_temp_dir(self) -> str:
        """Создание временной директории для тестов"""
        temp_dir = tempfile.mkdtemp()
        self.temp_dirs.append(temp_dir)
        return temp_dir
    
    def cleanup_temp_dirs(self):
        """Очистка временных директорий"""
        for temp_dir in self.temp_dirs:
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                print(f"Warning: Failed to cleanup {temp_dir}: {e}")
        self.temp_dirs.clear()
    
    async def run_test(self, test_name: str, test_func, *args, **kwargs) -> TestResult:
        """Выполнение отдельного теста с измерением времени"""
        print(f"🧪 Running {test_name}...")
        start_time = time.time()
        
        try:
            result = await test_func(*args, **kwargs)
            duration = time.time() - start_time
            
            if result:
                print(f"✅ {test_name} passed ({duration:.2f}s)")
                return TestResult(test_name, True, duration)
            else:
                print(f"❌ {test_name} failed ({duration:.2f}s)")
                return TestResult(test_name, False, duration, "Test returned False")
                
        except Exception as e:
            duration = time.time() - start_time
            print(f"❌ {test_name} failed with exception ({duration:.2f}s): {e}")
            return TestResult(test_name, False, duration, str(e))
    
    async def test_file_structure(self) -> bool:
        """Тест структуры файлов проекта"""
        try:
            required_files = [
                "agents/enhanced_recovery_agent_v2.py",
                "lib/mcp-ai-agent-integration.py",
                "lib/memory-manager.py",
                "lib/session-manager.py",
                "server/memory-mcp-server.py",
                "server/session-mcp-server.py",
                "config/memory-config.yaml",
                "config/session-config.yaml"
            ]
            
            missing_files = []
            for file_path in required_files:
                if not os.path.exists(file_path):
                    missing_files.append(file_path)
            
            if missing_files:
                print(f"Missing required files: {missing_files}")
                return False
            
            return True
            
        except Exception as e:
            print(f"File structure test error: {e}")
            return False
    
    async def test_configuration_loading(self) -> bool:
        """Тест загрузки конфигураций"""
        try:
            # Test memory config
            memory_config_path = "config/memory-config.yaml"
            if os.path.exists(memory_config_path):
                try:
                    import yaml
                    with open(memory_config_path, 'r', encoding='utf-8') as f:
                        memory_config = yaml.safe_load(f)
                        if not memory_config or 'memory' not in memory_config:
                            return False
                except ImportError:
                    print("PyYAML not available, skipping YAML validation")
            
            # Test session config
            session_config_path = "config/session-config.yaml"
            if os.path.exists(session_config_path):
                try:
                    import yaml
                    with open(session_config_path, 'r', encoding='utf-8') as f:
                        session_config = yaml.safe_load(f)
                        if not session_config or 'sessions' not in session_config:
                            return False
                except ImportError:
                    print("PyYAML not available, skipping YAML validation")
            
            return True
            
        except Exception as e:
            print(f"Configuration loading test error: {e}")
            return False
    
    async def test_import_structure(self) -> bool:
        """Тест импортов и зависимостей"""
        try:
            # Test basic Python syntax by attempting to compile files
            python_files = [
                "agents/enhanced_recovery_agent_v2.py",
                "agents/enhanced_recovery_agent_v2_clean.py",
                "lib/mcp-ai-agent-integration.py",
                "lib/memory-manager.py",
                "lib/session-manager.py",
                "server/memory-mcp-server.py",
                "server/session-mcp-server.py"
            ]
            
            for py_file in python_files:
                if os.path.exists(py_file):
                    try:
                        with open(py_file, 'r', encoding='utf-8') as f:
                            content = f.read()
                        compile(content, py_file, 'exec')
                    except SyntaxError as e:
                        print(f"Syntax error in {py_file}: {e}")
                        return False
            
            return True
            
        except Exception as e:
            print(f"Import structure test error: {e}")
            return False
    
    async def run_all_tests(self) -> Dict[str, Any]:
        """Выполнение всех тестов"""
        print("🚀 Starting Test Suite...\n")
        
        # Define all tests
        tests = [
            ("File Structure", self.test_file_structure),
            ("Import Structure", self.test_import_structure),
            ("Configuration Loading", self.test_configuration_loading),
        ]
        
        # Run all tests
        for test_name, test_func in tests:
            result = await self.run_test(test_name, test_func)
            self.results.append(result)
        
        # Generate summary
        passed_tests = sum(1 for r in self.results if r.passed)
        total_tests = len(self.results)
        total_duration = sum(r.duration for r in self.results)
        
        summary = {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "success_rate": (passed_tests / total_tests) * 100 if total_tests > 0 else 0,
            "total_duration": total_duration,
            "timestamp": datetime.now().isoformat(),
            "results": [
                {
                    "name": r.name,
                    "passed": r.passed,
                    "duration": r.duration,
                    "error": r.error,
                    "timestamp": r.timestamp.isoformat()
                }
                for r in self.results
            ]
        }
        
        return summary
    
    def print_summary(self, summary: Dict[str, Any]):
        """Вывод сводки результатов тестов"""
        print(f"\n📊 Test Results Summary:")
        print(f"   Total Tests: {summary['total_tests']}")
        print(f"   Passed: {summary['passed_tests']} ✅")
        print(f"   Failed: {summary['failed_tests']} ❌")
        print(f"   Success Rate: {summary['success_rate']:.1f}%")
        print(f"   Total Duration: {summary['total_duration']:.2f}s")
        
        if summary['failed_tests'] > 0:
            print(f"\n❌ Failed Tests:")
            for result in summary['results']:
                if not result['passed']:
                    print(f"   - {result['name']}: {result['error']}")
        
        print(f"\n{'🎉 All tests passed!' if summary['failed_tests'] == 0 else '⚠️ Some tests failed.'}")
    
    def save_results(self, summary: Dict[str, Any], output_file: str = "test_results.json"):
        """Сохранение результатов тестов в файл"""
        try:
            # Ensure results directory exists
            results_dir = Path("test_results")
            results_dir.mkdir(exist_ok=True)
            
            output_path = results_dir / output_file
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Test results saved to: {output_path}")
            
        except Exception as e:
            print(f"Failed to save test results: {e}")
    
    async def cleanup(self):
        """Очистка ресурсов после тестов"""
        self.cleanup_temp_dirs()

async def main():
    """Основная функция для запуска тестов"""
    test_suite = TestSuite()
    
    try:
        # Run all tests
        summary = await test_suite.run_all_tests()
        
        # Print summary
        test_suite.print_summary(summary)
        
        # Save results
        test_suite.save_results(summary)
        
        # Return appropriate exit code
        return 0 if summary['failed_tests'] == 0 else 1
        
    finally:
        await test_suite.cleanup()

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)