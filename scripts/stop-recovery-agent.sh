#!/bin/bash

echo "🛑 Остановка AI агента восстановления..."

# Проверка PID файла
if [ -f "logs/recovery-agent.pid" ]; then
    PID=$(cat logs/recovery-agent.pid)
    
    if ps -p $PID > /dev/null 2>&1; then
        echo "🔄 Остановка процесса $PID..."
        kill $PID
        
        # Ожидание завершения
        sleep 5
        
        if ps -p $PID > /dev/null 2>&1; then
            echo "⚠️ Принудительная остановка..."
            kill -9 $PID
        fi
        
        echo "✅ AI агент восстановления остановлен"
        rm -f logs/recovery-agent.pid
    else
        echo "⚠️ Процесс $PID не найден"
        rm -f logs/recovery-agent.pid
    fi
else
    echo "⚠️ PID файл не найден. Поиск процесса по имени..."
    
    # Поиск процесса по имени
    PIDS=$(pgrep -f "recovery-agent.py")
    
    if [ -n "$PIDS" ]; then
        echo "🔄 Найдены процессы: $PIDS"
        kill $PIDS
        echo "✅ Процессы остановлены"
    else
        echo "ℹ️ AI агент восстановления не запущен"
    fi
fi

echo ""
echo "📋 Последние записи из лога:"
if [ -f "logs/recovery-agent.log" ]; then
    tail -10 logs/recovery-agent.log
else
    echo "   Лог файл не найден"
fi
