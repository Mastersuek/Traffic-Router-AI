#!/usr/bin/env python3
"""
Integration Tests for Enhanced Recovery Agent
Тесты интеграции всех компонентов системы
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
from typing import Dict, List, Any

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Configure logging
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

class IntegrationTestSuite:
    """Интеграционные тесты для всей системы"""
    
    def __init__(self):
        self.temp_dirs = []
        self.test_results = []
    
    def create_temp_dir(self) -> str:
        """Создание временной директории"""
        temp_dir = tempfile.mkdtemp()
        self.temp_dirs.append(temp_dir)
        return temp_dir
    
    def cleanup_temp_dirs(self):
        """Очистка временных директорий"""
        for temp_dir in self.temp_dirs:
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass
        self.temp_dirs.clear()
    
    async def test_basic_integration(self) -> bool:
        """Базовый тест интеграции"""
        print("🧪 Testing Basic Integration...")
        
        try:
            # Test that all main components can be imported without errors
            # This is a basic integration test that doesn't require external dependencies
            
            # Test file existence and basic structure
            required_components = [
                "agents/enhanced_recovery_agent_v2.py",
                "lib/memory-manager.py",
                "lib/session-manager.py",
                "lib/mcp-ai-agent-integration.py",
                "server/memory-mcp-server.py",
                "server/session-mcp-server.py"
            ]
            
            for component in required_components:
                if not os.path.exists(component):
                    print(f"❌ Missing component: {component}")
                    return False
                
                # Test basic syntax
                try:
                    with open(component, 'r', encoding='utf-8') as f:
                        content = f.read()
                    compile(content, component, 'exec')
                except SyntaxError as e:
                    print(f"❌ Syntax error in {component}: {e}")
                    return False
            
            print("✅ Basic integration test passed")
            return True
            
        except Exception as e:
            print(f"❌ Basic integration test failed: {e}")
            return False
    
    async def test_configuration_integration(self) -> bool:
        """Тест интеграции конфигураций"""
        print("🧪 Testing Configuration Integration...")
        
        try:
            # Test that configuration files exist and have basic structure
            config_files = [
                "config/memory-config.yaml",
                "config/session-config.yaml"
            ]
            
            for config_file in config_files:
                if not os.path.exists(config_file):
                    print(f"❌ Missing config file: {config_file}")
                    return False
                
                # Test that file is not empty and contains some expected content
                with open(config_file, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                
                if not content:
                    print(f"❌ Empty config file: {config_file}")
                    return False
                
                # Basic YAML structure check (without requiring PyYAML)
                # Check if the file contains expected keys (allowing for comments)
                if "memory-config" in config_file and "memory:" not in content:
                    print(f"❌ Config file {config_file} doesn't contain 'memory:' key")
                    return False
                if "session-config" in config_file and "sessions:" not in content:
                    print(f"❌ Config file {config_file} doesn't contain 'sessions:' key")
                    return False
            
            print("✅ Configuration integration test passed")
            return True
            
        except Exception as e:
            print(f"❌ Configuration integration test failed: {e}")
            return False
    
    async def test_directory_integration(self) -> bool:
        """Тест интеграции директорий"""
        print("🧪 Testing Directory Integration...")
        
        try:
            # Test that all required directories exist and are accessible
            required_dirs = [
                "agents",
                "lib",
                "server", 
                "config",
                "tests",
                "memory",
                "logs"
            ]
            
            for dir_path in required_dirs:
                if not os.path.isdir(dir_path):
                    print(f"❌ Missing directory: {dir_path}")
                    return False
                
                # Test directory is accessible
                if not os.access(dir_path, os.R_OK):
                    print(f"❌ Directory not accessible: {dir_path}")
                    return False
            
            # Test that memory and logs directories are writable
            for dir_path in ["memory", "logs"]:
                if not os.access(dir_path, os.W_OK):
                    print(f"❌ Directory not writable: {dir_path}")
                    return False
            
            print("✅ Directory integration test passed")
            return True
            
        except Exception as e:
            print(f"❌ Directory integration test failed: {e}")
            return False
    
    async def test_server_files_integration(self) -> bool:
        """Тест интеграции серверных файлов"""
        print("🧪 Testing Server Files Integration...")
        
        try:
            # Test that server files exist and have proper structure
            server_files = [
                "server/memory-mcp-server.py",
                "server/session-mcp-server.py"
            ]
            
            for server_file in server_files:
                if not os.path.exists(server_file):
                    print(f"❌ Missing server file: {server_file}")
                    return False
                
                # Test file content has basic server structure
                with open(server_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Check for basic server patterns
                if "class" not in content or "async def" not in content:
                    print(f"❌ Server file {server_file} missing expected patterns")
                    return False
                
                # Test syntax
                try:
                    compile(content, server_file, 'exec')
                except SyntaxError as e:
                    print(f"❌ Syntax error in {server_file}: {e}")
                    return False
            
            print("✅ Server files integration test passed")
            return True
            
        except Exception as e:
            print(f"❌ Server files integration test failed: {e}")
            return False
    
    async def run_all_integration_tests(self) -> Dict[str, Any]:
        """Выполнение всех интеграционных тестов"""
        print("🚀 Starting Integration Test Suite...\n")
        
        tests = [
            ("Basic Integration", self.test_basic_integration),
            ("Configuration Integration", self.test_configuration_integration),
            ("Directory Integration", self.test_directory_integration),
            ("Server Files Integration", self.test_server_files_integration),
        ]
        
        results = []
        start_time = time.time()
        
        for test_name, test_func in tests:
            test_start = time.time()
            try:
                success = await test_func()
                duration = time.time() - test_start
                results.append({
                    "name": test_name,
                    "passed": success,
                    "duration": duration,
                    "error": None
                })
            except Exception as e:
                duration = time.time() - test_start
                results.append({
                    "name": test_name,
                    "passed": False,
                    "duration": duration,
                    "error": str(e)
                })
                print(f"❌ {test_name} failed with exception: {e}")
        
        total_duration = time.time() - start_time
        passed_tests = sum(1 for r in results if r["passed"])
        total_tests = len(results)
        
        summary = {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "success_rate": (passed_tests / total_tests) * 100 if total_tests > 0 else 0,
            "total_duration": total_duration,
            "timestamp": datetime.now().isoformat(),
            "results": results
        }
        
        return summary
    
    def print_summary(self, summary: Dict[str, Any]):
        """Вывод сводки результатов"""
        print(f"\n📊 Integration Test Results:")
        print(f"   Total Tests: {summary['total_tests']}")
        print(f"   Passed: {summary['passed_tests']} ✅")
        print(f"   Failed: {summary['failed_tests']} ❌")
        print(f"   Success Rate: {summary['success_rate']:.1f}%")
        print(f"   Total Duration: {summary['total_duration']:.2f}s")
        
        if summary['failed_tests'] > 0:
            print(f"\n❌ Failed Tests:")
            for result in summary['results']:
                if not result['passed']:
                    print(f"   - {result['name']}: {result['error'] or 'Test returned False'}")
        
        print(f"\n{'🎉 All integration tests passed!' if summary['failed_tests'] == 0 else '⚠️ Some integration tests failed.'}")
    
    async def cleanup(self):
        """Очистка ресурсов"""
        self.cleanup_temp_dirs()

async def main():
    """Основная функция для запуска интеграционных тестов"""
    test_suite = IntegrationTestSuite()
    
    try:
        # Run all integration tests
        summary = await test_suite.run_all_integration_tests()
        
        # Print summary
        test_suite.print_summary(summary)
        
        # Save results
        results_dir = Path("test_results")
        results_dir.mkdir(exist_ok=True)
        
        with open(results_dir / "integration_test_results.json", 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Integration test results saved to: test_results/integration_test_results.json")
        
        # Return appropriate exit code
        return 0 if summary['failed_tests'] == 0 else 1
        
    finally:
        await test_suite.cleanup()

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)