# Мультплатформенный Трафик Роутер с Геолокацией
==========================

## Описание проекта
Мультплатформенное приложение для маршрутизации трафика с сортировкой по географическому принципу. Поддерживает работу через порты 80 и 443, с автоматической детекцией RU трафика и интеграцией с ИИ-сервисами.

## Основные особенности
- Мультиплатформенность (Windows, Linux, macOS, Android, iOS)
- Работа через HTTPS (порты 80/443)
- Автоматическая детекция RU доменов
- Балансировка нагрузки
- Система логирования и мониторинга
- Поддержка ИИ-сервисов
- Раздельные конфигурации для разных платформ

## Структура проекта
\`\`\`plaintext
traffic-router/
├── server/
│   ├── nginx/
│   │   └── config/
│   ├── proxy/
│   └── load-balancer/
├── clients/
│   ├── windows/
│   ├── linux/
│   ├── android/
│   ├── ios/
│   └── common/
├── tests/
└── docs/
\`\`\`

## Установка зависимостей
### Серверная часть
\`\`\`bash
# NGINX и SSL сертификаты
sudo apt-get update && sudo apt-get install nginx certbot python3-certbot-nginx

# GeoIP базы данных
wget http://geolite.maxmind.com/download/geoip/database/GeoLite2-City.mmdb
\`\`\`

### Клиентская часть
#### Windows
\`\`\`powershell
dotnet restore TrafficRouter.Windows
dotnet build TrafficRouter.Windows
\`\`\`

#### Linux/macOS
\`\`\`bash
npm install @types/node typescript ts-node
cp env.example .env
\`\`\`

## Настройка окружения
Создайте файл `.env` в корне проекта:
\`\`\`makefile
SERVER_URL=https://your-server.com
PROXY_PORT=443
GEOIP_DB=/path/to/GeoLite2-City.mmdb
LOG_LEVEL=debug
VIRTUAL_LOCATION=US
\`\`\`

## Конфигурация для разных платформ
### Мобильные устройства (Android/iOS)
\`\`\`json
{
    "platform": "mobile",
    "proxy": {
        "type": "socks5",
        "port": 1080
    },
    "messenger_config": {
        "whatsapp": {
            "web_socket": true,
            "priority": "high"
        },
        "telegram": {
            "mtproto": true,
            "cdn": true
        }
    }
}
\`\`\`

### Десктопные системы
\`\`\`json
{
    "platform": "desktop",
    "proxy": {
        "type": "http",
        "port": 8080
    },
    "ai_services": {
        "openai": {
            "api_key": "your_api_key",
            "priority": "high"
        },
        "dialogflow": {
            "project_id": "your_project_id",
            "credentials": "path/to/credentials.json"
        }
    }
}
\`\`\`

## Запуск серверной части
\`\`\`bash
# Запуск NGINX
sudo nginx -t && sudo systemctl restart nginx

# Запуск прокси-серверов
for port in 1080 1081 1082; do
    node proxy/server.js $port &
done
\`\`\`

## Запуск клиентской части
### Windows
\`\`\`powershell
dotnet run --project TrafficRouter.Windows
\`\`\`

### Linux/macOS
\`\`\`bash
ts-node client/index.ts
\`\`\`

## Тестирование
\`\`\`bash
npm test
\`\`\`

## Мониторинг
Система включает встроенный мониторинг через:
- Лог-файлы в формате JSON
- Метрики производительности
- Систему оповещений о сбоях

## Возможные улучшения
- Добавление GUI для настройки правил маршрутизации
- Реализация автоматического обновления GeoIP базы
- Расширение системы балансировки нагрузки
- Добавление поддержки IPv6

## Для решения проблемы с геолокацией и доступом к ИИ-сервисам предлагается модифицировать существующую архитектуру системы:

\`\`\`mermaid
sequenceDiagram
    participant К as Клиент
    participant М as Маршрутизатор
    participant П as Провайдер
    participant С as Сервер
    
    Note over К,С: Инициализация системы
    
    К->>+М: Запуск приложения
    М->>М: Загрузка правил маршрутизации
    М->>М: Инициализация HTTPS прокси (443)
    
    Note over К,С: Обработка RU трафика
    
    К->>+М: HTTP(S) запрос
    М->>М: Проверка геолокации
    М->>М: Применение правил маршрутизации
    М->>-К: Прямой ответ от RU сервиса
    
    Note over К,С: Обработка не-RU трафика
    
    К->>+М: HTTP(S) запрос
    М->>М: Проверка геолокации
    М->>М: Применение правил маршрутизации
    М->>+С: Туннелирование через HTTPS (443)
    С-->>-М: Ответ от сервера
    М->>-К: Передача ответа
    
    Note over К,С: Распределение нагрузки
    
    К->>+М: Множественные запросы
    М->>М: Балансировка нагрузки
    М->>С: Параллельные HTTPS соединения
\`\`\`

На диаграмме показаны три ключевых процесса:

1. **Инициализация**: запуск приложения и настройка HTTPS прокси
2. **Обработка RU трафика**: прямая маршрутизация без использования туннеля
3. **Обработка не-RU трафика**: туннелирование через HTTPS порт 443 на удалённый сервер

###  Техническая реализация

Для обеспечения корректной работы ИИ-сервисов предлагается следующее решение:

\`\`\`python
class GeoLocationHandler:
    def __init__(self):
        self.virtual_location = {
            'country': 'US',
            'city': 'New York',
            'latitude': 40.7128,
            'longitude': -74.0060
        }
        
    def override_geo(self):
        # Настройка системных переменных
        os.environ['GEO_COUNTRY'] = self.virtual_location['country']
        
        # Конфигурация прокси для геолокации
        return {
            'http': f'http://proxy:{self.get_proxy_port()}',
            'https': f'https://proxy:{self.get_proxy_port()}'
        }
    
    def get_proxy_port(self):
        return 1080  # Стандартный порт для SOCKS5

class AIProxyHandler:
    def __init__(self):
        self.geo_handler = GeoLocationHandler()
        self.ai_services = ['api.openai.com', 'dialogflow.googleapis.com']
        
    def route_ai_request(self, url):
        if any(ai_service in url for ai_service in self.ai_services):
            return self.route_through_virtual_location(url)
        return self.route_normal_traffic(url)
    
    def route_through_virtual_location(self, url):
        proxies = self.geo_handler.override_geo()
        headers = {
            'X-Forwarded-For': self.geo_handler.virtual_location['city'],
            'GeoIP-Country': self.geo_handler.virtual_location['country']
        }
        return requests.get(url, proxies=proxies, headers=headers)
\`\`\`

###  Настройка системы

Создайте файл конфигурации `config.json`:\`\`\`json
{
    "virtual_location": {
        "country": "US",
        "city": "New York",
        "latitude": 40.7128,
        "longitude": -74.0060
    },
    "proxy": {
        "port": 1080,
        "protocol": "socks5"
    },
    "ai_services": [
        "api.openai.com",
        "dialogflow.googleapis.com",
        "*.phind.com"
    ]
}
\`\`\`

Добавьте автоматическое обновление баз данных геолокации:\`\`\`bash
# Добавьте в crontab
0 0 * * * wget http://geolite.maxmind.com/download/geoip/database/GeoLite2-City.mmdb -O /path/to/geoip.db
\`\`\`

###  Безопасность и надёжность

1. **Защита от обнаружения**:
          - Ротация User-Agent заголовков
  - Эмуляция поведения браузера
  - Балансировка нагрузки между прокси


2. **Надёжность работы**:
          - Автоматическое переключение между прокси
  - Резервные серверы для ИИ-сервисов
  - Мониторинг доступности сервисов



###  Рекомендации по использованию

Перед покупкой подписки- Проверьте работу с тестовым API
- Убедитесь в стабильной работе всех сервисов
- Протестируйте скорость ответов

При активации подписки- Настройте отдельный профиль браузера
- Используйте VPN только для нужных сервисов
- Сохраняйте логи для отладки

Этот подход обеспечивает:

- Надёжную работу ИИ-сервисов
- Стабильное обновление баз данных
- Защиту от блокировок
- Возможность масштабирования системы
