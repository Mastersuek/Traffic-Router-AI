#!/usr/bin/env python3
"""
Markdown Memory Manager
Система управления памятью AI агента с хранением в markdown файлах
"""

import os
import json
import yaml
import asyncio
import aiofiles
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
from dataclasses import dataclass, asdict
import hashlib
import re
import logging

logger = logging.getLogger(__name__)

@dataclass
class MemoryEntry:
    """Запись в памяти агента"""
    id: str
    entity: str
    content: str
    memory_type: str  # fact, decision, observation, error, success, warning
    timestamp: datetime
    tags: List[str] = None
    metadata: Dict[str, Any] = None
    importance: int = 1  # 1-5, где 5 - критически важно
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.metadata is None:
            self.metadata = {}

@dataclass
class MemoryStats:
    """Статистика памяти"""
    total_entries: int
    entities_count: int
    memory_types: Dict[str, int]
    last_updated: datetime
    storage_size_mb: float

class MarkdownMemoryManager:
    """Менеджер памяти с хранением в markdown файлах"""
    
    def __init__(self, memory_dir: str = "memory"):
        self.memory_dir = Path(memory_dir)
        self.entities_dir = self.memory_dir / "entities"
        self.index_file = self.memory_dir / "index.json"
        self.config_file = self.memory_dir / "config.yaml"
        
        # Создаем директории
        self.memory_dir.mkdir(exist_ok=True)
        self.entities_dir.mkdir(exist_ok=True)
        
        # Индекс для быстрого поиска
        self.memory_index: Dict[str, List[str]] = {}
        self.entity_stats: Dict[str, Dict[str, Any]] = {}
        
        # Конфигурация
        self.config = self._load_config()
        
        # Загружаем индекс
        asyncio.create_task(self._load_index())
        
        logger.info(f"MarkdownMemoryManager initialized with directory: {self.memory_dir}")
    
    def _load_config(self) -> Dict[str, Any]:
        """Загрузка конфигурации памяти"""
        default_config = {
            "max_entries_per_entity": 1000,
            "auto_cleanup_days": 30,
            "compression_enabled": True,
            "indexing_enabled": True,
            "memory_types": [
                "fact", "decision", "observation", "error", 
                "success", "warning", "recovery", "monitoring"
            ],
            "importance_levels": {
                1: "low",
                2: "normal", 
                3: "high",
                4: "critical",
                5: "emergency"
            }
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)
                    return {**default_config, **config}
            except Exception as e:
                logger.error(f"Failed to load memory config: {e}")
        
        # Создаем конфигурацию по умолчанию
        with open(self.config_file, 'w', encoding='utf-8') as f:
            yaml.dump(default_config, f, default_flow_style=False, allow_unicode=True)
        
        return default_config
    
    async def _load_index(self):
        """Загрузка индекса памяти"""
        try:
            if self.index_file.exists():
                async with aiofiles.open(self.index_file, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    index_data = json.loads(content)
                    self.memory_index = index_data.get('memory_index', {})
                    self.entity_stats = index_data.get('entity_stats', {})
                    logger.info(f"Loaded memory index: {len(self.memory_index)} entities")
            else:
                await self._rebuild_index()
        except Exception as e:
            logger.error(f"Failed to load memory index: {e}")
            await self._rebuild_index()
    
    async def _save_index(self):
        """Сохранение индекса памяти"""
        try:
            index_data = {
                'memory_index': self.memory_index,
                'entity_stats': self.entity_stats,
                'last_updated': datetime.now().isoformat()
            }
            
            async with aiofiles.open(self.index_file, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(index_data, indent=2, ensure_ascii=False))
        except Exception as e:
            logger.error(f"Failed to save memory index: {e}")
    
    async def _rebuild_index(self):
        """Перестроение индекса памяти"""
        logger.info("Rebuilding memory index...")
        self.memory_index.clear()
        self.entity_stats.clear()
        
        try:
            for entity_file in self.entities_dir.glob("*.md"):
                entity_name = entity_file.stem
                await self._index_entity_file(entity_name)
            
            await self._save_index()
            logger.info(f"Memory index rebuilt: {len(self.memory_index)} entities")
        except Exception as e:
            logger.error(f"Failed to rebuild memory index: {e}")
    
    async def _index_entity_file(self, entity_name: str):
        """Индексация файла сущности"""
        entity_file = self.entities_dir / f"{entity_name}.md"
        
        if not entity_file.exists():
            return
        
        try:
            async with aiofiles.open(entity_file, 'r', encoding='utf-8') as f:
                content = await f.read()
            
            # Парсим markdown и извлекаем записи
            entries = self._parse_markdown_entries(content)
            
            # Обновляем индекс
            self.memory_index[entity_name] = [entry.id for entry in entries]
            
            # Обновляем статистику
            self.entity_stats[entity_name] = {
                'total_entries': len(entries),
                'last_updated': datetime.now().isoformat(),
                'memory_types': {},
                'file_size': entity_file.stat().st_size
            }
            
            # Подсчитываем типы памяти
            for entry in entries:
                memory_type = entry.memory_type
                if memory_type not in self.entity_stats[entity_name]['memory_types']:
                    self.entity_stats[entity_name]['memory_types'][memory_type] = 0
                self.entity_stats[entity_name]['memory_types'][memory_type] += 1
                
        except Exception as e:
            logger.error(f"Failed to index entity {entity_name}: {e}")
    
    def _parse_markdown_entries(self, content: str) -> List[MemoryEntry]:
        """Парсинг записей из markdown содержимого"""
        entries = []
        
        # Разделяем на секции по заголовкам уровня 2
        sections = re.split(r'\n## ', content)
        
        for section in sections[1:]:  # Пропускаем первую секцию (заголовок файла)
            try:
                lines = section.strip().split('\n')
                if not lines:
                    continue
                
                # Первая строка - заголовок записи
                header = lines[0].strip()
                
                # Извлекаем метаданные из заголовка
                entry_id = self._extract_entry_id(header)
                memory_type = self._extract_memory_type(header)
                timestamp = self._extract_timestamp(header)
                
                # Остальные строки - содержимое
                entry_content = '\n'.join(lines[1:]).strip()
                
                # Извлекаем теги и метаданные
                tags, metadata = self._extract_tags_and_metadata(entry_content)
                
                # Определяем важность
                importance = self._determine_importance(entry_content, memory_type)
                
                entry = MemoryEntry(
                    id=entry_id,
                    entity="",  # Будет установлено позже
                    content=entry_content,
                    memory_type=memory_type,
                    timestamp=timestamp,
                    tags=tags,
                    metadata=metadata,
                    importance=importance
                )
                
                entries.append(entry)
                
            except Exception as e:
                logger.warning(f"Failed to parse memory entry: {e}")
                continue
        
        return entries
    
    def _extract_entry_id(self, header: str) -> str:
        """Извлечение ID записи из заголовка"""
        # Ищем ID в формате [ID: xxx]
        id_match = re.search(r'\[ID:\s*([^\]]+)\]', header)
        if id_match:
            return id_match.group(1).strip()
        
        # Генерируем ID на основе заголовка и времени
        return hashlib.md5(f"{header}{datetime.now().isoformat()}".encode()).hexdigest()[:8]
    
    def _extract_memory_type(self, header: str) -> str:
        """Извлечение типа памяти из заголовка"""
        # Ищем тип в формате [TYPE: xxx]
        type_match = re.search(r'\[TYPE:\s*([^\]]+)\]', header)
        if type_match:
            return type_match.group(1).strip().lower()
        
        # Определяем тип по ключевым словам
        header_lower = header.lower()
        if any(word in header_lower for word in ['error', 'failed', 'exception']):
            return 'error'
        elif any(word in header_lower for word in ['success', 'completed', 'fixed']):
            return 'success'
        elif any(word in header_lower for word in ['warning', 'alert']):
            return 'warning'
        elif any(word in header_lower for word in ['recovery', 'restart', 'restore']):
            return 'recovery'
        elif any(word in header_lower for word in ['monitoring', 'check', 'status']):
            return 'monitoring'
        else:
            return 'fact'
    
    def _extract_timestamp(self, header: str) -> datetime:
        """Извлечение времени из заголовка"""
        # Ищем время в формате [TIME: xxx]
        time_match = re.search(r'\[TIME:\s*([^\]]+)\]', header)
        if time_match:
            try:
                return datetime.fromisoformat(time_match.group(1).strip())
            except ValueError:
                pass
        
        return datetime.now()
    
    def _extract_tags_and_metadata(self, content: str) -> tuple[List[str], Dict[str, Any]]:
        """Извлечение тегов и метаданных из содержимого"""
        tags = []
        metadata = {}
        
        # Ищем теги в формате #tag
        tag_matches = re.findall(r'#(\w+)', content)
        tags.extend(tag_matches)
        
        # Ищем метаданные в формате **Key**: Value
        metadata_matches = re.findall(r'\*\*([^*]+)\*\*:\s*([^\n]+)', content)
        for key, value in metadata_matches:
            metadata[key.strip()] = value.strip()
        
        return tags, metadata
    
    def _determine_importance(self, content: str, memory_type: str) -> int:
        """Определение важности записи"""
        content_lower = content.lower()
        
        # Критически важные события
        if any(word in content_lower for word in ['critical', 'emergency', 'fatal', 'crash']):
            return 5
        
        # Высокая важность
        if memory_type in ['error', 'recovery'] or any(word in content_lower for word in ['failed', 'timeout', 'restart']):
            return 4
        
        # Средняя важность
        if memory_type in ['warning', 'decision'] or any(word in content_lower for word in ['alert', 'changed', 'updated']):
            return 3
        
        # Обычная важность
        if memory_type in ['success', 'monitoring']:
            return 2
        
        # Низкая важность
        return 1
    
    async def update_memory(self, entity: str, content: str, memory_type: str = "fact", 
                          tags: List[str] = None, metadata: Dict[str, Any] = None,
                          importance: int = None) -> str:
        """Обновление памяти сущности"""
        try:
            # Создаем новую запись
            entry_id = hashlib.md5(f"{entity}{content}{datetime.now().isoformat()}".encode()).hexdigest()[:8]
            
            if importance is None:
                importance = self._determine_importance(content, memory_type)
            
            entry = MemoryEntry(
                id=entry_id,
                entity=entity,
                content=content,
                memory_type=memory_type,
                timestamp=datetime.now(),
                tags=tags or [],
                metadata=metadata or {},
                importance=importance
            )
            
            # Добавляем запись в файл
            await self._append_entry_to_file(entity, entry)
            
            # Обновляем индекс
            if entity not in self.memory_index:
                self.memory_index[entity] = []
            self.memory_index[entity].append(entry_id)
            
            # Обновляем статистику
            await self._update_entity_stats(entity)
            
            # Сохраняем индекс
            await self._save_index()
            
            logger.debug(f"Memory updated for entity {entity}: {entry_id}")
            return entry_id
            
        except Exception as e:
            logger.error(f"Failed to update memory for {entity}: {e}")
            raise
    
    async def _append_entry_to_file(self, entity: str, entry: MemoryEntry):
        """Добавление записи в файл сущности"""
        entity_file = self.entities_dir / f"{entity}.md"
        
        # Создаем файл если не существует
        if not entity_file.exists():
            await self._create_entity_file(entity)
        
        # Форматируем запись в markdown
        markdown_entry = self._format_entry_as_markdown(entry)
        
        # Добавляем в файл
        async with aiofiles.open(entity_file, 'a', encoding='utf-8') as f:
            await f.write(f"\n{markdown_entry}\n")
    
    async def _create_entity_file(self, entity: str):
        """Создание нового файла сущности"""
        entity_file = self.entities_dir / f"{entity}.md"
        
        header = f"""# {entity}

Память AI агента для сущности: {entity}
Создано: {datetime.now().isoformat()}

---
"""
        
        async with aiofiles.open(entity_file, 'w', encoding='utf-8') as f:
            await f.write(header)
    
    def _format_entry_as_markdown(self, entry: MemoryEntry) -> str:
        """Форматирование записи в markdown"""
        # Заголовок с метаданными
        header = f"## {entry.memory_type.title()} Entry [ID: {entry.id}] [TYPE: {entry.memory_type}] [TIME: {entry.timestamp.isoformat()}]"
        
        # Содержимое
        content_lines = [header, ""]
        
        # Добавляем важность
        importance_name = self.config['importance_levels'].get(entry.importance, 'unknown')
        content_lines.append(f"**Важность**: {entry.importance}/5 ({importance_name})")
        
        # Добавляем теги
        if entry.tags:
            tags_str = " ".join([f"#{tag}" for tag in entry.tags])
            content_lines.append(f"**Теги**: {tags_str}")
        
        # Добавляем метаданные
        if entry.metadata:
            content_lines.append("**Метаданные**:")
            for key, value in entry.metadata.items():
                content_lines.append(f"- **{key}**: {value}")
        
        content_lines.append("")
        content_lines.append("**Содержимое**:")
        content_lines.append(entry.content)
        
        return "\n".join(content_lines)
    
    async def _update_entity_stats(self, entity: str):
        """Обновление статистики сущности"""
        entity_file = self.entities_dir / f"{entity}.md"
        
        if not entity_file.exists():
            return
        
        try:
            # Получаем размер файла
            file_size = entity_file.stat().st_size
            
            # Подсчитываем записи
            entry_count = len(self.memory_index.get(entity, []))
            
            # Обновляем статистику
            self.entity_stats[entity] = {
                'total_entries': entry_count,
                'last_updated': datetime.now().isoformat(),
                'file_size': file_size
            }
            
        except Exception as e:
            logger.error(f"Failed to update stats for entity {entity}: {e}")
    
    async def search_memory(self, query: str, entity: str = None, 
                          memory_type: str = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Поиск в памяти"""
        results = []
        
        try:
            # Определяем сущности для поиска
            entities_to_search = [entity] if entity else list(self.memory_index.keys())
            
            for entity_name in entities_to_search:
                entity_results = await self._search_in_entity(entity_name, query, memory_type)
                results.extend(entity_results)
            
            # Сортируем по релевантности и важности
            results.sort(key=lambda x: (x['relevance_score'], x['importance']), reverse=True)
            
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Failed to search memory: {e}")
            return []
    
    async def _search_in_entity(self, entity: str, query: str, memory_type: str = None) -> List[Dict[str, Any]]:
        """Поиск в конкретной сущности"""
        results = []
        entity_file = self.entities_dir / f"{entity}.md"
        
        if not entity_file.exists():
            return results
        
        try:
            async with aiofiles.open(entity_file, 'r', encoding='utf-8') as f:
                content = await f.read()
            
            entries = self._parse_markdown_entries(content)
            
            for entry in entries:
                # Фильтр по типу памяти
                if memory_type and entry.memory_type != memory_type:
                    continue
                
                # Вычисляем релевантность
                relevance_score = self._calculate_relevance(entry, query)
                
                if relevance_score > 0:
                    results.append({
                        'entity': entity,
                        'entry_id': entry.id,
                        'content': entry.content,
                        'memory_type': entry.memory_type,
                        'timestamp': entry.timestamp.isoformat(),
                        'tags': entry.tags,
                        'metadata': entry.metadata,
                        'importance': entry.importance,
                        'relevance_score': relevance_score
                    })
            
        except Exception as e:
            logger.error(f"Failed to search in entity {entity}: {e}")
        
        return results
    
    def _calculate_relevance(self, entry: MemoryEntry, query: str) -> float:
        """Вычисление релевантности записи к запросу"""
        query_lower = query.lower()
        content_lower = entry.content.lower()
        
        score = 0.0
        
        # Точное совпадение фразы
        if query_lower in content_lower:
            score += 10.0
        
        # Совпадение отдельных слов
        query_words = query_lower.split()
        content_words = content_lower.split()
        
        matching_words = set(query_words) & set(content_words)
        if matching_words:
            score += len(matching_words) * 2.0
        
        # Совпадение в тегах
        for tag in entry.tags:
            if query_lower in tag.lower():
                score += 5.0
        
        # Совпадение в метаданных
        for key, value in entry.metadata.items():
            if query_lower in str(value).lower():
                score += 3.0
        
        # Бонус за важность
        score += entry.importance * 0.5
        
        return score
    
    async def get_memory_stats(self) -> MemoryStats:
        """Получение статистики памяти"""
        try:
            total_entries = sum(len(entries) for entries in self.memory_index.values())
            entities_count = len(self.memory_index)
            
            # Подсчитываем типы памяти
            memory_types = {}
            for entity_stats in self.entity_stats.values():
                for mem_type, count in entity_stats.get('memory_types', {}).items():
                    memory_types[mem_type] = memory_types.get(mem_type, 0) + count
            
            # Размер хранилища
            storage_size = sum(
                stats.get('file_size', 0) 
                for stats in self.entity_stats.values()
            ) / (1024 * 1024)  # В мегабайтах
            
            return MemoryStats(
                total_entries=total_entries,
                entities_count=entities_count,
                memory_types=memory_types,
                last_updated=datetime.now(),
                storage_size_mb=storage_size
            )
            
        except Exception as e:
            logger.error(f"Failed to get memory stats: {e}")
            return MemoryStats(0, 0, {}, datetime.now(), 0.0)
    
    async def get_entity_memory(self, entity: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Получение памяти конкретной сущности"""
        try:
            entity_file = self.entities_dir / f"{entity}.md"
            
            if not entity_file.exists():
                return []
            
            async with aiofiles.open(entity_file, 'r', encoding='utf-8') as f:
                content = await f.read()
            
            entries = self._parse_markdown_entries(content)
            
            # Сортируем по времени (новые сначала)
            entries.sort(key=lambda x: x.timestamp, reverse=True)
            
            # Ограничиваем количество
            entries = entries[:limit]
            
            return [
                {
                    'entry_id': entry.id,
                    'content': entry.content,
                    'memory_type': entry.memory_type,
                    'timestamp': entry.timestamp.isoformat(),
                    'tags': entry.tags,
                    'metadata': entry.metadata,
                    'importance': entry.importance
                }
                for entry in entries
            ]
            
        except Exception as e:
            logger.error(f"Failed to get entity memory for {entity}: {e}")
            return []
    
    async def cleanup_old_memories(self, days: int = None):
        """Очистка старых записей памяти"""
        if days is None:
            days = self.config.get('auto_cleanup_days', 30)
        
        cutoff_date = datetime.now() - timedelta(days=days)
        
        logger.info(f"Cleaning up memories older than {days} days...")
        
        try:
            cleaned_count = 0
            
            for entity in list(self.memory_index.keys()):
                entity_file = self.entities_dir / f"{entity}.md"
                
                if not entity_file.exists():
                    continue
                
                # Читаем и фильтруем записи
                async with aiofiles.open(entity_file, 'r', encoding='utf-8') as f:
                    content = await f.read()
                
                entries = self._parse_markdown_entries(content)
                
                # Оставляем только новые записи или важные старые
                filtered_entries = [
                    entry for entry in entries
                    if entry.timestamp > cutoff_date or entry.importance >= 4
                ]
                
                if len(filtered_entries) < len(entries):
                    # Перезаписываем файл
                    await self._rewrite_entity_file(entity, filtered_entries)
                    cleaned_count += len(entries) - len(filtered_entries)
            
            # Перестраиваем индекс
            await self._rebuild_index()
            
            logger.info(f"Cleanup completed: removed {cleaned_count} old entries")
            
        except Exception as e:
            logger.error(f"Failed to cleanup old memories: {e}")
    
    async def _rewrite_entity_file(self, entity: str, entries: List[MemoryEntry]):
        """Перезапись файла сущности с новыми записями"""
        entity_file = self.entities_dir / f"{entity}.md"
        
        # Создаем заголовок
        header = f"""# {entity}

Память AI агента для сущности: {entity}
Обновлено: {datetime.now().isoformat()}

---
"""
        
        # Записываем файл
        async with aiofiles.open(entity_file, 'w', encoding='utf-8') as f:
            await f.write(header)
            
            for entry in entries:
                markdown_entry = self._format_entry_as_markdown(entry)
                await f.write(f"\n{markdown_entry}\n")
    
    async def export_memory(self, entity: str = None, format: str = "json") -> str:
        """Экспорт памяти в различных форматах"""
        try:
            if entity:
                entities = [entity]
            else:
                entities = list(self.memory_index.keys())
            
            export_data = {}
            
            for entity_name in entities:
                entity_memory = await self.get_entity_memory(entity_name, limit=1000)
                export_data[entity_name] = entity_memory
            
            if format == "json":
                return json.dumps(export_data, indent=2, ensure_ascii=False)
            elif format == "yaml":
                return yaml.dump(export_data, default_flow_style=False, allow_unicode=True)
            else:
                raise ValueError(f"Unsupported export format: {format}")
                
        except Exception as e:
            logger.error(f"Failed to export memory: {e}")
            raise
    
    async def get_memory_summary(self, entity: str = None) -> str:
        """Получение краткой сводки памяти"""
        try:
            if entity:
                # Сводка для конкретной сущности
                entity_memory = await self.get_entity_memory(entity, limit=10)
                
                if not entity_memory:
                    return f"# {entity}\n\nНет записей в памяти.\n"
                
                summary_lines = [f"# Сводка памяти: {entity}", ""]
                summary_lines.append(f"Всего записей: {len(self.memory_index.get(entity, []))}")
                summary_lines.append(f"Последние записи:")
                summary_lines.append("")
                
                for entry in entity_memory[:5]:
                    timestamp = entry['timestamp'][:19]  # Убираем микросекунды
                    summary_lines.append(f"- **{timestamp}** [{entry['memory_type']}]: {entry['content'][:100]}...")
                
                return "\n".join(summary_lines)
            
            else:
                # Общая сводка
                stats = await self.get_memory_stats()
                
                summary_lines = ["# Общая сводка памяти AI агента", ""]
                summary_lines.append(f"**Всего записей**: {stats.total_entries}")
                summary_lines.append(f"**Сущностей**: {stats.entities_count}")
                summary_lines.append(f"**Размер хранилища**: {stats.storage_size_mb:.2f} MB")
                summary_lines.append("")
                
                if stats.memory_types:
                    summary_lines.append("**Типы памяти**:")
                    for mem_type, count in sorted(stats.memory_types.items(), key=lambda x: x[1], reverse=True):
                        summary_lines.append(f"- {mem_type}: {count}")
                
                summary_lines.append("")
                summary_lines.append("**Активные сущности**:")
                for entity_name in list(self.memory_index.keys())[:10]:
                    entry_count = len(self.memory_index[entity_name])
                    summary_lines.append(f"- {entity_name}: {entry_count} записей")
                
                return "\n".join(summary_lines)
                
        except Exception as e:
            logger.error(f"Failed to get memory summary: {e}")
            return f"Ошибка получения сводки памяти: {e}"