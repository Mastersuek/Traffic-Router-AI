#!/usr/bin/env node

/**
 * Пример использования системы алиасов моделей
 * 
 * Этот файл демонстрирует основные возможности:
 * - Инициализация фабрики моделей
 * - Отправка запросов к различным моделям
 * - Использование fallback логики
 * - Проверка здоровья моделей
 * - Управление конфигурацией
 */

import { AIModelFactory } from '../lib/ai-model-factory'
import type { ModelRequest } from '../lib/model-alias-manager'

async function main() {
  console.log('🚀 Запуск примера системы алиасов моделей...\n')

  // Создание фабрики с отслеживанием изменений конфигурации
  const factory = new AIModelFactory({
    enableConfigWatch: true,
    logLevel: 'info'
  })

  // Настройка обработчиков событий
  factory.on('initialized', () => {
    console.log('✅ Фабрика моделей инициализирована')
  })

  factory.on('requestSuccess', (data) => {
    console.log(`✅ Успешный запрос к модели: ${data.model} (${data.provider})`)
  })

  factory.on('requestFailed', (data) => {
    console.log(`❌ Ошибка запроса к модели: ${data.model} (${data.provider})`)
  })

  factory.on('fallbackSuccess', (data) => {
    console.log(`🔄 Успешный fallback: ${data.originalModel} -> ${data.fallbackModel}`)
  })

  factory.on('configReloaded', () => {
    console.log('🔄 Конфигурация перезагружена')
  })

  try {
    // Инициализация
    await factory.initialize()

    // Получение информации о доступных моделях
    console.log('\n📋 Доступные модели:')
    const models = factory.getAvailableModels()
    models.forEach(model => {
      console.log(`  - ${model.alias}: ${model.provider}:${model.model} (приоритет: ${model.priority})`)
    })

    // Пример простого запроса
    console.log('\n💬 Отправка простого запроса...')
    const simpleRequest: ModelRequest = {
      messages: [
        { role: 'user', content: 'Привет! Как дела?' }
      ],
      maxTokens: 100,
      temperature: 0.7
    }

    try {
      // Попытка использовать модель по умолчанию
      const response = await factory.sendDefaultRequest(simpleRequest)
      console.log(`📝 Ответ от ${response.model} (${response.provider}):`)
      console.log(`   "${response.content}"`)
      
      if (response.usage) {
        console.log(`📊 Использование токенов: ${response.usage.totalTokens} (${response.usage.promptTokens} + ${response.usage.completionTokens})`)
      }
    } catch (error) {
      console.log(`❌ Ошибка при отправке запроса: ${error}`)
    }

    // Пример запроса к конкретной модели
    console.log('\n💬 Отправка запроса к конкретной модели...')
    const specificRequest: ModelRequest = {
      messages: [
        { role: 'system', content: 'Ты полезный ассистент, который отвечает кратко и по делу.' },
        { role: 'user', content: 'Объясни что такое машинное обучение в двух предложениях.' }
      ],
      maxTokens: 150,
      temperature: 0.5
    }

    try {
      // Попытка использовать GPT-3.5 (если доступен)
      const gpt35Response = await factory.sendRequest('gpt-3.5', specificRequest)
      console.log(`📝 Ответ от GPT-3.5:`)
      console.log(`   "${gpt35Response.content}"`)
    } catch (error) {
      console.log(`❌ GPT-3.5 недоступен: ${error}`)
      
      // Попытка использовать Claude (fallback сработает автоматически)
      try {
        const claudeResponse = await factory.sendRequest('claude-3-haiku', specificRequest)
        console.log(`📝 Ответ от Claude Haiku:`)
        console.log(`   "${claudeResponse.content}"`)
      } catch (claudeError) {
        console.log(`❌ Claude также недоступен: ${claudeError}`)
      }
    }

    // Проверка здоровья моделей
    console.log('\n🏥 Проверка здоровья моделей...')
    const healthResults = await factory.healthCheckAll()
    
    Object.entries(healthResults).forEach(([alias, isHealthy]) => {
      const status = isHealthy ? '✅ Здорова' : '❌ Недоступна'
      console.log(`  ${alias}: ${status}`)
    })

    // Получение статистики
    console.log('\n📊 Статистика использования:')
    const stats = factory.getStats()
    Object.entries(stats).forEach(([alias, stat]) => {
      console.log(`  ${alias}: ${stat.requests} запросов, ${stat.failures} ошибок`)
    })

    // Пример работы с конфигурацией
    console.log('\n⚙️ Информация о конфигурации:')
    const info = factory.getInfo()
    console.log(`  Путь к конфигурации: ${info.configPath}`)
    console.log(`  Конфигурация существует: ${info.configExists}`)
    console.log(`  Количество моделей: ${info.modelsCount}`)

    // Создание резервной копии конфигурации
    console.log('\n💾 Создание резервной копии конфигурации...')
    try {
      const backupPath = await factory.backupConfig()
      console.log(`✅ Резервная копия создана: ${backupPath}`)
    } catch (error) {
      console.log(`❌ Ошибка создания резервной копии: ${error}`)
    }

    // Демонстрация обновления конфигурации модели
    console.log('\n🔧 Обновление конфигурации модели...')
    try {
      const currentConfig = factory.getCurrentConfig()
      
      // Найдем модель для обновления
      const modelToUpdate = currentConfig.models.find(m => m.alias === 'gpt-3.5')
      if (modelToUpdate) {
        // Обновим температуру
        factory.updateModel('gpt-3.5', { temperature: 0.9 })
        console.log('✅ Температура модели gpt-3.5 обновлена до 0.9')
      }
    } catch (error) {
      console.log(`❌ Ошибка обновления модели: ${error}`)
    }

    console.log('\n🎉 Пример завершен успешно!')

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    // Graceful shutdown
    console.log('\n🛑 Завершение работы...')
    await factory.shutdown()
  }
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n🛑 Получен сигнал SIGINT, завершение работы...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Получен сигнал SIGTERM, завершение работы...')
  process.exit(0)
})

// Запуск примера
if (require.main === module) {
  main().catch(console.error)
}

export { main as runExample }