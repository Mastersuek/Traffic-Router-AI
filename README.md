# 🚀 Traffic Router AI Platform

**Мультиплатформенная система маршрутизации трафика** с AI-агентом для обхода блокировок, поддержкой AI-сервисов, виртуальной геолокации и **YouTube кеширующим плеером**.

## ✨ Новые возможности v2.0

### 🎬 YouTube Кеширующий Плеер
- **Потоковое воспроизведение** с автоматическим кешированием
- **Адаптивное качество**: 480p, 640p, 1024p
- **Умная буферизация** с автоочисткой
- **Плавное переключение** качества без прерывания
- **Статистика в реальном времени**

### 🤖 Enhanced Recovery Agent (AI-Агент)
- **MCP (Model Context Protocol)** интеграция
- **Автоматическое восстановление** сервисов
- **Система памяти** с обучением на ошибках
- **Алиасы команд** для ручного управления
- **Мониторинг системы** в реальном времени

### 🔄 Улучшенная архитектура
- **Реальное API проксирование** к OpenAI/Anthropic
- **Современные PowerShell команды** вместо WMIC
- **TypeScript компиляция** с автоматической сборкой
- **Кеширование ответов** AI-сервисов

## 🚀 Возможности

- **Умная маршрутизация**: Автоматическое определение российских доменов для прямого подключения
- **AI-сервисы**: Специализированная поддержка OpenAI, Anthropic, Google AI, Hugging Face
- **YouTube Плеер**: Кеширующий потоковый плеер с адаптивным качеством
- **AI-Агент**: Автономное восстановление и мониторинг системы
- **Виртуальная геолокация**: Подмена местоположения на США для AI-сервисов
- **Кроссплатформенность**: Windows, Linux, macOS, Android, iOS
- **Балансировка нагрузки**: Множественные прокси-пулы с автоматическим переключением
- **Мониторинг**: Система метрик и алертов с MCP интеграцией

## 📋 Системные требования

### Минимальные требования:
- **Node.js**: 18.0+ (рекомендуется 20.0+)
- **Python**: 3.8+ (для AI-агента)
- **FFmpeg**: Для работы YouTube плеера
- **RAM**: 1GB (рекомендуется 4GB+ для YouTube кеширования)
- **Диск**: 5GB свободного места (для видео кеша)
- **Сеть**: Стабильное интернет-соединение

### Поддерживаемые платформы:
- **Windows**: 10/11 (x64, ARM64) - PowerShell 7.0+
- **Linux**: Ubuntu 20.04+, CentOS 8+, Debian 11+
- **macOS**: 11.0+ (Intel, Apple Silicon)
- **Android**: 8.0+ (API 26+) - без YouTube кеша
- **iOS**: 13.0+ - без YouTube кеша

## 🛠 Стек технологий

### Backend:
- **Node.js** + **TypeScript** - основная логика
- **Express.js** - HTTP сервер
- **WebSocket** - реальное время
- **SOCKS5/HTTP** прокси протоколы

### Frontend:
- **Next.js 14** - веб-интерфейс
- **React 19** - UI компоненты
- **Tailwind CSS 4** - стилизация
- **Radix UI** - компоненты

### Mobile:
- **React Native 0.81** - мобильные приложения
- **Expo** - сборка и деплой

### Desktop:
- **Electron** - десктопные приложения
- **Python/Tkinter** - альтернативный GUI

## 🔧 Быстрая установка

### 🎯 Автоматическая установка (Рекомендуемо)

