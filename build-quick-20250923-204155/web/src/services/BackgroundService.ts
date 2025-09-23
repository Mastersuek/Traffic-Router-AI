// Заглушка для фонового сервиса
export class BackgroundService {
  static async start(): Promise<void> {
    console.log('Background service started');
  }

  static async stop(): Promise<void> {
    console.log('Background service stopped');
  }

  static handleAppBackground(): void {
    console.log('App went to background');
  }

  static handleAppForeground(): void {
    console.log('App came to foreground');
  }
}