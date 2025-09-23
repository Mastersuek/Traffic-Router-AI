#!/bin/bash
# 🚀 Traffic Router AI Platform - Автоматическая установка
# Linux/macOS Bash скрипт установки всех зависимостей

echo "🚀 Traffic Router AI Platform v2.0"
echo "   Автоматическая установка всех компонентов..."
echo ""

# Определение ОС
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
elif [[ "$OSTYPE" == "cygwin" ]]; then
    OS="cygwin"
else
    OS="unknown"
    echo "⚠️  Неопознанная операционная система: $OSTYPE"
fi

echo "🖥️  Обнаружена ОС: $OS"
echo ""

# Функция проверки наличия команды
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Функция для Linux - определение дистрибутива
get_linux_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo $ID
    elif [ -f /etc/redhat-release ]; then
        echo "rhel"
    elif [ -f /etc/debian_version ]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

# Функция установки для различных систем
install_package() {
    local package=$1
    local name=$2
    
    echo "🔧 Установка $name..."
    
    case $OS in
        "linux")
            DISTRO=$(get_linux_distro)
            case $DISTRO in
                "ubuntu"|"debian")
                    sudo apt-get update -qq && sudo apt-get install -y $package
                    ;;
                "fedora"|"centos"|"rhel")
                    sudo dnf install -y $package 2>/dev/null || sudo yum install -y $package
                    ;;
                "arch")
                    sudo pacman -S --noconfirm $package
                    ;;
                *)
                    echo "⚠️  Неопознанный дистрибутив Linux: $DISTRO"
                    echo "   Установите $name вручную"
                    return 1
                    ;;
            esac
            ;;
        "mac")
            if command_exists brew; then
                brew install $package
            else
                echo "❌ Homebrew не найден. Установите его сначала:"
                echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
                return 1
            fi
            ;;
        *)
            echo "⚠️  Установка не поддерживается для $OS"
            return 1
            ;;
    esac
}

echo "📋 Проверка установленных компонентов..."
echo ""

# 1. Проверка Node.js
echo -n "🟢 Node.js: "
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo "$NODE_VERSION ✅"
else
    echo "Не найден"
    case $OS in
        "linux")
            # Установка NodeJS для различных Linux дистрибутивов
            DISTRO=$(get_linux_distro)
            case $DISTRO in
                "ubuntu"|"debian")
                    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                    install_package nodejs "Node.js"
                    ;;
                "fedora"|"centos"|"rhel")
                    install_package nodejs "Node.js"
                    install_package npm "npm"
                    ;;
                *)
                    install_package nodejs "Node.js"
                    ;;
            esac
            ;;
        "mac")
            install_package node "Node.js"
            ;;
    esac
fi

# 2. Проверка Python
echo -n "🟢 Python: "
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    echo "$PYTHON_VERSION ✅"
    # Создаем алиас python -> python3 если нужно
    if ! command_exists python; then
        echo "alias python=python3" >> ~/.bashrc
        alias python=python3
    fi
elif command_exists python; then
    PYTHON_VERSION=$(python --version)
    echo "$PYTHON_VERSION ✅"
else
    echo "Не найден"
    case $OS in
        "linux")
            install_package python3 "Python"
            install_package python3-pip "pip"
            ;;
        "mac")
            install_package python "Python"
            ;;
    esac
fi

# 3. Проверка pip
echo -n "🟢 pip: "
if command_exists pip3; then
    PIP_VERSION=$(pip3 --version | cut -d' ' -f2)
    echo "$PIP_VERSION ✅"
    # Создаем алиас pip -> pip3 если нужно
    if ! command_exists pip; then
        echo "alias pip=pip3" >> ~/.bashrc
        alias pip=pip3
    fi
elif command_exists pip; then
    PIP_VERSION=$(pip --version | cut -d' ' -f2)
    echo "$PIP_VERSION ✅"
else
    echo "Не найден"
    case $OS in
        "linux")
            install_package python3-pip "pip"
            ;;
        "mac")
            echo "pip должен устанавливаться с Python"
            ;;
    esac
fi

# 4. Проверка FFmpeg
echo -n "🟢 FFmpeg: "
if command_exists ffmpeg; then
    echo "✅"
else
    echo "Не найден"
    case $OS in
        "linux")
            install_package ffmpeg "FFmpeg"
            ;;
        "mac")
            install_package ffmpeg "FFmpeg"
            ;;
    esac
fi

# 5. Проверка Git
echo -n "🟢 Git: "
if command_exists git; then
    GIT_VERSION=$(git --version)
    echo "$GIT_VERSION ✅"
else
    echo "Не найден"
    install_package git "Git"
fi

echo ""
echo "📦 Установка зависимостей проекта..."

# 6. Проверка и создание config.env
if [ ! -f "config.env" ]; then
    echo "📝 Создание config.env..."
    if [ -f "config.env.example" ]; then
        cp config.env.example config.env
        echo "✅ config.env создан из примера"
    else
        # Создаем базовый config.env
        cat > config.env << 'EOF'
