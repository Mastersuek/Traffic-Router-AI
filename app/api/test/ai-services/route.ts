import { NextResponse } from "next/server"

export async function GET() {
  try {
    const aiServices = [
      { name: "OpenAI", endpoint: "https://api.openai.com/v1/models", requiresAuth: true },
      { name: "Anthropic", endpoint: "https://api.anthropic.com/v1/messages", requiresAuth: true },
      { name: "Google AI", endpoint: "https://generativelanguage.googleapis.com/v1beta/models", requiresAuth: true },
      { name: "Hugging Face", endpoint: "https://api-inference.huggingface.co/models", requiresAuth: false },
    ]

    const results = await Promise.all(
      aiServices.map(async (service) => {
        try {
          // Mock availability test - in real implementation would test actual endpoints
          const isAvailable = Math.random() > 0.2 // 80% success rate for demo

          return {
            name: service.name,
            endpoint: service.endpoint,
            status: isAvailable ? "available" : "unavailable",
            requiresAuth: service.requiresAuth,
            responseTime: isAvailable ? Math.floor(Math.random() * 200) + 50 : null,
          }
        } catch (error) {
          return {
            name: service.name,
            endpoint: service.endpoint,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          }
        }
      }),
    )

    const availableCount = results.filter((r) => r.status === "available").length
    const allAvailable = availableCount === results.length

    return NextResponse.json({
      status: allAvailable ? "pass" : "warning",
      results,
      summary: `${availableCount}/${results.length} AI services available`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: "AI services test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
