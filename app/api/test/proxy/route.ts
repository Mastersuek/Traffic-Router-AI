import { NextResponse } from "next/server"

export async function GET() {
  try {
    const proxyEndpoints = [
      { name: "AI Services Proxy", host: "localhost", port: 8080 },
      { name: "SOCKS Proxy", host: "localhost", port: 1080 },
      { name: "HTTP Proxy", host: "localhost", port: 3128 },
    ]

    const results = await Promise.all(
      proxyEndpoints.map(async (endpoint) => {
        try {
          // Mock connectivity test - in real implementation would test actual connection
          const isReachable = Math.random() > 0.3 // 70% success rate for demo

          return {
            name: endpoint.name,
            host: endpoint.host,
            port: endpoint.port,
            status: isReachable ? "reachable" : "unreachable",
            responseTime: isReachable ? Math.floor(Math.random() * 100) + 10 : null,
          }
        } catch (error) {
          return {
            name: endpoint.name,
            host: endpoint.host,
            port: endpoint.port,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          }
        }
      }),
    )

    const reachableCount = results.filter((r) => r.status === "reachable").length
    const allReachable = reachableCount === results.length

    return NextResponse.json({
      status: allReachable ? "pass" : "warning",
      results,
      summary: `${reachableCount}/${results.length} proxy endpoints reachable`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Proxy test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
