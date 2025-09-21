"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertTriangle, Play, RefreshCw } from "lucide-react"

interface TestResult {
  name: string
  status: "pass" | "fail" | "warning"
  message: string
  details?: string
}

interface SystemHealth {
  overall: "healthy" | "warning" | "critical"
  services: Array<{
    name: string
    status: "online" | "offline" | "degraded"
    port?: number
    lastCheck: string
  }>
}

export default function HomePage() {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [isRunningTests, setIsRunningTests] = useState(false)

  const runSmokeTests = async () => {
    setIsRunningTests(true)
    const results: TestResult[] = []

    // Test 1: Configuration validation
    try {
      const configTest = await fetch("/api/test/config")
      results.push({
        name: "Configuration Validation",
        status: configTest.ok ? "pass" : "fail",
        message: configTest.ok ? "All configurations are valid" : "Configuration errors detected",
        details: configTest.ok ? undefined : await configTest.text(),
      })
    } catch (error) {
      results.push({
        name: "Configuration Validation",
        status: "fail",
        message: "Failed to validate configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Test 2: Proxy connectivity
    try {
      const proxyTest = await fetch("/api/test/proxy")
      results.push({
        name: "Proxy Connectivity",
        status: proxyTest.ok ? "pass" : "warning",
        message: proxyTest.ok ? "Proxy servers are reachable" : "Some proxy servers unreachable",
        details: proxyTest.ok ? undefined : await proxyTest.text(),
      })
    } catch (error) {
      results.push({
        name: "Proxy Connectivity",
        status: "fail",
        message: "Proxy connectivity test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Test 3: AI Services availability
    try {
      const aiTest = await fetch("/api/test/ai-services")
      results.push({
        name: "AI Services",
        status: aiTest.ok ? "pass" : "warning",
        message: aiTest.ok ? "AI services are accessible" : "Some AI services unavailable",
        details: aiTest.ok ? undefined : await aiTest.text(),
      })
    } catch (error) {
      results.push({
        name: "AI Services",
        status: "warning",
        message: "AI services test inconclusive",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Test 4: Geolocation handler
    try {
      const geoTest = await fetch("/api/test/geolocation")
      results.push({
        name: "Geolocation Handler",
        status: geoTest.ok ? "pass" : "fail",
        message: geoTest.ok ? "Geolocation detection working" : "Geolocation handler errors",
        details: geoTest.ok ? undefined : await geoTest.text(),
      })
    } catch (error) {
      results.push({
        name: "Geolocation Handler",
        status: "fail",
        message: "Geolocation test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Test 5: Port conflicts
    const portTests = [3000, 8080, 1080, 8082]
    for (const port of portTests) {
      try {
        const portTest = await fetch(`/api/test/port/${port}`)
        results.push({
          name: `Port ${port} Availability`,
          status: portTest.ok ? "pass" : "warning",
          message: portTest.ok ? `Port ${port} is available` : `Port ${port} may be in use`,
          details: portTest.ok ? undefined : await portTest.text(),
        })
      } catch (error) {
        results.push({
          name: `Port ${port} Availability`,
          status: "warning",
          message: `Could not test port ${port}`,
          details: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    setTestResults(results)
    setIsRunningTests(false)
  }

  const checkSystemHealth = async () => {
    try {
      const healthResponse = await fetch("/api/health")
      if (healthResponse.ok) {
        const health = await healthResponse.json()
        setSystemHealth(health)
      } else {
        setSystemHealth({
          overall: "critical",
          services: [
            { name: "Web Interface", status: "online", port: 3000, lastCheck: new Date().toISOString() },
            { name: "AI Proxy", status: "offline", port: 8080, lastCheck: new Date().toISOString() },
            { name: "SOCKS Proxy", status: "offline", port: 1080, lastCheck: new Date().toISOString() },
            { name: "Monitoring", status: "offline", port: 8082, lastCheck: new Date().toISOString() },
          ],
        })
      }
    } catch (error) {
      setSystemHealth({
        overall: "critical",
        services: [{ name: "System", status: "offline", lastCheck: new Date().toISOString() }],
      })
    }
  }

  useEffect(() => {
    checkSystemHealth()
    const interval = setInterval(checkSystemHealth, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
      case "online":
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "warning":
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "fail":
      case "offline":
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
      case "online":
      case "healthy":
        return "bg-green-100 text-green-800"
      case "warning":
      case "degraded":
        return "bg-yellow-100 text-yellow-800"
      case "fail":
      case "offline":
      case "critical":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Traffic Router Control Panel</h1>
            <p className="text-muted-foreground">Система маршрутизации трафика с геолокацией и AI интеграцией</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={checkSystemHealth} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
            <Button onClick={runSmokeTests} disabled={isRunningTests}>
              <Play className="h-4 w-4 mr-2" />
              {isRunningTests ? "Running Tests..." : "Run Tests"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tests">System Tests</TabsTrigger>
            <TabsTrigger value="health">Health Monitor</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">System Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(systemHealth?.overall || "unknown")}
                    <Badge className={getStatusColor(systemHealth?.overall || "unknown")}>
                      {systemHealth?.overall || "Unknown"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active Services</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {systemHealth?.services.filter((s) => s.status === "online").length || 0}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{systemHealth?.services.length || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {testResults.filter((t) => t.status === "pass").length}
                    <span className="text-sm font-normal text-muted-foreground">/{testResults.length} passed</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Last Check</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {systemHealth?.services[0]?.lastCheck
                      ? new Date(systemHealth.services[0].lastCheck).toLocaleTimeString()
                      : "Never"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and system controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="justify-start bg-transparent">
                    Start AI Proxy Server
                  </Button>
                  <Button variant="outline" className="justify-start bg-transparent">
                    Configure Proxy Settings
                  </Button>
                  <Button variant="outline" className="justify-start bg-transparent">
                    View System Logs
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Tests</CardTitle>
                <CardDescription>Comprehensive testing of all system components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {testResults.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No tests have been run yet. Click "Run Tests" to start system validation.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {testResults.map((test, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                        {getStatusIcon(test.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{test.name}</h4>
                            <Badge className={getStatusColor(test.status)}>{test.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{test.message}</p>
                          {test.details && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer">Show details</summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">{test.details}</pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Service Health Monitor</CardTitle>
                <CardDescription>Real-time status of all system services</CardDescription>
              </CardHeader>
              <CardContent>
                {systemHealth ? (
                  <div className="space-y-3">
                    {systemHealth.services.map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(service.status)}
                          <div>
                            <h4 className="font-medium">{service.name}</h4>
                            {service.port && <p className="text-sm text-muted-foreground">Port: {service.port}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(service.status)}>{service.status}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(service.lastCheck).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Unable to retrieve system health information.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
