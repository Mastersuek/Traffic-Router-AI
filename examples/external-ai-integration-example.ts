import { AIModelFactory } from '../lib/ai-model-factory'
import { ExternalAIIntegrator } from '../lib/external-ai-integrator'
import { getErrorMessage } from '../lib/error-utils'

/**
 * Пример использования интеграции с внешними AI системами
 * Демонстрирует интеллектуальную маршрутизацию, fallback логику и мониторинг
 */

async function externalAIIntegrationExample() {
  console.log('🤖 Пример интеграции с внешними AI системами\n')

  // Инициализация AI Model Factory с поддержкой внешних систем
  const aiFactory = new AIModelFactory({
    enableIntelligentRouting: true,
    enableConfigWatch: true,
    logLevel: 'info'
  })

  // Настройка обработчиков событий
  setupEventHandlers(aiFactory)

  try {
    // Инициализация системы
    console.log('📡 Инициализация AI Model Factory...')
    await aiFactory.initialize()
    
    // Получение информации о системе
    const info = aiFactory.getInfo()
    console.log('ℹ️ Информация о системе:', {
      модели: info.modelsCount,
      интеллектуальнаяМаршрутизация: info.intelligentRoutingEnabled,
      внешниеИнтеграции: info.externalAIIntegratorAvailable
    })

    // Демонстрация различных способов отправки запросов
    await demonstrateRequestMethods(aiFactory)

    // Демонстрация мониторинга и статистики
    await demonstrateMonitoring(aiFactory)

    // Демонстрация управления конфигурацией
    await demonstrateConfigurationManagement(aiFactory)

  } catch (error) {
    console.error('❌ Ошибка:', getErrorMessage(error))
  } finally {
    await aiFactory.shutdown()
    console.log('🔄 AI Model Factory остановлен')
  }
}

// Настройка обработчиков событий
function setupEventHandlers(aiFactory: AIModelFactory) {
  aiFactory.on('initialized', () => {
    console.log('✅ AI Model Factory инициализирован')
  })

  aiFactory.on('requestSuccess', (data) => {
    console.log(`✅ Успешный запрос к ${data.model} (${data.provider})`)
  })

  aiFactory.on('requestFailed', (data) => {
    console.log(`❌ Неудачный запрос к ${data.model} (${data.provider}):`, data.error?.message)
  })

  aiFactory.on('intelligentRoutingSuccess', (data) => {
    console.log(`🎯 Интеллектуальная маршрутизация: выбрана модель ${data.selectedModel}, латентность: ${data.latency}мс`)
  })

  aiFactory.on('circuitBreakerOpened', (data) => {
    console.log(`🚨 Circuit breaker открыт для провайдера ${data.provider} (ошибок: ${data.failureRate}%)`)
  })

  aiFactory.on('providerUnavailable', (data) => {
    console.log(`⚠️ Провайдер ${data.provider} недоступен: ${data.error}`)
  })

  aiFactory.on('rateLimitExceeded', (data) => {
    console.log(`⏱️ Превышен лимит запросов для ${data.provider}`)
  })
}

