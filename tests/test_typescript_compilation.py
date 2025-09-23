#!/usr/bin/env python3
"""
TypeScript Compilation Tests
Тесты компиляции TypeScript для проверки исправленных проблем
"""

import subprocess
import sys
import os
import json
from pathlib import Path
from typing import List, Dict, Any

def test_typescript_compilation():
    """Test TypeScript compilation for the entire project"""
    print("🧪 Testing TypeScript Compilation...")
    
    # Check if TypeScript is available
    try:
        result = subprocess.run(['npx', 'tsc', '--version'], 
                              capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            print("❌ TypeScript compiler not available")
            return False
        
        print(f"✅ TypeScript compiler available: {result.stdout.strip()}")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        print("❌ TypeScript compiler not found")
        return False
    
    # Test compilation
    try:
        print("🔨 Compiling TypeScript project...")
        
        result = subprocess.run(['npx', 'tsc', '--noEmit'], 
                              capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            print("✅ TypeScript compilation successful - no errors found")
            return True
        else:
            print("❌ TypeScript compilation failed:")
            print(result.stdout)
            print(result.stderr)
            return False
            
    except subprocess.TimeoutExpired:
        print("❌ TypeScript compilation timed out")
        return False
    except Exception as e:
        print(f"❌ TypeScript compilation error: {e}")
        return False

def test_specific_files():
    """Test compilation of specific fixed files"""
    print("\n🧪 Testing Specific Fixed Files...")
    
    # Files that were specifically fixed
    test_files = [
        "clients/common/traffic-router-client.ts",
        "lib/ai-request-optimizer.ts", 
        "lib/cache-manager.ts",
        "lib/connection-pool.ts",
        "lib/traffic-router.ts",
        "server/ai-proxy-server.ts"
    ]
    
    success_count = 0
    
    for file_path in test_files:
        if not os.path.exists(file_path):
            print(f"⚠️ File not found: {file_path}")
            continue
        
        try:
            print(f"🔨 Compiling {file_path}...")
            
            result = subprocess.run(['npx', 'tsc', '--noEmit', file_path], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print(f"✅ {file_path} compiled successfully")
                success_count += 1
            else:
                print(f"❌ {file_path} compilation failed:")
                print(result.stdout)
                print(result.stderr)
                
        except subprocess.TimeoutExpired:
            print(f"❌ {file_path} compilation timed out")
        except Exception as e:
            print(f"❌ {file_path} compilation error: {e}")
    
    print(f"\n📊 Specific files test result: {success_count}/{len(test_files)} files compiled successfully")
    return success_count == len([f for f in test_files if os.path.exists(f)])

def test_tsconfig_validation():
    """Test tsconfig.json validation"""
    print("\n🧪 Testing tsconfig.json Configuration...")
    
    tsconfig_files = [
        "tsconfig.json",
        "clients/desktop/tsconfig.json",
        "clients/mobile/tsconfig.json"
    ]
    
    success_count = 0
    
    for tsconfig_path in tsconfig_files:
        if not os.path.exists(tsconfig_path):
            print(f"⚠️ tsconfig not found: {tsconfig_path}")
            continue
        
        try:
            # Validate JSON syntax
            with open(tsconfig_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            print(f"✅ {tsconfig_path} is valid JSON")
            
            # Check for required compiler options
            compiler_options = config.get('compilerOptions', {})
            
            required_options = ['target', 'module', 'strict']
            missing_options = [opt for opt in required_options if opt not in compiler_options]
            
            if missing_options:
                print(f"⚠️ {tsconfig_path} missing options: {missing_options}")
            else:
                print(f"✅ {tsconfig_path} has required compiler options")
                success_count += 1
                
        except json.JSONDecodeError as e:
            print(f"❌ {tsconfig_path} invalid JSON: {e}")
        except Exception as e:
            print(f"❌ {tsconfig_path} validation error: {e}")
    
    return success_count > 0

def test_import_resolution():
    """Test import resolution for common modules"""
    print("\n🧪 Testing Import Resolution...")
    
    # Create a temporary test file to check imports
    test_content = '''
// Test common imports that were problematic
import { TrafficRouter } from './lib/traffic-router';
import { AIRequestOptimizer } from './lib/ai-request-optimizer';
import { CacheManager } from './lib/cache-manager';
import { ConnectionPool } from './lib/connection-pool';

// Test React imports for desktop client
// import React from 'react';

// Test Node.js types
import { RequestInit } from 'node-fetch';

console.log('Import test');
'''
    
    test_file = 'test_imports.ts'
    
    try:
        # Write test file
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(test_content)
        
        # Test compilation
        result = subprocess.run(['npx', 'tsc', '--noEmit', '--skipLibCheck', test_file], 
                              capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ Import resolution test passed")
            return True
        else:
            print("❌ Import resolution test failed:")
            print(result.stdout)
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Import resolution test error: {e}")
        return False
    finally:
        # Cleanup test file
        if os.path.exists(test_file):
            os.remove(test_file)

def check_package_json():
    """Check package.json for required dependencies"""
    print("\n🧪 Checking package.json Dependencies...")
    
    try:
        with open('package.json', 'r', encoding='utf-8') as f:
            package_data = json.load(f)
        
        # Check for TypeScript and related dependencies
        dependencies = {**package_data.get('dependencies', {}), **package_data.get('devDependencies', {})}
        
        required_deps = [
            'typescript',
            '@types/node',
            'ts-node'
        ]
        
        missing_deps = [dep for dep in required_deps if dep not in dependencies]
        
        if missing_deps:
            print(f"⚠️ Missing TypeScript dependencies: {missing_deps}")
            return False
        else:
            print("✅ All required TypeScript dependencies found")
            
            # Show versions
            for dep in required_deps:
                if dep in dependencies:
                    print(f"   - {dep}: {dependencies[dep]}")
            
            return True
            
    except FileNotFoundError:
        print("❌ package.json not found")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ package.json invalid JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ package.json check error: {e}")
        return False

def main():
    """Run all TypeScript compilation tests"""
    print("🚀 Starting TypeScript Compilation Tests...\n")
    
    test_results = []
    
    # Run all tests
    test_results.append(("Package.json Check", check_package_json()))
    test_results.append(("tsconfig.json Validation", test_tsconfig_validation()))
    test_results.append(("Import Resolution", test_import_resolution()))
    test_results.append(("Specific Files Compilation", test_specific_files()))
    test_results.append(("Full Project Compilation", test_typescript_compilation()))
    
    # Summary
    passed_tests = sum(1 for _, result in test_results if result)
    total_tests = len(test_results)
    
    print(f"\n📊 TypeScript Test Results:")
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All TypeScript compilation tests passed!")
        return 0
    else:
        print("❌ Some TypeScript tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)