\`\`\`powershell
# Windows - запустить в PowerShell от имени администратора
.\scripts\setup.ps1
\`\`\`

\`\`\`bash
# Linux/macOS
bash scripts/setup.sh
\`\`\`

**Что сделает скрипт:**
- ✅ Установит Node.js и Python (если не установлены)
- ✅ Установит FFmpeg автоматически
- ✅ Установит все зависимости
- ✅ Скомпилировать TypeScript
- ✅ Настроить окружение
- ✅ Проверить все компоненты

---

### 🛠️ Ручная установка

#### 1. Клонирование проекта

\`\`\`bash
# Скачать ZIP архив из v0
# Или клонировать из GitHub
git clone https://github.com/your-username/traffic-router.git
cd traffic-router
\`\`\`

#### 2. Установка FFmpeg (Обязательно!)

\`\`\`powershell
# Windows (PowerShell)
winget install Gyan.FFmpeg
# Или
choco install ffmpeg
\`\`\`

\`\`\`bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# macOS
brew install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg
\`\`\`

#### 3. Установка Node.js зависимостей

\`\`\`bash
# Основные зависимости
npm install

# Компиляция TypeScript
npm run build:ts
\`\`\`

#### 4. Установка Python зависимостей (для AI-агента)

\`\`\`bash
# Python зависимости
pip install -r requirements.txt
pip install -r requirements-agent.txt
\`\`\`

#### 5. Настройка окружения

\`\`\`bash
# Копирование конфигурации
cp config.env.example config.env

# Редактирование настроек
notepad config.env  # Windows
nano config.env     # Linux/macOS
\`\`\`

**Обязательно указать API ключи:**
\`\`\`bash
# В config.env
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_key_here
\`\`\`

---

## 🚀 Запуск системы

### ⚙️ Конфигурация портов

**Новые порты v2.0 (нестандартные для избежания конфликтов):**

\`\`\`bash
# В config.env
PORT=13000                   # Next.js веб-сервер
AI_PROXY_PORT=13081          # AI прокси сервер
MONITORING_PORT=13082        # Мониторинг
YOUTUBE_CACHE_PORT=13083     # YouTube кеш сервер (НОВЫЙ!)
MCP_SERVER_PORT=3001         # MCP сервер (НОВЫЙ!)
SOCKS_PROXY_PORT=11080       # SOCKS5 прокси
HTTP_PROXY_PORT=13128        # HTTP прокси
\`\`\`

### 💫 Запуск всей системы (Рекомендуемо)

\`\`\`bash
# Запуск всех сервисов одновременно
npm run dev:all

# Что запустится:
# ✅ Next.js (http://localhost:13000) - веб-интерфейс
# ✅ AI Proxy (http://localhost:13081) - проксирование AI
# ✅ Monitoring (http://localhost:13082) - мониторинг
# ✅ YouTube Cache (http://localhost:13083) - YouTube кеш
# ✅ MCP Server (http://localhost:3001) - AI агент
\`\`\`

### 🔧 Запуск отдельных сервисов

\`\`\`bash
# Только веб-сервер
npm run dev

# Только AI прокси
npm run dev:proxy

# Только мониторинг
npm run dev:monitor

# Только YouTube кеш сервер
npm run dev:youtube

# Только MCP сервер
npm run dev:mcp
\`\`\`

### 🤖 Запуск AI-Агента

\`\`\`bash
# Запуск Enhanced Recovery Agent
python agents/start-recovery-agent.py

# Или напрямую
python agents/enhanced_recovery_agent.py
\`\`\`

---

## 🎬 YouTube Кеширующий Плеер

### 🎬 Основные возможности:
- **Потоковое воспроизведение** с автоматическим кешированием
- **Адаптивное качество**: автоматический выбор между 480p/640p/1024p
- **Умный кеш**: автоочистка по размеру и времени
- **Плавное переключение**: без прерывания воспроизведения
- **Статистика**: буферизация, скорость скачивания, потерянные кадры

### 🌐 Доступ:
\`\`\`
http://localhost:13000/video-player-demo
\`\`\`

### 📊 Мониторинг кеша:
\`\`\`bash
# Статистика кеша
curl http://localhost:13083/api/stats

# Список кешированных видео
curl http://localhost:13083/api/cached

# Очистка кеша
curl -X POST http://localhost:13083/api/cleanup
\`\`\`

### ⚙️ Настройки кеша в config.env:
\`\`\`bash
CACHE_MAX_SIZE_GB=10              # Максимальный размер кеша
CACHE_CLEANUP_INTERVAL_HOURS=24   # Интервал очистки
CACHE_DEFAULT_TTL_HOURS=168       # Время жизни кеша (7 дней)
\`\`\`

---

## 🤖 AI-Агент с алиасами команд

### 💬 Алиасы команд для ручного управления:

\`\`\`bash
# Состояние системы
status                    # Показать состояние всех сервисов
health                    # Проверка здоровья
metrics                   # Метрики системы (CPU, RAM, Disk)

# Управление сервисами
restart <service>         # Перезапуск сервиса
recover <service>         # Аварийное восстановление
logs <service>            # Логи сервиса

# Поиск и память
memory <query>            # Поиск в памяти агента
mcp tools                 # Список MCP инструментов
mcp resources             # Список MCP ресурсов

# Помощь
help                      # Список всех команд
\`\`\`

### 📝 Примеры использования:
\`\`\`bash
# Проверка состояния
status

# Перезапуск AI прокси
restart ai-proxy

# Поиск в памяти по ключевому слову
memory error

# Посмотреть логи YouTube сервиса
logs youtube
\`\`\`

### 🧠 Система памяти:
- ✅ **Обучается** на ошибках и успешных восстановлениях
- ✅ **Сохраняет** контекст о состоянии системы
- ✅ **Предсказывает** проблемы на основе паттернов
- ✅ **Адаптирует** стратегии восстановления

---

## 🔄 Опенсорс AI интеграция

### 🎆 Поддерживаемые модели:

#### 📦 Локальные модели (Ollama):
\`\`\`bash
# Установка Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Запуск моделей
ollama pull llama3.2:3b     # Маленькая и быстрая
ollama pull mistral:7b      # Оптимальная по качеству
ollama pull codellama:13b   # Для кодирования

# Конфигурация в config.env
OLLAMA_API_BASE=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
\`\`\`

#### 🌍 Облачные модели:
\`\`\`bash
# OpenAI-совместимые API
OPENAI_API_KEY=your_key_here              # OpenAI GPT
ANTHROPIC_API_KEY=your_key_here           # Claude
GOOGLE_AI_API_KEY=your_key_here           # Gemini
HUGGINGFACE_API_KEY=your_key_here         # HuggingFace

# Бесплатные альтернативы
GROQ_API_KEY=your_key_here                # Очень быстро
TOGETHER_AI_KEY=your_key_here             # Низкие цены
\`\`\`

### 🎯 Настройка для работы с опенсорс AI:

\`\`\`bash
# 1. Установка Ollama
.\scripts\install-ollama.ps1     # Windows
bash scripts/install-ollama.sh   # Linux/macOS

# 2. Или создайте аккаунт на Groq/Together.ai
# Бесплатные API ключи
\`\`\`

### ⚙️ Настройка по умолчанию:
Проект **работает без API ключей** с следующими ограничениями:
- ✅ **YouTube плеер** - полностью рабочий
- ✅ **AI-агент** - базовые функции
- ⚠️ **AI прокси** - заглушки вместо реальных ответов

---

## 🌐 Конфликты портов

### Автоматическое решение:
Система автоматически проверяет доступность портов и выбирает свободные:

\`\`\`typescript
// Автоматический поиск свободного порта
const availablePort = await findFreePort(8080, 8090)
\`\`\`

### Ручная настройка:
\`\`\`bash
# Проверка занятых портов
netstat -tulpn | grep :8080

# Windows
netstat -ano | findstr :8080

# Освобождение порта (Linux/macOS)
sudo lsof -ti:8080 | xargs kill -9

# Windows
taskkill /PID <PID> /F
\`\`\`

## 📱 Клиентские приложения

### Веб-интерфейс:
\`\`\`bash
# Запуск веб-интерфейса
npm run dev
# Доступен на http://localhost:3000
\`\`\`

### Десктопное приложение:
\`\`\`bash
# Сборка Electron приложения
npm run build:clients
# Файлы в dist/desktop/
\`\`\`

### Мобильное приложение:
\`\`\`bash
# React Native
cd clients/mobile
npm install
npm run android  # или npm run ios
\`\`\`

### Python GUI (Windows):
\`\`\`bash
# Установка Python зависимостей
pip install -r requirements.txt
python clients/windows/traffic_router_gui.py
\`\`\`

## 🔐 Безопасность

### Настройка прокси серверов:
1. **Собственные серверы**: Арендуйте VPS в США/Европе
2. **Коммерческие прокси**: Используйте надежных провайдеров
3. **Ротация**: Настройте автоматическую смену прокси

### Конфигурация в `config/proxy-config.json`:
\`\`\`json
{
  "pools": {
    "ai-services": {
      "endpoints": [
        {
          "host": "your-proxy-server.com",
          "port": 1080,
          "protocol": "socks5"
        }
      ]
    }
  }
}
\`\`\`

## 📊 Мониторинг

### Веб-интерфейс мониторинга:
- Доступен на `http://localhost:8082/monitoring`
- Метрики производительности
- Статус прокси серверов
- Логи запросов