// Демонстрация различных методов отправки запросов
async function demonstrateRequestMethods(aiFactory: AIModelFactory) {
  console.log('\n📤 Демонстрация методов отправки запросов\n')

  const testMessage = {
    messages: [
      { role: 'user' as const, content: 'Привет! Ответь кратко на русском языке.' }
    ],
    maxTokens: 50,
    temperature: 0.7
  }

  try {
    // 1. Запрос к конкретной модели
    console.log('1️⃣ Запрос к конкретной модели (gpt-4):')
    try {
      const response1 = await aiFactory.sendRequest('gpt-4', testMessage)
      console.log(`   Ответ: ${response1.content.substring(0, 100)}...`)
      console.log(`   Модель: ${response1.model}, Провайдер: ${response1.provider}`)
    } catch (error) {
      console.log(`   ❌ Ошибка: ${getErrorMessage(error)}`)
    }

    // 2. Запрос к модели по умолчанию
    console.log('\n2️⃣ Запрос к модели по умолчанию:')
    try {
      const response2 = await aiFactory.sendDefaultRequest(testMessage)
      console.log(`   Ответ: ${response2.content.substring(0, 100)}...`)
      console.log(`   Модель: ${response2.model}, Провайдер: ${response2.provider}`)
    } catch (error) {
      console.log(`   ❌ Ошибка: ${getErrorMessage(error)}`)
    }

    // 3. Интеллектуальная маршрутизация
    console.log('\n3️⃣ Интеллектуальная маршрутизация:')
    try {
      const response3 = await aiFactory.sendIntelligentRequest(testMessage)
      console.log(`   Ответ: ${response3.content.substring(0, 100)}...`)
      console.log(`   Модель: ${response3.model}, Провайдер: ${response3.provider}`)
    } catch (error) {
      console.log(`   ❌ Ошибка: ${getErrorMessage(error)}`)
    }

    // 4. Интеллектуальная маршрутизация с предпочтительной моделью
    console.log('\n4️⃣ Интеллектуальная маршрутизация с предпочтением (groq):')
    try {
      const response4 = await aiFactory.sendIntelligentRequest(testMessage, 'llama-3.1-8b-groq')
      console.log(`   Ответ: ${response4.content.substring(0, 100)}...`)
      console.log(`   Модель: ${response4.model}, Провайдер: ${response4.provider}`)
    } catch (error) {
      console.log(`   ❌ Ошибка: ${getErrorMessage(error)}`)
    }

  } catch (error) {
    console.log(`❌ Общая ошибка демонстрации запросов: ${getErrorMessage(error)}`)
  }
}

