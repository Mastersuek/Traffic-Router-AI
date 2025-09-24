#!/usr/bin/env python3
"""
NTFS/fuseblk Fixes Tests
Тесты для проверки исправлений проблем с файловой системой NTFS/fuseblk
"""

import subprocess
import sys
import os
import json
import time
from pathlib import Path
from typing import List, Dict, Any

def test_filesystem_detection():
    """Test filesystem detection"""
    print("🧪 Testing Filesystem Detection...")
    
    try:
        # Get filesystem type
        result = subprocess.run(['df', '-T', '.'], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 2:
                fs_type = lines[1].split()[1]
                print(f"✅ Detected filesystem: {fs_type}")
                
                if fs_type in ['fuseblk', 'ntfs']:
                    print("⚠️ NTFS/fuseblk filesystem detected - compatibility fixes needed")
                    return True, fs_type
                else:
                    print("✅ Standard filesystem - minimal fixes needed")
                    return True, fs_type
            else:
                print("❌ Could not parse filesystem information")
                return False, "unknown"
        else:
            print("❌ Failed to detect filesystem")
            return False, "unknown"
            
    except Exception as e:
        print(f"❌ Filesystem detection error: {e}")
        return False, "unknown"

def test_script_permissions():
    """Test script file permissions"""
    print("\n🧪 Testing Script Permissions...")
    
    scripts = [
        "scripts/quick-build.sh",
        "scripts/build-ntfs-fix.sh", 
        "scripts/fix-permissions.sh"
    ]
    
    success_count = 0
    
    for script in scripts:
        if not os.path.exists(script):
            print(f"⚠️ Script not found: {script}")
            continue
        
        # Check if file is executable
        if os.access(script, os.X_OK):
            print(f"✅ {script} is executable")
            success_count += 1
        else:
            print(f"❌ {script} is not executable")
    
    return success_count == len([s for s in scripts if os.path.exists(s)])

def test_npm_scripts():
    """Test npm scripts for NTFS fixes"""
    print("\n🧪 Testing NPM Scripts...")
    
    try:
        with open('package.json', 'r', encoding='utf-8') as f:
            package_data = json.load(f)
        
        scripts = package_data.get('scripts', {})
        
        required_scripts = [
            'build:ntfs',
            'build:quick', 
            'fix:permissions'
        ]
        
        success_count = 0
        
        for script_name in required_scripts:
            if script_name in scripts:
                print(f"✅ Found script: {script_name}")
                success_count += 1
            else:
                print(f"❌ Missing script: {script_name}")
        
        return success_count == len(required_scripts)
        
    except Exception as e:
        print(f"❌ Error checking npm scripts: {e}")
        return False

def test_next_config():
    """Test Next.js configuration for NTFS compatibility"""
    print("\n🧪 Testing Next.js Configuration...")
    
    if not os.path.exists('next.config.mjs'):
        print("❌ next.config.mjs not found")
        return False
    
    try:
        with open('next.config.mjs', 'r', encoding='utf-8') as f:
            config_content = f.read()
        
        # Check for NTFS-specific fixes
        ntfs_fixes = [
            'esmExternals',
            'watchOptions',
            'poll: 1000',
            'cache = false'
        ]
        
        found_fixes = []
        for fix in ntfs_fixes:
            if fix in config_content:
                found_fixes.append(fix)
                print(f"✅ Found NTFS fix: {fix}")
            else:
                print(f"⚠️ NTFS fix not found: {fix}")
        
        if len(found_fixes) >= 2:
            print("✅ Next.js configuration has NTFS compatibility fixes")
            return True
        else:
            print("❌ Next.js configuration lacks NTFS compatibility fixes")
            return False
            
    except Exception as e:
        print(f"❌ Error checking Next.js config: {e}")
        return False

def test_environment_setup():
    """Test environment configuration for NTFS"""
    print("\n🧪 Testing Environment Configuration...")
    
    # Check for .env.local
    env_files = ['.env.local', '.env']
    env_found = False
    
    for env_file in env_files:
        if os.path.exists(env_file):
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    env_content = f.read()
                
                # Check for NTFS-specific environment variables
                ntfs_vars = [
                    'CHOKIDAR_USEPOLLING',
                    'NEXT_TELEMETRY_DISABLED',
                    'NODE_OPTIONS'
                ]
                
                found_vars = []
                for var in ntfs_vars:
                    if var in env_content:
                        found_vars.append(var)
                        print(f"✅ Found environment variable: {var}")
                
                if found_vars:
                    env_found = True
                    print(f"✅ Environment file {env_file} has NTFS compatibility settings")
                    break
                    
            except Exception as e:
                print(f"⚠️ Error reading {env_file}: {e}")
    
    if not env_found:
        print("⚠️ No NTFS-specific environment configuration found")
        return False
    
    return True

def test_gitignore_setup():
    """Test .gitignore for NTFS-specific entries"""
    print("\n🧪 Testing .gitignore Configuration...")
    
    if not os.path.exists('.gitignore'):
        print("⚠️ .gitignore not found")
        return False
    
    try:
        with open('.gitignore', 'r', encoding='utf-8') as f:
            gitignore_content = f.read()
        
        # Check for NTFS-specific entries
        ntfs_entries = [
            '.next/',
            '*.tmp',
            '.cache/',
            'Thumbs.db',
            'desktop.ini'
        ]
        
        found_entries = []
        for entry in ntfs_entries:
            if entry in gitignore_content:
                found_entries.append(entry)
                print(f"✅ Found .gitignore entry: {entry}")
        
        if len(found_entries) >= 3:
            print("✅ .gitignore has good NTFS compatibility entries")
            return True
        else:
            print("⚠️ .gitignore could use more NTFS compatibility entries")
            return False
            
    except Exception as e:
        print(f"❌ Error checking .gitignore: {e}")
        return False

def test_build_compatibility():
    """Test build process compatibility"""
    print("\n🧪 Testing Build Compatibility...")
    
    # Test TypeScript compilation first
    try:
        print("🔨 Testing TypeScript compilation...")
        
        result = subprocess.run(['npm', 'run', 'build:ts'], 
                              capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            print("✅ TypeScript compilation successful")
            ts_success = True
        else:
            print("❌ TypeScript compilation failed")
            print("STDERR:", result.stderr[:200])
            ts_success = False
            
    except subprocess.TimeoutExpired:
        print("❌ TypeScript compilation timed out")
        ts_success = False
    except Exception as e:
        print(f"❌ TypeScript compilation error: {e}")
        ts_success = False
    
    # Test if NTFS build script exists and is executable
    ntfs_build_script = "scripts/build-ntfs-fix.sh"
    if os.path.exists(ntfs_build_script) and os.access(ntfs_build_script, os.X_OK):
        print("✅ NTFS build script is available and executable")
        ntfs_script_ok = True
    else:
        print("❌ NTFS build script is not available or not executable")
        ntfs_script_ok = False
    
    return ts_success and ntfs_script_ok

def test_directory_structure():
    """Test directory structure and permissions"""
    print("\n🧪 Testing Directory Structure...")
    
    required_dirs = [
        'scripts',
        'lib', 
        'app',
        'components'
    ]
    
    optional_dirs = [
        'logs',
        'data',
        'cache',
        'memory',
        'test_results'
    ]
    
    success_count = 0
    
    # Check required directories
    for dir_name in required_dirs:
        if os.path.exists(dir_name) and os.path.isdir(dir_name):
            print(f"✅ Required directory exists: {dir_name}")
            success_count += 1
        else:
            print(f"❌ Required directory missing: {dir_name}")
    
    # Check optional directories (create if missing)
    for dir_name in optional_dirs:
        if os.path.exists(dir_name):
            print(f"✅ Optional directory exists: {dir_name}")
        else:
            try:
                os.makedirs(dir_name, exist_ok=True)
                print(f"✅ Created optional directory: {dir_name}")
            except Exception as e:
                print(f"⚠️ Could not create directory {dir_name}: {e}")
    
    return success_count == len(required_dirs)

def main():
    """Run all NTFS fixes tests"""
    print("🚀 Starting NTFS/fuseblk Fixes Tests...\n")
    
    test_results = []
    
    # Run all tests
    fs_success, fs_type = test_filesystem_detection()
    test_results.append(("Filesystem Detection", fs_success))
    
    test_results.append(("Script Permissions", test_script_permissions()))
    test_results.append(("NPM Scripts", test_npm_scripts()))
    test_results.append(("Next.js Configuration", test_next_config()))
    test_results.append(("Environment Setup", test_environment_setup()))
    test_results.append(("Gitignore Setup", test_gitignore_setup()))
    test_results.append(("Build Compatibility", test_build_compatibility()))
    test_results.append(("Directory Structure", test_directory_structure()))
    
    # Summary
    passed_tests = sum(1 for _, result in test_results if result)
    total_tests = len(test_results)
    
    print(f"\n📊 NTFS Fixes Test Results:")
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
    print(f"📁 Detected Filesystem: {fs_type}")
    
    if passed_tests == total_tests:
        print("🎉 All NTFS fixes tests passed!")
        print("\n📋 Ready to build:")
        print("   npm run fix:permissions  - Fix any remaining permission issues")
        print("   npm run build:ntfs       - Build with NTFS compatibility")
        print("   npm run build:quick      - Quick build script")
        return 0
    else:
        print("❌ Some NTFS fixes tests failed.")
        print("\n🔧 Recommended actions:")
        print("   npm run fix:permissions  - Fix permission issues")
        print("   Check the failed tests above for specific issues")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)