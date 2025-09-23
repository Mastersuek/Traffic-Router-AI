#!/usr/bin/env python3
"""
Startup script for Enhanced Recovery Agent v2.0
Handles initialization, dependency checks, and graceful startup
"""

import sys
import os
import asyncio
import argparse
import logging
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from agents.enhanced_recovery_agent_v2 import EnhancedRecoveryAgent

def setup_logging(log_level: str = "INFO"):
    """Setup logging configuration"""
    # Ensure logs directory exists
    logs_dir = project_root / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(logs_dir / 'recovery-agent-startup.log', encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    return logging.getLogger(__name__)

def check_dependencies():
    """Check if required dependencies are available"""
    required_packages = [
        'aiohttp',
        'yaml', 
        'psutil'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing required packages: {', '.join(missing_packages)}")
        print("Install them with: pip install " + " ".join(missing_packages))
        return False
    
    return True

def check_directories():
    """Ensure required directories exist"""
    required_dirs = [
        "logs",
        "memory",
        "memory/entities",
        "config"
    ]
    
    for dir_name in required_dirs:
        dir_path = project_root / dir_name
        dir_path.mkdir(parents=True, exist_ok=True)
    
    return True

def create_default_config():
    """Create default configuration if it doesn't exist"""
    config_file = project_root / "config" / "recovery-config.yaml"
    
    if not config_file.exists():
        print("⚠️ Configuration file not found, creating default...")
        # The agent will create a default config automatically
        return True
    
    return True

async def test_connections():
    """Test connections to required services"""
    import aiohttp
    
    services_to_test = [
        ("AI Proxy", "http://localhost:13081/health"),
        ("Monitoring", "http://localhost:13082/health"),
        ("MCP Server", "http://localhost:3001/health")
    ]
    
    logger = logging.getLogger(__name__)
    
    async with aiohttp.ClientSession() as session:
        for service_name, url in services_to_test:
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status == 200:
                        logger.info(f"✅ {service_name} is accessible")
                    else:
                        logger.warning(f"⚠️ {service_name} returned status {response.status}")
            except Exception as e:
                logger.warning(f"⚠️ {service_name} is not accessible: {e}")

async def main():
    """Main startup function"""
    parser = argparse.ArgumentParser(description="Enhanced Recovery Agent v2.0")
    parser.add_argument("--config", "-c", 
                       default="config/recovery-config.yaml",
                       help="Configuration file path")
    parser.add_argument("--log-level", "-l",
                       default="INFO",
                       choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                       help="Log level")
    parser.add_argument("--test-only", "-t",
                       action="store_true",
                       help="Run tests only, don't start monitoring")
    parser.add_argument("--interactive", "-i",
                       action="store_true", 
                       help="Start in interactive mode")
    
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logging(args.log_level)
    
    logger.info("🚀 Starting Enhanced Recovery Agent v2.0...")
    
    # Check dependencies
    logger.info("🔍 Checking dependencies...")
    if not check_dependencies():
        return 1
    
    # Check directories
    logger.info("📁 Checking directories...")
    if not check_directories():
        return 1
    
    # Create default config if needed
    logger.info("⚙️ Checking configuration...")
    if not create_default_config():
        return 1
    
    # Test connections
    logger.info("🔗 Testing service connections...")
    await test_connections()
    
    if args.test_only:
        logger.info("✅ All tests completed successfully")
        return 0
    
    # Initialize and start the agent
    try:
        config_path = project_root / args.config
        agent = EnhancedRecoveryAgent(str(config_path))
        
        if args.interactive:
            await run_interactive_mode(agent)
        else:
            await agent.start_monitoring()
            
    except KeyboardInterrupt:
        logger.info("👋 Shutdown requested by user")
        return 0
    except Exception as e:
        logger.error(f"❌ Agent failed to start: {e}")
        return 1
    
    logger.info("👋 Enhanced Recovery Agent stopped")
    return 0

async def run_interactive_mode(agent: EnhancedRecoveryAgent):
    """Run agent in interactive mode"""
    logger = logging.getLogger(__name__)
    
    logger.info("🎮 Starting interactive mode...")
    logger.info("Type 'help' for available commands, 'quit' to exit")
    
    # Start monitoring in background
    monitoring_task = asyncio.create_task(agent.start_monitoring())
    
    try:
        while True:
            try:
                # Get user input
                user_input = input("\n🤖 recovery-agent> ").strip()
                
                if not user_input:
                    continue
                
                if user_input.lower() in ['quit', 'exit', 'q']:
                    break
                
                # Parse command and arguments
                parts = user_input.split()
                command = parts[0]
                args = parts[1:] if len(parts) > 1 else []
                
                # Execute command
                result = await agent.execute_command(command, args)
                print(result)
                
            except EOFError:
                break
            except Exception as e:
                logger.error(f"Command error: {e}")
                
    except KeyboardInterrupt:
        pass
    finally:
        # Stop monitoring
        agent.running = False
        try:
            await asyncio.wait_for(monitoring_task, timeout=5.0)
        except asyncio.TimeoutError:
            monitoring_task.cancel()

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)