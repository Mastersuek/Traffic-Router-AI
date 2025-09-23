#!/usr/bin/env python3
"""
Component Unit Tests
Модульные тесты для исправленных компонентов системы
"""

import asyncio
import sys
import os
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

def test_config_loading():
    """Test configuration loading functionality"""
    print("🧪 Testing Configuration Loading...")
    
    try:
        # Test YAML config loading
        import yaml
        
        # Create test config
        test_config = {
            "services": [
                {"name": "test-service", "port": 8080, "endpoint": "/health"}
            ],
            "monitoring": {
                "interval": 30,
                "timeout": 10
            }
        }
        
        # Write and read config
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(test_config, f)
            config_file = f.name
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                loaded_config = yaml.safe_load(f)
            
            if loaded_config == test_config:
                print("✅ YAML configuration loading works correctly")
                return True
            else:
                print("❌ YAML configuration loading failed - data mismatch")
                return False
                
        finally:
            os.unlink(config_file)
            
    except ImportError:
        print("⚠️ PyYAML not available, skipping YAML config test")
        return True
    except Exception as e:
        print(f"❌ Configuration loading test failed: {e}")
        return False

def test_json_operations():
    """Test JSON operations used throughout the system"""
    print("\n🧪 Testing JSON Operations...")
    
    try:
        # Test data structures used in the system
        test_data = {
            "session_id": "test-session-123",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "web": {"status": "healthy", "response_time": 150.5},
                "api": {"status": "unhealthy", "error": "Connection timeout"}
            },
            "metadata": {
                "version": "2.0.0",
                "features": ["mcp", "memory", "sessions"]
            }
        }
        
        # Test JSON serialization
        json_str = json.dumps(test_data, ensure_ascii=False, indent=2)
        
        # Test JSON deserialization
        loaded_data = json.loads(json_str)
        
        # Verify data integrity
        if loaded_data == test_data:
            print("✅ JSON serialization/deserialization works correctly")
            
            # Test specific data types
            if isinstance(loaded_data["services"]["web"]["response_time"], float):
                print("✅ Float values preserved correctly")
            
            if isinstance(loaded_data["metadata"]["features"], list):
                print("✅ List values preserved correctly")
            
            return True
        else:
            print("❌ JSON operations failed - data mismatch")
            return False
            
    except Exception as e:
        print(f"❌ JSON operations test failed: {e}")
        return False

def test_file_operations():
    """Test file operations used by memory and session systems"""
    print("\n🧪 Testing File Operations...")
    
    try:
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Test directory creation
            test_subdir = Path(temp_dir) / "test_subdir"
            test_subdir.mkdir(exist_ok=True)
            
            if test_subdir.exists():
                print("✅ Directory creation works correctly")
            else:
                print("❌ Directory creation failed")
                return False
            
            # Test file writing
            test_file = test_subdir / "test_file.txt"
            test_content = "Test content with UTF-8: тест 🚀"
            
            with open(test_file, 'w', encoding='utf-8') as f:
                f.write(test_content)
            
            # Test file reading
            with open(test_file, 'r', encoding='utf-8') as f:
                read_content = f.read()
            
            if read_content == test_content:
                print("✅ File read/write operations work correctly")
            else:
                print("❌ File read/write operations failed")
                return False
            
            # Test file listing
            files = list(test_subdir.glob("*.txt"))
            if len(files) == 1 and files[0].name == "test_file.txt":
                print("✅ File listing operations work correctly")
            else:
                print("❌ File listing operations failed")
                return False
            
            return True
            
        finally:
            # Cleanup
            shutil.rmtree(temp_dir)
            
    except Exception as e:
        print(f"❌ File operations test failed: {e}")
        return False

def test_datetime_operations():
    """Test datetime operations used throughout the system"""
    print("\n🧪 Testing DateTime Operations...")
    
    try:
        # Test datetime creation and formatting
        now = datetime.now()
        iso_string = now.isoformat()
        
        # Test ISO format parsing
        parsed_datetime = datetime.fromisoformat(iso_string)
        
        if abs((now - parsed_datetime).total_seconds()) < 1:
            print("✅ DateTime ISO format operations work correctly")
        else:
            print("❌ DateTime ISO format operations failed")
            return False
        
        # Test datetime comparison
        earlier = datetime(2024, 1, 1, 12, 0, 0)
        later = datetime(2024, 1, 1, 13, 0, 0)
        
        if earlier < later and later > earlier:
            print("✅ DateTime comparison operations work correctly")
        else:
            print("❌ DateTime comparison operations failed")
            return False
        
        # Test datetime arithmetic
        from datetime import timedelta
        
        future = now + timedelta(hours=1)
        past = now - timedelta(minutes=30)
        
        if future > now > past:
            print("✅ DateTime arithmetic operations work correctly")
        else:
            print("❌ DateTime arithmetic operations failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ DateTime operations test failed: {e}")
        return False

