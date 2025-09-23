import { MCPClient, MCPUtils } from '../lib/mcp-client'
import { getErrorMessage } from '../lib/error-utils'

/**
 * Пример использования MCP (Model Context Protocol) интеграции
 * Демонстрирует подключение к MCP серверам, вызов инструментов и работу с ресурсами
 */

async function mcpIntegrationExample() {
  console.log('🔌 Пример интеграции MCP (Model Context Protocol)\n')

  // Инициализация MCP клиента
  const mcpClient = new MCPClient('.kiro/settings/mcp.json')

  // Настройка обработчиков событий
  setupEventHandlers(mcpClient)

  try {
    // Подключение ко всем MCP серверам
    console.log('📡 Подключение к MCP серверам...')
    await mcpClient.connectAll()

    // Получение статуса серверов
    await demonstrateServerStatus(mcpClient)

    // Демонстрация работы с инструментами
    await demonstrateTools(mcpClient)

    // Демонстрация работы с ресурсами
    await demonstrateResources(mcpClient)

    // Демонстрация работы с промптами
    await demonstratePrompts(mcpClient)

    // Демонстрация работы с памятью
    await demonstrateMemoryOperations(mcpClient)

    // Демонстрация системного мониторинга
    await demonstrateSystemMonitoring(mcpClient)

  } catch (error) {
    console.error('❌ Ошибка:', getErrorMessage(error))
  } finally {
    await mcpClient.shutdown()
    console.log('🔄 MCP клиент остановлен')
  }
}

// Настройка обработчиков событий
function setupEventHandlers(mcpClient: MCPClient) {
  mcpClient.on('serverConnected', (data) => {
    console.log(`✅ Подключен к серверу: ${data.serverId}`)
  })

  mcpClient.on('serverConnectionFailed', (data) => {
    console.log(`❌ Не удалось подключиться к серверу ${data.serverId}: ${data.error}`)
  })

  mcpClient.on('serverDisconnected', (data) => {
    console.log(`🔌 Отключен от сервера: ${data.serverId}`)
  })

  mcpClient.on('toolCalled', (data) => {
    console.log(`🔧 Вызван инструмент ${data.toolName} на сервере ${data.serverId}`)
  })

  mcpClient.on('toolCallFailed', (data) => {
    console.log(`❌ Ошибка вызова инструмента ${data.toolName}: ${data.error}`)
  })

  mcpClient.on('configurationReloaded', () => {
    console.log('⚙️ Конфигурация MCP перезагружена')
  })
}

// Демонстрация статуса серверов
async function demonstrateServerStatus(mcpClient: MCPClient) {
  console.log('\n📊 Статус MCP серверов\n')

  const serverStatus = mcpClient.getServerStatus()
  const connectedServers = mcpClient.getConnectedServers()

  console.log(`Всего серверов: ${Object.keys(serverStatus).length}`)
  console.log(`Подключенных серверов: ${connectedServers.length}`)

  for (const [serverId, status] of Object.entries(serverStatus)) {
    const statusIcon = status.connected ? '🟢' : '🔴'
    console.log(`${statusIcon} ${serverId}: ${status.connected ? 'подключен' : 'отключен'}`)
    console.log(`   Описание: ${status.config.description || 'Нет описания'}`)
    console.log(`   Команда: ${MCPUtils.getServerInfo(status.config)}`)
  }
}

