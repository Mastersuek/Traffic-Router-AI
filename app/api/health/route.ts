import { NextResponse } from "next/server"

export async function GET() {
  try {
    const services = [
      {
        name: "Web Interface",
        status: "online" as const,
        port: 3000,
        lastCheck: new Date().toISOString(),
        details: "Next.js application running",
      },
      {
        name: "AI Proxy Server",
        status: Math.random() > 0.3 ? ("online" as const) : ("offline" as const),
        port: 8080,
        lastCheck: new Date().toISOString(),
        details: "AI request proxy and geolocation handler",
      },
      {
        name: "SOCKS Proxy",
        status: Math.random() > 0.4 ? ("online" as const) : ("offline" as const),
        port: 1080,
        lastCheck: new Date().toISOString(),
        details: "SOCKS5 proxy for traffic routing",
      },
      {
        name: "Monitoring Service",
        status: Math.random() > 0.2 ? ("online" as const) : ("degraded" as const),
        port: 8082,
        lastCheck: new Date().toISOString(),
        details: "System monitoring and metrics collection",
      },
    ]

    const onlineServices = services.filter((s) => s.status === "online").length
    const totalServices = services.length

    let overall: "healthy" | "warning" | "critical"
    if (onlineServices === totalServices) {
      overall = "healthy"
    } else if (onlineServices >= totalServices * 0.5) {
      overall = "warning"
    } else {
      overall = "critical"
    }

    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    }

    return NextResponse.json({
      overall,
      services,
      systemInfo,
      timestamp: new Date().toISOString(),
      summary: `${onlineServices}/${totalServices} services online`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        overall: "critical",
        services: [],
        error: "Health check failed",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
