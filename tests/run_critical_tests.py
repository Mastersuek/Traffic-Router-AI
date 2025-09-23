#!/usr/bin/env python3
"""
Critical Tests Runner
Запуск критически важных тестов для проверки готовности системы
"""

import asyncio
import sys
import os
import time
from datetime import datetime

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

async def test_basic_imports():
    """Тест базовых импортов"""
    print("🧪 Testing basic imports...")
    
    try:
        # Test agent import
        from agents.enhanced_recovery_agent_v2 import EnhancedRecoveryAgent
        print("✅ Enhanced Recovery Agent import successful")
        
        # Test memory manager import
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "memory_manager", 
            os.path.join(os.path.dirname(__file__), '..', 'lib', 'memory-manager.py')
        )
        memory_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(memory_module)
        print("✅ Memory Manager import successful")
        
        # Test session manager import
        spec = importlib.util.spec_from_file_location(
            "session_manager", 
            os.path.join(os.path.dirname(__file__), '..', 'lib', 'session-manager.py')
        )
        session_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(session_module)
        print("✅ Session Manager import successful")
        
        # Test MCP integration import
        spec = importlib.util.spec_from_file_location(
            "mcp_integration", 
            os.path.join(os.path.dirname(__file__), '..', 'lib', 'mcp-ai-agent-integration.py')
        )
        mcp_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mcp_module)
        print("✅ MCP Integration import successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Import test failed: {e}")
        return False

async def test_configuration_files():
    """Тест конфигурационных файлов"""
    print("🧪 Testing configuration files...")
    
    try:
        import yaml
        
        # Test memory config
        memory_config_path = "config/memory-config.yaml"
        if os.path.exists(memory_config_path):
            with open(memory_config_path, 'r', encoding='utf-8') as f:
                memory_config = yaml.safe_load(f)
                if 'memory' not in memory_config:
                    print("❌ Memory config missing 'memory' section")
                    return False
            print("✅ Memory configuration valid")
        else:
            print("⚠️ Memory config file not found")
        
        # Test session config
        session_config_path = "config/session-config.yaml"
        if os.path.exists(session_config_path):
            with open(session_config_path, 'r', encoding='utf-8') as f:
                session_config = yaml.safe_load(f)
                if 'sessions' not in session_config:
                    print("❌ Session config missing 'sessions' section")
                    return False
            print("✅ Session configuration valid")
        else:
            print("⚠️ Session config file not found")
        
        return True
        
    except Exception as e:
        print(f"❌ Configuration test failed: {e}")
        return False

async def test_agent_initialization():
    """Тест инициализации агента"""
    print("🧪 Testing agent initialization...")
    
    try:
        from agents.enhanced_recovery_agent_v2 import EnhancedRecoveryAgent
        import tempfile
        import yaml
        
        # Create temporary config
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            test_config = {
                "services": [
                    {"name": "test-service", "port": 13000, "endpoint": "/health", "timeout": 5}
                ],
                "monitoring": {
                    "interval": 30,
                    "health_check_interval": 60,
                    "recovery_attempts": 3,
                    "cooldown_period": 300
                },
                "recovery": {
                    "max_concurrent_recoveries": 2,
                    "restart_timeout": 60,
                    "health_check_retries": 3
                }
            }
            yaml.dump(test_config, f, default_flow_style=False, allow_unicode=True)
            config_file = f.name
        
        # Initialize agent
        agent = EnhancedRecoveryAgent(config_file)
        await agent.initialize()
        
        print("✅ Agent initialization successful")
        
        # Test basic command
        response = await agent.process_command("help", "test_user")
        if not response or "команды" not in response.lower():
            print("❌ Agent help command failed")
            return False
        
        print("✅ Agent command processing successful")
        
        # Cleanup
        await agent._cleanup()
        os.unlink(config_file)
        
        return True
        
    except Exception as e:
        print(f"❌ Agent initialization test failed: {e}")
        return False

