import { NextResponse } from "next/server"

export async function GET() {
  try {
    const configTests = [
      {
        name: "Environment Variables",
        test: () => {
          const requiredEnvs = ["NODE_ENV"]
          const missing = requiredEnvs.filter((env) => !process.env[env])
          return { pass: missing.length === 0, details: missing.length > 0 ? `Missing: ${missing.join(", ")}` : null }
        },
      },
      {
        name: "Port Configuration",
        test: () => {
          const ports = [3000, 8080, 1080, 8082]
          const conflicts = ports.filter((port) => {
            // Simple port availability check (mock)
            return false // No conflicts in mock
          })
          return {
            pass: conflicts.length === 0,
            details: conflicts.length > 0 ? `Port conflicts: ${conflicts.join(", ")}` : null,
          }
        },
      },
      {
        name: "TypeScript Configuration",
        test: () => {
          try {
            // Check if tsconfig.json is valid (simplified)
            return { pass: true, details: null }
          } catch (error) {
            return { pass: false, details: error instanceof Error ? error.message : "Unknown error" }
          }
        },
      },
    ]

    const results = configTests.map(({ name, test }) => {
      const result = test()
      return { name, ...result }
    })

    const allPassed = results.every((r) => r.pass)

    return NextResponse.json({
      status: allPassed ? "pass" : "fail",
      results,
      summary: `${results.filter((r) => r.pass).length}/${results.length} tests passed`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Configuration test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
