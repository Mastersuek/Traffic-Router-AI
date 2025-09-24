"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, StatusBar } from "react-native"
import { TrafficRouterClient } from "../../common/traffic-router-client"
import type { ConnectionStatus, TrafficStats } from "../../common/client-config"

const TrafficRouterApp: React.FC = () => {
  const [client] = useState(
    () =>
      new TrafficRouterClient({
        serverUrl: "http://localhost:8080",
        proxyPort: 1080,
        autoStart: true,
        minimizeToTray: false,
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

    client.on("connectionFailed", (error: any) => {
      setStatus(client.getStatus())
      setIsConnecting(false)
      Alert.alert("Ошибка подключения", error?.message || "Не удалось подключиться к серверу")
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
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1f2937" />

      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.title}>Traffic Router</Text>
        <View style={[styles.statusBadge, status.connected ? styles.connected : styles.disconnected]}>
          <Text style={styles.statusText}>{status.connected ? "Подключено" : "Отключено"}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Управление подключением */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Управление подключением</Text>

          <View style={styles.controlRow}>
            <View style={styles.controlInfo}>
              <Text style={styles.controlLabel}>Подключение к серверу</Text>
              <Text style={styles.controlDescription}>
                {status.connected ? "Подключено к localhost:8080" : "Не подключено"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.button, 
                status.connected ? styles.buttonSecondary : styles.buttonPrimary,
                isConnecting ? styles.buttonDisabled : {}
              ]}
              onPress={isConnecting ? undefined : (status.connected ? handleDisconnect : handleConnect)}
            >
              <Text style={styles.buttonText}>
                {isConnecting ? "Подключение..." : status.connected ? "Отключиться" : "Подключиться"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.controlRow}>
            <View style={styles.controlInfo}>
              <Text style={styles.controlLabel}>Прокси-сервер</Text>
              <Text style={styles.controlDescription}>
                {status.proxyActive ? "Активен на порту 1080" : "Неактивен"}
              </Text>
            </View>
            <Switch
              value={status.proxyActive}
              onValueChange={status.connected ? handleToggleProxy : undefined}
            />
          </View>
        </View>

        {/* Статус */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Текущий статус</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{status.currentRegion}</Text>
              <Text style={styles.statLabel}>Регион</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{status.activeConnections}</Text>
              <Text style={styles.statLabel}>Соединения</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatBytes(status.bytesTransferred)}</Text>
              <Text style={styles.statLabel}>Передано</Text>
            </View>
          </View>
        </View>

        {/* Статистика */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Статистика запросов</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalRequests.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Всего</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#3b82f6" }]}>{stats.proxiedRequests.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Через прокси</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#10b981" }]}>{stats.directRequests.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Напрямую</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: "#ef4444" }]}>{stats.blockedRequests.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Заблокировано</Text>
            </View>
          </View>

          <View style={styles.dataTransfer}>
            <View style={styles.transferRow}>
              <Text style={styles.transferLabel}>Загружено:</Text>
              <Text style={styles.transferValue}>{formatBytes(stats.dataTransferred.upload)}</Text>
            </View>
            <View style={styles.transferRow}>
              <Text style={styles.transferLabel}>Скачано:</Text>
              <Text style={styles.transferValue}>{formatBytes(stats.dataTransferred.download)}</Text>
            </View>
            <View style={styles.transferRow}>
              <Text style={styles.transferLabel}>Задержка:</Text>
              <Text style={styles.transferValue}>{stats.averageLatency}ms</Text>
            </View>
          </View>
        </View>

        {/* Топ доменов */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Топ доменов</Text>

          {stats.topDomains.length > 0 ? (
            stats.topDomains.slice(0, 5).map((domain: { domain: string; requests: number }, index: number) => (
              <View key={domain.domain} style={styles.domainRow}>
                <View style={styles.domainInfo}>
                  <Text style={styles.domainRank}>#{index + 1}</Text>
                  <Text style={styles.domainName}>{domain.domain}</Text>
                </View>
                <Text style={styles.domainRequests}>{domain.requests}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noData}>Нет данных о доменах</Text>
          )}
        </View>

        {status.lastError && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorTitle}>Последняя ошибка</Text>
            <Text style={styles.errorText}>{status.lastError}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    backgroundColor: "#1f2937",
    padding: 20,
    paddingTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  connected: {
    backgroundColor: "#10b981",
  },
  disconnected: {
    backgroundColor: "#ef4444",
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  controlInfo: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
  },
  controlDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  buttonPrimary: {
    backgroundColor: "#3b82f6",
  },
  buttonSecondary: {
    backgroundColor: "#6b7280",
  },
  buttonDisabled: {
    backgroundColor: "#d1d5db",
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statItem: {
    width: "48%",
    alignItems: "center",
    marginBottom: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  dataTransfer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  transferRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  transferLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  transferValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    fontFamily: "monospace",
  },
  domainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    marginBottom: 8,
  },
  domainInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  domainRank: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginRight: 8,
  },
  domainName: {
    fontSize: 14,
    color: "#1f2937",
    fontFamily: "monospace",
    flex: 1,
  },
  domainRequests: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3b82f6",
  },
  noData: {
    textAlign: "center",
    color: "#6b7280",
    fontStyle: "italic",
    paddingVertical: 16,
  },
  errorCard: {
    borderColor: "#ef4444",
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#1f2937",
  },
})

export default TrafficRouterApp
