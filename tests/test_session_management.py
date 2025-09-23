#!/usr/bin/env python3
"""
Test Session Management System
"""

import asyncio
import sys
import os
import json
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import from the actual filename (with hyphens)
import importlib.util
spec = importlib.util.spec_from_file_location(
    "session_manager", 
    os.path.join(os.path.dirname(__file__), '..', 'lib', 'session-manager.py')
)
session_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(session_module)
SessionManager = session_module.SessionManager
ContextAwareAgent = session_module.ContextAwareAgent

async def test_session_manager():
    """Test the SessionManager functionality"""
    print("🧪 Testing Session Manager...")
    
    # Create temporary directory for testing
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Initialize session manager
        session_manager = SessionManager(temp_dir)
        print("✅ Session manager initialized")
        
        # Test 1: Create session
        print("\n📝 Testing session creation...")
        
        session_id1 = await session_manager.create_session(
            user_id="test_user_1",
            initial_context={"test": "initial_data"}
        )
        print(f"✅ Session created: {session_id1}")
        
        session_id2 = await session_manager.create_session(
            user_id="test_user_2"
        )
        print(f"✅ Second session created: {session_id2}")
        
        # Test 2: Get session info
        print("\n📋 Testing session retrieval...")
        
        session_info1 = await session_manager.get_session(session_id1)
        print(f"✅ Retrieved session info: {session_info1.user_id}")
        
        session_info2 = await session_manager.get_session(session_id2)
        print(f"✅ Retrieved second session info: {session_info2.user_id}")
        
        # Test 3: Add context entries
        print("\n📝 Testing context entries...")
        
        entry_id1 = await session_manager.add_context_entry(
            session_id=session_id1,
            entry_type="command",
            content="status",
            metadata={"source": "test"},
            importance=2
        )
        print(f"✅ Context entry added: {entry_id1}")
        
        entry_id2 = await session_manager.add_context_entry(
            session_id=session_id1,
            entry_type="response",
            content="System is healthy",
            metadata={"command": "status"},
            importance=1
        )
        print(f"✅ Response entry added: {entry_id2}")
        
        entry_id3 = await session_manager.add_context_entry(
            session_id=session_id1,
            entry_type="error",
            content="Service ai-proxy is down",
            metadata={"service": "ai-proxy", "error_code": "CONNECTION_FAILED"},
            importance=4
        )
        print(f"✅ Error entry added: {entry_id3}")
        
        # Test 4: Get session context
        print("\n📋 Testing context retrieval...")
        
        context_entries = await session_manager.get_session_context(session_id1, limit=10)
        print(f"✅ Retrieved {len(context_entries)} context entries")
        
        for entry in context_entries:
            print(f"   - [{entry.entry_type}] {entry.content[:50]}... (importance: {entry.importance})")
        
        # Test 5: Search context
        print("\n🔍 Testing context search...")
        
        search_results = await session_manager.search_context(
            session_id=session_id1,
            query="status",
            limit=5
        )
        print(f"✅ Found {len(search_results)} entries for 'status'")
        
        error_results = await session_manager.search_context(
            session_id=session_id1,
            entry_type="error"
        )
        print(f"✅ Found {len(error_results)} error entries")
        
        # Test 6: Session statistics
        print("\n📊 Testing session statistics...")
        
        stats = await session_manager.get_session_stats()
        print(f"✅ Session stats:")
        print(f"   - Active sessions: {stats['active_sessions']}")
        print(f"   - Total context entries: {stats['total_context_entries']}")
        print(f"   - Entry types: {stats['entry_types']}")
        
        # Test 7: Export session
        print("\n💾 Testing session export...")
        
        export_data = await session_manager.export_session(session_id1, include_context=True)
        print(f"✅ Session exported: {len(str(export_data))} characters")
        print(f"   - Session info: {export_data['session_info']['user_id']}")
        print(f"   - Context entries: {len(export_data['context'])}")
        
        # Test 8: Close session
        print("\n🔒 Testing session closure...")
        
        await session_manager.close_session(session_id2, "test_completed")
        print(f"✅ Session closed: {session_id2}")
        
        # Verify session is no longer active
        closed_session = await session_manager.get_session(session_id2)
        if closed_session is None:
            print("✅ Closed session is no longer accessible")
        
        print("\n🎉 All session manager tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Session manager test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup temporary directory
        shutil.rmtree(temp_dir)

async def test_context_aware_agent():
    """Test the ContextAwareAgent functionality"""
    print("\n🧪 Testing Context Aware Agent...")
    
    temp_dir = tempfile.mkdtemp()
    
    try:
        session_manager = SessionManager(temp_dir)
        agent = ContextAwareAgent(session_manager)
        
        # Test 1: Start session
        session_id = await agent.start_session("test_agent_user")
        print(f"✅ Agent session started: {session_id}")
        
        # Test 2: Process commands
        print("\n📝 Testing command processing...")
        
        response1 = await agent.process_command("status", {"source": "test"})
        print(f"✅ Command processed: {response1}")
        
        response2 = await agent.process_command("restart ai-proxy", {"urgency": "high"})
        print(f"✅ Second command processed: {response2}")
        
        response3 = await agent.process_command("memory search error", {"type": "search"})
        print(f"✅ Third command processed: {response3}")
        
        # Test 3: Get context summary
        print("\n📋 Testing context summary...")
        
        summary = await agent.get_context_summary(limit=5)
        print(f"✅ Context summary generated:")
        print(summary[:200] + "..." if len(summary) > 200 else summary)
        
        # Test 4: End session
        print("\n🔒 Testing session end...")
        
        await agent.end_session("test_completed")
        print("✅ Agent session ended")
        
        print("\n🎉 All context aware agent tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Context aware agent test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        shutil.rmtree(temp_dir)

async def test_session_persistence():
    """Test session persistence across manager instances"""
    print("\n🧪 Testing Session Persistence...")
    
    temp_dir = tempfile.mkdtemp()
    
    try:
        # First manager instance
        session_manager1 = SessionManager(temp_dir)
        
        # Create session and add context
        session_id = await session_manager1.create_session("persistence_test")
        
        await session_manager1.add_context_entry(
            session_id=session_id,
            entry_type="test",
            content="This is a persistence test entry",
            importance=3
        )
        
        # Get initial stats
        stats1 = await session_manager1.get_session_stats()
        print(f"✅ First instance stats: {stats1['active_sessions']} sessions, {stats1['total_context_entries']} entries")
        
        # Shutdown first instance
        await session_manager1.shutdown()
        
        # Create second manager instance (should load existing data)
        session_manager2 = SessionManager(temp_dir)
        
        # Wait for loading
        await asyncio.sleep(0.1)
        
        # Get stats from second instance
        stats2 = await session_manager2.get_session_stats()
        print(f"✅ Second instance stats: {stats2['active_sessions']} sessions, {stats2['total_context_entries']} entries")
        
        # Verify data persistence
        if stats1['active_sessions'] == stats2['active_sessions']:
            print("✅ Session persistence verified - session count matches")
        else:
            print(f"❌ Session persistence failed - session count mismatch ({stats1['active_sessions']} vs {stats2['active_sessions']})")
            return False
        
        # Test session retrieval
        session_info = await session_manager2.get_session(session_id)
        if session_info and session_info.user_id == "persistence_test":
            print("✅ Session data persistence verified")
        else:
            print("❌ Session data not persisted correctly")
            return False
        
        # Test context retrieval
        context_entries = await session_manager2.get_session_context(session_id)
        if len(context_entries) >= 2:  # At least session creation + test entry
            print("✅ Context persistence verified")
        else:
            print(f"❌ Context not persisted correctly: {len(context_entries)} entries")
            return False
        
        await session_manager2.shutdown()
        
        print("\n🎉 Session persistence tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Session persistence test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        shutil.rmtree(temp_dir)

async def main():
    """Run all session management tests"""
    print("🚀 Starting Session Management System Tests...\n")
    
    # Run all tests
    test_results = []
    
    test_results.append(await test_session_manager())
    test_results.append(await test_context_aware_agent())
    test_results.append(await test_session_persistence())
    
    # Summary
    passed_tests = sum(test_results)
    total_tests = len(test_results)
    
    print(f"\n📊 Test Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All session management tests passed! The session and context system is working correctly.")
        return 0
    else:
        print("❌ Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)