"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Activity, AlertTriangle, CheckCircle, XCircle, TrendingUp, Server, Network, Clock } from "lucide-react"

interface MonitoringData {
  summary: {
    totalRequests: number
    requestsPerSecond: number
    averageLatency: number
    errorRate: number
    proxyUtilization: number
    memoryUsage: number
    cpuUsage: number
    activeConnections: number
    bytesTransferred: number
  }
  alerts: Array<{
    id: string
    name: string
    severity: "low" | "medium" | "high" | "critical"
    message: string
    timestamp: number
    resolved: boolean
  }>
  performance: {
    status: "healthy" | "warning" | "critical"
    score: number
    issues: string[]
    recommendations: string[]
  }
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData>({
    summary: {
      totalRequests: 0,
      requestsPerSecond: 0,
      averageLatency: 0,
      errorRate: 0,
      proxyUtilization: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      bytesTransferred: 0,
    },
    alerts: [],
    performance: {
      status: "healthy",
      score: 100,
      issues: [],
      recommendations: [],
    },
  })

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = () => {
      setData({
        summary: {
          totalRequests: 15420,
          requestsPerSecond: 12.5,
          averageLatency: 245,
          errorRate: 0.02,
          proxyUtilization: 0.67,
          memoryUsage: 0.72,
          cpuUsage: 0.45,
          activeConnections: 89,
          bytesTransferred: 2.1 * 1024 * 1024 * 1024,
        },
        alerts: [
          {
            id: "1",
            name: "High Memory Usage",
            severity: "medium",
            message: "Memory usage: 72% (threshold: 70%)",
            timestamp: Date.now() - 300000,
            resolved: false,
          },
          {
            id: "2",
            name: "Low Proxy Utilization",
            severity: "low",
            message: "Proxy utilization: 67% (threshold: 70%)",
            timestamp: Date.now() - 600000,
            resolved: false,
          },
        ],
        performance: {
          status: "warning",
          score: 75,
          issues: ["High memory usage", "Periodic timeouts"],
          recommendations: ["Increase RAM", "Optimize proxy settings", "Check network connection"],
        },
      })
      setIsLoading(false)
    }

    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-yellow-500"
      case "medium":
        return "bg-orange-500"
      case "high":
        return "bg-red-500"
      case "critical":
        return "bg-purple-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case "critical":
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Activity className="w-5 h-5 text-gray-500" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Activity className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading monitoring data...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">System Monitoring</h1>
            <p className="text-muted-foreground">Traffic Router performance and status tracking</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(data.performance.status)}
            <Badge variant={data.performance.status === "healthy" ? "default" : "destructive"}>
              {data.performance.status === "healthy"
                ? "Healthy"
                : data.performance.status === "warning"
                  ? "Warning"
                  : "Critical"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Requests per Second
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.requestsPerSecond.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Total: {data.summary.totalRequests.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Average Latency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.averageLatency}ms</div>
              <p className="text-xs text-muted-foreground">Errors: {(data.summary.errorRate * 100).toFixed(2)}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Network className="w-4 h-4" />
                Active Connections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.activeConnections}</div>
              <p className="text-xs text-muted-foreground">
                Proxy utilization: {(data.summary.proxyUtilization * 100).toFixed(0)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Server className="w-4 h-4" />
                Data Transferred
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(data.summary.bytesTransferred)}</div>
              <p className="text-xs text-muted-foreground">Current session</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts
              {data.alerts.filter((a) => !a.resolved).length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {data.alerts.filter((a) => !a.resolved).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon(data.performance.status)}
                    Performance Score
                  </CardTitle>
                  <CardDescription>Overall system score: {data.performance.score}/100</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={data.performance.score} className="w-full" />

                  {data.performance.issues.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Detected Issues:</h4>
                      <ul className="space-y-1">
                        {data.performance.issues.map((issue, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Optimization Recommendations</CardTitle>
                  <CardDescription>Suggestions for performance improvement</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.performance.recommendations.length > 0 ? (
                    <ul className="space-y-2">
                      {data.performance.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">System is running optimally</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <div className="space-y-4">
              {data.alerts.length > 0 ? (
                data.alerts.map((alert) => (
                  <Alert key={alert.id} className={alert.resolved ? "opacity-60" : ""}>
                    <div className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full ${getSeverityColor(alert.severity)} mt-1`} />
                      <div className="flex-1">
                        <AlertTitle className="flex items-center justify-between">
                          <span>{alert.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={alert.resolved ? "secondary" : "destructive"}>
                              {alert.resolved ? "Resolved" : "Active"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </AlertTitle>
                        <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                      </div>
                    </div>
                  </Alert>
                ))
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <p className="text-muted-foreground">No active alerts</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Resource Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>CPU</span>
                      <span>{(data.summary.cpuUsage * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={data.summary.cpuUsage * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory</span>
                      <span>{(data.summary.memoryUsage * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={data.summary.memoryUsage * 100} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Network Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Active connections:</span>
                    <span className="text-sm font-medium">{data.summary.activeConnections}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Data transferred:</span>
                    <span className="text-sm font-medium">{formatBytes(data.summary.bytesTransferred)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Proxy utilization:</span>
                    <span className="text-sm font-medium">{(data.summary.proxyUtilization * 100).toFixed(0)}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
