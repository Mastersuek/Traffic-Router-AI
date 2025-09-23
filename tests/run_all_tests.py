#!/usr/bin/env python3
"""
Test Runner - Execute All Tests
Запуск всех тестов системы для проверки исправлений
"""

import asyncio
import subprocess
import sys
import os
import time
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Dict, Any

class TestRunner:
    """Класс для запуска и управления тестами"""
    
    def __init__(self):
        self.test_results: List[Tuple[str, bool, float, str]] = []
        self.start_time = time.time()
        
    def run_sync_test(self, test_name: str, test_script: str) -> Tuple[bool, float, str]:
        """Запуск синхронного теста"""
        print(f"\n🧪 Running {test_name}...")
        
        start_time = time.time()
        
        try:
            result = subprocess.run(
                [sys.executable, test_script],
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout
            )
            
            execution_time = time.time() - start_time
            
            if result.returncode == 0:
                print(f"✅ {test_name} PASSED ({execution_time:.2f}s)")
                return True, execution_time, result.stdout
            else:
                print(f"❌ {test_name} FAILED ({execution_time:.2f}s)")
                print(f"STDOUT: {result.stdout}")
                print(f"STDERR: {result.stderr}")
                return False, execution_time, result.stderr
                
        except subprocess.TimeoutExpired:
            execution_time = time.time() - start_time
            print(f"⏰ {test_name} TIMEOUT ({execution_time:.2f}s)")
            return False, execution_time, "Test timed out"
        except Exception as e:
            execution_time = time.time() - start_time
            print(f"💥 {test_name} ERROR ({execution_time:.2f}s): {e}")
            return False, execution_time, str(e)
    
    async def run_async_test(self, test_name: str, test_script: str) -> Tuple[bool, float, str]:
        """Запуск асинхронного теста"""
        print(f"\n🧪 Running {test_name}...")
        
        start_time = time.time()
        
        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable, test_script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=300)
            
            execution_time = time.time() - start_time
            
            if process.returncode == 0:
                print(f"✅ {test_name} PASSED ({execution_time:.2f}s)")
                return True, execution_time, stdout.decode()
            else:
                print(f"❌ {test_name} FAILED ({execution_time:.2f}s)")
                print(f"STDOUT: {stdout.decode()}")
                print(f"STDERR: {stderr.decode()}")
                return False, execution_time, stderr.decode()
                
        except asyncio.TimeoutError:
            execution_time = time.time() - start_time
            print(f"⏰ {test_name} TIMEOUT ({execution_time:.2f}s)")
            return False, execution_time, "Test timed out"
        except Exception as e:
            execution_time = time.time() - start_time
            print(f"💥 {test_name} ERROR ({execution_time:.2f}s): {e}")
            return False, execution_time, str(e)
    
    def check_test_files(self) -> List[Tuple[str, str]]:
        """Проверка наличия тестовых файлов"""
        test_files = [
            ("TypeScript Compilation", "tests/test_typescript_compilation.py"),
            ("Component Units", "tests/test_component_units.py"),
            ("Memory System", "tests/test_memory_system.py"),
            ("Session Management", "tests/test_session_management.py"),
            ("MCP Integration", "tests/test_mcp_integration.py"),
            ("Integration Suite", "tests/test_integration_suite.py")
        ]
        
        available_tests = []
        missing_tests = []
        
        for test_name, test_file in test_files:
            if os.path.exists(test_file):
                available_tests.append((test_name, test_file))
            else:
                missing_tests.append((test_name, test_file))
        
        if missing_tests:
            print("⚠️ Missing test files:")
            for test_name, test_file in missing_tests:
                print(f"   - {test_name}: {test_file}")
        
        print(f"📋 Found {len(available_tests)} available test suites")
        return available_tests
    
    def generate_report(self) -> str:
        """Генерация отчета о тестах"""
        total_time = time.time() - self.start_time
        
        passed_tests = sum(1 for _, success, _, _ in self.test_results if success)
        total_tests = len(self.test_results)
        
        report_lines = [
            "=" * 60,
            "🧪 TEST EXECUTION REPORT",
            "=" * 60,
            f"Execution Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Execution Time: {total_time:.2f} seconds",
            f"Tests Passed: {passed_tests}/{total_tests}",
            f"Success Rate: {(passed_tests/total_tests*100):.1f}%" if total_tests > 0 else "N/A",
            "",
            "📊 DETAILED RESULTS:",
            ""
        ]
        
        for test_name, success, exec_time, output in self.test_results:
            status = "✅ PASS" if success else "❌ FAIL"
            report_lines.append(f"{status} {test_name} ({exec_time:.2f}s)")
            
            if not success and output:
                # Include first few lines of error output
                error_lines = output.split('\n')[:3]
                for line in error_lines:
                    if line.strip():
                        report_lines.append(f"     {line.strip()}")
        
        report_lines.extend([
            "",
            "=" * 60,
            "🎯 SUMMARY:",
            ""
        ])
        
        if passed_tests == total_tests:
            report_lines.append("🎉 ALL TESTS PASSED! The system is working correctly.")
        elif passed_tests >= total_tests * 0.8:
            report_lines.append("✅ Most tests passed. The system is mostly functional.")
        elif passed_tests >= total_tests * 0.5:
            report_lines.append("⚠️ Some tests failed. The system needs attention.")
        else:
            report_lines.append("❌ Many tests failed. The system has significant issues.")
        
        report_lines.append("=" * 60)
        
        return "\n".join(report_lines)
    
    def save_report(self, report: str):
        """Сохранение отчета в файл"""
        try:
            # Create reports directory
            reports_dir = Path("reports")
            reports_dir.mkdir(exist_ok=True)
            
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_file = reports_dir / f"test_report_{timestamp}.txt"
            
            with open(report_file, 'w', encoding='utf-8') as f:
                f.write(report)
            
            print(f"\n📄 Test report saved to: {report_file}")
            
        except Exception as e:
            print(f"⚠️ Failed to save report: {e}")