async def test_memory_system():
    """Тест системы памяти"""
    print("🧪 Testing memory system...")
    
    try:
        import importlib.util
        import tempfile
        import shutil
        
        # Import memory manager
        spec = importlib.util.spec_from_file_location(
            "memory_manager", 
            os.path.join(os.path.dirname(__file__), '..', 'lib', 'memory-manager.py')
        )
        memory_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(memory_module)
        MarkdownMemoryManager = memory_module.MarkdownMemoryManager
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Initialize memory manager
            memory_manager = MarkdownMemoryManager(temp_dir)
            
            # Test memory update
            entry_id = await memory_manager.update_memory(
                entity="test_entity",
                content="Test memory entry for critical tests",
                memory_type="fact",
                tags=["test", "critical"],
                importance=3
            )
            
            if not entry_id:
                print("❌ Memory update failed")
                return False
            
            print("✅ Memory update successful")
            
            # Test memory search
            results = await memory_manager.search_memory("test", limit=5)
            if not results:
                print("❌ Memory search failed")
                return False
            
            print("✅ Memory search successful")
            
            # Test memory stats
            stats = await memory_manager.get_memory_stats()
            if stats.total_entries == 0:
                print("❌ Memory stats failed")
                return False
            
            print("✅ Memory stats successful")
            
            return True
            
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
        
    except Exception as e:
        print(f"❌ Memory system test failed: {e}")
        return False

async def test_session_system():
    """Тест системы сессий"""
    print("🧪 Testing session system...")
    
    try:
        import importlib.util
        import tempfile
        import shutil
        
        # Import session manager
        spec = importlib.util.spec_from_file_location(
            "session_manager", 
            os.path.join(os.path.dirname(__file__), '..', 'lib', 'session-manager.py')
        )
        session_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(session_module)
        SessionManager = session_module.SessionManager
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Initialize session manager
            session_manager = SessionManager(temp_dir)
            
            # Test session creation
            session_id = await session_manager.create_session("critical_test_user")
            if not session_id:
                print("❌ Session creation failed")
                return False
            
            print("✅ Session creation successful")
            
            # Test context addition
            entry_id = await session_manager.add_context_entry(
                session_id=session_id,
                entry_type="test",
                content="Critical test context entry",
                importance=2
            )
            
            if not entry_id:
                print("❌ Context addition failed")
                return False
            
            print("✅ Context addition successful")
            
            # Test context retrieval
            context = await session_manager.get_session_context(session_id)
            if not context or len(context) < 2:  # Should have at least session creation + test entry
                print("❌ Context retrieval failed")
                return False
            
            print("✅ Context retrieval successful")
            
            # Test session stats
            stats = await session_manager.get_session_stats()
            if stats['active_sessions'] == 0:
                print("❌ Session stats failed")
                return False
            
            print("✅ Session stats successful")
            
            # Cleanup
            await session_manager.shutdown()
            
            return True
            
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
        
    except Exception as e:
        print(f"❌ Session system test failed: {e}")
        return False

async def run_critical_tests():
    """Запуск всех критических тестов"""
    print("🚀 Starting Critical Tests Suite...\n")
    
    start_time = time.time()
    
    tests = [
        ("Basic Imports", test_basic_imports),
        ("Configuration Files", test_configuration_files),
        ("Agent Initialization", test_agent_initialization),
        ("Memory System", test_memory_system),
        ("Session System", test_session_system),
    ]
    
    results = []
    
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
            print(f"❌ {test_name} crashed: {e}")
    
    total_duration = time.time() - start_time
    passed_tests = sum(1 for r in results if r["passed"])
    total_tests = len(results)
    
    # Print summary
    print(f"\n" + "="*50)
    print(f"📊 CRITICAL TESTS SUMMARY")
    print(f"="*50)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests} ✅")
    print(f"Failed: {total_tests - passed_tests} ❌")
    print(f"Success Rate: {(passed_tests / total_tests) * 100:.1f}%")
    print(f"Duration: {total_duration:.2f}s")
    
    if passed_tests == total_tests:
        print(f"\n🎉 ALL CRITICAL TESTS PASSED!")
        print(f"✅ System is ready for basic operation.")
    else:
        print(f"\n⚠️ {total_tests - passed_tests} critical tests failed!")
        print(f"❌ System may not function properly.")
        
        print(f"\nFailed tests:")
        for result in results:
            if not result["passed"]:
                print(f"   - {result['name']}: {result['error'] or 'Test returned False'}")
    
    print(f"="*50)
    
    return passed_tests == total_tests

def main():
    """Основная функция"""
    try:
        success = asyncio.run(run_critical_tests())
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 130
    except Exception as e:
        print(f"\n💥 Critical tests crashed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)