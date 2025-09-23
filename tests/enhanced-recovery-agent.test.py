#!/usr/bin/env python3
"""
Tests for Enhanced Recovery Agent v2.0
"""

import unittest
import asyncio
import tempfile
import os
import sys
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from agents.enhanced_recovery_agent_v2 import (
    EnhancedRecoveryAgent, 
    ServiceHealth, 
    ServiceStatus, 
    SystemMetrics,
    MemoryManager,
    AIModelClient,
    MCPClient
)

class TestEnhancedRecoveryAgent(unittest.TestCase):
    """Test cases for Enhanced Recovery Agent"""
    
    def setUp(self):
        """Set up test environment"""
        self.temp_dir = tempfile.mkdtemp()
        self.config_file = os.path.join(self.temp_dir, "test-config.yaml")
        
        # Create test configuration
        test_config = """
services:
  - name: "test-service"
    port: 8080
    endpoint: "/health"
    timeout: 5

monitoring:
  interval: 10
  health_check_interval: 30
  recovery_attempts: 2
  cooldown_period: 60

recovery:
  max_concurrent_recoveries: 1
  restart_timeout: 30
  health_check_retries: 2
  model_fallback_enabled: true

ai_models:
  default_model: "test-model"
  fallback_models: ["fallback-model"]
  health_check_enabled: true
"""
        
        with open(self.config_file, 'w') as f:
            f.write(test_config)
        
        self.agent = EnhancedRecoveryAgent(self.config_file)
    
    def tearDown(self):
        """Clean up test environment"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_agent_initialization(self):
        """Test agent initialization"""
        self.assertIsNotNone(self.agent)
        self.assertIsInstance(self.agent.config, dict)
        self.assertIn('services', self.agent.config)
        self.assertIn('monitoring', self.agent.config)
    
    def test_config_loading(self):
        """Test configuration loading"""
        config = self.agent.config
        
        # Check services configuration
        self.assertEqual(len(config['services']), 1)
        self.assertEqual(config['services'][0]['name'], 'test-service')
        self.assertEqual(config['services'][0]['port'], 8080)
        
        # Check monitoring configuration
        self.assertEqual(config['monitoring']['interval'], 10)
        self.assertEqual(config['monitoring']['recovery_attempts'], 2)
    
    def test_default_config(self):
        """Test default configuration fallback"""
        # Create agent with non-existent config file
        agent = EnhancedRecoveryAgent("/non/existent/config.yaml")
        
        self.assertIsInstance(agent.config, dict)
        self.assertIn('services', agent.config)
        self.assertGreater(len(agent.config['services']), 0)
    
    def test_service_health_creation(self):
        """Test ServiceHealth dataclass"""
        from datetime import datetime
        
        health = ServiceHealth(
            name="test-service",
            status=ServiceStatus.HEALTHY,
            response_time=0.5,
            last_check=datetime.now()
        )
        
        self.assertEqual(health.name, "test-service")
        self.assertEqual(health.status, ServiceStatus.HEALTHY)
        self.assertEqual(health.response_time, 0.5)
        self.assertEqual(health.recovery_attempts, 0)
    
    def test_system_metrics_creation(self):
        """Test SystemMetrics dataclass"""
        from datetime import datetime
        
        metrics = SystemMetrics(
            cpu_percent=50.0,
            memory_percent=60.0,
            disk_percent=70.0,
            network_io={'bytes_sent': 1000, 'bytes_recv': 2000},
            timestamp=datetime.now()
        )
        
        self.assertEqual(metrics.cpu_percent, 50.0)
        self.assertEqual(metrics.memory_percent, 60.0)
        self.assertEqual(metrics.disk_percent, 70.0)
        self.assertIn('bytes_sent', metrics.network_io)

class TestMemoryManager(unittest.TestCase):
    """Test cases for Memory Manager"""
    
    def setUp(self):
        """Set up test environment"""
        self.temp_dir = tempfile.mkdtemp()
        self.memory_manager = MemoryManager(self.temp_dir)
    
    def tearDown(self):
        """Clean up test environment"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_memory_initialization(self):
        """Test memory manager initialization"""
        self.assertTrue(self.memory_manager.memory_dir.exists())
        self.assertTrue(self.memory_manager.entities_dir.exists())
        self.assertTrue(self.memory_manager.system_memory_file.exists())
    
    def test_entity_memory_update(self):
        """Test entity memory updates"""
        test_data = {
            "status": "healthy",
            "timestamp": "2024-01-01T00:00:00",
            "metrics": {"cpu": 50, "memory": 60}
        }
        
        self.memory_manager.update_entity_memory("test-service", test_data)
        
        # Check if memory file was created
        memory_file = self.memory_manager.entities_dir / "test-service.md"
        self.assertTrue(memory_file.exists())
        
        # Check content
        content = memory_file.read_text(encoding='utf-8')
        self.assertIn("test-service", content)
        self.assertIn("healthy", content)
    
    def test_memory_search(self):
        """Test memory search functionality"""
        # Add some test data
        self.memory_manager.update_entity_memory("service1", {"status": "healthy"})
        self.memory_manager.update_entity_memory("service2", {"status": "unhealthy"})
        
        # Search for "healthy"
        results = self.memory_manager.search_memory("healthy")
        self.assertGreater(len(results), 0)
        
        # Search for non-existent term
        results = self.memory_manager.search_memory("nonexistent")
        self.assertEqual(len(results), 0)
    
    def test_recovery_learning(self):
        """Test recovery learning functionality"""
        from agents.enhanced_recovery_agent_v2 import RecoveryAction
        
        context = {
            "error_message": "Connection timeout",
            "response_time": 5.0,
            "cpu_percent": 80,
            "memory_percent": 70
        }
        
        self.memory_manager.learn_from_recovery(
            "test-service", 
            RecoveryAction.RESTART, 
            True, 
            context
        )
        
        # Check if learning was recorded
        recovery_memory = self.memory_manager.get_entity_memory("test-service_recovery")
        self.assertIn("restart", recovery_memory.lower())
        self.assertIn("true", recovery_memory.lower())

