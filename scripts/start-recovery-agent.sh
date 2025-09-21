#!/bin/bash

echo "🚀 Запуск AI агента восстановления с Mem-Agent памятью..."

# Проверка зависимостей
echo "📋 Проверка зависимостей..."

# Проверка Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден. Установите Python 3.8+"
    exit 1
fi

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не найден. Установите Docker"
    exit 1
fi

# Создание директорий
echo "📁 Создание директорий..."
mkdir -p memory/entities
mkdir -p logs
mkdir -p config

# Установка Python зависимостей
echo "📦 Установка зависимостей..."
pip3 install -r requirements.txt 2>/dev/null || {
    echo "⚠️ requirements.txt не найден, устанавливаем основные зависимости..."
    pip3 install asyncio psutil requests docker pyyaml markdown pathlib omnara
}

# Проверка конфигурации
if [ ! -f "config/recovery-config.yaml" ]; then
    echo "⚠️ Конфигурационный файл не найден, будет использована конфигурация по умолчанию"
fi

# Проверка переменных окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "⚠️ TELEGRAM_BOT_TOKEN не установлен. Telegram уведомления будут отключены"
fi

if [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo "⚠️ TELEGRAM_CHAT_ID не установлен. Telegram уведомления будут отключены"
fi

# Запуск агента
echo "🤖 Запуск AI агента восстановления..."
cd "$(dirname "$0")/.."

# Запуск в фоновом режиме с логированием
nohup python3 agents/recovery-agent.py > logs/recovery-agent.log 2>&1 &
AGENT_PID=$!

echo "✅ AI агент восстановления запущен (PID: $AGENT_PID)"
echo "📋 Логи доступны в: logs/recovery-agent.log"
echo "🧠 Память системы: memory/system.md"
echo "📊 Мониторинг простоя: каждые 30 минут после 60 минут простоя"

# Сохранение PID для остановки
echo $AGENT_PID > logs/recovery-agent.pid

echo ""
echo "🔍 Для просмотра логов в реальном времени:"
echo "   tail -f logs/recovery-agent.log"
echo ""
echo "🛑 Для остановки агента:"
echo "   kill \$(cat logs/recovery-agent.pid)"
echo ""
echo "🧠 Для просмотра памяти системы:"
echo "   cat memory/system.md"
