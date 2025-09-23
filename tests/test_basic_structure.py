#!/usr/bin/env python3
"""
Basic Structure Tests
Базовые тесты структуры проекта без внешних зависимостей
"""

import os
import sys
import json
import time
from pathlib import Path

def test_file_structure():
    """Тест структуры файлов проекта"""
    print("🧪 Testing project file structure...")
    
    required_files = [
        "agents/enhanced_recovery_agent_v2.py",
        "agents/enhanced_recovery_agent_v2_clean.py",
        "lib/mcp-ai-agent-integration.py",
        "lib/memory-manager.py",
        "lib/session-manager.py",
        "server/memory-mcp-server.py",
        "server/session-mcp-server.py",
        "config/memory-config.yaml",
        "config/session-config.yaml",
        "tests/test_suite.py",
        "tests/test_integration.py",
        "tests/master_test_runner.py",
        "tests/run_critical_tests.py"
    ]
    
    missing_files = []
    existing_files = []
    
    for file_path in required_files:
        if os.path.exists(file_path):
            existing_files.append(file_path)
            print(f"✅ {file_path}")
        else:
            missing_files.append(file_path)
            print(f"❌ {file_path}")
    
    print(f"\nFile Structure Summary:")
    print(f"  Existing: {len(existing_files)}/{len(required_files)} files")
    print(f"  Missing: {len(missing_files)} files")
    
    if missing_files:
        print(f"\nMissing files:")
        for file_path in missing_files:
            print(f"  - {file_path}")
        return False
    
    return True

def test_configuration_syntax():
    """Тест синтаксиса конфигурационных файлов"""
    print("🧪 Testing configuration file syntax...")
    
    config_files = [
        "config/memory-config.yaml",
        "config/session-config.yaml"
    ]
    
    try:
        import yaml
        yaml_available = True
    except ImportError:
        print("⚠️ PyYAML not available, skipping YAML syntax check")
        yaml_available = False
    
    for config_file in config_files:
        if not os.path.exists(config_file):
            print(f"⚠️ Config file not found: {config_file}")
            continue
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Basic syntax check - file should not be empty and should contain expected keys
            if not content.strip():
                print(f"❌ {config_file} is empty")
                return False
            
            if yaml_available:
                config_data = yaml.safe_load(content)
                if not isinstance(config_data, dict):
                    print(f"❌ {config_file} does not contain valid YAML dictionary")
                    return False
                
                # Check for expected sections
                if "memory-config" in config_file and "memory" not in config_data:
                    print(f"❌ {config_file} missing 'memory' section")
                    return False
                
                if "session-config" in config_file and "sessions" not in config_data:
                    print(f"❌ {config_file} missing 'sessions' section")
                    return False
            
            print(f"✅ {config_file} syntax OK")
            
        except Exception as e:
            print(f"❌ {config_file} syntax error: {e}")
            return False
    
    return True

def test_python_syntax():
    """Тест синтаксиса Python файлов"""
    print("🧪 Testing Python file syntax...")
    
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
        if not os.path.exists(py_file):
            print(f"⚠️ Python file not found: {py_file}")
            continue
        
        try:
            with open(py_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Basic syntax check using compile
            compile(content, py_file, 'exec')
            print(f"✅ {py_file} syntax OK")
            
        except SyntaxError as e:
            print(f"❌ {py_file} syntax error: {e}")
            return False
        except Exception as e:
            print(f"⚠️ {py_file} could not be checked: {e}")
    
    return True

def test_directory_structure():
    """Тест структуры директорий"""
    print("🧪 Testing directory structure...")
    
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
        if os.path.isdir(dir_path):
            print(f"✅ {dir_path}/ directory exists")
        else:
            print(f"❌ {dir_path}/ directory missing")
            return False
    
    return True

def test_file_permissions():
    """Тест прав доступа к файлам"""
    print("🧪 Testing file permissions...")
    
    executable_files = [
        "tests/test_suite.py",
        "tests/test_integration.py", 
        "tests/master_test_runner.py",
        "tests/run_critical_tests.py",
        "tests/test_basic_structure.py"
    ]
    
    for file_path in executable_files:
        if not os.path.exists(file_path):
            print(f"⚠️ File not found: {file_path}")
            continue
        
        # Check if file is readable
        if os.access(file_path, os.R_OK):
            print(f"✅ {file_path} is readable")
        else:
            print(f"❌ {file_path} is not readable")
            return False
    
    return True

def run_basic_tests():
    """Запуск всех базовых тестов"""
    print("🚀 Starting Basic Structure Tests...\n")
    
    start_time = time.time()
    
    tests = [
        ("File Structure", test_file_structure),
        ("Configuration Syntax", test_configuration_syntax),
        ("Python Syntax", test_python_syntax),
        ("Directory Structure", test_directory_structure),
        ("File Permissions", test_file_permissions),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        test_start = time.time()
        try:
            success = test_func()
            duration = time.time() - test_start
            results.append({
                "name": test_name,
                "passed": success,
                "duration": duration,
                "error": None
            })
            print(f"{'✅ PASSED' if success else '❌ FAILED'} - {test_name} ({duration:.2f}s)")
        except Exception as e:
            duration = time.time() - test_start
            results.append({
                "name": test_name,
                "passed": False,
                "duration": duration,
                "error": str(e)
            })
            print(f"💥 CRASHED - {test_name} ({duration:.2f}s): {e}")
    
    total_duration = time.time() - start_time
    passed_tests = sum(1 for r in results if r["passed"])
    total_tests = len(results)
    
    # Print summary
    print(f"\n" + "="*60)
    print(f"📊 BASIC STRUCTURE TESTS SUMMARY")
    print(f"="*60)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests} ✅")
    print(f"Failed: {total_tests - passed_tests} ❌")
    print(f"Success Rate: {(passed_tests / total_tests) * 100:.1f}%")
    print(f"Duration: {total_duration:.2f}s")
    
    if passed_tests == total_tests:
        print(f"\n🎉 ALL BASIC TESTS PASSED!")
        print(f"✅ Project structure is valid and ready for testing.")
    else:
        print(f"\n⚠️ {total_tests - passed_tests} basic tests failed!")
        print(f"❌ Fix structural issues before proceeding.")
        
        print(f"\nFailed tests:")
        for result in results:
            if not result["passed"]:
                print(f"   - {result['name']}: {result['error'] or 'Test returned False'}")
    
    print(f"="*60)
    
    # Save results
    try:
        results_dir = Path("test_results")
        results_dir.mkdir(exist_ok=True)
        
        summary = {
            "test_type": "basic_structure",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "success_rate": (passed_tests / total_tests) * 100,
            "duration": total_duration,
            "results": results
        }
        
        with open(results_dir / "basic_structure_results.json", 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Results saved to: test_results/basic_structure_results.json")
        
    except Exception as e:
        print(f"⚠️ Could not save results: {e}")
    
    return passed_tests == total_tests

def main():
    """Основная функция"""
    try:
        success = run_basic_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 130
    except Exception as e:
        print(f"\n💥 Basic tests crashed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)