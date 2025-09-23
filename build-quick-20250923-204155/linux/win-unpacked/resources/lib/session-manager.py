#!/usr/bin/env python3
"""
Session and Context Manager
Система управления сессиями и контекстом для AI агента
"""

import asyncio
import json
import yaml
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
from dataclasses import dataclass, asdict
import logging
import hashlib
import aiofiles

logger = logging.getLogger(__name__)

@dataclass
class SessionInfo:
    """Информация о сессии"""
    session_id: str
    user_id: Optional[str]
    created_at: datetime
    last_activity: datetime
    context: Dict[str, Any]
    metadata: Dict[str, Any]
    is_active: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'session_id': self.session_id,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat(),
            'last_activity': self.last_activity.isoformat(),
            'context': self.context,
            'metadata': self.metadata,
            'is_active': self.is_active
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SessionInfo':
        return cls(
            session_id=data['session_id'],
            user_id=data.get('user_id'),
            created_at=datetime.fromisoformat(data['created_at']),
            last_activity=datetime.fromisoformat(data['last_activity']),
            context=data.get('context', {}),
            metadata=data.get('metadata', {}),
            is_active=data.get('is_active', True)
        )

@dataclass
class ContextEntry:
    """Запись контекста"""
    entry_id: str
    session_id: str
    timestamp: datetime
    entry_type: str  # command, response, event, system
    content: str
    metadata: Dict[str, Any]
    importance: int = 1  # 1-5
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'entry_id': self.entry_id,
            'session_id': self.session_id,
            'timestamp': self.timestamp.isoformat(),
            'entry_type': self.entry_type,
            'content': self.content,
            'metadata': self.metadata,
            'importance': self.importance
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ContextEntry':
        return cls(
            entry_id=data['entry_id'],
            session_id=data['session_id'],
            timestamp=datetime.fromisoformat(data['timestamp']),
            entry_type=data['entry_type'],
            content=data['content'],
            metadata=data.get('metadata', {}),
            importance=data.get('importance', 1)
        )

