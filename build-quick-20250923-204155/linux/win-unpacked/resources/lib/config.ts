import type { RouterConfig } from "./types"

export const defaultConfig: RouterConfig = {
  virtualLocation: {
    country: "US",
    city: "New York",
    latitude: 40.7128,
    longitude: -74.006,
  },
  proxy: {
    port: 1080,
    protocol: "socks5",
    host: "localhost",
  },
  aiServices: [
    {
      name: "OpenAI",
      domains: ["api.openai.com", "openai.com"],
      priority: "high",
      requiresProxy: true,
    },
    {
      name: "Google AI",
      domains: ["dialogflow.googleapis.com", "ai.google.dev"],
      priority: "high",
      requiresProxy: true,
    },
    {
      name: "Anthropic",
      domains: ["api.anthropic.com", "claude.ai"],
      priority: "high",
      requiresProxy: true,
    },
  ],
  trafficRules: [
    {
      id: "block-ads",
      pattern: "*doubleclick.net*",
      action: "block",
      priority: 100,
    },
    {
      id: "direct-ru",
      pattern: "*.ru",
      action: "direct",
      region: "RU",
      priority: 90,
    },
    {
      id: "proxy-ai",
      pattern: "*openai.com*",
      action: "proxy",
      priority: 95,
    },
  ],
  logLevel: "info",
}

export function loadConfig(): RouterConfig {
  // В реальной реализации загружаем из файла или переменных окружения
  return defaultConfig
}
