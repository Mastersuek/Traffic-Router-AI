# 🚀 Traffic Router AI Platform - Автоматическая установка
# Windows PowerShell скрипт установки всех зависимостей

Write-Host "🚀 Traffic Router AI Platform v2.0" -ForegroundColor Green
Write-Host "   Автоматическая установка всех компонентов..." -ForegroundColor Cyan
Write-Host ""

# Проверка прав администратора
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  Требуются права администратора для установки!" -ForegroundColor Yellow
    Write-Host "   Перезапустите PowerShell от имени администратора" -ForegroundColor Yellow
    Write-Host "   или установите компоненты вручную" -ForegroundColor Yellow
    Write-Host ""
}

# Функция проверки наличия команды
function Test-Command($command) {
    try {
        Get-Command $command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Функция установки через winget
function Install-WithWinget($package, $name) {
    Write-Host "🔧 Установка $name..." -ForegroundColor Yellow
    try {
        winget install $package --silent --accept-source-agreements --accept-package-agreements
        Write-Host "✅ $name установлен успешно" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Ошибка установки $name через winget: $_" -ForegroundColor Red
        return $false
    }
}

# Функция установки через Chocolatey
function Install-WithChoco($package, $name) {
    Write-Host "🔧 Установка $name через Chocolatey..." -ForegroundColor Yellow
    try {
        choco install $package -y
        Write-Host "✅ $name установлен успешно" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Ошибка установки $name через Chocolatey: $_" -ForegroundColor Red
        return $false
    }
}

Write-Host "📋 Проверка установленных компонентов..." -ForegroundColor Blue
Write-Host ""

# 1. Проверка Node.js
Write-Host "🟢 Node.js:" -NoNewline
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host " $nodeVersion ✅" -ForegroundColor Green
} else {
    Write-Host " Не найден" -ForegroundColor Red
    if ($isAdmin) {
        if (Test-Command "winget") {
            Install-WithWinget "OpenJS.NodeJS" "Node.js"
        } elseif (Test-Command "choco") {
            Install-WithChoco "nodejs" "Node.js"
        } else {
            Write-Host "⚠️  Установите Node.js вручную: https://nodejs.org/" -ForegroundColor Yellow
        }
    }
}

# 2. Проверка Python
Write-Host "🟢 Python:" -NoNewline
if (Test-Command "python") {
    $pythonVersion = python --version 2>&1
    Write-Host " $pythonVersion ✅" -ForegroundColor Green
} else {
    Write-Host " Не найден" -ForegroundColor Red
    if ($isAdmin) {
        if (Test-Command "winget") {
            Install-WithWinget "Python.Python.3.11" "Python"
        } elseif (Test-Command "choco") {
            Install-WithChoco "python" "Python"
        } else {
            Write-Host "⚠️  Установите Python вручную: https://python.org/" -ForegroundColor Yellow
        }
    }
}

# 3. Проверка FFmpeg
Write-Host "🟢 FFmpeg:" -NoNewline
if (Test-Command "ffmpeg") {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-String "ffmpeg version" | Select-Object -First 1
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " Не найден" -ForegroundColor Red
    if ($isAdmin) {
        if (Test-Command "winget") {
            $success = Install-WithWinget "Gyan.FFmpeg" "FFmpeg"
            if (-not $success) {
                Install-WithWinget "FFmpeg.FFmpeg" "FFmpeg"
            }
        } elseif (Test-Command "choco") {
            Install-WithChoco "ffmpeg" "FFmpeg"
        } else {
            Write-Host "⚠️  Установите FFmpeg вручную:" -ForegroundColor Yellow
            Write-Host "   1. Скачайте: https://ffmpeg.org/download.html" -ForegroundColor Yellow
            Write-Host "   2. Добавьте в PATH" -ForegroundColor Yellow
        }
    }
}

# 4. Проверка Git
Write-Host "🟢 Git:" -NoNewline
if (Test-Command "git") {
    $gitVersion = git --version
    Write-Host " $gitVersion ✅" -ForegroundColor Green
} else {
    Write-Host " Не найден" -ForegroundColor Red
    if ($isAdmin -and (Test-Command "winget")) {
        Install-WithWinget "Git.Git" "Git"
    }
}

Write-Host ""
Write-Host "📦 Установка зависимостей проекта..." -ForegroundColor Blue

# 5. Проверка и создание config.env
if (-not (Test-Path "config.env")) {
    Write-Host "📝 Создание config.env..." -ForegroundColor Yellow
    if (Test-Path "config.env.example") {
        Copy-Item "config.env.example" "config.env"
        Write-Host "✅ config.env создан из примера" -ForegroundColor Green
    } else {
        # Создаем базовый config.env
        @"
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
"@ | Out-File -FilePath "config.env" -Encoding UTF8
        Write-Host "✅ Создан базовый config.env" -ForegroundColor Green
    }
}

# 6. Установка Node.js зависимостей
if (Test-Path "package.json") {
    Write-Host "📦 Установка Node.js пакетов..." -ForegroundColor Yellow
    try {
        npm install
        Write-Host "✅ Node.js зависимости установлены" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Ошибка установки Node.js зависимостей: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  package.json не найден" -ForegroundColor Yellow
}

# 7. Компиляция TypeScript
Write-Host "🔨 Компиляция TypeScript..." -ForegroundColor Yellow
try {
    npm run build:ts
    Write-Host "✅ TypeScript скомпилирован" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Ошибка компиляции TypeScript (возможно, есть ошибки в коде)" -ForegroundColor Yellow
}

# 8. Установка Python зависимостей
if (Test-Path "requirements.txt") {
    Write-Host "🐍 Установка Python зависимостей..." -ForegroundColor Yellow
    try {
        pip install -r requirements.txt
        Write-Host "✅ Python зависимости установлены" -ForegroundColor Green
        
        if (Test-Path "requirements-agent.txt") {
            pip install -r requirements-agent.txt
            Write-Host "✅ AI-агент зависимости установлены" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "❌ Ошибка установки Python зависимостей: $_" -ForegroundColor Red
    }
}

# 9. Создание необходимых директорий
Write-Host "📁 Создание директорий..." -ForegroundColor Yellow
$directories = @(
    "logs",
    "data/video-cache",
    "data/video-cache/480p", 
    "data/video-cache/640p",
    "data/video-cache/1024p",
    "memory/entities"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  ✅ Создана папка: $dir" -ForegroundColor Green
    }
}

# 10. Финальная проверка
Write-Host ""
Write-Host "🔍 Финальная проверка компонентов..." -ForegroundColor Blue

$allGood = $true

# Проверяем основные команды
$commands = @(
    @{Name="Node.js"; Command="node"},
    @{Name="npm"; Command="npm"}, 
    @{Name="Python"; Command="python"},
    @{Name="pip"; Command="pip"},
    @{Name="FFmpeg"; Command="ffmpeg"}
)

foreach ($cmd in $commands) {
    if (Test-Command $cmd.Command) {
        Write-Host "  ✅ $($cmd.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($cmd.Name) - не найден" -ForegroundColor Red
        $allGood = $false
    }
}

Write-Host ""

if ($allGood) {
    Write-Host "🎉 УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Для запуска всех сервисов:" -ForegroundColor Cyan
    Write-Host "   npm run dev:all" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 После запуска доступно:" -ForegroundColor Cyan
    Write-Host "   • Веб-интерфейс:       http://localhost:13000" -ForegroundColor White
    Write-Host "   • YouTube плеер:       http://localhost:13000/video-player-demo" -ForegroundColor White
    Write-Host "   • AI Proxy:            http://localhost:13081/health" -ForegroundColor White
    Write-Host "   • Мониторинг:          http://localhost:13082/monitoring" -ForegroundColor White
    Write-Host "   • YouTube API:         http://localhost:13083/api/stats" -ForegroundColor White
    Write-Host ""
    Write-Host "🤖 Для запуска AI-агента:" -ForegroundColor Cyan
    Write-Host "   python agents/start-recovery-agent.py" -ForegroundColor White
    Write-Host ""
    Write-Host "⚙️  Не забудьте настроить API ключи в config.env для полного функционала!" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  УСТАНОВКА ЗАВЕРШЕНА С ОШИБКАМИ" -ForegroundColor Yellow
    Write-Host "   Некоторые компоненты требуют ручной установки" -ForegroundColor Yellow
    Write-Host "   Проверьте сообщения выше и установите недостающие компоненты" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📖 Подробная документация в README.md" -ForegroundColor Blue