export interface AppConfig {
  serverUrl: string
  proxyPort: number
  autoStart: boolean
  minimizeToTray: boolean
  startWithSystem: boolean
  logLevel: "debug" | "info" | "warn" | "error"
  theme: "light" | "dark" | "auto"
  language: "ru" | "en"
  notifications: boolean
  updateCheck: boolean
}

export interface ConnectionStatus {
  connected: boolean
  serverReachable: boolean
  proxyActive: boolean
  currentRegion: string
  bytesTransferred: number
  activeConnections: number
  lastError?: string
}

export interface TrafficStats {
  totalRequests: number
  proxiedRequests: number
  directRequests: number
  blockedRequests: number
  averageLatency: number
  dataTransferred: {
    upload: number
    download: number
  }
  topDomains: Array<{ domain: string; requests: number }>
}

export const defaultConfig: AppConfig = {
  serverUrl: "http://localhost:8080",
  proxyPort: 1080,
  autoStart: true,
  minimizeToTray: true,
  startWithSystem: false,
  logLevel: "info",
  theme: "auto",
  language: "ru",
  notifications: true,
  updateCheck: true,
}