class TestAsyncComponents(unittest.TestCase):
    """Test cases for async components"""
    
    def setUp(self):
        """Set up async test environment"""
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
    
    def tearDown(self):
        """Clean up async test environment"""
        self.loop.close()
    
    def test_ai_model_client_initialization(self):
        """Test AI Model Client initialization"""
        client = AIModelClient("http://localhost:13081")
        self.assertEqual(client.base_url, "http://localhost:13081")
        self.assertIsNone(client.session)
    
    def test_mcp_client_initialization(self):
        """Test MCP Client initialization"""
        client = MCPClient("http://localhost:3001")
        self.assertEqual(client.server_url, "http://localhost:3001")
        self.assertIsNone(client.session)
        self.assertEqual(client.capabilities, {})
    
    async def async_test_client_context_manager(self):
        """Test client context manager (async)"""
        with patch('aiohttp.ClientSession') as mock_session:
            mock_session.return_value.__aenter__ = AsyncMock()
            mock_session.return_value.__aexit__ = AsyncMock()
            
            client = AIModelClient()
            
            async with client:
                self.assertIsNotNone(client.session)
    
    def test_client_context_manager(self):
        """Test client context manager"""
        self.loop.run_until_complete(self.async_test_client_context_manager())

class TestCommandAliases(unittest.TestCase):
    """Test cases for command aliases"""
    
    def setUp(self):
        """Set up test environment"""
        self.temp_dir = tempfile.mkdtemp()
        self.config_file = os.path.join(self.temp_dir, "test-config.yaml")
        
        # Create minimal test configuration
        test_config = """
services:
  - name: "test-service"
    port: 8080
    endpoint: "/health"
    timeout: 5

monitoring:
  interval: 30
  recovery_attempts: 3
  cooldown_period: 300

recovery:
  max_concurrent_recoveries: 2
  restart_timeout: 60
"""
        
        with open(self.config_file, 'w') as f:
            f.write(test_config)
        
        self.agent = EnhancedRecoveryAgent(self.config_file)
    
    def tearDown(self):
        """Clean up test environment"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_command_aliases_exist(self):
        """Test that command aliases are properly defined"""
        expected_commands = [
            'status', 'restart', 'logs', 'health', 'metrics', 
            'recover', 'models', 'switch', 'memory', 'mcp', 'help'
        ]
        
        for command in expected_commands:
            self.assertIn(command, self.agent.aliases)
    
    async def async_test_help_command(self):
        """Test help command (async)"""
        result = await self.agent.execute_command('help')
        
        self.assertIsInstance(result, str)
        self.assertIn('Enhanced Recovery Agent', result)
        self.assertIn('Commands:', result)
    
    def test_help_command(self):
        """Test help command"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self.async_test_help_command())
        finally:
            loop.close()
    
    async def async_test_unknown_command(self):
        """Test unknown command handling (async)"""
        result = await self.agent.execute_command('unknown_command')
        
        self.assertIsInstance(result, str)
        self.assertIn('Unknown command', result)
    
    def test_unknown_command(self):
        """Test unknown command handling"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self.async_test_unknown_command())
        finally:
            loop.close()

def run_tests():
    """Run all tests"""
    # Create test suite
    test_suite = unittest.TestSuite()
    
    # Add test cases
    test_classes = [
        TestEnhancedRecoveryAgent,
        TestMemoryManager,
        TestAsyncComponents,
        TestCommandAliases
    ]
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)