// Демонстрация работы с инструментами
async function demonstrateTools(mcpClient: MCPClient) {
  console.log('\n🔧 Демонстрация MCP инструментов\n')

  const connectedServers = mcpClient.getConnectedServers()

  for (const serverId of connectedServers) {
    try {
      console.log(`📋 Инструменты сервера ${serverId}:`)
      
      const tools = await mcpClient.getTools(serverId)
      
      if (tools.length === 0) {
        console.log('   Нет доступных инструментов')
        continue
      }

      // Показываем список инструментов
      tools.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.name}: ${tool.description}`)
      })

      // Демонстрируем вызов некоторых инструментов
      await demonstrateSpecificTools(mcpClient, serverId, tools)

    } catch (error) {
      console.log(`   ❌ Ошибка получения инструментов: ${getErrorMessage(error)}`)
    }
  }
}

// Демонстрация конкретных инструментов
async function demonstrateSpecificTools(mcpClient: MCPClient, serverId: string, tools: any[]) {
  // Проверка здоровья системы
  const healthTool = tools.find(t => t.name === 'check_health')
  if (healthTool) {
    try {
      console.log('\n   🏥 Проверка здоровья системы:')
      const healthCall = MCPUtils.createToolCall('check_health', {})
      const healthResult = await mcpClient.callTool(serverId, healthCall)
      
      const healthData = JSON.parse(healthResult.content[0].text)
      console.log(`   Результат: ${JSON.stringify(healthData, null, 4)}`)
    } catch (error) {
      console.log(`   ❌ Ошибка проверки здоровья: ${getErrorMessage(error)}`)
    }
  }

  // Получение системных логов
  const logsTool = tools.find(t => t.name === 'get_logs')
  if (logsTool) {
    try {
      console.log('\n   📋 Получение системных логов:')
      const logsCall = MCPUtils.createToolCall('get_logs', { 
        service: 'system', 
        lines: 5,
        level: 'error'
      })
      const logsResult = await mcpClient.callTool(serverId, logsCall)
      
      const logsData = JSON.parse(logsResult.content[0].text)
      console.log(`   Последние ошибки: ${logsData.lines || 0} строк`)
    } catch (error) {
      console.log(`   ❌ Ошибка получения логов: ${getErrorMessage(error)}`)
    }
  }

  // Получение метрик системы
  const metricsTool = tools.find(t => t.name === 'get_metrics')
  if (metricsTool) {
    try {
      console.log('\n   📊 Получение метрик системы:')
      const metricsCall = MCPUtils.createToolCall('get_metrics', { 
        type: 'all',
        timeframe: 'current'
      })
      const metricsResult = await mcpClient.callTool(serverId, metricsCall)
      
      const metricsData = JSON.parse(metricsResult.content[0].text)
      if (metricsData.success && metricsData.data) {
        if (metricsData.data.cpu) {
          console.log(`   CPU: ${metricsData.data.cpu.usage}%`)
        }
        if (metricsData.data.memory) {
          console.log(`   Память: ${metricsData.data.memory.usage}% (${metricsData.data.memory.used}MB/${metricsData.data.memory.total}MB)`)
        }
      }
    } catch (error) {
      console.log(`   ❌ Ошибка получения метрик: ${getErrorMessage(error)}`)
    }
  }
}

// Демонстрация работы с ресурсами
async function demonstrateResources(mcpClient: MCPClient) {
  console.log('\n📚 Демонстрация MCP ресурсов\n')

  const connectedServers = mcpClient.getConnectedServers()

  for (const serverId of connectedServers) {
    try {
      console.log(`📖 Ресурсы сервера ${serverId}:`)
      
      const resources = await mcpClient.getResources(serverId)
      
      if (resources.length === 0) {
        console.log('   Нет доступных ресурсов')
        continue
      }

      // Показываем список ресурсов
      resources.forEach((resource, index) => {
        console.log(`   ${index + 1}. ${resource.name} (${resource.uri})`)
        console.log(`      ${resource.description}`)
      })

      // Читаем некоторые ресурсы
      await demonstrateSpecificResources(mcpClient, serverId, resources)

    } catch (error) {
      console.log(`   ❌ Ошибка получения ресурсов: ${getErrorMessage(error)}`)
    }
  }
}

// Демонстрация конкретных ресурсов
async function demonstrateSpecificResources(mcpClient: MCPClient, serverId: string, resources: any[]) {
  // Чтение системного статуса
  const statusResource = resources.find(r => r.uri.includes('status'))
  if (statusResource) {
    try {
      console.log('\n   📊 Системный статус:')
      const statusContent = await mcpClient.readResource(serverId, statusResource.uri)
      
      // Показываем первые 500 символов
      const preview = statusContent.length > 500 
        ? statusContent.substring(0, 500) + '...'
        : statusContent
      
      console.log(`   ${preview}`)
    } catch (error) {
      console.log(`   ❌ Ошибка чтения статуса: ${getErrorMessage(error)}`)
    }
  }

  // Чтение метрик
  const metricsResource = resources.find(r => r.uri.includes('metrics'))
  if (metricsResource) {
    try {
      console.log('\n   📈 Системные метрики:')
      const metricsContent = await mcpClient.readResource(serverId, metricsResource.uri)
      
      try {
        const metricsData = JSON.parse(metricsContent)
        console.log(`   CPU: ${metricsData.cpu?.usage || 'N/A'}%`)
        console.log(`   Память: ${metricsData.memory?.usage || 'N/A'}%`)
        console.log(`   Сервисы: ${Object.keys(metricsData.services || {}).length}`)
      } catch {
        console.log(`   Данные: ${metricsContent.substring(0, 200)}...`)
      }
    } catch (error) {
      console.log(`   ❌ Ошибка чтения метрик: ${getErrorMessage(error)}`)
    }
  }
}

// Демонстрация работы с промптами
async function demonstratePrompts(mcpClient: MCPClient) {
  console.log('\n💭 Демонстрация MCP промптов\n')

  const connectedServers = mcpClient.getConnectedServers()

  for (const serverId of connectedServers) {
    try {
      console.log(`🎯 Промпты сервера ${serverId}:`)
      
      const prompts = await mcpClient.getPrompts(serverId)
      
      if (prompts.length === 0) {
        console.log('   Нет доступных промптов')
        continue
      }

      // Показываем список промптов
      prompts.forEach((prompt, index) => {
        console.log(`   ${index + 1}. ${prompt.name}: ${prompt.description}`)
      })

      // Демонстрируем получение промптов
      await demonstrateSpecificPrompts(mcpClient, serverId, prompts)

    } catch (error) {
      console.log(`   ❌ Ошибка получения промптов: ${getErrorMessage(error)}`)
    }
  }
}

// Демонстрация конкретных промптов
async function demonstrateSpecificPrompts(mcpClient: MCPClient, serverId: string, prompts: any[]) {
  // Системная диагностика
  const diagnosisPrompt = prompts.find(p => p.name === 'system_diagnosis')
  if (diagnosisPrompt) {
    try {
      console.log('\n   🔍 Промпт системной диагностики:')
      const promptResult = await mcpClient.getPrompt(serverId, 'system_diagnosis', { 
        severity: 'medium' 
      })
      
      if (promptResult.messages && promptResult.messages.length > 0) {
        const promptText = promptResult.messages[0].content.text
        console.log(`   ${promptText.substring(0, 300)}...`)
      }
    } catch (error) {
      console.log(`   ❌ Ошибка получения промпта диагностики: ${getErrorMessage(error)}`)
    }
  }

  // Восстановление сервиса
  const recoveryPrompt = prompts.find(p => p.name === 'service_recovery')
  if (recoveryPrompt) {
    try {
      console.log('\n   🔧 Промпт восстановления сервиса:')
      const promptResult = await mcpClient.getPrompt(serverId, 'service_recovery', { 
        service: 'ai-proxy',
        error: 'Connection timeout'
      })
      
      if (promptResult.messages && promptResult.messages.length > 0) {
        const promptText = promptResult.messages[0].content.text
        console.log(`   ${promptText.substring(0, 300)}...`)
      }
    } catch (error) {
      console.log(`   ❌ Ошибка получения промпта восстановления: ${getErrorMessage(error)}`)
    }
  }
}

// Демонстрация операций с памятью
async function demonstrateMemoryOperations(mcpClient: MCPClient) {
  console.log('\n🧠 Демонстрация операций с памятью\n')

  const memoryServerId = 'memory-mcp'
  
  if (!mcpClient.isServerConnected(memoryServerId)) {
    console.log('❌ Memory MCP сервер не подключен')
    return
  }

  try {
    // Создание записи в памяти
    console.log('📝 Создание записи в памяти:')
    const updateCall = MCPUtils.createToolCall('update_memory', {
      entity: 'test-entity',
      content: 'Это тестовая запись в памяти AI агента',
      type: 'fact'
    })
    
    const updateResult = await mcpClient.callTool(memoryServerId, updateCall)
    const updateData = JSON.parse(updateResult.content[0].text)
    console.log(`   ${updateData.success ? '✅' : '❌'} ${updateData.message}`)

    // Чтение памяти
    console.log('\n📖 Чтение памяти:')
    const readCall = MCPUtils.createToolCall('read_memory', {
      entity: 'test-entity'
    })
    
    const readResult = await mcpClient.callTool(memoryServerId, readCall)
    const readData = JSON.parse(readResult.content[0].text)
    
    if (readData.success) {
      console.log(`   Содержимое памяти (${readData.content.length} символов):`)
      console.log(`   ${readData.content.substring(0, 200)}...`)
    }

    // Поиск в памяти
    console.log('\n🔍 Поиск в памяти:')
    const searchCall = MCPUtils.createToolCall('search_memory', {
      query: 'тестовая',
      limit: 5
    })
    
    const searchResult = await mcpClient.callTool(memoryServerId, searchCall)
    const searchData = JSON.parse(searchResult.content[0].text)
    
    if (searchData.success) {
      console.log(`   Найдено результатов: ${searchData.results.length}`)
      searchData.results.forEach((result: any, index: number) => {
        console.log(`   ${index + 1}. ${result.entity}: ${result.match}`)
      })
    }

    // Статистика памяти
    console.log('\n📊 Статистика памяти:')
    const statsCall = MCPUtils.createToolCall('get_memory_stats', {})
    
    const statsResult = await mcpClient.callTool(memoryServerId, statsCall)
    const statsData = JSON.parse(statsResult.content[0].text)
    
    if (statsData.success) {
      console.log(`   Сущностей: ${statsData.stats.entities.count}`)
      console.log(`   Сессий: ${statsData.stats.sessions.count}`)
      console.log(`   Размер: ${statsData.stats.storage.totalSizeMB} MB`)
    }

  } catch (error) {
    console.log(`❌ Ошибка операций с памятью: ${getErrorMessage(error)}`)
  }
}

// Демонстрация системного мониторинга
async function demonstrateSystemMonitoring(mcpClient: MCPClient) {
  console.log('\n📊 Демонстрация системного мониторинга\n')

  const monitorServerId = 'system-monitor-mcp'
  
  if (!mcpClient.isServerConnected(monitorServerId)) {
    console.log('❌ System Monitor MCP сервер не подключен')
    return
  }

  try {
    // Получение текущих метрик
    console.log('📈 Текущие метрики системы:')
    const metricsCall = MCPUtils.createToolCall('get_metrics', {
      type: 'all',
      timeframe: 'current'
    })
    
    const metricsResult = await mcpClient.callTool(monitorServerId, metricsCall)
    const metricsData = JSON.parse(metricsResult.content[0].text)
    
    if (metricsData.success && metricsData.data) {
      if (metricsData.data.cpu) {
        console.log(`   🖥️ CPU: ${metricsData.data.cpu.usage}% (${metricsData.data.cpu.cores} ядер)`)
      }
      if (metricsData.data.memory) {
        console.log(`   💾 Память: ${metricsData.data.memory.usage}% (${metricsData.data.memory.used}/${metricsData.data.memory.total} MB)`)
      }
      if (metricsData.data.disk && metricsData.data.disk.length > 0) {
        metricsData.data.disk.forEach((disk: any) => {
          console.log(`   💿 Диск ${disk.device}: ${disk.usage}% (${disk.usedGB}/${disk.totalGB} GB)`)
        })
      }
    }

    // Проверка сервисов
    console.log('\n🔧 Статус сервисов:')
    const servicesCall = MCPUtils.createToolCall('check_services', {})
    
    const servicesResult = await mcpClient.callTool(monitorServerId, servicesCall)
    const servicesData = JSON.parse(servicesResult.content[0].text)
    
    if (servicesData.success) {
      console.log(`   Всего сервисов: ${servicesData.summary.total}`)
      console.log(`   Здоровых: ${servicesData.summary.healthy}`)
      console.log(`   Проблемных: ${servicesData.summary.unhealthy}`)
      
      Object.entries(servicesData.services).forEach(([service, status]: [string, any]) => {
        const statusIcon = status.status === 'healthy' ? '🟢' : '🔴'
        console.log(`   ${statusIcon} ${service}: ${status.status}`)
      })
    }

    // Получение алертов
    console.log('\n🚨 Системные алерты:')
    const alertsCall = MCPUtils.createToolCall('get_alerts', {
      limit: 10
    })
    
    const alertsResult = await mcpClient.callTool(monitorServerId, alertsCall)
    const alertsData = JSON.parse(alertsResult.content[0].text)
    
    if (alertsData.success) {
      if (alertsData.alerts.length === 0) {
        console.log('   ✅ Нет активных алертов')
      } else {
        console.log(`   Активных алертов: ${alertsData.alerts.length}`)
        alertsData.alerts.slice(0, 5).forEach((alert: any) => {
          const severityIcon: { [key: string]: string } = {
            'critical': '🔴',
            'high': '🟠', 
            'medium': '🟡',
            'low': '🟢'
          }
          const icon = severityIcon[alert.severity] || '⚪'
          
          console.log(`   ${icon} [${alert.severity.toUpperCase()}] ${alert.category}: ${alert.message}`)
        })
      }
    }

  } catch (error) {
    console.log(`❌ Ошибка системного мониторинга: ${getErrorMessage(error)}`)
  }
}

// Запуск примера
if (require.main === module) {
  mcpIntegrationExample()
    .then(() => {
      console.log('\n🎉 Пример MCP интеграции завершен успешно!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Ошибка выполнения примера:', error)
      process.exit(1)
    })
}

export { mcpIntegrationExample }