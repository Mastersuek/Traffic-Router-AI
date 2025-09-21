export interface VirtualLocation {
  country: string
  city: string
  latitude: number
  longitude: number
}

export interface ProxyConfig {
  port: number
  protocol: "socks5" | "http" | "https"
  host?: string
}

export interface AIServiceConfig {
  name: string
  domains: string[]
  priority: "high" | "medium" | "low"
  requiresProxy: boolean
}

export interface TrafficRule {
  id: string
  pattern: string
  action: "direct" | "proxy" | "block"
  region?: "RU" | "US" | "EU" | "GLOBAL"
  priority: number
}

export interface RouterConfig {
  virtualLocation: VirtualLocation
  proxy: ProxyConfig
  aiServices: AIServiceConfig[]
  trafficRules: TrafficRule[]
  logLevel: "debug" | "info" | "warn" | "error"
}
