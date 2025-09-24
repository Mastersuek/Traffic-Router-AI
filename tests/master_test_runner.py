#!/usr/bin/env python3
"""
Master Test Runner for Enhanced Recovery Agent
Главный запускатель всех тестов системы
"""

import asyncio
import sys
import os
import json
import subprocess
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Configure logging
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

class MasterTestRunner:
    """Главный класс для запуска всех тестов"""
    
    def __init__(self):
        self.test_results = []
        self.start_time = None
        self.end_time = None
        
    def run_python_test(self, test_file: str, test_name: str) -> Dict[str, Any]:
        """Запуск Python теста"""
        print(f"🧪 Running {test_name}...")
        
        start_time = time.time()
        
        try:
            # Run the test file
            result = subprocess.run(
                [sys.executable, test_file],
                cwd=os.path.dirname(os.path.abspath(__file__)),
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            duration = time.time() - start_time
            
            success = result.returncode == 0
            
            test_result = {
                "name": test_name,
                "file": test_file,
                "type": "python",
                "passed": success,
                "duration": duration,
                "return_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "timestamp": datetime.now().isoformat()
            }
            
            if success:
                print(f"✅ {test_name} passed ({duration:.2f}s)")
            else:
                print(f"❌ {test_name} failed ({duration:.2f}s)")
                if result.stderr:
                    print(f"   Error: {result.stderr[:200]}...")
            
            return test_result
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            print(f"⏰ {test_name} timed out ({duration:.2f}s)")
            return {
                "name": test_name,
                "file": test_file,
                "type": "python",
                "passed": False,
                "duration": duration,
                "return_code": -1,
                "stdout": "",
                "stderr": "Test timed out after 5 minutes",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            duration = time.time() - start_time
            print(f"💥 {test_name} crashed ({duration:.2f}s): {e}")
            return {
                "name": test_name,
                "file": test_file,
                "type": "python",
                "passed": False,
                "duration": duration,
                "return_code": -1,
                "stdout": "",
                "stderr": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def run_node_test(self, test_file: str, test_name: str) -> Dict[str, Any]:
        """Запуск Node.js теста"""
        print(f"🧪 Running {test_name}...")
        
        start_time = time.time()
        
        try:
            # Check if node is available
            node_check = subprocess.run(["node", "--version"], capture_output=True)
            if node_check.returncode != 0:
                print(f"⚠️ Node.js not available, skipping {test_name}")
                return {
                    "name": test_name,
                    "file": test_file,
                    "type": "node",
                    "passed": False,
                    "duration": 0,
                    "return_code": -1,
                    "stdout": "",
                    "stderr": "Node.js not available",
                    "timestamp": datetime.now().isoformat(),
                    "skipped": True
                }
            
            # Run the test file
            result = subprocess.run(
                ["node", test_file],
                cwd=os.path.dirname(os.path.abspath(__file__)),
                capture_output=True,
                text=True,
                timeout=180  # 3 minute timeout for JS tests
            )
            
            duration = time.time() - start_time
            
            success = result.returncode == 0
            
            test_result = {
                "name": test_name,
                "file": test_file,
                "type": "node",
                "passed": success,
                "duration": duration,
                "return_code": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "timestamp": datetime.now().isoformat()
            }
            
            if success:
                print(f"✅ {test_name} passed ({duration:.2f}s)")
            else:
                print(f"❌ {test_name} failed ({duration:.2f}s)")
                if result.stderr:
                    print(f"   Error: {result.stderr[:200]}...")
            
            return test_result
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            print(f"⏰ {test_name} timed out ({duration:.2f}s)")
            return {
                "name": test_name,
                "file": test_file,
                "type": "node",
                "passed": False,
                "duration": duration,
                "return_code": -1,
                "stdout": "",
                "stderr": "Test timed out after 3 minutes",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            duration = time.time() - start_time
            print(f"💥 {test_name} crashed ({duration:.2f}s): {e}")
            return {
                "name": test_name,
                "file": test_file,
                "type": "node",
                "passed": False,
                "duration": duration,
                "return_code": -1,
                "stdout": "",
                "stderr": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Запуск всех тестов"""
        print("🚀 Starting Master Test Suite...\n")
        
        self.start_time = time.time()
        
        # Define all tests to run
        test_suite = [
            # Core functionality tests
            ("test_basic_functionality.py", "Basic Functionality Tests", "python"),
            ("test_component_units.py", "Component Unit Tests", "python"),
            ("test_memory_system.py", "Memory System Tests", "python"),
            ("test_session_management.py", "Session Management Tests", "python"),
            ("test_mcp_integration.py", "MCP Integration Tests", "python"),
            ("test_integration_suite.py", "Integration Suite Tests", "python"),
            
            # TypeScript compilation test
            ("test_typescript_compilation.py", "TypeScript Compilation Tests", "python"),
            
            # NTFS/fuseblk fixes test
            ("test_ntfs_fixes.py", "NTFS/fuseblk Fixes Tests", "python"),
            
            # Enhanced recovery agent tests
            ("enhanced-recovery-agent.test.py", "Enhanced Recovery Agent Tests", "python"),
            ("fault-tolerance-tests.py", "Fault Tolerance Tests", "python"),
            
            # JavaScript/Node.js tests (if available)
            ("external-ai-integration.test.js", "External AI Integration Tests", "node"),
            ("mcp-integration.test.js", "MCP Integration JS Tests", "node"),
            ("model-alias-system.test.js", "Model Alias System Tests", "node"),
        ]
        
        # Run each test
        for test_file, test_name, test_type in test_suite:
            test_path = test_file  # Files are already in tests directory
            
            if not os.path.exists(test_path):
                print(f"⚠️ Test file not found: {test_file}")
                self.test_results.append({
                    "name": test_name,
                    "file": test_file,
                    "type": test_type,
                    "passed": False,
                    "duration": 0,
                    "return_code": -1,
                    "stdout": "",
                    "stderr": f"Test file not found: {test_file}",
                    "timestamp": datetime.now().isoformat(),
                    "skipped": True
                })
                continue
            
            if test_type == "python":
                result = self.run_python_test(test_path, test_name)
            elif test_type == "node":
                result = self.run_node_test(test_path, test_name)
            else:
                print(f"⚠️ Unknown test type: {test_type}")
                continue
            
            self.test_results.append(result)
        
        self.end_time = time.time()
        
        # Generate summary
        return self.generate_summary()
    
    def generate_summary(self) -> Dict[str, Any]:
        """Генерация сводки результатов"""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["passed"])
        failed_tests = total_tests - passed_tests
        skipped_tests = sum(1 for r in self.test_results if r.get("skipped", False))
        
        total_duration = self.end_time - self.start_time if self.end_time and self.start_time else 0
        test_duration = sum(r["duration"] for r in self.test_results)
        
        # Categorize results by type
        python_tests = [r for r in self.test_results if r["type"] == "python"]
        node_tests = [r for r in self.test_results if r["type"] == "node"]
        
        python_passed = sum(1 for r in python_tests if r["passed"])
        node_passed = sum(1 for r in node_tests if r["passed"])
        
        summary = {
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": failed_tests,
            "skipped_tests": skipped_tests,
            "success_rate": (passed_tests / total_tests) * 100 if total_tests > 0 else 0,
            "total_duration": total_duration,
            "test_duration": test_duration,
            "timestamp": datetime.now().isoformat(),
            "python_tests": {
                "total": len(python_tests),
                "passed": python_passed,
                "failed": len(python_tests) - python_passed,
                "success_rate": (python_passed / len(python_tests)) * 100 if python_tests else 0
            },
            "node_tests": {
                "total": len(node_tests),
                "passed": node_passed,
                "failed": len(node_tests) - node_passed,
                "success_rate": (node_passed / len(node_tests)) * 100 if node_tests else 0
            },
            "results": self.test_results
        }
        
        return summary
    
    def print_summary(self, summary: Dict[str, Any]):
        """Вывод сводки результатов"""
        print(f"\n" + "="*60)
        print(f"📊 MASTER TEST SUITE RESULTS")
        print(f"="*60)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed_tests']} ✅")
        print(f"Failed: {summary['failed_tests']} ❌")
        print(f"Skipped: {summary['skipped_tests']} ⚠️")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        print(f"Total Duration: {summary['total_duration']:.2f}s")
        print(f"Test Duration: {summary['test_duration']:.2f}s")
        
        # Python tests breakdown
        python = summary['python_tests']
        print(f"\n🐍 Python Tests: {python['passed']}/{python['total']} passed ({python['success_rate']:.1f}%)")
        
        # Node.js tests breakdown
        node = summary['node_tests']
        print(f"🟢 Node.js Tests: {node['passed']}/{node['total']} passed ({node['success_rate']:.1f}%)")
        
        # Failed tests details
        if summary['failed_tests'] > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in summary['results']:
                if not result['passed'] and not result.get('skipped', False):
                    print(f"   - {result['name']}")
                    if result['stderr']:
                        error_preview = result['stderr'][:100].replace('\\n', ' ')
                        print(f"     Error: {error_preview}...")
        
        # Skipped tests details
        if summary['skipped_tests'] > 0:
            print(f"\n⚠️ SKIPPED TESTS:")
            for result in summary['results']:
                if result.get('skipped', False):
                    print(f"   - {result['name']}: {result['stderr']}")
        
        # Overall result
        if summary['failed_tests'] == 0:
            print(f"\n🎉 ALL TESTS PASSED! System is ready for production.")
        else:
            print(f"\n⚠️ {summary['failed_tests']} tests failed. Review and fix issues before production.")
        
        print(f"="*60)
    
    def save_results(self, summary: Dict[str, Any], output_file: str = "master_test_results.json"):
        """Сохранение результатов в файл"""
        try:
            # Ensure results directory exists
            results_dir = Path("test_results")
            results_dir.mkdir(exist_ok=True)
            
            output_path = results_dir / output_file
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Master test results saved to: {output_path}")
            
            # Also save a human-readable report
            report_path = results_dir / "test_report.txt"
            with open(report_path, 'w', encoding='utf-8') as f:
                f.write(f"Enhanced Recovery Agent - Test Report\\n")
                f.write(f"Generated: {summary['timestamp']}\\n")
                f.write(f"="*60 + "\\n\\n")
                
                f.write(f"SUMMARY:\\n")
                f.write(f"Total Tests: {summary['total_tests']}\\n")
                f.write(f"Passed: {summary['passed_tests']}\\n")
                f.write(f"Failed: {summary['failed_tests']}\\n")
                f.write(f"Skipped: {summary['skipped_tests']}\\n")
                f.write(f"Success Rate: {summary['success_rate']:.1f}%\\n")
                f.write(f"Duration: {summary['total_duration']:.2f}s\\n\\n")
                
                f.write(f"DETAILED RESULTS:\\n")
                for result in summary['results']:
                    status = "PASS" if result['passed'] else "SKIP" if result.get('skipped') else "FAIL"
                    f.write(f"[{status}] {result['name']} ({result['duration']:.2f}s)\\n")
                    if not result['passed'] and result['stderr']:
                        f.write(f"      Error: {result['stderr'][:200]}\\n")
                    f.write("\\n")
            
            print(f"📄 Human-readable report saved to: {report_path}")
            
        except Exception as e:
            print(f"Failed to save test results: {e}")

def main():
    """Основная функция"""
    runner = MasterTestRunner()
    
    try:
        # Run all tests
        summary = runner.run_all_tests()
        
        # Print summary
        runner.print_summary(summary)
        
        # Save results
        runner.save_results(summary)
        
        # Return appropriate exit code
        return 0 if summary['failed_tests'] == 0 else 1
        
    except KeyboardInterrupt:
        print("\\n⚠️ Test suite interrupted by user")
        return 130
    except Exception as e:
        print(f"\\n💥 Test suite crashed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)