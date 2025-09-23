// Классификатор доменов для определения региона и типа сервиса
export interface DomainInfo {
  region: "RU" | "US" | "EU" | "CN" | "GLOBAL"
  category: "social" | "search" | "ai" | "messenger" | "media" | "government" | "other"
  requiresProxy: boolean
  priority: number
}

export class DomainClassifier {
  private domainRules = new Map<string, DomainInfo>()
  private patterns = new Map<RegExp, DomainInfo>()

  constructor() {
    this.initializeDomainRules()
  }

  private initializeDomainRules(): void {
    // Российские домены - прямое подключение
    const russianDomains = [
      "yandex.ru",
      "yandex.com",
      "mail.ru",
      "vk.com",
      "ok.ru",
      "rambler.ru",
      "livejournal.com",
      "pikabu.ru",
      "habr.com",
      "rbc.ru",
      "rt.com",
      "ria.ru",
      "tass.ru",
      "interfax.ru",
    ]

    russianDomains.forEach((domain) => {
      this.domainRules.set(domain, {
        region: "RU",
        category: this.categorizeDomain(domain),
        requiresProxy: false,
        priority: 10,
      })
    })

    // AI сервисы - высокий приоритет прокси
    const aiDomains = [
      "openai.com",
      "api.openai.com",
      "chat.openai.com",
      "claude.ai",
      "api.anthropic.com",
      "bard.google.com",
      "ai.google.dev",
      "huggingface.co",
      "replicate.com",
      "midjourney.com",
      "stability.ai",
    ]

    aiDomains.forEach((domain) => {
      this.domainRules.set(domain, {
        region: "US",
        category: "ai",
        requiresProxy: true,
        priority: 100,
      })
    })

    // Социальные сети - средний приоритет
    const socialDomains = [
      "facebook.com",
      "instagram.com",
      "twitter.com",
      "x.com",
      "linkedin.com",
      "tiktok.com",
      "youtube.com",
      "discord.com",
      "reddit.com",
      "pinterest.com",
    ]

    socialDomains.forEach((domain) => {
      this.domainRules.set(domain, {
        region: "US",
        category: "social",
        requiresProxy: true,
        priority: 50,
      })
    })

    // Мессенджеры - специальная обработка
    const messengerDomains = ["web.whatsapp.com", "web.telegram.org", "discord.com", "slack.com", "zoom.us"]

    messengerDomains.forEach((domain) => {
      this.domainRules.set(domain, {
        region: "GLOBAL",
        category: "messenger",
        requiresProxy: true,
        priority: 80,
      })
    })

    // Паттерны для доменов
    this.patterns.set(/.*\.ru$/, {
      region: "RU",
      category: "other",
      requiresProxy: false,
      priority: 5,
    })

    this.patterns.set(/.*\.рф$/, {
      region: "RU",
      category: "other",
      requiresProxy: false,
      priority: 5,
    })

    this.patterns.set(/.*\.gov\..*/, {
      region: "GLOBAL",
      category: "government",
      requiresProxy: true,
      priority: 90,
    })
  }

  // Классификация домена
  classifyDomain(hostname: string): DomainInfo {
    const cleanHostname = hostname.toLowerCase().replace(/^www\./, "")

    // Проверяем точные совпадения
    if (this.domainRules.has(cleanHostname)) {
      return this.domainRules.get(cleanHostname)!
    }

    // Проверяем паттерны
    for (const [pattern, info] of this.patterns) {
      if (pattern.test(cleanHostname)) {
        return info
      }
    }

    // По умолчанию - международный домен через прокси
    return {
      region: "GLOBAL",
      category: "other",
      requiresProxy: true,
      priority: 20,
    }
  }

  private categorizeDomain(domain: string): DomainInfo["category"] {
    if (domain.includes("yandex") || domain.includes("google")) return "search"
    if (domain.includes("vk") || domain.includes("ok")) return "social"
    if (domain.includes("mail") || domain.includes("telegram")) return "messenger"
    if (domain.includes("rbc") || domain.includes("ria")) return "media"
    return "other"
  }

  // Добавление пользовательского правила
  addCustomRule(hostname: string, info: DomainInfo): void {
    this.domainRules.set(hostname.toLowerCase(), info)
    console.log(`[DomainClassifier] Added custom rule for ${hostname}`)
  }

  // Получение статистики классификации
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {}

    for (const info of this.domainRules.values()) {
      const key = `${info.region}-${info.category}`
      stats[key] = (stats[key] || 0) + 1
    }

    return stats
  }
}
