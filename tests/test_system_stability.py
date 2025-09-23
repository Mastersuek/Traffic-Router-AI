#!/usr/bin/env python3
"""
System Stability Tests for Enhanced Recovery Agent
Тесты стабильности системы
"""

import asyncio
import sys
import os
import json
import time
import threading
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Configure logging
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

class StabilityTestSuite:
    """Тесты стабильности системы"""
    
    def __init__(self):
        self.test_results = []
        self.temp_dirs = []
        
    def create_temp_dir(self) -> str:
        """Создание временной директории"""
        import tempfile
        temp_dir = tempfile.mkdtemp()
        self.temp_dirs.append(temp_dir)
        return temp_dir
    
    def cleanup_temp_dirs(self):
        """Очистка временных директорий"""
        import shutil
        for temp_dir in self.temp_dirs:
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass
        self.temp_dirs.clear()
    
    async def test_agent_stability_under_load(self, duration_minutes: int = 2) -> bool:
        """Тест стабильности агента под нагрузкой"""
        print(f"🧪 Testing Agent Stability Under Load ({duration_minutes} minutes)...")
        
        try:
            from agents.enhanced_recovery_agent_v2 import EnhancedRecoveryAgent
            
            # Create test configuration
            test_config = {
                "services": [
                    {"name": "test-service", "port": 13000, "endpoint": "/health", "timeout": 5}
                ],
                "monitoring": {
                    "interval": 60,
                    "health_check_interval": 120,
                    "recovery_attempts": 2,
                    "cooldown_period": 300
                }
            }
            
            import tempfile
            import yaml
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(test_config, f, default_flow_style=False, allow_unicode=True)
                config_file = f.name
            
            try:
                # Initialize agent
                agent = EnhancedRecoveryAgent(config_file)
                await agent.initialize()
                
                # Test parameters
                end_time = time.time() + (duration_minutes * 60)
                command_count = 0
                success_count = 0
                error_count = 0
                
                commands = ["help", "status", "session info", "memory", "mcp status"]
                
                print(f"   Running continuous load for {duration_minutes} minutes...")
                
                while time.time() < end_time:
                    command = commands[command_count % len(commands)]
                    
                    try:
                        response = await agent.process_command(command, f"stability_user_{command_count}")
                        if response:
                            success_count += 1
                        else:
                            error_count += 1
                    except Exception as e:
                        error_count += 1
                        logger.error(f"Command error: {e}")
                    
                    command_count += 1
                    
                    # Small delay to prevent overwhelming
                    await asyncio.sleep(0.1)
                
                # Calculate results
                success_rate = (success_count / command_count) * 100 if command_count > 0 else 0
                
                print(f"   Commands executed: {command_count}")
                print(f"   Success rate: {success_rate:.1f}%")
                print(f"   Errors: {error_count}")
                
                # Cleanup
                await agent._cleanup()
                
                # Consider test passed if success rate > 90%
                test_passed = success_rate > 90
                
                if test_passed:
                    print("✅ Agent stability test passed")
                else:
                    print("❌ Agent stability test failed - too many errors")
                
                return test_passed
                
            finally:
                os.unlink(config_file)
                
        except Exception as e:
            print(f"❌ Agent stability test failed: {e}")
            return False
    
    async def test_memory_system_stability(self, operations_count: int = 500) -> bool:
        """Тест стабильности системы памяти"""
        print(f"🧪 Testing Memory System Stability ({operations_count} operations)...")
        
        try:
            # Import memory manager
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "memory_manager", 
                os.path.join(os.path.dirname(__file__), '..', 'lib', 'memory-manager.py')
            )
            memory_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(memory_module)
            MarkdownMemoryManager = memory_module.MarkdownMemoryManager
            
            # Create temporary directory
            temp_dir = self.create_temp_dir()
            memory_manager = MarkdownMemoryManager(temp_dir)
            
            success_count = 0
            error_count = 0
            
            print(f"   Executing {operations_count} memory operations...")
            
            for i in range(operations_count):
                operation_type = i % 4
                
                try:
                    if operation_type == 0:  # Memory update
                        await memory_manager.update_memory(
                            entity=f"stability_entity_{i % 50}",
                            content=f"Stability test entry {i}",
                            memory_type="fact",
                            tags=["stability_test"],
                            importance=1
                        )
                    elif operation_type == 1:  # Memory search
                        await memory_manager.search_memory("stability", limit=10)
                    elif operation_type == 2:  # Memory stats
                        await memory_manager.get_memory_stats()
                    else:  # Update different entity
                        await memory_manager.update_memory(
                            entity=f"shared_entity_{i % 10}",
                            content=f"Shared stability entry {i}",
                            memory_type="observation",
                            tags=["shared", "stability"],
                            importance=2
                        )
                    
                    success_count += 1
                    
                except Exception as e:
                    error_count += 1
                    logger.error(f"Memory operation {i} error: {e}")
                
                # Progress indicator
                if i % 100 == 0 and i > 0:
                    print(f"   Progress: {i}/{operations_count} operations completed")
            
            # Calculate results
            success_rate = (success_count / operations_count) * 100
            
            print(f"   Operations completed: {operations_count}")
            print(f"   Success rate: {success_rate:.1f}%")
            print(f"   Errors: {error_count}")
            
            # Consider test passed if success rate > 95%
            test_passed = success_rate > 95
            
            if test_passed:
                print("✅ Memory system stability test passed")
            else:
                print("❌ Memory system stability test failed - too many errors")
            
            return test_passed
            
        except Exception as e:
            print(f"❌ Memory system stability test failed: {e}")
            return False
    
    async def test_session_system_stability(self, sessions_count: int = 50) -> bool:
        """Тест стабильности системы сессий"""
        print(f"🧪 Testing Session System Stability ({sessions_count} sessions)...")
        
        try:
            # Import session manager
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "session_manager", 
                os.path.join(os.path.dirname(__file__), '..', 'lib', 'session-manager.py')
            )
            session_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(session_module)
            SessionManager = session_module.SessionManager
            
            # Create temporary directory
            temp_dir = self.create_temp_dir()
            session_manager = SessionManager(temp_dir)
            
            success_count = 0
            error_count = 0
            created_sessions = []
            
            print(f"   Creating and managing {sessions_count} sessions...")
            
            # Create sessions and perform operations
            for i in range(sessions_count):
                try:
                    # Create session
                    session_id = await session_manager.create_session(f"stability_user_{i}")
                    if session_id:
                        created_sessions.append(session_id)
                        success_count += 1
                        
                        # Add context entries to session
                        for j in range(5):  # 5 context entries per session
                            try:
                                await session_manager.add_context_entry(
                                    session_id=session_id,
                                    entry_type="test",
                                    content=f"Stability test context {i}_{j}",
                                    importance=1
                                )
                                success_count += 1
                            except Exception as e:
                                error_count += 1
                                logger.error(f"Context entry error: {e}")
                        
                        # Get session context
                        try:
                            await session_manager.get_session_context(session_id, limit=10)
                            success_count += 1
                        except Exception as e:
                            error_count += 1
                            logger.error(f"Get context error: {e}")
                    else:
                        error_count += 1
                        
                except Exception as e:
                    error_count += 1
                    logger.error(f"Session creation error: {e}")
                
                # Progress indicator
                if i % 10 == 0 and i > 0:
                    print(f"   Progress: {i}/{sessions_count} sessions processed")
            
            # Test search functionality
            try:
                search_results = await session_manager.search_context(query="stability", limit=20)
                if search_results:
                    success_count += 1
                else:
                    error_count += 1
            except Exception as e:
                error_count += 1
                logger.error(f"Search error: {e}")
            
            # Calculate results
            total_operations = sessions_count * 7 + 1  # 1 create + 5 add_context + 1 get_context per session + 1 search
            success_rate = (success_count / total_operations) * 100
            
            print(f"   Sessions created: {len(created_sessions)}")
            print(f"   Total operations: {total_operations}")
            print(f"   Success rate: {success_rate:.1f}%")
            print(f"   Errors: {error_count}")
            
            # Cleanup
            await session_manager.shutdown()
            
            # Consider test passed if success rate > 90%
            test_passed = success_rate > 90
            
            if test_passed:
                print("✅ Session system stability test passed")
            else:
                print("❌ Session system stability test failed - too many errors")
            
            return test_passed
            
        except Exception as e:
            print(f"❌ Session system stability test failed: {e}")
            return False
    
    async def test_concurrent_operations_stability(self, concurrent_tasks: int = 10) -> bool:
        """Тест стабильности при параллельных операциях"""
        print(f"🧪 Testing Concurrent Operations Stability ({concurrent_tasks} concurrent tasks)...")
        
        try:
            from agents.enhanced_recovery_agent_v2 import EnhancedRecoveryAgent
            
            # Create test configuration
            test_config = {
                "services": [
                    {"name": "test-service", "port": 13000, "endpoint": "/health", "timeout": 3}
                ],
                "monitoring": {
                    "interval": 120,
                    "health_check_interval": 240,
                    "recovery_attempts": 1,
                    "cooldown_period": 600
                }
            }
            
            import tempfile
            import yaml
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(test_config, f, default_flow_style=False, allow_unicode=True)
                config_file = f.name
            
            try:
                # Initialize agent
                agent = EnhancedRecoveryAgent(config_file)
                await agent.initialize()
                
                # Shared results
                results_lock = threading.Lock()
                total_success = 0
                total_errors = 0
                
                async def concurrent_task(task_id: int):
                    """Параллельная задача"""
                    nonlocal total_success, total_errors
                    
                    task_success = 0
                    task_errors = 0
                    
                    commands = ["help", "status", "session info", "memory"]
                    
                    for i in range(20):  # 20 commands per task
                        command = commands[i % len(commands)]
                        
                        try:
                            response = await agent.process_command(command, f"concurrent_user_{task_id}_{i}")
                            if response:
                                task_success += 1
                            else:
                                task_errors += 1
                        except Exception as e:
                            task_errors += 1
                            logger.error(f"Task {task_id} command error: {e}")
                    
                    # Update shared results
                    with results_lock:
                        total_success += task_success
                        total_errors += task_errors
                
                # Run concurrent tasks
                print(f"   Running {concurrent_tasks} concurrent tasks...")
                
                tasks = []
                for task_id in range(concurrent_tasks):
                    task = asyncio.create_task(concurrent_task(task_id))
                    tasks.append(task)
                
                await asyncio.gather(*tasks)
                
                # Calculate results
                total_operations = concurrent_tasks * 20
                success_rate = (total_success / total_operations) * 100 if total_operations > 0 else 0
                
                print(f"   Total operations: {total_operations}")
                print(f"   Success rate: {success_rate:.1f}%")
                print(f"   Errors: {total_errors}")
                
                # Cleanup
                await agent._cleanup()
                
                # Consider test passed if success rate > 85%
                test_passed = success_rate > 85
                
                if test_passed:
                    print("✅ Concurrent operations stability test passed")
                else:
                    print("❌ Concurrent operations stability test failed - too many errors")
                
                return test_passed
                
            finally:
                os.unlink(config_file)
                
        except Exception as e:
            print(f"❌ Concurrent operations stability test failed: {e}")
            return False
    
    async def test_resource_cleanup_stability(self) -> bool:
        """Тест стабильности очистки ресурсов"""
        print("🧪 Testing Resource Cleanup Stability...")
        
        try:
            from agents.enhanced_recovery_agent_v2 import EnhancedRecoveryAgent
            
            # Test multiple agent creation and cleanup cycles
            cycles = 5
            success_count = 0
            
            for cycle in range(cycles):
                try:
                    # Create test configuration
                    test_config = {
                        "services": [
                            {"name": f"test-service-{cycle}", "port": 13000 + cycle, "endpoint": "/health", "timeout": 2}
                        ],
                        "monitoring": {
                            "interval": 300,
                            "health_check_interval": 600,
                            "recovery_attempts": 1,
                            "cooldown_period": 900
                        }
                    }
                    
                    import tempfile
                    import yaml
                    
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                        yaml.dump(test_config, f, default_flow_style=False, allow_unicode=True)
                        config_file = f.name
                    
                    try:
                        # Initialize agent
                        agent = EnhancedRecoveryAgent(config_file)
                        await agent.initialize()
                        
                        # Perform some operations
                        await agent.process_command("help", f"cleanup_test_user_{cycle}")
                        await agent.process_command("status", f"cleanup_test_user_{cycle}")
                        
                        # Cleanup agent
                        await agent._cleanup()
                        
                        success_count += 1
                        print(f"   Cycle {cycle + 1}/{cycles} completed successfully")
                        
                    finally:
                        os.unlink(config_file)
                        
                except Exception as e:
                    print(f"   Cycle {cycle + 1}/{cycles} failed: {e}")
            
            # Calculate results
            success_rate = (success_count / cycles) * 100
            
            print(f"   Cleanup cycles completed: {success_count}/{cycles}")
            print(f"   Success rate: {success_rate:.1f}%")
            
            # Consider test passed if all cycles succeeded
            test_passed = success_count == cycles
            
            if test_passed:
                print("✅ Resource cleanup stability test passed")
            else:
                print("❌ Resource cleanup stability test failed")
            
            return test_passed
            
        except Exception as e:
            print(f"❌ Resource cleanup stability test failed: {e}")
            return False
    
    async def run_all_stability_tests(self) -> Dict[str, Any]:
        """Выполнение всех тестов стабильности"""
        print("🚀 Starting System Stability Tests...\n")
        
        start_time = time.time()
        
        # Define stability tests
        tests = [
            ("Agent Stability Under Load", self.test_agent_stability_under_load),
            ("Memory System Stability", self.test_memory_system_stability),
            ("Session System Stability", self.test_session_system_stability),
            ("Concurrent Operations Stability", self.test_concurrent_operations_stability),
            ("Resource Cleanup Stability", self.test_resource_cleanup_stability),
        ]
        
        results = []
        
        for test_name, test_func in tests:
            print(f"\n{'='*70}")
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
        
        summary = {
            "test_type": "system_stability",
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "success_rate": (passed_tests / total_tests) * 100 if total_tests > 0 else 0,
            "total_duration": total_duration,
            "timestamp": datetime.now().isoformat(),
            "results": results
        }
        
        return summary
    
    def print_stability_summary(self, summary: Dict[str, Any]):
        """Вывод сводки тестов стабильности"""
        print(f"\n" + "="*70)
        print(f"📊 SYSTEM STABILITY TESTS SUMMARY")
        print(f"="*70)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed_tests']} ✅")
        print(f"Failed: {summary['failed_tests']} ❌")
        print(f"Success Rate: {summary['success_rate']:.1f}%")
        print(f"Duration: {summary['total_duration']:.2f}s")
        
        if summary['failed_tests'] > 0:
            print(f"\n❌ Failed Tests:")
            for result in summary['results']:
                if not result['passed']:
                    print(f"   - {result['name']}: {result['error'] or 'Test returned False'}")
        
        # Stability assessment
        if summary['success_rate'] >= 100:
            print(f"\n🎉 EXCELLENT STABILITY!")
            print("✅ System is highly stable and ready for production load.")
        elif summary['success_rate'] >= 80:
            print(f"\n👍 GOOD STABILITY!")
            print("✅ System shows good stability under load.")
        else:
            print(f"\n⚠️ STABILITY ISSUES!")
            print("🔧 System needs stability improvements before production.")
        
        print(f"="*70)
    
    def save_stability_results(self, summary: Dict[str, Any]):
        """Сохранение результатов тестов стабильности"""
        try:
            results_dir = Path("test_results")
            results_dir.mkdir(exist_ok=True)
            
            with open(results_dir / "stability_test_results.json", 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 Stability test results saved to: test_results/stability_test_results.json")
            
        except Exception as e:
            print(f"Failed to save stability test results: {e}")
    
    async def cleanup(self):
        """Очистка ресурсов"""
        self.cleanup_temp_dirs()

async def main():
    """Основная функция для запуска тестов стабильности"""
    test_suite = StabilityTestSuite()
    
    try:
        # Run all stability tests
        summary = await test_suite.run_all_stability_tests()
        
        # Print summary
        test_suite.print_stability_summary(summary)
        
        # Save results
        test_suite.save_stability_results(summary)
        
        # Return appropriate exit code
        return 0 if summary['failed_tests'] == 0 else 1
        
    except KeyboardInterrupt:
        print("\n⚠️ Stability tests interrupted by user")
        return 130
    except Exception as e:
        print(f"\n💥 Stability tests crashed: {e}")
        return 1
    finally:
        await test_suite.cleanup()

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)