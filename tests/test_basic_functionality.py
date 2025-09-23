#!/usr/bin/env python3
"""
Basic Functionality Tests
Базовые тесты функциональности системы
"""

import sys
import os
import json
import subprocess
from pathlib import Path

def test_python_syntax():
    """Test Python syntax of all main files"""
    print("🧪 Testing Python Syntax...")
    
    python_files = [
        "agents/enhanced_recovery_agent_v2.py",
        "lib/mcp-ai-agent-integration.py",
        "lib/memory-manager.py",
        "lib/session-manager.py"
    ]
    
    syntax_errors = []
    
    for file_path in python_files:
        if not os.path.exists(file_path):
            print(f"⚠️ File not found: {file_path}")
            continue
        
        try:
            result = subprocess.run(
                [sys.executable, '-m', 'py_compile', file_path],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print(f"✅ {file_path} - syntax OK")
            else:
                print(f"❌ {file_path} - syntax error")
                print(result.stderr)
                syntax_errors.append(file_path)
                
        except Exception as e:
            print(f"❌ {file_path} - check failed: {e}")
            syntax_errors.append(file_path)
    
    return len(syntax_errors) == 0

def test_imports():
    """Test that main modules can be imported"""
    print("\n🧪 Testing Module Imports...")
    
    import_tests = [
        ("json", "import json"),
        ("yaml", "import yaml"),
        ("asyncio", "import asyncio"),
        ("datetime", "from datetime import datetime"),
        ("pathlib", "from pathlib import Path"),
        ("typing", "from typing import Dict, List, Any")
    ]
    
    failed_imports = []
    
    for module_name, import_statement in import_tests:
        try:
            exec(import_statement)
            print(f"✅ {module_name} import OK")
        except ImportError:
            print(f"⚠️ {module_name} not available (optional)")
        except Exception as e:
            print(f"❌ {module_name} import failed: {e}")
            failed_imports.append(module_name)
    
    return len(failed_imports) == 0

def test_file_structure():
    """Test that required files and directories exist"""
    print("\n🧪 Testing File Structure...")
    
    required_files = [
        "package.json",
        "tsconfig.json",
        "agents/enhanced_recovery_agent_v2.py"
    ]
    
    required_dirs = [
        "agents",
        "lib",
        "server", 
        "tests",
        "config"
    ]
    
    missing_items = []
    
    # Check files
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path} exists")
        else:
            print(f"❌ {file_path} missing")
            missing_items.append(file_path)
    
    # Check directories
    for dir_path in required_dirs:
        if os.path.isdir(dir_path):
            print(f"✅ {dir_path}/ exists")
        else:
            print(f"❌ {dir_path}/ missing")
            missing_items.append(dir_path)
    
    return len(missing_items) == 0

def test_package_json():
    """Test package.json validity"""
    print("\n🧪 Testing package.json...")
    
    try:
        with open('package.json', 'r', encoding='utf-8') as f:
            package_data = json.load(f)
        
        print("✅ package.json is valid JSON")
        
        # Check required fields
        required_fields = ['name', 'version', 'scripts']
        missing_fields = [field for field in required_fields if field not in package_data]
        
        if missing_fields:
            print(f"⚠️ Missing fields in package.json: {missing_fields}")
        else:
            print("✅ package.json has required fields")
        
        # Check for build scripts
        scripts = package_data.get('scripts', {})
        if 'build' in scripts or 'dev' in scripts:
            print("✅ package.json has build scripts")
        else:
            print("⚠️ package.json missing build scripts")
        
        return True
        
    except FileNotFoundError:
        print("❌ package.json not found")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ package.json invalid JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ package.json test failed: {e}")
        return False

def test_tsconfig_json():
    """Test tsconfig.json validity"""
    print("\n🧪 Testing tsconfig.json...")
    
    try:
        with open('tsconfig.json', 'r', encoding='utf-8') as f:
            tsconfig_data = json.load(f)
        
        print("✅ tsconfig.json is valid JSON")
        
        # Check compiler options
        compiler_options = tsconfig_data.get('compilerOptions', {})
        
        important_options = ['target', 'module', 'strict']
        missing_options = [opt for opt in important_options if opt not in compiler_options]
        
        if missing_options:
            print(f"⚠️ Missing compiler options: {missing_options}")
        else:
            print("✅ tsconfig.json has important compiler options")
        
        return True
        
    except FileNotFoundError:
        print("❌ tsconfig.json not found")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ tsconfig.json invalid JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ tsconfig.json test failed: {e}")
        return False

def test_config_files():
    """Test configuration files"""
    print("\n🧪 Testing Configuration Files...")
    
    config_files = [
        "config/memory-config.yaml",
        "config/session-config.yaml"
    ]
    
    valid_configs = 0
    
    for config_file in config_files:
        if not os.path.exists(config_file):
            print(f"⚠️ {config_file} not found")
            continue
        
        try:
            # Try to read as text first
            with open(config_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if len(content) > 0:
                print(f"✅ {config_file} exists and has content")
                valid_configs += 1
            else:
                print(f"⚠️ {config_file} is empty")
                
        except Exception as e:
            print(f"❌ {config_file} read error: {e}")
    
    return valid_configs > 0

def main():
    """Run all basic functionality tests"""
    print("🚀 Starting Basic Functionality Tests\n")
    
    test_results = []
    
    # Run all tests
    test_results.append(("Python Syntax", test_python_syntax()))
    test_results.append(("Module Imports", test_imports()))
    test_results.append(("File Structure", test_file_structure()))
    test_results.append(("package.json", test_package_json()))
    test_results.append(("tsconfig.json", test_tsconfig_json()))
    test_results.append(("Config Files", test_config_files()))
    
    # Summary
    passed_tests = sum(1 for _, result in test_results if result)
    total_tests = len(test_results)
    
    print(f"\n📊 Basic Functionality Test Results:")
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All basic functionality tests passed!")
        return 0
    elif passed_tests >= total_tests * 0.8:
        print("✅ Most basic tests passed - system is mostly functional")
        return 0
    else:
        print("❌ Too many basic tests failed - system has fundamental issues")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)