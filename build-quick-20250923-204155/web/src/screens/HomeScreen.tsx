import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Toast from 'react-native-toast-message';

import { TrafficRouterService } from '../services/TrafficRouterService';
import { ConnectionStatus } from '../types/Config';

export default function HomeScreen(): JSX.Element {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    serverReachable: false,
    proxyActive: false,
    currentRegion: "Unknown",
    bytesTransferred: 0,
    activeConnections: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const service = TrafficRouterService.getInstance();
    
    // Подписка на события
    service.on('connected', handleConnected);
    service.on('disconnected', handleDisconnected);
    service.on('proxyStarted', handleProxyStarted);
    service.on('proxyStopped', handleProxyStopped);
    service.on('connectionFailed', handleConnectionFailed);

    // Загрузка начального состояния
    updateStatus();

    return () => {
      service.off('connected', handleConnected);
      service.off('disconnected', handleDisconnected);
      service.off('proxyStarted', handleProxyStarted);
      service.off('proxyStopped', handleProxyStopped);
      service.off('connectionFailed', handleConnectionFailed);
    };
  }, []);

  const updateStatus = () => {
    const service = TrafficRouterService.getInstance();
    setStatus(service.getStatus());
  };

  const handleConnected = () => {
    updateStatus();
    Toast.show({
      type: 'success',
      text1: 'Подключено',
      text2: 'Соединение с сервером установлено',
    });
  };

  const handleDisconnected = () => {
    updateStatus();
    Toast.show({
      type: 'info',
      text1: 'Отключено',
      text2: 'Соединение с сервером разорвано',
    });
  };

  const handleProxyStarted = () => {
    updateStatus();
    Toast.show({
      type: 'success',
      text1: 'Прокси запущен',
      text2: 'Трафик маршрутизируется через прокси',
    });
  };

  const handleProxyStopped = () => {
    updateStatus();
    Toast.show({
      type: 'info',
      text1: 'Прокси остановлен',
      text2: 'Трафик идет напрямую',
    });
  };

  const handleConnectionFailed = (error: any) => {
    updateStatus();
    Toast.show({
      type: 'error',
      text1: 'Ошибка подключения',
      text2: error?.message || 'Не удалось подключиться к серверу',
    });
  };

  const toggleConnection = async () => {
    setIsLoading(true);
    const service = TrafficRouterService.getInstance();

    try {
      if (status.connected) {
        service.disconnect();
      } else {
        await service.connect();
      }
    } catch (error) {
      Alert.alert(
        'Ошибка',
        error instanceof Error ? error.message : 'Неизвестная ошибка'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleProxy = async () => {
    if (!status.connected) {
      Alert.alert('Ошибка', 'Сначала подключитесь к серверу');
      return;
    }

    setIsLoading(true);
    const service = TrafficRouterService.getInstance();

    try {
      if (status.proxyActive) {
        await service.stopProxy();
      } else {
        await service.startProxy();
      }
    } catch (error) {
      Alert.alert(
        'Ошибка прокси',
        error instanceof Error ? error.message : 'Неизвестная ошибка'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    const service = TrafficRouterService.getInstance();

    try {
      const result = await service.testConnection();
      
      Alert.alert(
        'Тест соединения',
        result.success 
          ? `Соединение успешно!\nЗадержка: ${result.latency} мс`
          : `Ошибка: ${result.error}\nЗадержка: ${result.latency} мс`
      );
    } catch (error) {
      Alert.alert(
        'Ошибка теста',
        error instanceof Error ? error.message : 'Неизвестная ошибка'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    updateStatus();
    
    if (status.connected) {
      const service = TrafficRouterService.getInstance();
      await service.fetchStats();
    }
    
    setRefreshing(false);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Traffic Router</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: status.connected ? '#4CAF50' : '#F44336' }
        ]}>
          <Text style={styles.statusText}>
            {status.connected ? 'Подключено' : 'Отключено'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Управление подключением</Text>
        
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: status.connected ? '#F44336' : '#4CAF50' }
          ]}
          onPress={toggleConnection}
          disabled={isLoading}
        >
          <Icon 
            name={status.connected ? 'stop' : 'play-arrow'} 
            size={24} 
            color="white" 
          />
          <Text style={styles.buttonText}>
            {status.connected ? 'Отключиться' : 'Подключиться'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.secondaryButton,
            { opacity: status.connected ? 1 : 0.5 }
          ]}
          onPress={toggleProxy}
          disabled={isLoading || !status.connected}
        >
          <Icon 
            name={status.proxyActive ? 'visibility-off' : 'visibility'} 
            size={24} 
            color="#2196F3" 
          />
          <Text style={[styles.buttonText, { color: '#2196F3' }]}>
            {status.proxyActive ? 'Остановить прокси' : 'Запустить прокси'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Текущее состояние</Text>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Регион:</Text>
          <Text style={styles.statusValue}>{status.currentRegion}</Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Соединения:</Text>
          <Text style={styles.statusValue}>{status.activeConnections}</Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Передано:</Text>
          <Text style={styles.statusValue}>
            {formatBytes(status.bytesTransferred)}
          </Text>
        </View>

        {status.lastError && (
          <View style={styles.errorContainer}>
            <Icon name="error" size={20} color="#F44336" />
            <Text style={styles.errorText}>{status.lastError}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Действия</Text>
        
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={testConnection}
          disabled={isLoading}
        >
          <Icon name="network-check" size={24} color="#2196F3" />
          <Text style={[styles.buttonText, { color: '#2196F3' }]}>
            Тест соединения
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
});