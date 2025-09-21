#!/bin/bash

echo "🚀 Запуск системы AI восстановления трафик-роутера"

# Проверка зависимостей
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 не установлен"
    exit 1
fi

# Установка Python зависимостей
echo "📦 Установка зависимостей..."
pip3 install -r requirements-agent.txt

# Создание директорий
mkdir -p logs config

# Копирование конфигурации по умолчанию
if [ ! -f "config/recovery-config.yaml" ]; then
    cp config/recovery-config.yaml.example config/recovery-config.yaml
    echo "⚙️ Создан файл конфигурации. Отредактируйте config/recovery-config.yaml"
fi

# Проверка переменных окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "⚠️ Не установлен TELEGRAM_BOT_TOKEN для уведомлений"
fi

# Запуск агента восстановления
echo "🤖 Запуск AI агента восстановления..."
python3 agents/start-recovery-agent.py &

# Сохранение PID
echo $! > recovery-agent.pid
echo "✅ AI агент восстановления запущен (PID: $!)"

# Запуск основной системы
echo "🌐 Запуск основной системы трафик-роутера..."
docker-compose up -d

echo "🎉 Система полностью запущена!"
echo "📱 Откройте Omnara приложение для мониторинга: https://omnara.com"