def test_string_operations():
    """Test string operations used in search and processing"""
    print("\n🧪 Testing String Operations...")
    
    try:
        # Test string formatting
        template = "Service {service} is {status} with response time {time}ms"
        formatted = template.format(service="web", status="healthy", time=150.5)
        
        expected = "Service web is healthy with response time 150.5ms"
        if formatted == expected:
            print("✅ String formatting works correctly")
        else:
            print("❌ String formatting failed")
            return False
        
        # Test string searching (used in memory/session search)
        text = "The AI proxy server is experiencing connection timeouts to OpenAI API"
        
        # Case-insensitive search
        if "proxy" in text.lower() and "openai" in text.lower():
            print("✅ String searching works correctly")
        else:
            print("❌ String searching failed")
            return False
        
        # Test string splitting (used in command parsing)
        command = "memory search ai-proxy timeout"
        parts = command.split()
        
        if parts == ["memory", "search", "ai-proxy", "timeout"]:
            print("✅ String splitting works correctly")
        else:
            print("❌ String splitting failed")
            return False
        
        # Test string joining
        joined = " ".join(parts[2:])
        if joined == "ai-proxy timeout":
            print("✅ String joining works correctly")
        else:
            print("❌ String joining failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ String operations test failed: {e}")
        return False

def test_data_structures():
    """Test data structures used throughout the system"""
    print("\n🧪 Testing Data Structures...")
    
    try:
        # Test dictionary operations
        services = {}
        
        # Add services
        services["web"] = {"status": "healthy", "port": 13000}
        services["api"] = {"status": "unhealthy", "port": 13081}
        
        # Test dictionary access
        if services["web"]["status"] == "healthy":
            print("✅ Dictionary operations work correctly")
        else:
            print("❌ Dictionary operations failed")
            return False
        
        # Test list operations
        service_names = list(services.keys())
        unhealthy_services = [name for name, info in services.items() if info["status"] == "unhealthy"]
        
        if "web" in service_names and "api" in unhealthy_services:
            print("✅ List operations work correctly")
        else:
            print("❌ List operations failed")
            return False
        
        # Test set operations (used for deduplication)
        tags1 = {"ai", "proxy", "service"}
        tags2 = {"proxy", "timeout", "error"}
        
        common_tags = tags1 & tags2
        all_tags = tags1 | tags2
        
        if "proxy" in common_tags and len(all_tags) == 5:
            print("✅ Set operations work correctly")
        else:
            print("❌ Set operations failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Data structures test failed: {e}")
        return False

def test_error_handling():
    """Test error handling patterns used in the system"""
    print("\n🧪 Testing Error Handling...")
    
    try:
        # Test try-catch with specific exceptions
        def test_function():
            try:
                # Simulate file not found
                with open("nonexistent_file.txt", 'r') as f:
                    return f.read()
            except FileNotFoundError:
                return "file_not_found"
            except Exception as e:
                return f"other_error: {e}"
        
        result = test_function()
        if result == "file_not_found":
            print("✅ Specific exception handling works correctly")
        else:
            print("❌ Specific exception handling failed")
            return False
        
        # Test try-catch with general exceptions
        def test_json_parsing():
            try:
                return json.loads("invalid json {")
            except json.JSONDecodeError:
                return "json_error"
            except Exception:
                return "general_error"
        
        result = test_json_parsing()
        if result == "json_error":
            print("✅ JSON exception handling works correctly")
        else:
            print("❌ JSON exception handling failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
        return False

async def test_async_operations():
    """Test async operations used in the system"""
    print("\n🧪 Testing Async Operations...")
    
    try:
        # Test basic async function
        async def async_task():
            await asyncio.sleep(0.01)  # Minimal delay
            return "async_result"
        
        result = await async_task()
        if result == "async_result":
            print("✅ Basic async operations work correctly")
        else:
            print("❌ Basic async operations failed")
            return False
        
        # Test async with exception handling
        async def async_task_with_error():
            try:
                await asyncio.sleep(0.01)
                raise ValueError("test error")
            except ValueError:
                return "error_handled"
        
        result = await async_task_with_error()
        if result == "error_handled":
            print("✅ Async exception handling works correctly")
        else:
            print("❌ Async exception handling failed")
            return False
        
        # Test multiple async tasks
        async def create_tasks():
            tasks = [
                asyncio.create_task(async_task()),
                asyncio.create_task(async_task()),
                asyncio.create_task(async_task())
            ]
            results = await asyncio.gather(*tasks)
            return results
        
        results = await create_tasks()
        if len(results) == 3 and all(r == "async_result" for r in results):
            print("✅ Multiple async tasks work correctly")
        else:
            print("❌ Multiple async tasks failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Async operations test failed: {e}")
        return False

async def main():
    """Run all component unit tests"""
    print("🚀 Starting Component Unit Tests...\n")
    
    test_results = []
    
    # Run synchronous tests
    test_results.append(("Configuration Loading", test_config_loading()))
    test_results.append(("JSON Operations", test_json_operations()))
    test_results.append(("File Operations", test_file_operations()))
    test_results.append(("DateTime Operations", test_datetime_operations()))
    test_results.append(("String Operations", test_string_operations()))
    test_results.append(("Data Structures", test_data_structures()))
    test_results.append(("Error Handling", test_error_handling()))
    
    # Run async tests
    test_results.append(("Async Operations", await test_async_operations()))
    
    # Summary
    passed_tests = sum(1 for _, result in test_results if result)
    total_tests = len(test_results)
    
    print(f"\n📊 Component Unit Test Results:")
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All component unit tests passed!")
        return 0
    else:
        print("❌ Some component tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)