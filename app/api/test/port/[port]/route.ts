import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { port: string } }) {
  try {
    const port = Number.parseInt(params.port)

    if (isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: "Invalid port number" }, { status: 400 })
    }

    try {
      // Mock port availability check - in real implementation would attempt to bind to port
      const isAvailable = Math.random() > 0.1 // 90% success rate for demo
      const isInUse = !isAvailable

      return NextResponse.json({
        port,
        status: isAvailable ? "available" : "in-use",
        available: isAvailable,
        message: isAvailable ? `Port ${port} is available` : `Port ${port} appears to be in use`,
      })
    } catch (error) {
      return NextResponse.json({
        port,
        status: "error",
        available: false,
        message: `Error checking port ${port}`,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Port test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