class SessionManager:
    """Менеджер сессий и контекста"""
    
    def __init__(self, sessions_dir: str = "sessions", memory_manager=None):
        self.sessions_dir = Path(sessions_dir)
        self.sessions_dir.mkdir(exist_ok=True)
        
        # Директории для хранения
        self.active_sessions_dir = self.sessions_dir / "active"
        self.archived_sessions_dir = self.sessions_dir / "archived"
        self.context_dir = self.sessions_dir / "context"
        
        for dir_path in [self.active_sessions_dir, self.archived_sessions_dir, self.context_dir]:
            dir_path.mkdir(exist_ok=True)
        
        # Активные сессии в памяти
        self.active_sessions: Dict[str, SessionInfo] = {}
        self.session_contexts: Dict[str, List[ContextEntry]] = {}
        
        # Интеграция с системой памяти
        self.memory_manager = memory_manager
        
        # Конфигурация
        self.config = self._load_config()
        
        # Загружаем активные сессии
        asyncio.create_task(self._load_active_sessions())
        
        logger.info(f"SessionManager initialized with directory: {self.sessions_dir}")
    
    def _load_config(self) -> Dict[str, Any]:
        """Загрузка конфигурации сессий"""
        config_file = self.sessions_dir / "config.yaml"
        
        default_config = {
            "session_timeout_hours": 24,
            "max_active_sessions": 100,
            "context_retention_days": 7,
            "auto_archive_inactive_hours": 48,
            "max_context_entries_per_session": 1000,
            "cleanup_interval_hours": 6,
            "memory_integration": {
                "auto_update_memory": True,
                "important_threshold": 3,
                "memory_entity_prefix": "session_"
            }
        }
        
        if config_file.exists():
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)
                    return {**default_config, **config}
            except Exception as e:
                logger.error(f"Failed to load session config: {e}")
        
        # Создаем конфигурацию по умолчанию
        with open(config_file, 'w', encoding='utf-8') as f:
            yaml.dump(default_config, f, default_flow_style=False, allow_unicode=True)
        
        return default_config
    
    async def _load_active_sessions(self):
        """Загрузка активных сессий"""
        try:
            for session_file in self.active_sessions_dir.glob("*.json"):
                try:
                    async with aiofiles.open(session_file, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        session_data = json.loads(content)
                        session_info = SessionInfo.from_dict(session_data)
                        
                        # Проверяем, не истекла ли сессия
                        if self._is_session_expired(session_info):
                            await self._archive_session(session_info.session_id)
                        else:
                            self.active_sessions[session_info.session_id] = session_info
                            
                            # Загружаем контекст сессии
                            await self._load_session_context(session_info.session_id)
                            
                except Exception as e:
                    logger.error(f"Failed to load session from {session_file}: {e}")
            
            logger.info(f"Loaded {len(self.active_sessions)} active sessions")
            
        except Exception as e:
            logger.error(f"Failed to load active sessions: {e}")
    
    async def _load_session_context(self, session_id: str):
        """Загрузка контекста сессии"""
        context_file = self.context_dir / f"{session_id}.json"
        
        if not context_file.exists():
            self.session_contexts[session_id] = []
            return
        
        try:
            async with aiofiles.open(context_file, 'r', encoding='utf-8') as f:
                content = await f.read()
                context_data = json.loads(content)
                
                context_entries = [
                    ContextEntry.from_dict(entry_data)
                    for entry_data in context_data.get('entries', [])
                ]
                
                self.session_contexts[session_id] = context_entries
                
        except Exception as e:
            logger.error(f"Failed to load context for session {session_id}: {e}")
            self.session_contexts[session_id] = []
    
    def _is_session_expired(self, session_info: SessionInfo) -> bool:
        """Проверка истечения сессии"""
        timeout_hours = self.config['session_timeout_hours']
        expiry_time = session_info.last_activity + timedelta(hours=timeout_hours)
        return datetime.now() > expiry_time
    
    async def create_session(self, user_id: Optional[str] = None, 
                           initial_context: Dict[str, Any] = None) -> str:
        """Создание новой сессии"""
        try:
            # Генерируем уникальный ID сессии
            session_id = str(uuid.uuid4())
            
            # Создаем информацию о сессии
            session_info = SessionInfo(
                session_id=session_id,
                user_id=user_id,
                created_at=datetime.now(),
                last_activity=datetime.now(),
                context=initial_context or {},
                metadata={
                    'created_by': 'SessionManager',
                    'version': '1.0'
                }
            )
            
            # Сохраняем в активные сессии
            self.active_sessions[session_id] = session_info
            self.session_contexts[session_id] = []
            
            # Сохраняем на диск
            await self._save_session(session_info)
            
            # Добавляем запись в контекст
            await self.add_context_entry(
                session_id=session_id,
                entry_type="system",
                content=f"Session created for user: {user_id or 'anonymous'}",
                metadata={'action': 'session_created'},
                importance=2
            )
            
            # Обновляем память если включена интеграция
            if self.memory_manager and self.config['memory_integration']['auto_update_memory']:
                await self.memory_manager.update_memory(
                    entity=f"{self.config['memory_integration']['memory_entity_prefix']}sessions",
                    content=f"New session created: {session_id} for user {user_id or 'anonymous'}",
                    memory_type="fact",
                    tags=["session", "created"],
                    metadata={
                        'session_id': session_id,
                        'user_id': user_id,
                        'created_at': session_info.created_at.isoformat()
                    }
                )
            
            logger.info(f"Created new session: {session_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"Failed to create session: {e}")
            raise
    
    async def get_session(self, session_id: str) -> Optional[SessionInfo]:
        """Получение информации о сессии"""
        if session_id in self.active_sessions:
            session_info = self.active_sessions[session_id]
            
            # Проверяем истечение
            if self._is_session_expired(session_info):
                await self._archive_session(session_id)
                return None
            
            return session_info
        
        return None
    
    async def update_session_activity(self, session_id: str):
        """Обновление активности сессии"""
        if session_id in self.active_sessions:
            self.active_sessions[session_id].last_activity = datetime.now()
            await self._save_session(self.active_sessions[session_id])
    
    async def update_session_context(self, session_id: str, context_updates: Dict[str, Any]):
        """Обновление контекста сессии"""
        if session_id in self.active_sessions:
            session_info = self.active_sessions[session_id]
            session_info.context.update(context_updates)
            session_info.last_activity = datetime.now()
            
            await self._save_session(session_info)
            
            # Добавляем запись в контекст
            await self.add_context_entry(
                session_id=session_id,
                entry_type="system",
                content=f"Session context updated: {list(context_updates.keys())}",
                metadata={'context_updates': context_updates},
                importance=1
            )
    
    async def add_context_entry(self, session_id: str, entry_type: str, content: str,
                              metadata: Dict[str, Any] = None, importance: int = 1) -> str:
        """Добавление записи в контекст сессии"""
        try:
            # Генерируем ID записи
            entry_id = hashlib.md5(f"{session_id}{content}{datetime.now().isoformat()}".encode()).hexdigest()[:8]
            
            # Создаем запись
            context_entry = ContextEntry(
                entry_id=entry_id,
                session_id=session_id,
                timestamp=datetime.now(),
                entry_type=entry_type,
                content=content,
                metadata=metadata or {},
                importance=importance
            )
            
            # Добавляем в контекст сессии
            if session_id not in self.session_contexts:
                self.session_contexts[session_id] = []
            
            self.session_contexts[session_id].append(context_entry)
            
            # Ограничиваем размер контекста
            max_entries = self.config['max_context_entries_per_session']
            if len(self.session_contexts[session_id]) > max_entries:
                # Удаляем старые записи, оставляя важные
                sorted_entries = sorted(
                    self.session_contexts[session_id],
                    key=lambda x: (x.importance, x.timestamp),
                    reverse=True
                )
                self.session_contexts[session_id] = sorted_entries[:max_entries]
            
            # Сохраняем контекст
            await self._save_session_context(session_id)
            
            # Обновляем активность сессии
            await self.update_session_activity(session_id)
            
            # Обновляем память для важных записей
            if (self.memory_manager and 
                self.config['memory_integration']['auto_update_memory'] and
                importance >= self.config['memory_integration']['important_threshold']):
                
                await self.memory_manager.update_memory(
                    entity=f"{self.config['memory_integration']['memory_entity_prefix']}{session_id}",
                    content=content,
                    memory_type=self._map_entry_type_to_memory_type(entry_type),
                    tags=["session", entry_type, session_id],
                    metadata={
                        'session_id': session_id,
                        'entry_type': entry_type,
                        'entry_id': entry_id,
                        **metadata
                    },
                    importance=importance
                )
            
            return entry_id
            
        except Exception as e:
            logger.error(f"Failed to add context entry: {e}")
            raise
    
    def _map_entry_type_to_memory_type(self, entry_type: str) -> str:
        """Маппинг типа записи контекста в тип памяти"""
        mapping = {
            'command': 'decision',
            'response': 'fact',
            'event': 'observation',
            'system': 'monitoring',
            'error': 'error',
            'success': 'success'
        }
        return mapping.get(entry_type, 'fact')
    
    async def get_session_context(self, session_id: str, limit: int = 50) -> List[ContextEntry]:
        """Получение контекста сессии"""
        if session_id not in self.session_contexts:
            await self._load_session_context(session_id)
        
        context_entries = self.session_contexts.get(session_id, [])
        
        # Сортируем по времени (новые сначала)
        sorted_entries = sorted(context_entries, key=lambda x: x.timestamp, reverse=True)
        
        return sorted_entries[:limit]
    
    async def search_context(self, session_id: str = None, query: str = "", 
                           entry_type: str = None, limit: int = 20) -> List[ContextEntry]:
        """Поиск в контексте сессий"""
        results = []
        
        # Определяем сессии для поиска
        sessions_to_search = [session_id] if session_id else list(self.session_contexts.keys())
        
        for sid in sessions_to_search:
            if sid not in self.session_contexts:
                await self._load_session_context(sid)
            
            for entry in self.session_contexts.get(sid, []):
                # Фильтр по типу
                if entry_type and entry.entry_type != entry_type:
                    continue
                
                # Поиск по содержимому
                if query and query.lower() not in entry.content.lower():
                    continue
                
                results.append(entry)
        
        # Сортируем по релевантности и времени
        results.sort(key=lambda x: (x.importance, x.timestamp), reverse=True)
        
        return results[:limit]
    
    async def _save_session(self, session_info: SessionInfo):
        """Сохранение сессии на диск"""
        session_file = self.active_sessions_dir / f"{session_info.session_id}.json"
        
        try:
            async with aiofiles.open(session_file, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(session_info.to_dict(), indent=2, ensure_ascii=False))
        except Exception as e:
            logger.error(f"Failed to save session {session_info.session_id}: {e}")
    
    async def _save_session_context(self, session_id: str):
        """Сохранение контекста сессии"""
        context_file = self.context_dir / f"{session_id}.json"
        
        try:
            context_data = {
                'session_id': session_id,
                'last_updated': datetime.now().isoformat(),
                'entries': [
                    entry.to_dict() 
                    for entry in self.session_contexts.get(session_id, [])
                ]
            }
            
            async with aiofiles.open(context_file, 'w', encoding='utf-8') as f:
                await f.write(json.dumps(context_data, indent=2, ensure_ascii=False))
                
        except Exception as e:
            logger.error(f"Failed to save context for session {session_id}: {e}")
    
    async def close_session(self, session_id: str, reason: str = "manual"):
        """Закрытие сессии"""
        if session_id in self.active_sessions:
            session_info = self.active_sessions[session_id]
            session_info.is_active = False
            session_info.last_activity = datetime.now()
            
            # Добавляем запись о закрытии
            await self.add_context_entry(
                session_id=session_id,
                entry_type="system",
                content=f"Session closed: {reason}",
                metadata={'action': 'session_closed', 'reason': reason},
                importance=2
            )
            
            # Архивируем сессию
            await self._archive_session(session_id)
            
            logger.info(f"Session closed: {session_id} (reason: {reason})")
    
    async def _archive_session(self, session_id: str):
        """Архивирование сессии"""
        try:
            if session_id in self.active_sessions:
                session_info = self.active_sessions[session_id]
                
                # Перемещаем файл сессии в архив
                active_file = self.active_sessions_dir / f"{session_id}.json"
                archived_file = self.archived_sessions_dir / f"{session_id}.json"
                
                if active_file.exists():
                    # Обновляем статус и сохраняем в архив
                    session_info.is_active = False
                    async with aiofiles.open(archived_file, 'w', encoding='utf-8') as f:
                        await f.write(json.dumps(session_info.to_dict(), indent=2, ensure_ascii=False))
                    
                    # Удаляем из активных
                    active_file.unlink()
                
                # Удаляем из памяти
                del self.active_sessions[session_id]
                
                # Контекст оставляем для возможного восстановления
                logger.info(f"Session archived: {session_id}")
        
        except Exception as e:
            logger.error(f"Failed to archive session {session_id}: {e}")
    
    async def cleanup_old_sessions(self):
        """Очистка старых сессий и контекста"""
        try:
            current_time = datetime.now()
            
            # Архивируем неактивные сессии
            inactive_hours = self.config['auto_archive_inactive_hours']
            sessions_to_archive = []
            
            for session_id, session_info in self.active_sessions.items():
                if current_time - session_info.last_activity > timedelta(hours=inactive_hours):
                    sessions_to_archive.append(session_id)
            
            for session_id in sessions_to_archive:
                await self._archive_session(session_id)
            
            # Очищаем старый контекст
            retention_days = self.config['context_retention_days']
            cutoff_date = current_time - timedelta(days=retention_days)
            
            for session_id in list(self.session_contexts.keys()):
                if session_id not in self.active_sessions:
                    # Удаляем контекст неактивных сессий старше retention_days
                    context_file = self.context_dir / f"{session_id}.json"
                    if context_file.exists():
                        file_time = datetime.fromtimestamp(context_file.stat().st_mtime)
                        if file_time < cutoff_date:
                            context_file.unlink()
                            if session_id in self.session_contexts:
                                del self.session_contexts[session_id]
            
            logger.info(f"Cleanup completed: archived {len(sessions_to_archive)} sessions")
            
        except Exception as e:
            logger.error(f"Failed to cleanup old sessions: {e}")
    
    async def get_session_stats(self) -> Dict[str, Any]:
        """Получение статистики сессий"""
        try:
            active_count = len(self.active_sessions)
            
            # Подсчитываем архивированные сессии
            archived_count = len(list(self.archived_sessions_dir.glob("*.json")))
            
            # Подсчитываем записи контекста
            total_context_entries = sum(
                len(entries) for entries in self.session_contexts.values()
            )
            
            # Статистика по типам записей
            entry_types = {}
            for entries in self.session_contexts.values():
                for entry in entries:
                    entry_types[entry.entry_type] = entry_types.get(entry.entry_type, 0) + 1
            
            return {
                'active_sessions': active_count,
                'archived_sessions': archived_count,
                'total_context_entries': total_context_entries,
                'entry_types': entry_types,
                'last_updated': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to get session stats: {e}")
            return {}
    
    async def export_session(self, session_id: str, include_context: bool = True) -> Dict[str, Any]:
        """Экспорт сессии"""
        try:
            session_info = await self.get_session(session_id)
            if not session_info:
                # Попробуем найти в архиве
                archived_file = self.archived_sessions_dir / f"{session_id}.json"
                if archived_file.exists():
                    async with aiofiles.open(archived_file, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        session_data = json.loads(content)
                        session_info = SessionInfo.from_dict(session_data)
                else:
                    raise ValueError(f"Session {session_id} not found")
            
            export_data = {
                'session_info': session_info.to_dict(),
                'export_timestamp': datetime.now().isoformat()
            }
            
            if include_context:
                context_entries = await self.get_session_context(session_id, limit=1000)
                export_data['context'] = [entry.to_dict() for entry in context_entries]
            
            return export_data
            
        except Exception as e:
            logger.error(f"Failed to export session {session_id}: {e}")
            raise
    
    async def restore_session(self, session_id: str) -> bool:
        """Восстановление сессии из архива"""
        try:
            archived_file = self.archived_sessions_dir / f"{session_id}.json"
            
            if not archived_file.exists():
                return False
            
            # Загружаем данные сессии
            async with aiofiles.open(archived_file, 'r', encoding='utf-8') as f:
                content = await f.read()
                session_data = json.loads(content)
                session_info = SessionInfo.from_dict(session_data)
            
            # Активируем сессию
            session_info.is_active = True
            session_info.last_activity = datetime.now()
            
            # Добавляем в активные
            self.active_sessions[session_id] = session_info
            
            # Загружаем контекст
            await self._load_session_context(session_id)
            
            # Сохраняем как активную
            await self._save_session(session_info)
            
            # Удаляем из архива
            archived_file.unlink()
            
            # Добавляем запись о восстановлении
            await self.add_context_entry(
                session_id=session_id,
                entry_type="system",
                content="Session restored from archive",
                metadata={'action': 'session_restored'},
                importance=2
            )
            
            logger.info(f"Session restored: {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to restore session {session_id}: {e}")
            return False
    
    async def start_cleanup_task(self):
        """Запуск задачи автоматической очистки"""
        cleanup_interval = self.config['cleanup_interval_hours']
        
        while True:
            try:
                await asyncio.sleep(cleanup_interval * 3600)  # Конвертируем в секунды
                await self.cleanup_old_sessions()
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
    
    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("Shutting down SessionManager...")
        
        try:
            # Сохраняем все активные сессии
            for session_info in self.active_sessions.values():
                await self._save_session(session_info)
            
            # Сохраняем все контексты
            for session_id in self.session_contexts:
                await self._save_session_context(session_id)
            
            logger.info("SessionManager shutdown completed")
            
        except Exception as e:
            logger.error(f"Error during SessionManager shutdown: {e}")


class ContextAwareAgent:
    """AI агент с поддержкой контекста и сессий"""
    
    def __init__(self, session_manager: SessionManager, memory_manager=None):
        self.session_manager = session_manager
        self.memory_manager = memory_manager
        self.current_session_id: Optional[str] = None
        
    async def start_session(self, user_id: Optional[str] = None) -> str:
        """Начало новой сессии"""
        self.current_session_id = await self.session_manager.create_session(user_id)
        return self.current_session_id
    
    async def process_command(self, command: str, metadata: Dict[str, Any] = None) -> str:
        """Обработка команды с сохранением в контекст"""
        if not self.current_session_id:
            self.current_session_id = await self.session_manager.create_session()
        
        # Добавляем команду в контекст
        await self.session_manager.add_context_entry(
            session_id=self.current_session_id,
            entry_type="command",
            content=command,
            metadata=metadata or {},
            importance=2
        )
        
        # Здесь была бы логика обработки команды
        response = f"Processed command: {command}"
        
        # Добавляем ответ в контекст
        await self.session_manager.add_context_entry(
            session_id=self.current_session_id,
            entry_type="response",
            content=response,
            metadata={'command': command},
            importance=1
        )
        
        return response
    
    async def get_context_summary(self, limit: int = 10) -> str:
        """Получение сводки контекста текущей сессии"""
        if not self.current_session_id:
            return "No active session"
        
        context_entries = await self.session_manager.get_session_context(
            self.current_session_id, limit
        )
        
        if not context_entries:
            return "No context available"
        
        summary_lines = [f"Context for session {self.current_session_id}:"]
        
        for entry in context_entries:
            timestamp = entry.timestamp.strftime("%H:%M:%S")
            summary_lines.append(f"[{timestamp}] {entry.entry_type}: {entry.content[:80]}...")
        
        return "\n".join(summary_lines)
    
    async def end_session(self, reason: str = "manual"):
        """Завершение текущей сессии"""
        if self.current_session_id:
            await self.session_manager.close_session(self.current_session_id, reason)
            self.current_session_id = None