### API метрик:
\`\`\`bash
# Получение статистики
curl http://localhost:8080/api/stats

# Проверка здоровья
curl http://localhost:8080/health
\`\`\`

## 🚀 Деплой

### Docker:
\`\`\`bash
# Сборка образа
docker build -t traffic-router .

# Запуск контейнера
docker run -p 8080:8080 -p 1080:1080 traffic-router
\`\`\`

### Vercel (только веб-интерфейс):
\`\`\`bash
# Деплой на Vercel
vercel --prod
\`\`\`

### VPS сервер:
\`\`\`bash
# Установка на Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pm2

# Запуск с PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
\`\`\`

## 🔧 Конфигурация

### Основные файлы конфигурации:
- `config/proxy-config.json` - настройки прокси пулов
- `config/ai-services-config.json` - конфигурация AI сервисов
- `lib/config.ts` - основные настройки системы
- `.env` - переменные окружения

### Настройка AI сервисов:
\`\`\`json
{
  "providers": {
    "openai": {
      "baseUrl": "https://api.openai.com",
      "requiresGeolocation": true,
      "supportedRegions": ["US", "EU"]
    }
  }
}
\`\`\`

## 🐛 Устранение неполадок

### Частые проблемы:

1. **Порт занят**:
   \`\`\`bash
   # Изменить порт в .env
   PORT=8081
   \`\`\`

2. **Прокси не работает**:
   \`\`\`bash
   # Проверить конфигурацию
   curl --proxy socks5://localhost:1080 https://api.openai.com
   \`\`\`

3. **AI сервисы недоступны**:
   - Проверить API ключи
   - Убедиться в работе прокси
   - Проверить геолокацию

### Логи:
\`\`\`bash
# Просмотр логов
tail -f logs/traffic-router.log

# Отладочный режим
DEBUG=* npm run dev
\`\`\`

## 📞 Поддержка

- **GitHub Issues**: Создайте issue для багов и предложений
- **Документация**: Полная документация в папке `docs/`
- **Примеры**: Примеры конфигураций в `examples/`

## 📄 Лицензия

MIT License - см. файл `LICENSE`

---

**⚠️ Важно**: Используйте систему в соответствии с законодательством вашей страны. Авторы не несут ответственности за неправомерное использование.
