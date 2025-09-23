#!/usr/bin/env python3
"""
Test MCP Integration with Enhanced Recovery Agent
"""

import asyncio
import sys
import os
import json
from pathlib import Path

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from agents.enhanced_recovery_agent_v2 import EnhancedRecoveryAgent

async def test_mcp_integration():
    """Test MCP integration functionality"""
    print("🧪 Testing MCP Integration with Enhanced Recovery Agent...")
    
    # Create test configuration
    config_dir = Path("config")
    config_dir.mkdir(exist_ok=True)
    
    test_config = {
        "services": [
            {"name": "test-service", "port": 13000, "endpoint": "/health", "timeout": 5}
        ],
        "monitoring": {
            "interval": 10,
            "health_check_interval": 30,
            "recovery_attempts": 2,
            "cooldown_period": 60
        },
        "recovery": {
            "max_concurrent_recoveries": 1,
            "restart_timeout": 30,
            "health_check_retries": 2
        }
    }
    
    # Write test config
    import yaml
    with open("config/test-recovery-config.yaml", "w", encoding="utf-8") as f:
        yaml.dump(test_config, f, default_flow_style=False, allow_unicode=True)
    
    try:
        # Initialize agent
        agent = EnhancedRecoveryAgent("config/test-recovery-config.yaml")
        
        print("✅ Agent initialized successfully")
        
        # Test initialization
        await agent.initialize()
        print("✅ Agent MCP integration initialized")
        
        # Test status report
        status = await agent.get_status_report()
        print(f"✅ Status report generated: {status['agent_version']}")
        print(f"   MCP Integration: {status['mcp_integration']}")
        
        # Test command processing
        help_text = await agent.process_command("help")
        print("✅ Help command processed")
        
        status_text = await agent.process_command("status")
        print("✅ Status command processed")
        
        mcp_status = await agent.process_command("mcp status")
        print(f"✅ MCP status command processed: {len(mcp_status)} chars")
        
        # Test memory search if MCP is available
        if agent.mcp_integration:
            memory_result = await agent.process_command("memory test")
            print("✅ Memory search command processed")
        else:
            print("⚠️ MCP integration not available, skipping memory tests")
        
        # Cleanup
        await agent._cleanup()
        print("✅ Agent cleanup completed")
        
        print("\n🎉 All MCP integration tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup test config
        if os.path.exists("config/test-recovery-config.yaml"):
            os.remove("config/test-recovery-config.yaml")

async def test_mcp_configuration():
    """Test MCP configuration loading"""
    print("\n🧪 Testing MCP Configuration...")
    
    # Create test MCP config
    mcp_config_dir = Path(".kiro/settings")
    mcp_config_dir.mkdir(parents=True, exist_ok=True)
    
    test_mcp_config = {
        "mcpServers": {
            "traffic-router-mcp": {
                "command": "node",
                "args": ["server/mcp-server.js"],
                "env": {
                    "MCP_SERVER_PORT": "3001"
                },
                "disabled": False,
                "autoApprove": ["restart_service", "check_health"]
            },
            "memory-mcp": {
                "command": "python3",
                "args": ["server/memory-mcp-server.py"],
                "env": {
                    "MEMORY_PORT": "3003"
                },
                "disabled": False,
                "autoApprove": ["update_memory", "search_memory"]
            }
        }
    }
    
    # Write test MCP config
    with open(".kiro/settings/mcp.json", "w", encoding="utf-8") as f:
        json.dump(test_mcp_config, f, indent=2, ensure_ascii=False)
    
    try:
        # Test MCP integration import
        from lib.mcp_ai_agent_integration import MCPAIAgentIntegration, MCPConnectionManager
        print("✅ MCP AI Agent Integration imported successfully")
        
        # Test connection manager initialization
        connection_manager = MCPConnectionManager(".kiro/settings/mcp.json")
        await connection_manager.load_configuration()
        print(f"✅ MCP configuration loaded: {len(connection_manager.servers)} servers")
        
        # Test server configuration
        for server_id, server_config in connection_manager.servers.items():
            print(f"   - {server_id}: {server_config.url} (auto-approve: {len(server_config.auto_approve)} tools)")
        
        print("\n🎉 MCP configuration tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ MCP configuration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all MCP integration tests"""
    print("🚀 Starting MCP Integration Tests...\n")
    
    # Ensure log directory exists
    Path("logs").mkdir(exist_ok=True)
    
    # Run tests
    config_test = await test_mcp_configuration()
    integration_test = await test_mcp_integration()
    
    if config_test and integration_test:
        print("\n🎉 All tests passed! MCP integration is working correctly.")
        return 0
    else:
        print("\n❌ Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)