FROM node:20-alpine

WORKDIR /app

# Установка системных зависимостей
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    bash

# Копирование package.json и установка зависимостей
COPY package*.json ./
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN npm run build

# Создание пользователя без root прав
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Настройка прав доступа
RUN chown -R nextjs:nodejs /app
USER nextjs

# Открытие портов
EXPOSE 3000 8080 1080 8082

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Запуск приложения
CMD ["npm", "start"]
