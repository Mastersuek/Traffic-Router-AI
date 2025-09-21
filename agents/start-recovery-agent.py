#!/usr/bin/env python3
"""
Запуск AI агента восстановления
"""

import asyncio
import sys
import os

# Добавляем путь к проекту
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.enhanced_recovery_agent import EnhancedRecoveryAgent

async def main():
    """Главная функция запуска агента"""
    print("🤖 Запуск AI агента восстановления трафик-роутера...")
    
    agent = EnhancedRecoveryAgent()
    
    try:
        await agent.start_monitoring()
    except KeyboardInterrupt:
        print("\n👋 Агент остановлен пользователем")
    except Exception as e:
        print(f"❌ Критическая ошибка агента: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