// Демонстрация мониторинга и статистики
async function demonstrateMonitoring(aiFactory: AIModelFactory) {
  console.log('\n📊 Демонстрация мониторинга и статистики\n')

  try {
    // Статистика моделей
    console.log('1️⃣ Статистика использования моделей:')
    const modelStats = aiFactory.getStats()
    for (const [model, stats] of Object.entries(modelStats)) {
      console.log(`   ${model}: запросов=${stats.requests}, успешных=${stats.failures}, ошибок=${stats.failures}`)
    }

    // Статистика внешних провайдеров
    console.log('\n2️⃣ Статистика внешних AI провайдеров:')
    const externalStats = aiFactory.getExternalAIStats()
    if (externalStats) {
      for (const [provider, stats] of Object.entries(externalStats)) {
        console.log(`   ${provider}:`)
        console.log(`     Запросов: ${stats.requestCount}`)
        console.log(`     Успешных: ${stats.successCount}`)
        console.log(`     Ошибок: ${stats.failureCount}`)
        console.log(`     Средняя латентность: ${stats.avgLatency}мс`)
        console.log(`     Circuit breaker: ${stats.circuitBreakerOpen ? 'открыт' : 'закрыт'}`)
        console.log(`     Тип: ${stats.provider.type}, Стоимость: ${stats.provider.costTier}`)
      }
    } else {
      console.log('   Статистика внешних провайдеров недоступна')
    }

    // Проверка здоровья
    console.log('\n3️⃣ Проверка здоровья провайдеров:')
    const healthResults = await aiFactory.healthCheckExternalProviders()
    for (const [provider, isHealthy] of Object.entries(healthResults)) {
      console.log(`   ${provider}: ${isHealthy ? '✅ здоров' : '❌ недоступен'}`)
    }

    // Рекомендации по оптимизации
    console.log('\n4️⃣ Рекомендации по оптимизации:')
    const recommendations = aiFactory.getOptimizationRecommendations()
    if (recommendations.length > 0) {
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`)
      })
    } else {
      console.log('   Рекомендаций нет - система работает оптимально')
    }

  } catch (error) {
    console.log(`❌ Ошибка мониторинга: ${getErrorMessage(error)}`)
  }
}

// Демонстрация управления конфигурацией
async function demonstrateConfigurationManagement(aiFactory: AIModelFactory) {
  console.log('\n⚙️ Демонстрация управления конфигурацией\n')

  try {
    // Получение текущей конфигурации
    console.log('1️⃣ Текущая конфигурация:')
    const currentConfig = aiFactory.getCurrentConfig()
    console.log(`   Модель по умолчанию: ${currentConfig.defaultModel}`)
    console.log(`   Количество моделей: ${currentConfig.models.length}`)
    console.log(`   Fallback включен: ${currentConfig.fallback.enabled}`)

    // Обновление конфигурации интеллектуальной маршрутизации
    console.log('\n2️⃣ Обновление конфигурации интеллектуальной маршрутизации:')
    aiFactory.updateIntelligentRoutingConfig({
      costOptimization: true,
      latencyOptimization: false,
      reliabilityThreshold: 85
    })
    console.log('   ✅ Конфигурация обновлена')

    // Управление интеллектуальной маршрутизацией
    console.log('\n3️⃣ Управление интеллектуальной маршрутизацией:')
    console.log('   Отключение интеллектуальной маршрутизации...')
    aiFactory.setIntelligentRouting(false)
    console.log(`   Статус: ${aiFactory.getInfo().intelligentRoutingEnabled ? 'включена' : 'отключена'}`)
    
    console.log('   Включение интеллектуальной маршрутизации...')
    aiFactory.setIntelligentRouting(true)
    console.log(`   Статус: ${aiFactory.getInfo().intelligentRoutingEnabled ? 'включена' : 'отключена'}`)

    // Сброс метрик
    console.log('\n4️⃣ Сброс метрик провайдера:')
    aiFactory.resetProviderMetrics('openai')
    console.log('   ✅ Метрики провайдера OpenAI сброшены')

    // Создание резервной копии
    console.log('\n5️⃣ Создание резервной копии конфигурации:')
    try {
      const backupPath = await aiFactory.backupConfig()
      console.log(`   ✅ Резервная копия создана: ${backupPath}`)
    } catch (error) {
      console.log(`   ❌ Ошибка создания резервной копии: ${getErrorMessage(error)}`)
    }

  } catch (error) {
    console.log(`❌ Ошибка управления конфигурацией: ${getErrorMessage(error)}`)
  }
}

// Демонстрация обработки ошибок и fallback логики
async function demonstrateFallbackLogic(aiFactory: AIModelFactory) {
  console.log('\n🔄 Демонстрация fallback логики\n')

  const testMessage = {
    messages: [
      { role: 'user' as const, content: 'Тестовое сообщение для демонстрации fallback' }
    ],
    maxTokens: 30
  }

  try {
    // Попытка запроса к несуществующей модели
    console.log('1️⃣ Запрос к несуществующей модели:')
    try {
      await aiFactory.sendRequest('non-existent-model', testMessage)
    } catch (error) {
      console.log(`   ❌ Ожидаемая ошибка: ${getErrorMessage(error)}`)
    }

    // Интеллектуальная маршрутизация автоматически выберет доступную модель
    console.log('\n2️⃣ Интеллектуальная маршрутизация с автоматическим выбором:')
    try {
      const response = await aiFactory.sendIntelligentRequest(testMessage)
      console.log(`   ✅ Успешно выбрана модель: ${response.model} (${response.provider})`)
    } catch (error) {
      console.log(`   ❌ Все модели недоступны: ${getErrorMessage(error)}`)
    }

  } catch (error) {
    console.log(`❌ Ошибка демонстрации fallback: ${getErrorMessage(error)}`)
  }
}

// Запуск примера
if (require.main === module) {
  externalAIIntegrationExample()
    .then(() => {
      console.log('\n🎉 Пример завершен успешно!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Ошибка выполнения примера:', error)
      process.exit(1)
    })
}

export { externalAIIntegrationExample }