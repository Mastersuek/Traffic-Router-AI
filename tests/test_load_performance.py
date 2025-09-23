#!/usr/bin/env python3
"""
Load Testing and Performance Tests for Enhanced Recovery Agent
Нагрузочное тестирование и тесты производительности
"""

import asyncio
import sys
import os
import json
import time
import statistics
import concurrent.futures
import threading
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import logging

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Configure logging
logging.basicConfig(level=logging.WARNING)  # Reduce noise during load tests
logger = logging.getLogger(__name__)

class LoadTestResult:
    """Результат нагрузочного теста"""
    def __init__(self, test_name: str, total_requests: int, duration: float, 
                 success_count: int, error_count: int, response_times: List[float]):
        self.test_name = test_name
        self.total_requests = total_requests
        self.duration = duration
        self.success_count = success_count
        self.error_count = error_count
        self.response_times = response_times
        self.timestamp = datetime.now()
        
        # Calculate metrics
        self.success_rate = (success_count / total_requests) * 100 if total_requests > 0 else 0
        self.requests_per_second = total_requests / duration if duration > 0 else 0
        self.avg_response_time = statistics.mean(response_times) if response_times else 0
        self.min_response_time = min(response_times) if response_times else 0
        self.max_response_time = max(response_times) if response_times else 0
        self.median_response_time = statistics.median(response_times) if response_times else 0
        self.p95_response_time = self._percentile(response_times, 95) if response_times else 0
        self.p99_response_time = self._percentile(response_times, 99) if response_times else 0
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Вычисление перцентиля"""
        if not data:
            return 0
        sorted_data = sorted(data)
        index = int((percentile / 100) * len(sorted_data))
        return sorted_data[min(index, len(sorted_data) - 1)]

class LoadTestSuite:
    """Набор нагрузочных тестов"""
    
    def __init__(self):
        self.results: List[LoadTestResult] = []
        self.temp_dirs: List[str] = []
        
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
    
    async def load_test_agent_commands(self, concurrent_users: int = 10, 
                                     requests_per_user: int = 50) -> LoadTestResult:
        """Нагрузочный тест команд агента"""
        print(f"🧪 Load Testing Agent Commands ({concurrent_users} users, {requests_per_user} requests each)...")
        
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
                
                # Define test commands
                test_commands = [
                    "help",
                    "status", 
                    "session info",
                    "memory",
                    "mcp status"
                ]
                
                # Shared results storage
                results_lock = threading.Lock()
                success_count = 0
                error_count = 0
                response_times = []
                
                async def user_simulation(user_id: int):
                    """Симуляция одного пользователя"""
                    nonlocal success_count, error_count, response_times
                    
                    user_success = 0
                    user_errors = 0
                    user_times = []
                    
                    for i in range(requests_per_user):
                        command = test_commands[i % len(test_commands)]
                        start_time = time.time()
                        
                        try:
                            response = await agent.process_command(command, f"load_test_user_{user_id}")
                            duration = time.time() - start_time
                            
                            if response:
                                user_success += 1
                                user_times.append(duration)
                            else:
                                user_errors += 1
                                
                        except Exception as e:
                            duration = time.time() - start_time
                            user_errors += 1
                            logger.error(f"User {user_id} command error: {e}")
                    
                    # Update shared results
                    with results_lock:
                        success_count += user_success
                        error_count += user_errors
                        response_times.extend(user_times)
                
                # Run concurrent user simulations
                start_time = time.time()
                
                tasks = []
                for user_id in range(concurrent_users):
                    task = asyncio.create_task(user_simulation(user_id))
                    tasks.append(task)
                
                await asyncio.gather(*tasks)
                
                total_duration = time.time() - start_time
                total_requests = concurrent_users * requests_per_user
                
                # Cleanup
                await agent._cleanup()
                
                result = LoadTestResult(
                    test_name="Agent Commands Load Test",
                    total_requests=total_requests,
                    duration=total_duration,
                    success_count=success_count,
                    error_count=error_count,
                    response_times=response_times
                )
                
                print(f"✅ Agent Commands Load Test completed:")
                print(f"   Requests: {total_requests}, Success: {success_count}, Errors: {error_count}")
                print(f"   Success Rate: {result.success_rate:.1f}%")
                print(f"   RPS: {result.requests_per_second:.2f}")
                print(f"   Avg Response: {result.avg_response_time:.3f}s")
                print(f"   P95 Response: {result.p95_response_time:.3f}s")
                
                return result
                
            finally:
                os.unlink(config_file)
                
        except Exception as e:
            print(f"❌ Agent commands load test failed: {e}")
            return LoadTestResult(
                test_name="Agent Commands Load Test",
                total_requests=concurrent_users * requests_per_user,
                duration=0,
                success_count=0,
                error_count=concurrent_users * requests_per_user,
                response_times=[]
            )
    
    async def load_test_memory_system(self, concurrent_operations: int = 20,
                                    operations_per_thread: int = 100) -> LoadTestResult:
        """Нагрузочный тест системы памяти"""
        print(f"🧪 Load Testing Memory System ({concurrent_operations} threads, {operations_per_thread} ops each)...")
        
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
            
            # Shared results storage
            results_lock = threading.Lock()
            success_count = 0
            error_count = 0
            response_times = []
            
            async def memory_operations(thread_id: int):
                """Операции с памятью в отдельном потоке"""
                nonlocal success_count, error_count, response_times
                
                thread_success = 0
                thread_errors = 0
                thread_times = []
                
                for i in range(operations_per_thread):
                    operation_type = i % 4  # 4 types of operations
                    start_time = time.time()
                    
                    try:
                        if operation_type == 0:  # Memory update
                            await memory_manager.update_memory(
                                entity=f"load_test_entity_{thread_id}_{i}",
                                content=f"Load test memory entry {thread_id}_{i}",
                                memory_type="fact",
                                tags=["load_test", f"thread_{thread_id}"],
                                importance=2
                            )
                        elif operation_type == 1:  # Memory search
                            await memory_manager.search_memory("load_test", limit=10)
                        elif operation_type == 2:  # Memory stats
                            await memory_manager.get_memory_stats()
                        else:  # Memory update with different entity
                            await memory_manager.update_memory(
                                entity=f"shared_entity_{i % 5}",
                                content=f"Shared memory entry from thread {thread_id}",
                                memory_type="observation",
                                tags=["shared", "load_test"],
                                importance=1
                            )
                        
                        duration = time.time() - start_time
                        thread_success += 1
                        thread_times.append(duration)
                        
                    except Exception as e:
                        duration = time.time() - start_time
                        thread_errors += 1
                        logger.error(f"Memory operation error in thread {thread_id}: {e}")
                
                # Update shared results
                with results_lock:
                    success_count += thread_success
                    error_count += thread_errors
                    response_times.extend(thread_times)
            
            # Run concurrent memory operations
            start_time = time.time()
            
            tasks = []
            for thread_id in range(concurrent_operations):
                task = asyncio.create_task(memory_operations(thread_id))
                tasks.append(task)
            
            await asyncio.gather(*tasks)
            
            total_duration = time.time() - start_time
            total_requests = concurrent_operations * operations_per_thread
            
            result = LoadTestResult(
                test_name="Memory System Load Test",
                total_requests=total_requests,
                duration=total_duration,
                success_count=success_count,
                error_count=error_count,
                response_times=response_times
            )
            
            print(f"✅ Memory System Load Test completed:")
            print(f"   Operations: {total_requests}, Success: {success_count}, Errors: {error_count}")
            print(f"   Success Rate: {result.success_rate:.1f}%")
            print(f"   OPS: {result.requests_per_second:.2f}")
            print(f"   Avg Response: {result.avg_response_time:.3f}s")
            print(f"   P95 Response: {result.p95_response_time:.3f}s")
            
            return result
            
        except Exception as e:
            print(f"❌ Memory system load test failed: {e}")
            return LoadTestResult(
                test_name="Memory System Load Test",
                total_requests=concurrent_operations * operations_per_thread,
                duration=0,
                success_count=0,
                error_count=concurrent_operations * operations_per_thread,
                response_times=[]
            )
    
    async def load_test_session_system(self, concurrent_sessions: int = 15,
                                     operations_per_session: int = 50) -> LoadTestResult:
        """Нагрузочный тест системы сессий"""
        print(f"🧪 Load Testing Session System ({concurrent_sessions} sessions, {operations_per_session} ops each)...")
        
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
            
            # Shared results storage
            results_lock = threading.Lock()
            success_count = 0
            error_count = 0
            response_times = []
            
            async def session_operations(session_id_base: int):
                """Операции с сессиями"""
                nonlocal success_count, error_count, response_times
                
                session_success = 0
                session_errors = 0
                session_times = []
                
                # Create session
                session_id = None
                start_time = time.time()
                try:
                    session_id = await session_manager.create_session(f"load_test_user_{session_id_base}")
                    duration = time.time() - start_time
                    session_success += 1
                    session_times.append(duration)
                except Exception as e:
                    duration = time.time() - start_time
                    session_errors += 1
                    logger.error(f"Session creation error: {e}")
                    return
                
                # Perform operations on the session
                for i in range(operations_per_session - 1):  # -1 because we already created session
                    operation_type = i % 3  # 3 types of operations
                    start_time = time.time()
                    
                    try:
                        if operation_type == 0:  # Add context entry
                            await session_manager.add_context_entry(
                                session_id=session_id,
                                entry_type="test",
                                content=f"Load test context entry {i}",
                                importance=1
                            )
                        elif operation_type == 1:  # Get session context
                            await session_manager.get_session_context(session_id, limit=20)
                        else:  # Search context
                            await session_manager.search_context(query="load test", limit=10)
                        
                        duration = time.time() - start_time
                        session_success += 1
                        session_times.append(duration)
                        
                    except Exception as e:
                        duration = time.time() - start_time
                        session_errors += 1
                        logger.error(f"Session operation error: {e}")
                
                # Update shared results
                with results_lock:
                    success_count += session_success
                    error_count += session_errors
                    response_times.extend(session_times)
            
            # Run concurrent session operations
            start_time = time.time()
            
            tasks = []
            for session_id in range(concurrent_sessions):
                task = asyncio.create_task(session_operations(session_id))
                tasks.append(task)
            
            await asyncio.gather(*tasks)
            
            total_duration = time.time() - start_time
            total_requests = concurrent_sessions * operations_per_session
            
            # Cleanup
            await session_manager.shutdown()
            
            result = LoadTestResult(
                test_name="Session System Load Test",
                total_requests=total_requests,
                duration=total_duration,
                success_count=success_count,
                error_count=error_count,
                response_times=response_times
            )
            
            print(f"✅ Session System Load Test completed:")
            print(f"   Operations: {total_requests}, Success: {success_count}, Errors: {error_count}")
            print(f"   Success Rate: {result.success_rate:.1f}%")
            print(f"   OPS: {result.requests_per_second:.2f}")
            print(f"   Avg Response: {result.avg_response_time:.3f}s")
            print(f"   P95 Response: {result.p95_response_time:.3f}s")
            
            return result
            
        except Exception as e:
            print(f"❌ Session system load test failed: {e}")
            return LoadTestResult(
                test_name="Session System Load Test",
                total_requests=concurrent_sessions * operations_per_session,
                duration=0,
                success_count=0,
                error_count=concurrent_sessions * operations_per_session,
                response_times=[]
            )
    
    async def stress_test_concurrent_agents(self, num_agents: int = 5,
                                          commands_per_agent: int = 20) -> LoadTestResult:
        """Стресс-тест с несколькими агентами"""
        print(f"🧪 Stress Testing Concurrent Agents ({num_agents} agents, {commands_per_agent} commands each)...")
        
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
            
            # Shared results storage
            results_lock = threading.Lock()
            success_count = 0
            error_count = 0
            response_times = []
            
            async def agent_stress_test(agent_id: int):
                """Стресс-тест одного агента"""
                nonlocal success_count, error_count, response_times
                
                agent_success = 0
                agent_errors = 0
                agent_times = []
                
                # Create config file for this agent
                with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                    yaml.dump(test_config, f, default_flow_style=False, allow_unicode=True)
                    config_file = f.name
                
                try:
                    # Initialize agent
                    agent = EnhancedRecoveryAgent(config_file)
                    await agent.initialize()
                    
                    # Test commands
                    test_commands = ["help", "status", "session info", "memory"]
                    
                    for i in range(commands_per_agent):
                        command = test_commands[i % len(test_commands)]
                        start_time = time.time()
                        
                        try:
                            response = await agent.process_command(command, f"stress_test_user_{agent_id}_{i}")
                            duration = time.time() - start_time
                            
                            if response:
                                agent_success += 1
                                agent_times.append(duration)
                            else:
                                agent_errors += 1
                                
                        except Exception as e:
                            duration = time.time() - start_time
                            agent_errors += 1
                            logger.error(f"Agent {agent_id} command error: {e}")
                    
                    # Cleanup agent
                    await agent._cleanup()
                    
                finally:
                    os.unlink(config_file)
                
                # Update shared results
                with results_lock:
                    success_count += agent_success
                    error_count += agent_errors
                    response_times.extend(agent_times)
            
            # Run concurrent agents
            start_time = time.time()
            
            tasks = []
            for agent_id in range(num_agents):
                task = asyncio.create_task(agent_stress_test(agent_id))
                tasks.append(task)
            
            await asyncio.gather(*tasks)
            
            total_duration = time.time() - start_time
            total_requests = num_agents * commands_per_agent
            
            result = LoadTestResult(
                test_name="Concurrent Agents Stress Test",
                total_requests=total_requests,
                duration=total_duration,
                success_count=success_count,
                error_count=error_count,
                response_times=response_times
            )
            
            print(f"✅ Concurrent Agents Stress Test completed:")
            print(f"   Requests: {total_requests}, Success: {success_count}, Errors: {error_count}")
            print(f"   Success Rate: {result.success_rate:.1f}%")
            print(f"   RPS: {result.requests_per_second:.2f}")
            print(f"   Avg Response: {result.avg_response_time:.3f}s")
            print(f"   P99 Response: {result.p99_response_time:.3f}s")
            
            return result
            
        except Exception as e:
            print(f"❌ Concurrent agents stress test failed: {e}")
            return LoadTestResult(
                test_name="Concurrent Agents Stress Test",
                total_requests=num_agents * commands_per_agent,
                duration=0,
                success_count=0,
                error_count=num_agents * commands_per_agent,
                response_times=[]
            )
    
    async def memory_stress_test(self, duration_seconds: int = 30) -> LoadTestResult:
        """Стресс-тест памяти системы"""
        print(f"🧪 Memory Stress Test (running for {duration_seconds} seconds)...")
        
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
            
            # Stress test variables
            success_count = 0
            error_count = 0
            response_times = []
            
            start_time = time.time()
            end_time = start_time + duration_seconds
            
            operation_counter = 0
            
            while time.time() < end_time:
                operation_start = time.time()
                
                try:
                    # Alternate between different operations
                    if operation_counter % 3 == 0:
                        # Memory update
                        await memory_manager.update_memory(
                            entity=f"stress_entity_{operation_counter % 100}",
                            content=f"Stress test entry {operation_counter}",
                            memory_type="fact",
                            tags=["stress_test"],
                            importance=1
                        )
                    elif operation_counter % 3 == 1:
                        # Memory search
                        await memory_manager.search_memory("stress", limit=5)
                    else:
                        # Memory stats
                        await memory_manager.get_memory_stats()
                    
                    duration = time.time() - operation_start
                    success_count += 1
                    response_times.append(duration)
                    
                except Exception as e:
                    duration = time.time() - operation_start
                    error_count += 1
                    logger.error(f"Memory stress operation error: {e}")
                
                operation_counter += 1
                
                # Small delay to prevent overwhelming the system
                await asyncio.sleep(0.001)
            
            total_duration = time.time() - start_time
            total_requests = success_count + error_count
            
            result = LoadTestResult(
                test_name="Memory Stress Test",
                total_requests=total_requests,
                duration=total_duration,
                success_count=success_count,
                error_count=error_count,
                response_times=response_times
            )
            
            print(f"✅ Memory Stress Test completed:")
            print(f"   Operations: {total_requests}, Success: {success_count}, Errors: {error_count}")
            print(f"   Success Rate: {result.success_rate:.1f}%")
            print(f"   OPS: {result.requests_per_second:.2f}")
            print(f"   Avg Response: {result.avg_response_time:.3f}s")
            print(f"   Max Response: {result.max_response_time:.3f}s")
            
            return result
            
        except Exception as e:
            print(f"❌ Memory stress test failed: {e}")
            return LoadTestResult(
                test_name="Memory Stress Test",
                total_requests=0,
                duration=duration_seconds,
                success_count=0,
                error_count=1,
                response_times=[]
            )
    
    async def run_all_load_tests(self) -> Dict[str, Any]:
        """Выполнение всех нагрузочных тестов"""
        print("🚀 Starting Load Testing Suite...\n")
        
        start_time = time.time()
        
        # Define load test scenarios
        load_tests = [
            ("Light Load - Agent Commands", self.load_test_agent_commands, {"concurrent_users": 5, "requests_per_user": 20}),
            ("Medium Load - Memory System", self.load_test_memory_system, {"concurrent_operations": 10, "operations_per_thread": 50}),
            ("Medium Load - Session System", self.load_test_session_system, {"concurrent_sessions": 8, "operations_per_session": 30}),
            ("Heavy Load - Concurrent Agents", self.stress_test_concurrent_agents, {"num_agents": 3, "commands_per_agent": 15}),
            ("Stress Test - Memory", self.memory_stress_test, {"duration_seconds": 20}),
        ]
        
        # Run all load tests
        for test_name, test_func, test_params in load_tests:
            print(f"\n{'='*70}")
            print(f"🔥 {test_name}")
            print(f"{'='*70}")
            
            try:
                result = await test_func(**test_params)
                self.results.append(result)
            except Exception as e:
                print(f"💥 {test_name} crashed: {e}")
                # Create a failed result
                failed_result = LoadTestResult(
                    test_name=test_name,
                    total_requests=0,
                    duration=0,
                    success_count=0,
                    error_count=1,
                    response_times=[]
                )
                self.results.append(failed_result)
        
        total_duration = time.time() - start_time
        
        # Generate summary
        summary = self._generate_load_test_summary(total_duration)
        
        return summary
    
    def _generate_load_test_summary(self, total_duration: float) -> Dict[str, Any]:
        """Генерация сводки нагрузочных тестов"""
        total_requests = sum(r.total_requests for r in self.results)
        total_success = sum(r.success_count for r in self.results)
        total_errors = sum(r.error_count for r in self.results)
        
        all_response_times = []
        for result in self.results:
            all_response_times.extend(result.response_times)
        
        # Calculate overall metrics
        overall_success_rate = (total_success / total_requests) * 100 if total_requests > 0 else 0
        overall_rps = total_requests / total_duration if total_duration > 0 else 0
        
        # Performance thresholds
        performance_grade = self._calculate_performance_grade(self.results)
        
        summary = {
            "test_type": "load_testing",
            "total_duration": total_duration,
            "total_requests": total_requests,
            "total_success": total_success,
            "total_errors": total_errors,
            "overall_success_rate": overall_success_rate,
            "overall_rps": overall_rps,
            "performance_grade": performance_grade,
            "timestamp": datetime.now().isoformat(),
            "test_results": [
                {
                    "test_name": r.test_name,
                    "total_requests": r.total_requests,
                    "success_count": r.success_count,
                    "error_count": r.error_count,
                    "success_rate": r.success_rate,
                    "requests_per_second": r.requests_per_second,
                    "avg_response_time": r.avg_response_time,
                    "min_response_time": r.min_response_time,
                    "max_response_time": r.max_response_time,
                    "p95_response_time": r.p95_response_time,
                    "p99_response_time": r.p99_response_time,
                    "duration": r.duration
                }
                for r in self.results
            ]
        }
        
        return summary
    
    def _calculate_performance_grade(self, results: List[LoadTestResult]) -> str:
        """Вычисление оценки производительности"""
        if not results:
            return "F"
        
        # Criteria for grading
        avg_success_rate = sum(r.success_rate for r in results) / len(results)
        avg_response_time = sum(r.avg_response_time for r in results) / len(results)
        max_p99_time = max((r.p99_response_time for r in results), default=0)
        
        # Grading logic
        if avg_success_rate >= 99 and avg_response_time <= 0.1 and max_p99_time <= 0.5:
            return "A+"
        elif avg_success_rate >= 95 and avg_response_time <= 0.2 and max_p99_time <= 1.0:
            return "A"
        elif avg_success_rate >= 90 and avg_response_time <= 0.5 and max_p99_time <= 2.0:
            return "B"
        elif avg_success_rate >= 80 and avg_response_time <= 1.0 and max_p99_time <= 5.0:
            return "C"
        elif avg_success_rate >= 70:
            return "D"
        else:
            return "F"
    
    def print_load_test_summary(self, summary: Dict[str, Any]):
        """Вывод сводки нагрузочных тестов"""
        print(f"\n" + "="*80)
        print(f"📊 LOAD TESTING SUMMARY")
        print(f"="*80)
        print(f"Total Duration: {summary['total_duration']:.2f}s")
        print(f"Total Requests: {summary['total_requests']:,}")
        print(f"Successful: {summary['total_success']:,} ({summary['overall_success_rate']:.1f}%)")
        print(f"Failed: {summary['total_errors']:,}")
        print(f"Overall RPS: {summary['overall_rps']:.2f}")
        print(f"Performance Grade: {summary['performance_grade']}")
        
        print(f"\n📈 Individual Test Results:")
        print(f"{'Test Name':<35} {'Requests':<10} {'Success%':<10} {'RPS':<8} {'Avg(ms)':<10} {'P95(ms)':<10}")
        print(f"{'-'*35} {'-'*10} {'-'*10} {'-'*8} {'-'*10} {'-'*10}")
        
        for result in summary['test_results']:
            print(f"{result['test_name']:<35} "
                  f"{result['total_requests']:<10} "
                  f"{result['success_rate']:<10.1f} "
                  f"{result['requests_per_second']:<8.1f} "
                  f"{result['avg_response_time']*1000:<10.1f} "
                  f"{result['p95_response_time']*1000:<10.1f}")
        
        # Performance assessment
        grade = summary['performance_grade']
        if grade in ['A+', 'A']:
            print(f"\n🎉 EXCELLENT PERFORMANCE! Grade: {grade}")
            print("✅ System handles load very well and is ready for production.")
        elif grade in ['B', 'C']:
            print(f"\n👍 GOOD PERFORMANCE! Grade: {grade}")
            print("✅ System handles load adequately. Consider optimization for higher loads.")
        else:
            print(f"\n⚠️ PERFORMANCE ISSUES! Grade: {grade}")
            print("🔧 System needs optimization before handling production load.")
        
        print(f"="*80)
    
    def save_load_test_results(self, summary: Dict[str, Any]):
        """Сохранение результатов нагрузочных тестов"""
        try:
            results_dir = Path("test_results")
            results_dir.mkdir(exist_ok=True)
            
            # Save JSON results
            with open(results_dir / "load_test_results.json", 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            
            # Save detailed report
            with open(results_dir / "load_test_report.txt", 'w', encoding='utf-8') as f:
                f.write(f"Enhanced Recovery Agent - Load Testing Report\n")
                f.write(f"Generated: {summary['timestamp']}\n")
                f.write(f"="*60 + "\n\n")
                
                f.write(f"SUMMARY:\n")
                f.write(f"Total Duration: {summary['total_duration']:.2f}s\n")
                f.write(f"Total Requests: {summary['total_requests']:,}\n")
                f.write(f"Success Rate: {summary['overall_success_rate']:.1f}%\n")
                f.write(f"Overall RPS: {summary['overall_rps']:.2f}\n")
                f.write(f"Performance Grade: {summary['performance_grade']}\n\n")
                
                f.write(f"DETAILED RESULTS:\n")
                for result in summary['test_results']:
                    f.write(f"\n{result['test_name']}:\n")
                    f.write(f"  Requests: {result['total_requests']:,}\n")
                    f.write(f"  Success Rate: {result['success_rate']:.1f}%\n")
                    f.write(f"  RPS: {result['requests_per_second']:.2f}\n")
                    f.write(f"  Avg Response: {result['avg_response_time']:.3f}s\n")
                    f.write(f"  P95 Response: {result['p95_response_time']:.3f}s\n")
                    f.write(f"  P99 Response: {result['p99_response_time']:.3f}s\n")
            
            print(f"\n💾 Load test results saved to: test_results/")
            
        except Exception as e:
            print(f"Failed to save load test results: {e}")
    
    async def cleanup(self):
        """Очистка ресурсов"""
        self.cleanup_temp_dirs()

async def main():
    """Основная функция для запуска нагрузочных тестов"""
    test_suite = LoadTestSuite()
    
    try:
        # Run all load tests
        summary = await test_suite.run_all_load_tests()
        
        # Print summary
        test_suite.print_load_test_summary(summary)
        
        # Save results
        test_suite.save_load_test_results(summary)
        
        # Return appropriate exit code based on performance grade
        grade = summary['performance_grade']
        if grade in ['A+', 'A', 'B']:
            return 0  # Good performance
        else:
            return 1  # Performance issues
        
    except KeyboardInterrupt:
        print("\n⚠️ Load tests interrupted by user")
        return 130
    except Exception as e:
        print(f"\n💥 Load tests crashed: {e}")
        return 1
    finally:
        await test_suite.cleanup()

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)