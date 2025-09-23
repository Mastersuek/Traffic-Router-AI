import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppConfig, defaultConfig } from '../types/Config';

const CONFIG_KEY = 'traffic_router_config';

export class ConfigService {
  static async loadConfig(): Promise<AppConfig> {
    try {
      const configString = await AsyncStorage.getItem(CONFIG_KEY);
      if (configString) {
        const savedConfig = JSON.parse(configString);
        return { ...defaultConfig, ...savedConfig };
      }
      return defaultConfig;
    } catch (error) {
      console.error('Failed to load config:', error);
      return defaultConfig;
    }
  }

  static async saveConfig(config: AppConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  static async updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    const currentConfig = await this.loadConfig();
    const newConfig = { ...currentConfig, ...updates };
    await this.saveConfig(newConfig);
    return newConfig;
  }

  static async resetConfig(): Promise<AppConfig> {
    await this.saveConfig(defaultConfig);
    return defaultConfig;
  }
}