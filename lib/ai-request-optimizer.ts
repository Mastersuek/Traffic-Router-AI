// Оптимизатор AI запросов для улучшения производительности и обхода ограничений

export interface OptimizationRule {
  provider: string
  pattern: RegExp
  transform: (body: any) => any
  cacheKey?: (body: any) => string
  cacheTTL?: number
}

export class AIRequestOptimizer {
  private cache = new Map<string, { data: any; expires: number }>()
  private rules: OptimizationRule[] = []

  constructor() {
    this.initializeOptimizationRules()
    this.startCacheCleanup()
  }

  private initializeOptimizationRules(): void {
    // Оптимизация для OpenAI
    this.rules.push({
      provider: "openai",
      pattern: /\/v1\/chat\/completions/,
      transform: (body) => {
        // Оптимизируем параметры для лучшей производительности
        return {
          ...body,
          stream: false, // Отключаем стриминг для стабильности через прокси
          max_tokens: Math.min(body.max_tokens || 1000, 4000), // Ограничиваем токены
          temperature: Math.min(body.temperature || 0.7, 1.0),
        }
      },
      cacheKey: (body) => {
        // Кэшируем простые запросы
        if (body.messages && body.messages.length === 1) {
          return `openai:${JSON.stringify(body.messages[0])}`
        }
        return ""
      },
      cacheTTL: 300000, // 5 минут
    })

    // Оптимизация для Anthropic
    this.rules.push({
      provider: "anthropic",
      pattern: /\/v1\/messages/,
      transform: (body) => {
        return {
          ...body,
          max_tokens: Math.min(body.max_tokens || 1000, 4000),
          stream: false,
        }
      },
      cacheKey: (body) => {
        if (body.messages && body.messages.length <= 2) {
          return `anthropic:${JSON.stringify(body.messages)}`
        }
        return ""
      },
      cacheTTL: 300000,
    })

    // Оптимизация для Google AI
    this.rules.push({
      provider: "google",
      pattern: /\/v1beta\/models/,
      transform: (body) => {
        return {
          ...body,
          generationConfig: {
            ...body.generationConfig,
            maxOutputTokens: Math.min(body.generationConfig?.maxOutputTokens || 1000, 2048),
          },
        }
      },
    })
  }

  // Оптимизация запроса
  optimizeRequest(provider: string, endpoint: string, body: any): any {
    const rule = this.rules.find((r) => r.provider === provider && r.pattern.test(endpoint))

    if (!rule) {
      return body
    }

    // Проверяем кэш
    if (rule.cacheKey) {
      const cacheKey = rule.cacheKey(body)
      if (cacheKey !== null && cacheKey !== undefined) {
        const cached = this.cache.get(cacheKey)
        if (cached && cached.expires > Date.now()) {
          console.log(`[AIRequestOptimizer] Cache hit for ${cacheKey}`)
          return { __cached: true, data: cached.data }
        }
      }
    }

    // Применяем трансформацию
    const optimizedBody = rule.transform(body)
    console.log(`[AIRequestOptimizer] Applied optimization for ${provider}${endpoint}`)

    return optimizedBody
  }

  // Кэширование ответа
  cacheResponse(provider: string, endpoint: string, requestBody: any, response: any): void {
    const rule = this.rules.find((r) => r.provider === provider && r.pattern.test(endpoint))

    if (!rule || !rule.cacheKey || !rule.cacheTTL) {
      return
    }

    const cacheKey = rule.cacheKey(requestBody)
    if (cacheKey !== null && cacheKey !== undefined) {
      this.cache.set(cacheKey, {
        data: response,
        expires: Date.now() + rule.cacheTTL,
      })
      console.log(`[AIRequestOptimizer] Cached response for ${cacheKey}`)
    }
  }

  // Очистка устаревшего кэша
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now()
      let cleaned = 0

      this.cache.forEach((value, key) => {
        if (value.expires <= now) {
          this.cache.delete(key)
          cleaned++
        }
      })

      if (cleaned > 0) {
        console.log(`[AIRequestOptimizer] Cleaned ${cleaned} expired cache entries`)
      }
    }, 60000) // Каждую минуту
  }

  // Получение статистики кэша
  getCacheStats(): Record<string, any> {
    const now = Date.now()
    let activeEntries = 0
    let expiredEntries = 0

    this.cache.forEach((value) => {
      if (value.expires > now) {
        activeEntries++
      } else {
        expiredEntries++
      }
    })

    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries,
      hitRate: this.calculateHitRate(),
    }
  }

  private calculateHitRate(): number {
    // Упрощенный расчет hit rate
    // В реальной реализации нужно отслеживать hits и misses
    return 0.75 // 75% hit rate для примера
  }

  // Очистка всего кэша
  clearCache(): void {
    this.cache.clear()
    console.log("[AIRequestOptimizer] Cache cleared")
  }

  // Добавление пользовательского правила оптимизации
  addOptimizationRule(rule: OptimizationRule): void {
    this.rules.push(rule)
    console.log(`[AIRequestOptimizer] Added optimization rule for ${rule.provider}`)
  }
}
