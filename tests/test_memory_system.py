#!/usr/bin/env python3
"""
Test Markdown Memory System
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
    "memory_manager", 
    os.path.join(os.path.dirname(__file__), '..', 'lib', 'memory-manager.py')
)
memory_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(memory_module)
MarkdownMemoryManager = memory_module.MarkdownMemoryManager

async def test_memory_manager():
    """Test the MarkdownMemoryManager functionality"""
    print("🧪 Testing Markdown Memory Manager...")
    
    # Create temporary directory for testing
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Initialize memory manager
        memory_manager = MarkdownMemoryManager(temp_dir)
        print("✅ Memory manager initialized")
        
        # Test 1: Update memory
        print("\n📝 Testing memory updates...")
        
        entry_id1 = await memory_manager.update_memory(
            entity="system",
            content="AI proxy server started successfully on port 13081",
            memory_type="success",
            tags=["startup", "ai-proxy"],
            metadata={"port": 13081, "service": "ai-proxy"},
            importance=3
        )
        print(f"✅ Memory entry created: {entry_id1}")
        
        entry_id2 = await memory_manager.update_memory(
            entity="system",
            content="Failed to connect to OpenAI API - timeout error",
            memory_type="error",
            tags=["openai", "timeout"],
            metadata={"error_code": "TIMEOUT", "service": "ai-proxy"},
            importance=4
        )
        print(f"✅ Error entry created: {entry_id2}")
        
        entry_id3 = await memory_manager.update_memory(
            entity="recovery",
            content="Successfully restarted ai-proxy service after timeout",
            memory_type="recovery",
            tags=["restart", "ai-proxy", "success"],
            metadata={"action": "restart", "service": "ai-proxy"},
            importance=4
        )
        print(f"✅ Recovery entry created: {entry_id3}")
        
        # Test 2: Search memory
        print("\n🔍 Testing memory search...")
        
        # Search for AI proxy related entries
        results = await memory_manager.search_memory("ai-proxy", limit=5)
        print(f"✅ Found {len(results)} entries for 'ai-proxy'")
        
        for result in results:
            print(f"   - [{result['memory_type']}] {result['content'][:50]}... (score: {result['relevance_score']})")
        
        # Search for errors
        error_results = await memory_manager.search_memory("error", memory_type="error")
        print(f"✅ Found {len(error_results)} error entries")
        
        # Test 3: Get entity memory
        print("\n📋 Testing entity memory retrieval...")
        
        system_memory = await memory_manager.get_entity_memory("system", limit=10)
        print(f"✅ Retrieved {len(system_memory)} entries for 'system' entity")
        
        recovery_memory = await memory_manager.get_entity_memory("recovery", limit=10)
        print(f"✅ Retrieved {len(recovery_memory)} entries for 'recovery' entity")
        
        # Test 4: Memory statistics
        print("\n📊 Testing memory statistics...")
        
        stats = await memory_manager.get_memory_stats()
        print(f"✅ Memory stats:")
        print(f"   - Total entries: {stats.total_entries}")
        print(f"   - Entities: {stats.entities_count}")
        print(f"   - Storage size: {stats.storage_size_mb:.2f} MB")
        print(f"   - Memory types: {stats.memory_types}")
        
        # Test 5: Memory summary
        print("\n📄 Testing memory summary...")
        
        general_summary = await memory_manager.get_memory_summary()
        print("✅ General summary generated:")
        print(general_summary[:200] + "..." if len(general_summary) > 200 else general_summary)
        
        system_summary = await memory_manager.get_memory_summary("system")
        print("\n✅ System entity summary generated:")
        print(system_summary[:200] + "..." if len(system_summary) > 200 else system_summary)
        
        # Test 6: Export memory
        print("\n💾 Testing memory export...")
        
        json_export = await memory_manager.export_memory(format="json")
        print(f"✅ JSON export generated: {len(json_export)} characters")
        
        yaml_export = await memory_manager.export_memory(format="yaml")
        print(f"✅ YAML export generated: {len(yaml_export)} characters")
        
        # Test 7: Check markdown files
        print("\n📁 Testing markdown file structure...")
        
        entities_dir = Path(temp_dir) / "entities"
        markdown_files = list(entities_dir.glob("*.md"))
        print(f"✅ Created {len(markdown_files)} markdown files:")
        
        for md_file in markdown_files:
            file_size = md_file.stat().st_size
            print(f"   - {md_file.name}: {file_size} bytes")
            
            # Read and show first few lines
            with open(md_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()[:5]
                print(f"     Preview: {lines[0].strip()}")
        
        print("\n🎉 All memory manager tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Memory manager test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup temporary directory
        shutil.rmtree(temp_dir)

async def test_memory_indexing():
    """Test memory indexing and search functionality"""
    print("\n🧪 Testing Memory Indexing and Search...")
    
    temp_dir = tempfile.mkdtemp()
    
    try:
        memory_manager = MarkdownMemoryManager(temp_dir)
        
        # Add various types of entries
        test_entries = [
            {
                "entity": "services",
                "content": "Web server started on port 13000",
                "memory_type": "success",
                "tags": ["web", "startup"],
                "importance": 2
            },
            {
                "entity": "services", 
                "content": "AI proxy connection timeout to OpenAI",
                "memory_type": "error",
                "tags": ["ai-proxy", "openai", "timeout"],
                "importance": 4
            },
            {
                "entity": "services",
                "content": "YouTube cache server responding normally",
                "memory_type": "monitoring",
                "tags": ["youtube", "cache", "healthy"],
                "importance": 1
            },
            {
                "entity": "recovery",
                "content": "Restarted ai-proxy service successfully",
                "memory_type": "recovery",
                "tags": ["restart", "ai-proxy"],
                "importance": 3
            },
            {
                "entity": "recovery",
                "content": "Failed to restart monitoring service - port conflict",
                "memory_type": "error",
                "tags": ["restart", "monitoring", "port-conflict"],
                "importance": 4
            }
        ]
        
        # Add all entries
        entry_ids = []
        for entry in test_entries:
            entry_id = await memory_manager.update_memory(**entry)
            entry_ids.append(entry_id)
        
        print(f"✅ Added {len(entry_ids)} test entries")
        
        # Test different search queries
        search_tests = [
            ("ai-proxy", "Should find AI proxy related entries"),
            ("timeout", "Should find timeout related entries"),
            ("restart", "Should find restart related entries"),
            ("server", "Should find server related entries"),
            ("error", "Should find error entries"),
            ("port", "Should find port related entries")
        ]
        
        for query, description in search_tests:
            results = await memory_manager.search_memory(query, limit=5)
            print(f"✅ Search '{query}': {len(results)} results - {description}")
            
            # Show top result
            if results:
                top_result = results[0]
                print(f"   Top: [{top_result['memory_type']}] {top_result['content'][:60]}...")
        
        # Test entity-specific search
        services_results = await memory_manager.search_memory("server", entity="services")
        print(f"✅ Entity-specific search (services): {len(services_results)} results")
        
        # Test memory type filtering
        error_results = await memory_manager.search_memory("", memory_type="error")
        print(f"✅ Memory type filtering (errors): {len(error_results)} results")
        
        print("\n🎉 Memory indexing and search tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Memory indexing test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        shutil.rmtree(temp_dir)

async def test_memory_persistence():
    """Test memory persistence across manager instances"""
    print("\n🧪 Testing Memory Persistence...")
    
    temp_dir = tempfile.mkdtemp()
    
    try:
        # First manager instance
        memory_manager1 = MarkdownMemoryManager(temp_dir)
        
        # Add some entries
        await memory_manager1.update_memory(
            entity="test",
            content="This is a test entry for persistence",
            memory_type="fact",
            tags=["test", "persistence"]
        )
        
        await memory_manager1.update_memory(
            entity="test",
            content="Another test entry with different type",
            memory_type="observation",
            tags=["test", "observation"]
        )
        
        # Get stats from first instance
        stats1 = await memory_manager1.get_memory_stats()
        print(f"✅ First instance stats: {stats1.total_entries} entries")
        
        # Create second manager instance (should load existing data)
        memory_manager2 = MarkdownMemoryManager(temp_dir)
        
        # Wait for index loading
        await asyncio.sleep(0.1)
        
        # Get stats from second instance
        stats2 = await memory_manager2.get_memory_stats()
        print(f"✅ Second instance stats: {stats2.total_entries} entries")
        
        # Verify data persistence
        if stats1.total_entries == stats2.total_entries:
            print("✅ Memory persistence verified - entries match")
        else:
            print(f"❌ Memory persistence failed - entries don't match ({stats1.total_entries} vs {stats2.total_entries})")
            return False
        
        # Test search in second instance
        results = await memory_manager2.search_memory("test")
        print(f"✅ Search in second instance: {len(results)} results")
        
        if len(results) >= 2:
            print("✅ All test entries found in second instance")
        else:
            print(f"❌ Not all entries found in second instance: {len(results)}")
            return False
        
        print("\n🎉 Memory persistence tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Memory persistence test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        shutil.rmtree(temp_dir)

async def main():
    """Run all memory system tests"""
    print("🚀 Starting Markdown Memory System Tests...\n")
    
    # Run all tests
    test_results = []
    
    test_results.append(await test_memory_manager())
    test_results.append(await test_memory_indexing())
    test_results.append(await test_memory_persistence())
    
    # Summary
    passed_tests = sum(test_results)
    total_tests = len(test_results)
    
    print(f"\n📊 Test Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All memory system tests passed! The markdown memory system is working correctly.")
        return 0
    else:
        print("❌ Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)