import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  StatusBar,
  useColorScheme,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Screens
import HomeScreen from './screens/HomeScreen';
import StatsScreen from './screens/StatsScreen';
import SettingsScreen from './screens/SettingsScreen';
import LogsScreen from './screens/LogsScreen';

// Services
import { TrafficRouterService } from './services/TrafficRouterService';
import { ConfigService } from './services/ConfigService';
import { BackgroundService } from './services/BackgroundService';

// Types
import { AppConfig } from './types/Config';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Навигация для вкладок
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Stats':
              iconName = 'bar-chart';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Главная' }}
      />
      <Tab.Screen 
        name="Stats" 
        component={StatsScreen} 
        options={{ title: 'Статистика' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: 'Настройки' }}
      />
    </Tab.Navigator>
  );
}

// Главная навигация
function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Main" 
        component={TabNavigator} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Logs" 
        component={LogsScreen} 
        options={{ 
          title: 'Логи',
          headerBackTitle: 'Назад'
        }}
      />
    </Stack.Navigator>
  );
}

export default function App(): JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
    setupAppStateListener();
  }, []);

  const initializeApp = async () => {
    try {
      // Загрузка конфигурации
      const loadedConfig = await ConfigService.loadConfig();
      setConfig(loadedConfig);

      // Инициализация сервисов
      TrafficRouterService.initialize(loadedConfig);
      
      // Запуск фонового сервиса если включен автостарт
      if (loadedConfig.autoStart) {
        await BackgroundService.start();
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      Alert.alert(
        'Ошибка инициализации',
        'Не удалось запустить приложение. Проверьте настройки.',
        [{ text: 'OK' }]
      );
      setIsLoading(false);
    }
  };

  const setupAppStateListener = () => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        // Приложение ушло в фон
        BackgroundService.handleAppBackground();
      } else if (nextAppState === 'active') {
        // Приложение стало активным
        BackgroundService.handleAppForeground();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  if (isLoading) {
    // Можно добавить экран загрузки
    return <></>;
  }

  return (
    <NavigationContainer theme={isDarkMode ? DarkTheme : DefaultTheme}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#000000' : '#FFFFFF'}
      />
      <AppNavigator />
      <Toast />
    </NavigationContainer>
  );
}