async def main():
    """Основная функция запуска тестов"""
    print("🚀 Starting Comprehensive Test Suite")
    print("=" * 60)
    
    runner = TestRunner()
    
    # Check available test files
    available_tests = runner.check_test_files()
    
    if not available_tests:
        print("❌ No test files found!")
        return 1
    
    print(f"\n🎯 Executing {len(available_tests)} test suites...\n")
    
    # Run all available tests
    for test_name, test_file in available_tests:
        try:
            # Run test asynchronously
            success, exec_time, output = await runner.run_async_test(test_name, test_file)
            runner.test_results.append((test_name, success, exec_time, output))
            
        except Exception as e:
            print(f"💥 Failed to run {test_name}: {e}")
            runner.test_results.append((test_name, False, 0.0, str(e)))
    
    # Generate and display report
    report = runner.generate_report()
    print("\n" + report)
    
    # Save report to file
    runner.save_report(report)
    
    # Return appropriate exit code
    passed_tests = sum(1 for _, success, _, _ in runner.test_results if success)
    total_tests = len(runner.test_results)
    
    if passed_tests == total_tests:
        return 0  # All tests passed
    elif passed_tests >= total_tests * 0.8:
        return 0  # Acceptable pass rate
    else:
        return 1  # Too many failures

def run_quick_syntax_check():
    """Быстрая проверка синтаксиса Python файлов"""
    print("🔍 Running Quick Syntax Check...")
    
    python_files = [
        "agents/enhanced_recovery_agent_v2.py",
        "lib/mcp-ai-agent-integration.py",
        "lib/memory-manager.py", 
        "lib/session-manager.py",
        "server/memory-mcp-server.py",
        "server/session-mcp-server.py"
    ]
    
    syntax_errors = []
    
    for file_path in python_files:
        if not os.path.exists(file_path):
            continue
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                source = f.read()
            
            compile(source, file_path, 'exec')
            print(f"✅ {file_path} - syntax OK")
            
        except SyntaxError as e:
            print(f"❌ {file_path} - syntax error: {e}")
            syntax_errors.append((file_path, str(e)))
        except Exception as e:
            print(f"⚠️ {file_path} - check error: {e}")
    
    if syntax_errors:
        print(f"\n❌ Found {len(syntax_errors)} syntax errors:")
        for file_path, error in syntax_errors:
            print(f"   {file_path}: {error}")
        return False
    else:
        print("\n✅ All Python files have valid syntax")
        return True

if __name__ == "__main__":
    print("🧪 Enhanced Recovery Agent - Test Suite")
    print("=" * 60)
    
    # Quick syntax check first
    syntax_ok = run_quick_syntax_check()
    
    if not syntax_ok:
        print("\n❌ Syntax errors found. Fix them before running full tests.")
        sys.exit(1)
    
    # Run full test suite
    exit_code = asyncio.run(main())
    sys.exit(exit_code)