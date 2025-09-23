// Polyfill для fetch с поддержкой timeout в Node.js окружении

export interface EnhancedRequestInit extends RequestInit {
  timeout?: number
}

/**
 * Расширенная версия fetch с поддержкой timeout
 * Совместима как с браузерным, так и с Node.js окружением
 */
export async function fetchWithTimeout(
  url: string | URL | Request,
  options: EnhancedRequestInit = {}
): Promise<Response> {
  const { timeout, ...fetchOptions } = options

  // Если timeout не указан, используем стандартный fetch
  if (!timeout) {
    return fetch(url, fetchOptions)
  }

  // Создаем AbortController для отмены запроса по таймауту
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    
    // Если ошибка связана с отменой запроса, выбрасываем timeout ошибку
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`)
    }
    
    throw error
  }
}

/**
 * Утилита для создания fetch функции с предустановленным timeout
 */
export function createFetchWithDefaultTimeout(defaultTimeout: number) {
  return (url: string | URL | Request, options: EnhancedRequestInit = {}) => {
    return fetchWithTimeout(url, {
      timeout: defaultTimeout,
      ...options
    })
  }
}

// Экспортируем как дефолтную функцию для удобства
export default fetchWithTimeout