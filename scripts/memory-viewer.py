#!/usr/bin/env python3
"""
Просмотрщик памяти Mem-Agent для системы маршрутизации трафика
"""

import os
import sys
from pathlib import Path
import argparse
from datetime import datetime

def read_memory_file(file_path):
    """Чтение файла памяти"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return f"Файл {file_path} не найден"
    except Exception as e:
        return f"Ошибка чтения файла {file_path}: {e}"

def list_entities(memory_dir):
    """Список всех сущностей в памяти"""
    entities_dir = Path(memory_dir) / "entities"
    if not entities_dir.exists():
        return []
    
    return [f.stem for f in entities_dir.glob("*.md")]

def display_system_overview(memory_dir):
    """Отображение общего обзора системы"""
    system_file = Path(memory_dir) / "system.md"
    content = read_memory_file(system_file)
    
    print("=" * 60)
    print("🧠 ПАМЯТЬ СИСТЕМЫ МАРШРУТИЗАЦИИ ТРАФИКА")
    print("=" * 60)
    print(content)
    print("=" * 60)

def display_entity(memory_dir, entity_name):
    """Отображение информации о конкретной сущности"""
    entity_file = Path(memory_dir) / "entities" / f"{entity_name}.md"
    content = read_memory_file(entity_file)
    
    print("=" * 60)
    print(f"📋 СУЩНОСТЬ: {entity_name.upper()}")
    print("=" * 60)
    print(content)
    print("=" * 60)

def display_all_entities(memory_dir):
    """Отображение всех сущностей"""
    entities = list_entities(memory_dir)
    
    if not entities:
        print("⚠️ Сущности не найдены")
        return
    
    for entity in entities:
        display_entity(memory_dir, entity)
        print("\n")

def search_memory(memory_dir, search_term):
    """Поиск по памяти системы"""
    results = []
    
    # Поиск в основном файле
    system_file = Path(memory_dir) / "system.md"
    if system_file.exists():
        content = read_memory_file(system_file)
        if search_term.lower() in content.lower():
            results.append(("system.md", content))
    
    # Поиск в сущностях
    entities = list_entities(memory_dir)
    for entity in entities:
        entity_file = Path(memory_dir) / "entities" / f"{entity}.md"
        content = read_memory_file(entity_file)
        if search_term.lower() in content.lower():
            results.append((f"entities/{entity}.md", content))
    
    print("=" * 60)
    print(f"🔍 РЕЗУЛЬТАТЫ ПОИСКА: '{search_term}'")
    print("=" * 60)
    
    if not results:
        print("❌ Ничего не найдено")
        return
    
    for file_name, content in results:
        print(f"\n📄 Файл: {file_name}")
        print("-" * 40)
        
        # Показываем строки с совпадениями
        lines = content.split('\n')
        for i, line in enumerate(lines, 1):
            if search_term.lower() in line.lower():
                print(f"Строка {i}: {line.strip()}")
        
        print("-" * 40)

def main():
    parser = argparse.ArgumentParser(description="Просмотрщик памяти Mem-Agent")
    parser.add_argument("--memory-dir", default="memory", help="Директория памяти")
    parser.add_argument("--entity", help="Показать конкретную сущность")
    parser.add_argument("--all", action="store_true", help="Показать все сущности")
    parser.add_argument("--search", help="Поиск по памяти")
    parser.add_argument("--list", action="store_true", help="Список всех сущностей")
    
    args = parser.parse_args()
    
    memory_dir = Path(args.memory_dir)
    
    if not memory_dir.exists():
        print(f"❌ Директория памяти {memory_dir} не найдена")
        sys.exit(1)
    
    print(f"🧠 Mem-Agent Memory Viewer - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if args.list:
        entities = list_entities(memory_dir)
        print("\n📋 Доступные сущности:")
        for entity in entities:
            print(f"  - {entity}")
    
    elif args.search:
        search_memory(memory_dir, args.search)
    
    elif args.entity:
        display_entity(memory_dir, args.entity)
    
    elif args.all:
        display_all_entities(memory_dir)
    
    else:
        display_system_overview(memory_dir)

if __name__ == "__main__":
    main()
