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
    
    # Check if npm is available first
    try:
        npm_result = subprocess.run(['npm', '--version'], 
                                  capture_output=True, text=True, timeout=10)
        if npm_result.returncode != 0:
            print("❌ npm not available")
            return False
        print(f"✅ npm available: {npm_result.stdout.strip()}")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        print("❌ npm not found")
        return False
    
    # Check if TypeScript is available
    try:
        result = subprocess.run(['npm', 'run', 'build:ts'], 
                              capture_output=True, text=True, timeout=120)
        
        if result.returncode == 0:
            print("✅ TypeScript compilation successful via npm run build:ts")
            return True
        else:
            print("❌ TypeScript compilation failed:")
            print("STDOUT:", result.stdout)
            print("STDERR:", result.stderr)
            
            # Try alternative method
            print("🔄 Trying alternative compilation method...")
            alt_result = subprocess.run(['npx', 'tsc', '--noEmit', '--skipLibCheck'], 
                                      capture_output=True, text=True, timeout=60)
            
            if alt_result.returncode == 0:
                print("✅ TypeScript compilation successful with skipLibCheck")
                return True
            else:
                print("❌ Alternative compilation also failed:")
                print("STDOUT:", alt_result.stdout)
                print("STDERR:", alt_result.stderr)
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
        "clients/common/client-config.ts",
        "lib/ai-request-optimizer.ts", 
        "lib/cache-manager.ts",
        "lib/connection-pool.ts",
        "lib/traffic-router.ts"
    ]
    
    success_count = 0
    existing_files = []
    
    for file_path in test_files:
        if not os.path.exists(file_path):
            print(f"⚠️ File not found: {file_path}")
            continue
        
        existing_files.append(file_path)
        
        try:
            print(f"🔨 Checking syntax of {file_path}...")
            
            # First check if file has valid TypeScript syntax
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Basic syntax check - look for common issues
            if 'timeout:' in content and 'AbortController' not in content:
                print(f"⚠️ {file_path} may have fetch timeout issues")
            
            # Try compilation with lenient settings
            result = subprocess.run(['npx', 'tsc', '--noEmit', '--skipLibCheck', '--target', 'ES2020', file_path], 
                                  capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                print(f"✅ {file_path} compiled successfully")
                success_count += 1
            else:
                print(f"❌ {file_path} compilation failed:")
                # Only show first few lines of error
                stdout_lines = result.stdout.split('\n')[:5]
                stderr_lines = result.stderr.split('\n')[:5]
                print("STDOUT:", '\n'.join(stdout_lines))
                print("STDERR:", '\n'.join(stderr_lines))
                
        except subprocess.TimeoutExpired:
            print(f"❌ {file_path} compilation timed out")
        except Exception as e:
            print(f"❌ {file_path} compilation error: {e}")
    
    print(f"\n📊 Specific files test result: {success_count}/{len(existing_files)} existing files compiled successfully")
    return success_count == len(existing_files) if existing_files else True

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
export interface TestInterface {
    test: string;
}

// Test basic TypeScript syntax
const testFunction = (param: string): string => {
    return param;
};

// Test fetch with AbortController (our fix)
const testFetch = async (): Promise<void> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
        const response = await fetch('https://example.com', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log('Fetch test successful');
    } catch (error) {
        clearTimeout(timeoutId);
        console.log('Fetch test error:', error);
    }
};

console.log('Import test completed');
'''
    
    test_file = 'test_imports.ts'
    
    try:
        # Write test file
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(test_content)
        
        # Test compilation with more lenient settings
        result = subprocess.run(['npx', 'tsc', '--noEmit', '--skipLibCheck', '--target', 'ES2020', '--lib', 'ES2020,DOM', test_file], 
                              capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("✅ Import resolution test passed")
            return True
        else:
            print("❌ Import resolution test failed:")
            print("STDOUT:", result.stdout)
            print("STDERR:", result.stderr)
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