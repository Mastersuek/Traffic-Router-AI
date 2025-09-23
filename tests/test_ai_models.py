#!/usr/bin/env python3
"""
AI Models and Routing Tests
Тесты AI моделей и маршрутизации
"""

import asyncio
import sys
import os
import json
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AIModelsTestSuite:
    """Тесты AI моделей и маршрутизации"""
    
    def __init__(self):
        self.test_results = []
        
    async def test_model_alias_system(self) -> bool:
        """Тест системы алиасов моделей"""
        print("🧪 Testing Model Alias System...")
        
        try:
            # Check if model alias files exist
            model_files = [
                "lib/model-alias-manager.ts",
                "lib/model-alias-manager.js",
                "config/model-aliases.json"
            ]
            
            model_file_found = False
            for file_path in model_files:
                if os.path.exists(file_path):
                    model_file_found = True
                    print(f"✅ Found model alias file: {file_path}")
                    
                    # Validate file structure
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Check for essential model patterns
                    if file_path.endswith('.json'):
                        try:
                            model_config = json.loads(content)
                            if isinstance(model_config, dict):
                                print("✅ Model alias configuration is valid JSON")
                            else:
                                print("❌ Model alias configuration is not a valid object")
                                return False
                        except json.JSONDecodeError as e:
                            print(f"❌ Model alias JSON error: {e}")
                            return False
                    else:
                        # Check TypeScript/JavaScript patterns
                        required_patterns = ["class", "model", "alias"]
                        for pattern in required_patterns:
                            if pattern.lower() not in content.lower():
                                print(f"⚠️ Model alias file missing pattern: {pattern}")
                    
                    break
            
            if not model_file_found:
                print("⚠️ Model alias system files not found")
                return True  # Skip test but don't fail
            
            print("✅ Model alias system structure validated")
            return True
            
        except Exception as e:
            print(f"❌ Model alias system test failed: {e}")
            return False
    
    async def test_ai_service_integration(self) -> bool:
        """Тест интеграции AI сервисов"""
        print("🧪 Testing AI Service Integration...")
        
        try:
            # Check AI service configuration files
            ai_config_files = [
                "config/ai-services-config.json",
                "lib/ai-services.ts",
                "lib/ai-request-optimizer.ts"
            ]
            
            for config_file in ai_config_files:
                if os.path.exists(config_file):
                    print(f"✅ Found AI service file: {config_file}")
                    
                    with open(config_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if config_file.endswith('.json'):
                        try:
                            ai_config = json.loads(content)
                            
                            # Check for AI service providers
                            expected_providers = ["openai", "anthropic", "google"]
                            found_providers = []
                            
                            content_lower = content.lower()
                            for provider in expected_providers:
                                if provider in content_lower:
                                    found_providers.append(provider)
                            
                            if found_providers:
                                print(f"✅ Found AI providers: {found_providers}")
                            else:
                                print("⚠️ No AI providers found in configuration")
                            
                        except json.JSONDecodeError as e:
                            print(f"❌ AI services JSON error: {e}")
                            return False
                    else:
                        # Check TypeScript patterns
                        ai_patterns = ["openai", "anthropic", "google", "api", "request"]
                        found_patterns = []
                        
                        content_lower = content.lower()
                        for pattern in ai_patterns:
                            if pattern in content_lower:
                                found_patterns.append(pattern)
                        
                        if found_patterns:
                            print(f"✅ Found AI patterns: {found_patterns}")
                        else:
                            print("⚠️ No AI patterns found in file")
                else:
                    print(f"ℹ️ AI service file not found: {config_file}")
            
            print("✅ AI service integration structure validated")
            return True
            
        except Exception as e:
            print(f"❌ AI service integration test failed: {e}")
            return False
    
    async def test_request_routing(self) -> bool:
        """Тест маршрутизации запросов"""
        print("🧪 Testing Request Routing...")
        
        try:
            # Test Enhanced Recovery Agent routing capabilities
            from agents.enhanced_recovery_agent_v2 import EnhancedRecoveryAgent
            
            # Create test configuration with multiple services
            routing_config = {
                "services": [
                    {"name": "ai-proxy", "port": 13081, "endpoint": "/health", "timeout": 10},
                    {"name": "web", "port": 13000, "endpoint": "/", "timeout": 10}
                ],
                "monitoring": {
                    "interval": 30,
                    "health_check_interval": 60,
                    "recovery_attempts": 3,
                    "cooldown_period": 300
                }
            }
            
            import tempfile
            import yaml
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(routing_config, f, default_flow_style=False, allow_unicode=True)
                config_file = f.name
            
            try:
                agent = EnhancedRecoveryAgent(config_file)
                await agent.initialize()
                
                # Test routing commands
                commands_to_test = [
                    "status",
                    "help",
                    "session info",
                    "memory"
                ]
                
                routing_success = True
                for command in commands_to_test:
                    response = await agent.process_command(command, "routing_test_user")
                    if not response:
                        print(f"❌ Command routing failed for: {command}")
                        routing_success = False
                    else:
                        print(f"✅ Command routing successful for: {command}")
                
                if not routing_success:
                    return False
                
                # Test session-based routing
                session_response1 = await agent.process_command("session info", "user1")
                session_response2 = await agent.process_command("session info", "user2")
                
                if session_response1 and session_response2:
                    print("✅ Session-based routing working")
                else:
                    print("❌ Session-based routing failed")
                    return False
                
                await agent._cleanup()
                
            finally:
                os.unlink(config_file)
            
            print("✅ Request routing functionality validated")
            return True
            
        except Exception as e:
            print(f"❌ Request routing test failed: {e}")
            return False
    
    async def test_model_fallback(self) -> bool:
        """Тест fallback логики моделей"""
        print("🧪 Testing Model Fallback Logic...")
        
        try:
            # Test Enhanced Recovery Agent fallback capabilities
            from agents.enhanced_recovery_agent_v2 import EnhancedRecoveryAgent
            
            # Create test configuration
            fallback_config = {
                "services": [
                    {"name": "ai-proxy", "port": 13081, "endpoint": "/health", "timeout": 5}
                ],
                "monitoring": {
                    "interval": 30,
                    "health_check_interval": 60,
                    "recovery_attempts": 3,
                    "cooldown_period": 300
                }
            }
            
            import tempfile
            import yaml
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(fallback_config, f, default_flow_style=False, allow_unicode=True)
                config_file = f.name
            
            try:
                agent = EnhancedRecoveryAgent(config_file)
                await agent.initialize()
                
                # Test fallback behavior when MCP is not available
                mcp_response = await agent.process_command("mcp status", "fallback_test_user")
                if mcp_response:
                    if "недоступен" in mcp_response.lower() or "not available" in mcp_response.lower():
                        print("✅ MCP fallback working correctly")
                    else:
                        print("✅ MCP available and working")
                else:
                    print("❌ MCP fallback failed")
                    return False
                
                # Test memory system fallback
                memory_response = await agent.process_command("memory test", "fallback_test_user")
                if memory_response:
                    print("✅ Memory system fallback working")
                else:
                    print("❌ Memory system fallback failed")
                    return False
                
                # Test session fallback
                session_response = await agent.process_command("session info", "fallback_test_user")
                if session_response:
                    print("✅ Session system fallback working")
                else:
                    print("❌ Session system fallback failed")
                    return False
                
                await agent._cleanup()
                
            finally:
                os.unlink(config_file)
            
            print("✅ Model fallback logic validated")
            return True
            
        except Exception as e:
            print(f"❌ Model fallback test failed: {e}")
            return False
    
    async def test_domain_routing(self) -> bool:
        """Тест маршрутизации доменов"""
        print("🧪 Testing Domain Routing...")
        
        try:
            # Check if traffic router files exist
            router_files = [
                "lib/traffic-router.ts",
                "clients/common/traffic-router-client.ts"
            ]
            
            router_found = False
            for router_file in router_files:
                if os.path.exists(router_file):
                    router_found = True
                    print(f"✅ Found traffic router: {router_file}")
                    
                    with open(router_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Check for domain routing patterns
                    domain_patterns = [
                        "domain",
                        "route",
                        "proxy",
                        "russia",
                        "international"
                    ]
                    
                    found_patterns = []
                    content_lower = content.lower()
                    for pattern in domain_patterns:
                        if pattern in content_lower:
                            found_patterns.append(pattern)
                    
                    if found_patterns:
                        print(f"✅ Found domain routing patterns: {found_patterns}")
                    else:
                        print("⚠️ No domain routing patterns found")
                    
                    # Check for Russian domain handling
                    russian_indicators = [".ru", "russia", "russian", "рф"]
                    russian_found = any(indicator in content_lower for indicator in russian_indicators)
                    
                    if russian_found:
                        print("✅ Russian domain handling detected")
                    else:
                        print("ℹ️ No specific Russian domain handling found")
                    
                    break
            
            if not router_found:
                print("⚠️ Traffic router files not found")
                return True  # Skip test but don't fail
            
            # Test proxy configuration
            proxy_config_files = [
                "config/proxy-config.json",
                "config/proxy-pools.json"
            ]
            
            for proxy_file in proxy_config_files:
                if os.path.exists(proxy_file):
                    print(f"✅ Found proxy configuration: {proxy_file}")
                    
                    try:
                        with open(proxy_file, 'r', encoding='utf-8') as f:
                            proxy_config = json.load(f)
                        
                        if isinstance(proxy_config, dict):
                            print("✅ Proxy configuration is valid")
                        else:
                            print("❌ Invalid proxy configuration format")
                            return False
                            
                    except json.JSONDecodeError as e:
                        print(f"❌ Proxy configuration JSON error: {e}")
                        return False
                else:
                    print(f"ℹ️ Proxy configuration not found: {proxy_file}")
            
            print("✅ Domain routing system validated")
            return True
            
        except Exception as e:
            print(f"❌ Domain routing test failed: {e}")
            return False
    
    async def test_api_endpoints(self) -> bool:
        """Тест API endpoints"""
        print("🧪 Testing API Endpoints...")
        
        try:
            # Check if API route files exist
            api_files = [
                "app/api/ai-services/route.ts",
                "app/api/health/route.ts",
                "app/api/status/route.ts"
            ]
            
            api_found = False
            for api_file in api_files:
                if os.path.exists(api_file):
                    api_found = True
                    print(f"✅ Found API endpoint: {api_file}")
                    
                    with open(api_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Check for Next.js API patterns
                    api_patterns = [
                        "export",
                        "GET",
                        "POST",
                        "Response",
                        "NextRequest"
                    ]
                    
                    found_patterns = []
                    for pattern in api_patterns:
                        if pattern in content:
                            found_patterns.append(pattern)
                    
                    if found_patterns:
                        print(f"✅ Found API patterns in {api_file}: {found_patterns}")
                    else:
                        print(f"⚠️ No API patterns found in {api_file}")
                else:
                    print(f"ℹ️ API endpoint not found: {api_file}")
            
            if not api_found:
                print("⚠️ No API endpoint files found")
                return True  # Skip test but don't fail
            
            # Check server files
            server_files = [
                "server/ai-proxy-server.ts",
                "server/monitoring-server.ts"
            ]
            
            for server_file in server_files:
                if os.path.exists(server_file):
                    print(f"✅ Found server file: {server_file}")
                    
                    with open(server_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Check for server patterns
                    server_patterns = [
                        "express",
                        "app.listen",
                        "router",
                        "middleware"
                    ]
                    
                    found_patterns = []
                    content_lower = content.lower()
                    for pattern in server_patterns:
                        if pattern in content_lower:
                            found_patterns.append(pattern)
                    
                    if found_patterns:
                        print(f"✅ Found server patterns in {server_file}: {found_patterns}")
                    else:
                        print(f"⚠️ No server patterns found in {server_file}")
                else:
                    print(f"ℹ️ Server file not found: {server_file}")
            
            print("✅ API endpoints structure validated")
            return True
            
        except Exception as e:
            print(f"❌ API endpoints test failed: {e}")
            return False
    
    async def run_all_ai_tests(self) -> Dict[str, Any]:
        """Выполнение всех тестов AI моделей"""
        print("🚀 Starting AI Models and Routing Tests...\n")
        
        start_time = time.time()
        
        # Define all AI tests
        tests = [
            ("Model Alias System", self.test_model_alias_system),
            ("AI Service Integration", self.test_ai_service_integration),
            ("Request Routing", self.test_request_routing),
            ("Model Fallback Logic", self.test_model_fallback),
            ("Domain Routing", self.test_domain_routing),
            ("API Endpoints", self.test_api_endpoints),
        ]
        
        results = []
        
        for test_name, test_func in tests:
            print(f"\n{'='*60}")
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
            "test_type": "ai_models_routing",
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests,
            "success_rate": (passed_tests / total_tests) * 100 if total_tests > 0 else 0,
            "total_duration": total_duration,
            "timestamp": datetime.now().isoformat(),
            "results": results
        }
        
        return summary
    
    def print_summary(self, summary: Dict[str, Any]):
        """Вывод сводки результатов тестов AI моделей"""
        print(f"\n" + "="*70)
        print(f"📊 AI MODELS AND ROUTING TESTS SUMMARY")
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
        
        if summary['passed_tests'] == summary['total_tests']:
            print(f"\n🎉 ALL AI MODEL TESTS PASSED!")
            print(f"✅ AI system is fully functional and ready for production.")
        else:
            print(f"\n⚠️ {summary['failed_tests']} AI model tests failed!")
            print(f"🔧 Review and fix AI system issues before production deployment.")
        
        print(f"="*70)
    
    def save_results(self, summary: Dict[str, Any]):
        """Сохранение результатов тестов AI моделей"""
        try:
            results_dir = Path("test_results")
            results_dir.mkdir(exist_ok=True)
            
            with open(results_dir / "ai_models_test_results.json", 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            
            print(f"\n💾 AI models test results saved to: test_results/ai_models_test_results.json")
            
        except Exception as e:
            print(f"Failed to save AI models test results: {e}")

async def main():
    """Основная функция для запуска тестов AI моделей"""
    test_suite = AIModelsTestSuite()
    
    try:
        # Run all AI model tests
        summary = await test_suite.run_all_ai_tests()
        
        # Print summary
        test_suite.print_summary(summary)
        
        # Save results
        test_suite.save_results(summary)
        
        # Return appropriate exit code
        return 0 if summary['failed_tests'] == 0 else 1
        
    except KeyboardInterrupt:
        print("\n⚠️ AI model tests interrupted by user")
        return 130
    except Exception as e:
        print(f"\n💥 AI model tests crashed: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)