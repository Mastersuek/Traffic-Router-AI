// Ротация User-Agent для обхода детекции
export class UserAgentRotator {
  private userAgents: string[] = []
  private currentIndex = 0

  constructor() {
    this.initializeUserAgents()
  }

  private initializeUserAgents(): void {
    this.userAgents = [
      // Chrome на Windows
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

      // Chrome на macOS
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

      // Chrome на Linux
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

      // Firefox
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",

      // Safari
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",

      // Edge
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    ]
  }

  // Получение случайного User-Agent
  getRandomUserAgent(): string {
    const randomIndex = Math.floor(Math.random() * this.userAgents.length)
    return this.userAgents[randomIndex]
  }

  // Получение следующего User-Agent по кругу
  getNextUserAgent(): string {
    const userAgent = this.userAgents[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % this.userAgents.length
    return userAgent
  }

  // Получение User-Agent для конкретной платформы
  getUserAgentForPlatform(platform: "windows" | "macos" | "linux"): string {
    const platformAgents = this.userAgents.filter((ua) => {
      switch (platform) {
        case "windows":
          return ua.includes("Windows NT")
        case "macos":
          return ua.includes("Macintosh")
        case "linux":
          return ua.includes("X11; Linux")
        default:
          return true
      }
    })

    const randomIndex = Math.floor(Math.random() * platformAgents.length)
    return platformAgents[randomIndex] || this.userAgents[0]
  }

  // Добавление пользовательского User-Agent
  addCustomUserAgent(userAgent: string): void {
    if (!this.userAgents.includes(userAgent)) {
      this.userAgents.push(userAgent)
      console.log(`[UserAgentRotator] Added custom User-Agent: ${userAgent.substring(0, 50)}...`)
    }
  }
}