# Основные настройки - нестандартные порты для избежания конфликтов
NODE_ENV=development
PORT=13000
AI_PROXY_PORT=13081
MONITORING_PORT=13082
YOUTUBE_CACHE_PORT=13083
MCP_SERVER_PORT=3001
SOCKS_PROXY_PORT=11080
HTTP_PROXY_PORT=13128

# AI Сервисы API ключи (замените на ваши)
OPENAI_API_KEY=sk-test-key
ANTHROPIC_API_KEY=test-key
GOOGLE_AI_API_KEY=test-key
HUGGINGFACE_API_KEY=test-key

# YouTube Кеш настройки
CACHE_MAX_SIZE_GB=10
CACHE_CLEANUP_INTERVAL_HOURS=24
CACHE_DEFAULT_TTL_HOURS=168

# Логирование и отладка
LOG_LEVEL=info
DEBUG=traffic-router:*
ENABLE_REQUEST_LOGGING=true

# Безопасность
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=100
EOF
        echo "✅ Создан базовый config.env"
    fi
fi

# 7. Установка Node.js зависимостей
if [ -f "package.json" ]; then
    echo "📦 Установка Node.js пакетов..."
    if npm install; then
        echo "✅ Node.js зависимости установлены"
    else
        echo "❌ Ошибка установки Node.js зависимостей"
    fi
else
    echo "⚠️  package.json не найден"
fi

# 8. Компиляция TypeScript
echo "🔨 Компиляция TypeScript..."
if npm run build:ts; then
    echo "✅ TypeScript скомпилирован"
else
    echo "⚠️  Ошибка компиляции TypeScript (возможно, есть ошибки в коде)"
fi

# 9. Установка Python зависимостей
if [ -f "requirements.txt" ]; then
    echo "🐍 Установка Python зависимостей..."
    
    # Определяем команду pip
    PIP_CMD="pip3"
    if command_exists pip; then
        PIP_CMD="pip"
    fi
    
    if $PIP_CMD install -r requirements.txt; then
        echo "✅ Python зависимости установлены"
        
        if [ -f "requirements-agent.txt" ]; then
            if $PIP_CMD install -r requirements-agent.txt; then
                echo "✅ AI-агент зависимости установлены"
            fi
        fi
    else
        echo "❌ Ошибка установки Python зависимостей"
    fi
fi

# 10. Создание необходимых директорий
echo "📁 Создание директорий..."
DIRECTORIES=(
    "logs"
    "data/video-cache"
    "data/video-cache/480p"
    "data/video-cache/640p"
    "data/video-cache/1024p"
    "memory/entities"
)

for dir in "${DIRECTORIES[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "  ✅ Создана папка: $dir"
    fi
done

# 11. Установка прав на выполнение скриптов
echo "🔐 Установка прав на выполнение..."
find . -name "*.sh" -exec chmod +x {} \;
find agents/ -name "*.py" -exec chmod +x {} \; 2>/dev/null || true

# 12. Финальная проверка
echo ""
echo "🔍 Финальная проверка компонентов..."

ALL_GOOD=true

# Проверяем основные команды
COMMANDS=("node" "npm" "python3" "ffmpeg" "git")

# Используем python вместо python3 если python3 недоступен
if ! command_exists python3 && command_exists python; then
    COMMANDS[2]="python"
fi

# Используем pip вместо pip3 если нужно
if command_exists pip3; then
    COMMANDS+=("pip3")
elif command_exists pip; then
    COMMANDS+=("pip")
fi

for cmd in "${COMMANDS[@]}"; do
    if command_exists "$cmd"; then
        echo "  ✅ $cmd"
    else
        echo "  ❌ $cmd - не найден"
        ALL_GOOD=false
    fi
done

echo ""

if [ "$ALL_GOOD" = true ]; then
    echo "🎉 УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО!"
    echo ""
    echo "🚀 Для запуска всех сервисов:"
    echo "   npm run dev:all"
    echo ""
    echo "🌐 После запуска доступно:"
    echo "   • Веб-интерфейс:       http://localhost:13000"
    echo "   • YouTube плеер:       http://localhost:13000/video-player-demo"
    echo "   • AI Proxy:            http://localhost:13081/health"
    echo "   • Мониторинг:          http://localhost:13082/monitoring"
    echo "   • YouTube API:         http://localhost:13083/api/stats"
    echo ""
    echo "🤖 Для запуска AI-агента:"
    if command_exists python3; then
        echo "   python3 agents/start-recovery-agent.py"
    else
        echo "   python agents/start-recovery-agent.py"
    fi
    echo ""
    echo "⚙️  Не забудьте настроить API ключи в config.env для полного функционала!"
else
    echo "⚠️  УСТАНОВКА ЗАВЕРШЕНА С ОШИБКАМИ"
    echo "   Некоторые компоненты требуют ручной установки"
    echo "   Проверьте сообщения выше и установите недостающие компоненты"
fi

echo ""
echo "📖 Подробная документация в README.md"