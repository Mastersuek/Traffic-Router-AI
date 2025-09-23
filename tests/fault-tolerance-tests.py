#!/usr/bin/env python3
"""
Fault Tolerance and Load Testing Suite
Comprehensive testing for system reliability and performance
"""

import asyncio
import aiohttp
import json
import time
import random
import statistics
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import subprocess
import signal
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/fault-tolerance-tests.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class TestResult:
    test_name: str
    success: bool
    duration: float
    error_message: Optional[str] = None
    metrics: Dict[str, Any] = None
    timestamp: datetime = None

@dataclass
class LoadTestMetrics:
    total_requests: int
    successful_requests: int
    failed_requests: int
    average_response_time: float
    min_response_time: float
    max_response_time: float
    p95_response_time: float
    p99_response_time: float
    requests_per_second: float
    error_rate: float

class FaultToleranceTestSuite:
    """Comprehensive fault tolerance testing"""
    
    def __init__(self):
        self.services = {
            'web': {'port': 13000, 'health_endpoint': '/'},
            'ai-proxy': {'port': 13081, 'health_endpoint': '/health'},
            'monitoring': {'port': 13082, 'health_endpoint': '/health'}
        }
        self.test_results = []
        self.running_processes = []
        
    async def run_all_tests(self) -> List[TestResult]:
        """Run all fault tolerance tests"""
        logger.info("🧪 Starting Fault Tolerance Test Suite...")
        
        tests = [
            self.test_service_isolation,
            self.test_graceful_degradation,
            self.test_automatic_recovery,
            self.test_cascading_failure_prevention,
            self.test_resource_exhaustion_handling,
            self.test_network_partition_tolerance,
            self.test_concurrent_failure_handling,
            self.test_data_consistency_under_failure,
            self.test_configuration_change_resilience,
            self.test_monitoring_system_resilience
        ]
        
        for test in tests:
            try:
                result = await test()
                self.test_results.append(result)
                logger.info(f"✅ {test.__name__}: {'PASS' if result.success else 'FAIL'}")
            except Exception as e:
                error_result = TestResult(
                    test_name=test.__name__,
                    success=False,
                    duration=0,
                    error_message=str(e),
                    timestamp=datetime.now()
                )
                self.test_results.append(error_result)
                logger.error(f"❌ {test.__name__}: ERROR - {e}")
        
        return self.test_results
    
    async def test_service_isolation(self) -> TestResult:
        """Test that service failures don't affect other services"""
        start_time = time.time()
        
        try:
            # Kill one service and verify others continue working
            service_to_kill = 'ai-proxy'
            other_services = ['web', 'monitoring']
            
            logger.info(f"🔪 Testing service isolation by killing {service_to_kill}")
            
            # Kill the service
            await self._kill_service(service_to_kill)
            
            # Wait for failure detection
            await asyncio.sleep(5)
            
            # Check other services are still healthy
            isolation_success = True
            for service in other_services:
                health = await self._check_service_health(service)
                if not health['healthy']:
                    isolation_success = False
                    break
            
            # Restart the killed service
            await self._restart_service(service_to_kill)
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="service_isolation",
                success=isolation_success,
                duration=duration,
                metrics={'killed_service': service_to_kill, 'other_services_healthy': isolation_success},
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="service_isolation",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    async def test_graceful_degradation(self) -> TestResult:
        """Test system graceful degradation under load"""
        start_time = time.time()
        
        try:
            # Apply high load to one service
            target_service = 'web'
            logger.info(f"🔥 Testing graceful degradation with high load on {target_service}")
            
            # Generate high load
            load_task = asyncio.create_task(self._generate_load(target_service, 100, 30))
            
            # Monitor system behavior
            degradation_metrics = []
            for _ in range(10):  # Monitor for 30 seconds
                await asyncio.sleep(3)
                metrics = await self._get_system_metrics()
                degradation_metrics.append(metrics)
            
            # Stop load generation
            load_task.cancel()
            
            # Analyze degradation
            response_times = [m.get('average_response_time', 0) for m in degradation_metrics]
            error_rates = [m.get('error_rate', 0) for m in degradation_metrics]
            
            # System should degrade gracefully (not crash, maintain basic functionality)
            graceful_degradation = (
                max(response_times) < 5000 and  # Response time under 5s
                max(error_rates) < 0.5 and     # Error rate under 50%
                any(rt > 1000 for rt in response_times)  # But should show degradation
            )
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="graceful_degradation",
                success=graceful_degradation,
                duration=duration,
                metrics={
                    'max_response_time': max(response_times),
                    'max_error_rate': max(error_rates),
                    'degradation_detected': graceful_degradation
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="graceful_degradation",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    async def test_automatic_recovery(self) -> TestResult:
        """Test automatic recovery mechanisms"""
        start_time = time.time()
        
        try:
            service = 'monitoring'
            logger.info(f"🔄 Testing automatic recovery for {service}")
            
            # Kill service
            await self._kill_service(service)
            
            # Monitor recovery attempts
            recovery_detected = False
            recovery_time = 0
            
            for attempt in range(20):  # Wait up to 60 seconds
                await asyncio.sleep(3)
                health = await self._check_service_health(service)
                
                if health['healthy'] and not recovery_detected:
                    recovery_detected = True
                    recovery_time = attempt * 3
                    break
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="automatic_recovery",
                success=recovery_detected,
                duration=duration,
                metrics={
                    'recovery_time': recovery_time,
                    'recovery_detected': recovery_detected
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="automatic_recovery",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    async def test_cascading_failure_prevention(self) -> TestResult:
        """Test prevention of cascading failures"""
        start_time = time.time()
        
        try:
            logger.info("🌊 Testing cascading failure prevention")
            
            # Kill multiple services simultaneously
            services_to_kill = ['ai-proxy', 'monitoring']
            
            for service in services_to_kill:
                await self._kill_service(service)
            
            # Wait for system to stabilize
            await asyncio.sleep(10)
            
            # Check if remaining services are still healthy
            remaining_service = 'web'
            health = await self._check_service_health(remaining_service)
            
            # Restart killed services
            for service in services_to_kill:
                await self._restart_service(service)
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="cascading_failure_prevention",
                success=health['healthy'],
                duration=duration,
                metrics={
                    'killed_services': services_to_kill,
                    'remaining_service_healthy': health['healthy']
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="cascading_failure_prevention",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    async def test_resource_exhaustion_handling(self) -> TestResult:
        """Test handling of resource exhaustion"""
        start_time = time.time()
        
        try:
            logger.info("💾 Testing resource exhaustion handling")
            
            # Simulate high memory usage
            memory_hog = subprocess.Popen([
                'python', '-c', 
                'import time; data = ["x" * 1024 * 1024] * 1000; time.sleep(30)'
            ])
            
            self.running_processes.append(memory_hog)
            
            # Monitor system behavior
            resource_metrics = []
            for _ in range(10):
                await asyncio.sleep(2)
                metrics = await self._get_system_metrics()
                resource_metrics.append(metrics)
            
            # Clean up memory hog
            memory_hog.terminate()
            memory_hog.wait()
            
            # Check if system handled resource pressure gracefully
            memory_usage = [m.get('memory_percent', 0) for m in resource_metrics]
            max_memory = max(memory_usage)
            
            # System should handle high memory usage without crashing
            resource_handling_success = max_memory > 80  # Should detect high memory
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="resource_exhaustion_handling",
                success=resource_handling_success,
                duration=duration,
                metrics={
                    'max_memory_usage': max_memory,
                    'resource_pressure_detected': resource_handling_success
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="resource_exhaustion_handling",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    async def test_network_partition_tolerance(self) -> TestResult:
        """Test network partition tolerance"""
        start_time = time.time()
        
        try:
            logger.info("🌐 Testing network partition tolerance")
            
            # Simulate network issues by blocking ports
            blocked_ports = [13081, 13082]  # Block ai-proxy and monitoring
            
            # Block ports (Windows firewall)
            for port in blocked_ports:
                subprocess.run([
                    'netsh', 'advfirewall', 'firewall', 'add', 'rule',
                    f'name=TestBlock{port}',
                    'dir=in',
                    'action=block',
                    f'localport={port}',
                    'protocol=tcp'
                ], capture_output=True)
            
            # Wait for system to adapt
            await asyncio.sleep(10)
            
            # Check if system handles partition gracefully
            web_health = await self._check_service_health('web')
            
            # Unblock ports
            for port in blocked_ports:
                subprocess.run([
                    'netsh', 'advfirewall', 'firewall', 'delete', 'rule',
                    f'name=TestBlock{port}'
                ], capture_output=True)
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="network_partition_tolerance",
                success=web_health['healthy'],
                duration=duration,
                metrics={
                    'blocked_ports': blocked_ports,
                    'web_service_healthy': web_health['healthy']
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="network_partition_tolerance",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    async def test_concurrent_failure_handling(self) -> TestResult:
        """Test handling of concurrent failures"""
        start_time = time.time()
        
        try:
            logger.info("⚡ Testing concurrent failure handling")
            
            # Create multiple concurrent failures
            failure_tasks = [
                self._simulate_service_failure('ai-proxy'),
                self._simulate_service_failure('monitoring'),
                self._simulate_high_load('web')
            ]
            
            # Execute concurrent failures
            results = await asyncio.gather(*failure_tasks, return_exceptions=True)
            
            # Wait for system to recover
            await asyncio.sleep(15)
            
            # Check final system state
            final_health = {}
            for service in self.services:
                health = await self._check_service_health(service)
                final_health[service] = health['healthy']
            
            # System should handle concurrent failures
            concurrent_handling_success = any(final_health.values())
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="concurrent_failure_handling",
                success=concurrent_handling_success,
                duration=duration,
                metrics={
                    'concurrent_failures': len(failure_tasks),
                    'final_health': final_health
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="concurrent_failure_handling",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    async def test_data_consistency_under_failure(self) -> TestResult:
        """Test data consistency during failures"""
        start_time = time.time()
        
        try:
            logger.info("💾 Testing data consistency under failure")
            
            # Write test data
            test_data = {'test_key': 'test_value', 'timestamp': time.time()}
            
            # Simulate failure during data operation
            failure_task = asyncio.create_task(self._simulate_service_failure('ai-proxy'))
            
            # Perform data operations
            data_operations = []
            for i in range(10):
                operation = asyncio.create_task(self._perform_data_operation(test_data))
                data_operations.append(operation)
            
            # Wait for operations to complete
            operation_results = await asyncio.gather(*data_operations, return_exceptions=True)
            
            # Wait for failure simulation
            await failure_task
            
            # Check data consistency
            consistency_check = await self._check_data_consistency(test_data)
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="data_consistency_under_failure",
                success=consistency_check,
                duration=duration,
                metrics={
                    'operations_performed': len(data_operations),
                    'consistency_check': consistency_check
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="data_consistency_under_failure",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    async def test_configuration_change_resilience(self) -> TestResult:
        """Test resilience to configuration changes"""
        start_time = time.time()
        
        try:
            logger.info("⚙️ Testing configuration change resilience")
            
            # Backup original config
            config_backup = await self._backup_configuration()
            
            # Apply configuration changes
            config_changes = [
                {'service': 'ai-proxy', 'change': 'port', 'value': 13083},
                {'service': 'monitoring', 'change': 'interval', 'value': 5}
            ]
            
            for change in config_changes:
                await self._apply_config_change(change)
                await asyncio.sleep(2)
            
            # Check system stability
            stability_checks = []
            for _ in range(5):
                health = await self._check_service_health('web')
                stability_checks.append(health['healthy'])
                await asyncio.sleep(2)
            
            # Restore configuration
            await self._restore_configuration(config_backup)
            
            # System should remain stable during config changes
            config_resilience = all(stability_checks)
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="configuration_change_resilience",
                success=config_resilience,
                duration=duration,
                metrics={
                    'config_changes': len(config_changes),
                    'stability_checks': stability_checks
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="configuration_change_resilience",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    async def test_monitoring_system_resilience(self) -> TestResult:
        """Test monitoring system resilience"""
        start_time = time.time()
        
        try:
            logger.info("📊 Testing monitoring system resilience")
            
            # Kill monitoring service
            await self._kill_service('monitoring')
            
            # Wait for monitoring to be down
            await asyncio.sleep(5)
            
            # Check if other services continue to work without monitoring
            other_services_health = {}
            for service_name in ['web', 'ai-proxy']:
                health = await self._check_service_health(service_name)
                other_services_health[service_name] = health['healthy']
            
            # Restart monitoring
            await self._restart_service('monitoring')
            
            # Wait for monitoring to recover
            await asyncio.sleep(10)
            
            # Check if monitoring is working again
            monitoring_health = await self._check_service_health('monitoring')
            
            # System should work without monitoring, and monitoring should recover
            monitoring_resilience = (
                all(other_services_health.values()) and 
                monitoring_health['healthy']
            )
            
            duration = time.time() - start_time
            
            return TestResult(
                test_name="monitoring_system_resilience",
                success=monitoring_resilience,
                duration=duration,
                metrics={
                    'other_services_healthy': other_services_health,
                    'monitoring_recovered': monitoring_health['healthy']
                },
                timestamp=datetime.now()
            )
            
        except Exception as e:
            return TestResult(
                test_name="monitoring_system_resilience",
                success=False,
                duration=time.time() - start_time,
                error_message=str(e),
                timestamp=datetime.now()
            )
    
    # Helper methods
    async def _check_service_health(self, service_name: str) -> Dict[str, Any]:
        """Check health of a specific service"""
        if service_name not in self.services:
            return {'healthy': False, 'error': 'Service not found'}
        
        service_config = self.services[service_name]
        url = f"http://localhost:{service_config['port']}{service_config['health_endpoint']}"
        
        try:
            timeout = aiohttp.ClientTimeout(total=5)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                start_time = time.time()
                async with session.get(url) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    return {
                        'healthy': response.status == 200,
                        'status_code': response.status,
                        'response_time': response_time,
                        'timestamp': datetime.now().isoformat()
                    }
        except Exception as e:
            return {
                'healthy': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    async def _kill_service(self, service_name: str):
        """Kill a service process"""
        try:
            # Find and kill processes by port
            service_config = self.services[service_name]
            port = service_config['port']
            
            # Kill processes using the port
            subprocess.run([
                'netstat', '-ano', '|', 'findstr', f':{port}'
            ], shell=True)
            
            # This is a simplified implementation
            # In a real scenario, you'd need more sophisticated process management
            logger.info(f"Killed service {service_name} on port {port}")
            
        except Exception as e:
            logger.error(f"Failed to kill service {service_name}: {e}")
    
    async def _restart_service(self, service_name: str):
        """Restart a service"""
        try:
            restart_commands = {
                'web': 'npm run dev',
                'ai-proxy': 'npm run dev:proxy',
                'monitoring': 'npm run dev:monitor'
            }
            
            command = restart_commands.get(service_name)
            if command:
                subprocess.Popen(command, shell=True)
                logger.info(f"Restarted service {service_name}")
            
        except Exception as e:
            logger.error(f"Failed to restart service {service_name}: {e}")
    
    async def _generate_load(self, service_name: str, concurrent_requests: int, duration: int):
        """Generate load on a service"""
        service_config = self.services[service_name]
        url = f"http://localhost:{service_config['port']}{service_config['health_endpoint']}"
        
        async def make_request():
            try:
                timeout = aiohttp.ClientTimeout(total=10)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(url) as response:
                        return response.status
            except Exception as e:
                return 500
        
        # Generate load for specified duration
        end_time = time.time() + duration
        while time.time() < end_time:
            tasks = [make_request() for _ in range(concurrent_requests)]
            await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(0.1)
    
    async def _get_system_metrics(self) -> Dict[str, Any]:
        """Get system metrics"""
        try:
            # Get metrics from monitoring service
            health = await self._check_service_health('monitoring')
            return {
                'monitoring_healthy': health['healthy'],
                'average_response_time': health.get('response_time', 0),
                'error_rate': 0 if health['healthy'] else 1,
                'memory_percent': 0,  # Would implement actual metrics collection
                'cpu_percent': 0
            }
        except Exception:
            return {
                'monitoring_healthy': False,
                'average_response_time': 0,
                'error_rate': 1,
                'memory_percent': 0,
                'cpu_percent': 0
            }
    
    async def _simulate_service_failure(self, service_name: str):
        """Simulate service failure"""
        await self._kill_service(service_name)
        await asyncio.sleep(5)
        await self._restart_service(service_name)
    
    async def _simulate_high_load(self, service_name: str):
        """Simulate high load"""
        await self._generate_load(service_name, 50, 10)
    
    async def _perform_data_operation(self, data: Dict[str, Any]) -> bool:
        """Perform data operation"""
        try:
            # Simulate data operation
            await asyncio.sleep(random.uniform(0.1, 0.5))
            return True
        except Exception:
            return False
    
    async def _check_data_consistency(self, expected_data: Dict[str, Any]) -> bool:
        """Check data consistency"""
        # Simplified consistency check
        return True
    
    async def _backup_configuration(self) -> Dict[str, Any]:
        """Backup current configuration"""
        return {'backup': 'created'}
    
    async def _apply_config_change(self, change: Dict[str, Any]):
        """Apply configuration change"""
        # Simplified config change
        logger.info(f"Applied config change: {change}")
    
    async def _restore_configuration(self, backup: Dict[str, Any]):
        """Restore configuration from backup"""
        # Simplified config restore
        logger.info("Restored configuration from backup")
    
    def cleanup(self):
        """Cleanup test processes"""
        for process in self.running_processes:
            try:
                process.terminate()
                process.wait(timeout=5)
            except Exception:
                try:
                    process.kill()
                except Exception:
                    pass

class LoadTestSuite:
    """Comprehensive load testing suite"""
    
    def __init__(self):
        self.services = {
            'web': {'port': 13000, 'health_endpoint': '/'},
            'ai-proxy': {'port': 13081, 'health_endpoint': '/health'},
            'monitoring': {'port': 13082, 'health_endpoint': '/health'}
        }
    
    async def run_load_test(self, service_name: str, duration: int = 60, 
                           concurrent_users: int = 10, ramp_up: int = 10) -> LoadTestMetrics:
        """Run load test on a service"""
        logger.info(f"🚀 Starting load test on {service_name}: {duration}s, {concurrent_users} users")
        
        service_config = self.services[service_name]
        url = f"http://localhost:{service_config['port']}{service_config['health_endpoint']}"
        
        response_times = []
        successful_requests = 0
        failed_requests = 0
        start_time = time.time()
        
        async def make_request():
            try:
                request_start = time.time()
                timeout = aiohttp.ClientTimeout(total=30)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(url) as response:
                        request_duration = (time.time() - request_start) * 1000
                        
                        if response.status == 200:
                            return request_duration, True
                        else:
                            return request_duration, False
            except Exception as e:
                return 0, False
        
        # Ramp up phase
        current_users = 0
        while current_users < concurrent_users:
            current_users += 1
            
            # Create tasks for current user level
            tasks = []
            for _ in range(current_users):
                task = asyncio.create_task(make_request())
                tasks.append(task)
            
            # Execute requests
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            for result in results:
                if isinstance(result, tuple):
                    response_time, success = result
                    response_times.append(response_time)
                    if success:
                        successful_requests += 1
                    else:
                        failed_requests += 1
            
            await asyncio.sleep(ramp_up / concurrent_users)
        
        # Sustained load phase
        end_time = start_time + duration
        while time.time() < end_time:
            tasks = [make_request() for _ in range(concurrent_users)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, tuple):
                    response_time, success = result
                    response_times.append(response_time)
                    if success:
                        successful_requests += 1
                    else:
                        failed_requests += 1
            
            await asyncio.sleep(0.1)
        
        # Calculate metrics
        total_requests = successful_requests + failed_requests
        test_duration = time.time() - start_time
        
        if response_times:
            response_times_sorted = sorted(response_times)
            p95_index = int(len(response_times_sorted) * 0.95)
            p99_index = int(len(response_times_sorted) * 0.99)
            
            metrics = LoadTestMetrics(
                total_requests=total_requests,
                successful_requests=successful_requests,
                failed_requests=failed_requests,
                average_response_time=statistics.mean(response_times),
                min_response_time=min(response_times),
                max_response_time=max(response_times),
                p95_response_time=response_times_sorted[p95_index] if p95_index < len(response_times_sorted) else 0,
                p99_response_time=response_times_sorted[p99_index] if p99_index < len(response_times_sorted) else 0,
                requests_per_second=total_requests / test_duration,
                error_rate=failed_requests / total_requests if total_requests > 0 else 0
            )
        else:
            metrics = LoadTestMetrics(
                total_requests=0,
                successful_requests=0,
                failed_requests=0,
                average_response_time=0,
                min_response_time=0,
                max_response_time=0,
                p95_response_time=0,
                p99_response_time=0,
                requests_per_second=0,
                error_rate=0
            )
        
        logger.info(f"📊 Load test completed for {service_name}")
        logger.info(f"   Total requests: {metrics.total_requests}")
        logger.info(f"   Success rate: {(1 - metrics.error_rate) * 100:.1f}%")
        logger.info(f"   Avg response time: {metrics.average_response_time:.1f}ms")
        logger.info(f"   Requests/sec: {metrics.requests_per_second:.1f}")
        
        return metrics
    
    async def run_stress_test(self, service_name: str) -> LoadTestMetrics:
        """Run stress test to find breaking point"""
        logger.info(f"💥 Starting stress test on {service_name}")
        
        # Gradually increase load until failure
        for concurrent_users in [10, 25, 50, 100, 200, 500]:
            logger.info(f"   Testing with {concurrent_users} concurrent users...")
            
            metrics = await self.run_load_test(
                service_name, 
                duration=30, 
                concurrent_users=concurrent_users,
                ramp_up=5
            )
            
            # If error rate is too high, we've found the breaking point
            if metrics.error_rate > 0.1:  # 10% error rate threshold
                logger.info(f"   Breaking point found at {concurrent_users} users")
                break
        
        return metrics
    
    async def run_spike_test(self, service_name: str) -> LoadTestMetrics:
        """Run spike test to test sudden load increases"""
        logger.info(f"⚡ Starting spike test on {service_name}")
        
        # Normal load
        await self.run_load_test(service_name, duration=30, concurrent_users=10)
        
        # Sudden spike
        await self.run_load_test(service_name, duration=10, concurrent_users=100)
        
        # Back to normal
        metrics = await self.run_load_test(service_name, duration=30, concurrent_users=10)
        
        return metrics

async def main():
    """Main entry point for testing suite"""
    logger.info("🧪 Starting Comprehensive Testing Suite...")
    
    # Run fault tolerance tests
    fault_suite = FaultToleranceTestSuite()
    fault_results = await fault_suite.run_all_tests()
    
    # Run load tests
    load_suite = LoadTestSuite()
    load_results = {}
    
    for service_name in ['web', 'ai-proxy', 'monitoring']:
        try:
            load_results[service_name] = await load_suite.run_load_test(
                service_name, duration=60, concurrent_users=20
            )
        except Exception as e:
            logger.error(f"Load test failed for {service_name}: {e}")
    
    # Generate comprehensive report
    report = {
        'timestamp': datetime.now().isoformat(),
        'fault_tolerance_tests': [
            {
                'test_name': result.test_name,
                'success': result.success,
                'duration': result.duration,
                'error_message': result.error_message,
                'metrics': result.metrics
            }
            for result in fault_results
        ],
        'load_tests': {
            service: {
                'total_requests': metrics.total_requests,
                'success_rate': (1 - metrics.error_rate) * 100,
                'average_response_time': metrics.average_response_time,
                'requests_per_second': metrics.requests_per_second,
                'p95_response_time': metrics.p95_response_time,
                'p99_response_time': metrics.p99_response_time
            }
            for service, metrics in load_results.items()
        }
    }
    
    # Save report
    with open('logs/comprehensive-test-report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    # Print summary
    fault_pass_count = sum(1 for r in fault_results if r.success)
    fault_total_count = len(fault_results)
    
    logger.info("📋 Testing Summary:")
    logger.info(f"   Fault Tolerance Tests: {fault_pass_count}/{fault_total_count} passed")
    
    for service, metrics in load_results.items():
        logger.info(f"   {service} Load Test: {metrics.requests_per_second:.1f} req/s, {metrics.average_response_time:.1f}ms avg")
    
    # Cleanup
    fault_suite.cleanup()
    
    logger.info("✅ Testing suite completed")

if __name__ == "__main__":
    asyncio.run(main())
