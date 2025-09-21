#!/bin/bash

# Скрипт настройки окружения для прокси-сервера

echo "Setting up Traffic Router Proxy Environment..."

# Создание директорий
mkdir -p /opt/traffic-router/{config,logs,data,certs}
mkdir -p /var/log/traffic-router

# Установка зависимостей
echo "Installing dependencies..."

# Node.js и npm (если не установлены)
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Дополнительные системные пакеты
sudo apt-get update
sudo apt-get install -y \
    nginx \
    certbot \
    python3-certbot-nginx \
    iptables-persistent \
    fail2ban \
    htop \
    curl \
    wget \
    unzip

# Настройка файрвола
echo "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 1080/tcp
sudo ufw allow 8080/tcp
sudo ufw --force enable

# Настройка системных лимитов
echo "Configuring system limits..."
cat << EOF | sudo tee -a /etc/security/limits.conf
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
EOF

# Настройка sysctl для высокой нагрузки
cat << EOF | sudo tee -a /etc/sysctl.conf
# Traffic Router optimizations
net.core.somaxconn = 65536
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 60
net.ipv4.tcp_keepalive_probes = 3
net.ipv4.ip_local_port_range = 1024 65535
EOF

sudo sysctl -p

# Создание пользователя для сервиса
sudo useradd -r -s /bin/false -d /opt/traffic-router traffic-router
sudo chown -R traffic-router:traffic-router /opt/traffic-router
sudo chown -R traffic-router:traffic-router /var/log/traffic-router

# Создание systemd сервиса
cat << EOF | sudo tee /etc/systemd/system/traffic-router.service
[Unit]
Description=Traffic Router Proxy Service
After=network.target

[Service]
Type=simple
User=traffic-router
Group=traffic-router
WorkingDirectory=/opt/traffic-router
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=traffic-router

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/traffic-router /var/log/traffic-router

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768

[Install]
WantedBy=multi-user.target
EOF

# Перезагрузка systemd
sudo systemctl daemon-reload

# Настройка логротации
cat << EOF | sudo tee /etc/logrotate.d/traffic-router
/var/log/traffic-router/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 traffic-router traffic-router
    postrotate
        systemctl reload traffic-router
    endscript
}
EOF

# Создание конфигурационных файлов
cat << EOF > /opt/traffic-router/config/production.json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8080,
    "workers": 4
  },
  "proxy": {
    "timeout": 30000,
    "retries": 3,
    "keepAlive": true
  },
  "logging": {
    "level": "info",
    "file": "/var/log/traffic-router/app.log",
    "maxSize": "100MB",
    "maxFiles": 10
  },
  "security": {
    "rateLimit": {
      "windowMs": 900000,
      "max": 1000
    },
    "cors": {
      "enabled": true,
      "origins": ["*"]
    }
  }
}
EOF

# Загрузка GeoIP базы данных
echo "Downloading GeoIP database..."
cd /opt/traffic-router/data
wget -O GeoLite2-City.mmdb.gz "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_LICENSE_KEY&suffix=tar.gz"
gunzip GeoLite2-City.mmdb.gz 2>/dev/null || echo "GeoIP database download may have failed - please check your MaxMind license key"

# Настройка cron для обновления GeoIP базы
cat << EOF | sudo crontab -u traffic-router -
# Update GeoIP database daily at 3 AM
0 3 * * * cd /opt/traffic-router/data && wget -O GeoLite2-City.mmdb.gz "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_LICENSE_KEY&suffix=tar.gz" && gunzip -f GeoLite2-City.mmdb.gz

# Restart service weekly for memory cleanup
0 4 * * 0 systemctl restart traffic-router
EOF

# Создание скрипта мониторинга
cat << 'EOF' > /opt/traffic-router/scripts/monitor.sh
#!/bin/bash

# Мониторинг состояния Traffic Router

LOG_FILE="/var/log/traffic-router/monitor.log"
SERVICE_NAME="traffic-router"

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Проверка состояния сервиса
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    log_message "ERROR: Service $SERVICE_NAME is not running. Attempting restart..."
    systemctl restart "$SERVICE_NAME"
    
    sleep 10
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_message "INFO: Service $SERVICE_NAME restarted successfully"
    else
        log_message "CRITICAL: Failed to restart service $SERVICE_NAME"
    fi
else
    log_message "INFO: Service $SERVICE_NAME is running normally"
fi

# Проверка использования памяти
MEMORY_USAGE=$(ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem -C node | head -2 | tail -1 | awk '{print $4}')
if (( $(echo "$MEMORY_USAGE > 80" | bc -l) )); then
    log_message "WARNING: High memory usage detected: ${MEMORY_USAGE}%"
fi

# Проверка дискового пространства
DISK_USAGE=$(df /opt/traffic-router | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
    log_message "WARNING: High disk usage detected: ${DISK_USAGE}%"
fi

# Проверка логов на ошибки
ERROR_COUNT=$(tail -100 /var/log/traffic-router/app.log | grep -c "ERROR\|CRITICAL" || echo "0")
if [ "$ERROR_COUNT" -gt 10 ]; then
    log_message "WARNING: High error count in logs: $ERROR_COUNT errors in last 100 lines"
fi
EOF

chmod +x /opt/traffic-router/scripts/monitor.sh

# Добавление мониторинга в cron
echo "*/5 * * * * /opt/traffic-router/scripts/monitor.sh" | sudo crontab -u traffic-router -

echo "Traffic Router environment setup completed!"
echo ""
echo "Next steps:"
echo "1. Configure your proxy endpoints in /opt/traffic-router/config/proxy-config.json"
echo "2. Update MaxMind license key in cron job"
echo "3. Start the service: sudo systemctl start traffic-router"
echo "4. Enable auto-start: sudo systemctl enable traffic-router"
echo "5. Check logs: sudo journalctl -u traffic-router -f"
