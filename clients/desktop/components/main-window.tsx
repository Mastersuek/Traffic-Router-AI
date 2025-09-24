"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { TrafficRouterClient } from "../../common/traffic-router-client"
import type { ConnectionStatus, TrafficStats } from "../../common/client-config"
import { Activity, Globe, Shield, Settings, BarChart3, Wifi, WifiOff } from "lucide-react"

export function MainWindow() {
  const [client] = useState(
    () =>
      new TrafficRouterClient({
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
      }),
  )

  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    serverReachable: false,
    proxyActive: false,
    currentRegion: "Unknown",
    bytesTransferred: 0,
    activeConnections: 0,
  })

  const [stats, setStats] = useState<TrafficStats>({
    totalRequests: 0,
    proxiedRequests: 0,
    directRequests: 0,
    blockedRequests: 0,
    averageLatency: 0,
    dataTransferred: { upload: 0, download: 0 },
    topDomains: [],
  })

  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    // Подписка на события клиента
    client.on("connected", () => {
      setStatus(client.getStatus())
      setIsConnecting(false)
    })

    client.on("disconnected", () => {
      setStatus(client.getStatus())
      setIsConnecting(false)
    })

    client.on("connectionFailed", () => {
      setStatus(client.getStatus())
      setIsConnecting(false)
    })

    client.on("statsUpdated", (newStats: TrafficStats) => {
      setStats(newStats)
      setStatus(client.getStatus())
    })

    client.on("proxyStarted", () => {
      setStatus(client.getStatus())
    })

    client.on("proxyStopped", () => {
      setStatus(client.getStatus())
    })

    // Автоподключение при запуске
    handleConnect()

    return () => {
      client.disconnect()
    }
  }, [client])

  const handleConnect = async () => {
    setIsConnecting(true)
    await client.connect()
  }

  const handleDisconnect = () => {
    client.disconnect()
  }

  const handleToggleProxy = async () => {
    if (status.proxyActive) {
      await client.stopProxy()
    } else {
      await client.startProxy()
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Traffic Router</h1>
            <p className="text-muted-foreground">Система маршрутизации трафика с геолокацией</p>
          </div>
          <div className="flex items-center gap-2">
            {status.connected ? (
              <Badge variant="default" className="bg-green-500">
                <Wifi className="w-4 h-4 mr-1" />
                Подключено
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="w-4 h-4 mr-1" />
                Отключено
              </Badge>
            )}
          </div>
        </div>

        {/* Основные элементы управления */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Управление подключением
            </CardTitle>
            <CardDescription>Управление подключением к серверу и прокси</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Подключение к серверу</p>
                <p className="text-sm text-muted-foreground">
                  {status.connected ? "Подключено к localhost:8080" : "Не подключено"}
                </p>
              </div>
              <div className="flex gap-2">
                {!status.connected ? (
                  <Button onClick={handleConnect} disabled={isConnecting}>
                    {isConnecting ? "Подключение..." : "Подключиться"}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleDisconnect}>
                    Отключиться
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Прокси-сервер</p>
                <p className="text-sm text-muted-foreground">
                  {status.proxyActive ? "Активен на порту 1080" : "Неактивен"}
                </p>
              </div>
              <Switch checked={status.proxyActive} onCheckedChange={handleToggleProxy} disabled={!status.connected} />
            </div>
          </CardContent>
        </Card>

        {/* Вкладки с информацией */}
        <Tabs defaultValue="status" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Статус
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Статистика
            </TabsTrigger>
            <TabsTrigger value="domains" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Домены
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Настройки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Текущий регион</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{status.currentRegion}</div>
                  <p className="text-xs text-muted-foreground">Виртуальное местоположение</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Активные соединения</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{status.activeConnections}</div>
                  <p className="text-xs text-muted-foreground">Открытых подключений</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Передано данных</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatBytes(status.bytesTransferred)}</div>
                  <p className="text-xs text-muted-foreground">Всего за сессию</p>
                </CardContent>
              </Card>
            </div>

            {status.lastError && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Последняя ошибка</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{status.lastError}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Всего запросов</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Через прокси</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.proxiedRequests.toLocaleString()}</div>
                  <Progress
                    value={stats.totalRequests > 0 ? (stats.proxiedRequests / stats.totalRequests) * 100 : 0}
                    className="mt-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Напрямую</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.directRequests.toLocaleString()}</div>
                  <Progress
                    value={stats.totalRequests > 0 ? (stats.directRequests / stats.totalRequests) * 100 : 0}
                    className="mt-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Заблокировано</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.blockedRequests.toLocaleString()}</div>
                  <Progress
                    value={stats.totalRequests > 0 ? (stats.blockedRequests / stats.totalRequests) * 100 : 0}
                    className="mt-2"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Передача данных</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Загружено:</span>
                  <span className="font-mono">{formatBytes(stats.dataTransferred.upload)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Скачано:</span>
                  <span className="font-mono">{formatBytes(stats.dataTransferred.download)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Средняя задержка:</span>
                  <span className="font-mono">{stats.averageLatency}ms</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="domains" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Топ доменов</CardTitle>
                <CardDescription>Наиболее часто посещаемые домены</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topDomains.length > 0 ? (
                    stats.topDomains.map((domain: { domain: string; requests: number }, index: number) => (
                      <div key={domain.domain} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">#{index + 1}</span>
                          <span className="font-mono text-sm">{domain.domain}</span>
                        </div>
                        <Badge variant="secondary">{domain.requests} запросов</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Нет данных о доменах</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Настройки приложения</CardTitle>
                <CardDescription>Конфигурация клиентского приложения</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Автозапуск</p>
                    <p className="text-sm text-muted-foreground">Запускать при старте системы</p>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Уведомления</p>
                    <p className="text-sm text-muted-foreground">Показывать системные уведомления</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Сворачивать в трей</p>
                    <p className="text-sm text-muted-foreground">Минимизировать в системный трей</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="pt-4 border-t">
                  <Button variant="outline" onClick={() => client.clearStats()}>
                    Очистить статистику
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
