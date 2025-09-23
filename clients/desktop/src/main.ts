import { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import Store from 'electron-store'
import * as path from 'path'
import * as os from 'os'
import { spawn, ChildProcess } from 'child_process'

// Конфигурация
const store = new Store()
const isDev = process.env.NODE_ENV === 'development'

interface AppConfig {
  serverUrl: string
  proxyPort: number
  autoStart: boolean
  minimizeToTray: boolean
  startWithSystem: boolean
  logLevel: string
  theme: string
  language: string
  notifications: boolean
  updateCheck: boolean
}

class TrafficRouterApp {
  private mainWindow: BrowserWindow | null = null
  private tray: Tray | null = null
  private serverProcess: ChildProcess | null = null
  private config: AppConfig

  constructor() {
    this.config = this.loadConfig()
    this.setupApp()
  }

  private loadConfig(): AppConfig {
    return {
      serverUrl: store.get('serverUrl', 'http://localhost:8080') as string,
      proxyPort: store.get('proxyPort', 1080) as number,
      autoStart: store.get('autoStart', true) as boolean,
      minimizeToTray: store.get('minimizeToTray', true) as boolean,
      startWithSystem: store.get('startWithSystem', false) as boolean,
      logLevel: store.get('logLevel', 'info') as string,
      theme: store.get('theme', 'auto') as string,
      language: store.get('language', 'ru') as string,
      notifications: store.get('notifications', true) as boolean,
      updateCheck: store.get('updateCheck', true) as boolean,
    }
  }

  private saveConfig(): void {
    Object.entries(this.config).forEach(([key, value]) => {
      store.set(key, value)
    })
  }

  private setupApp(): void {
    // Настройка приложения
    app.setName('Traffic Router')
    
    // Обработчики событий приложения
    app.whenReady().then(() => {
      this.createWindow()
      this.createTray()
      this.setupIPC()
      this.setupAutoUpdater()
      
      if (this.config.autoStart) {
        this.startServer()
      }
    })

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.cleanup()
        app.quit()
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow()
      }
    })

    app.on('before-quit', () => {
      this.cleanup()
    })
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 600,
      icon: this.getIconPath(),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: !isDev
      },
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false
    })

    // Загрузка интерфейса
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:3000')
      this.mainWindow.webContents.openDevTools()
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }

    // Показать окно когда готово
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show()
    })

    // Обработка закрытия окна
    this.mainWindow.on('close', (event) => {
      if (this.config.minimizeToTray && !app.isQuiting) {
        event.preventDefault()
        this.mainWindow?.hide()
      }
    })

    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })

    // Настройка меню
    this.setupMenu()
  }

  private createTray(): void {
    this.tray = new Tray(this.getIconPath())
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Показать',
        click: () => {
          this.mainWindow?.show()
        }
      },
      {
        label: 'Скрыть',
        click: () => {
          this.mainWindow?.hide()
        }
      },
      { type: 'separator' },
      {
        label: 'Запустить сервер',
        click: () => {
          this.startServer()
        }
      },
      {
        label: 'Остановить сервер',
        click: () => {
          this.stopServer()
        }
      },
      { type: 'separator' },
      {
        label: 'Выход',
        click: () => {
          app.isQuiting = true
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
    this.tray.setToolTip('Traffic Router')

    this.tray.on('double-click', () => {
      this.mainWindow?.show()
    })
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Файл',
        submenu: [
          {
            label: 'Настройки',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              this.mainWindow?.webContents.send('show-settings')
            }
          },
          { type: 'separator' },
          {
            label: 'Выход',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.isQuiting = true
              app.quit()
            }
          }
        ]
      },
      {
        label: 'Сервер',
        submenu: [
          {
            label: 'Запустить',
            click: () => {
              this.startServer()
            }
          },
          {
            label: 'Остановить',
            click: () => {
              this.stopServer()
            }
          },
          {
            label: 'Перезапустить',
            click: () => {
              this.restartServer()
            }
          },
          { type: 'separator' },
          {
            label: 'Показать логи',
            click: () => {
              this.mainWindow?.webContents.send('show-logs')
            }
          }
        ]
      },
      {
        label: 'Вид',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Справка',
        submenu: [
          {
            label: 'О программе',
            click: () => {
              this.showAbout()
            }
          },
          {
            label: 'Проверить обновления',
            click: () => {
              autoUpdater.checkForUpdatesAndNotify()
            }
          },
          { type: 'separator' },
          {
            label: 'Открыть GitHub',
            click: () => {
              shell.openExternal('https://github.com/traffic-router/desktop-app')
            }
          }
        ]
      }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  private setupIPC(): void {
    // Получение конфигурации
    ipcMain.handle('get-config', () => {
      return this.config
    })

    // Сохранение конфигурации
    ipcMain.handle('save-config', (_, newConfig: Partial<AppConfig>) => {
      this.config = { ...this.config, ...newConfig }
      this.saveConfig()
      return this.config
    })

    // Управление сервером
    ipcMain.handle('start-server', () => {
      return this.startServer()
    })

    ipcMain.handle('stop-server', () => {
      return this.stopServer()
    })

    ipcMain.handle('restart-server', () => {
      return this.restartServer()
    })

    ipcMain.handle('get-server-status', () => {
      return {
        running: this.serverProcess !== null,
        pid: this.serverProcess?.pid
      }
    })

    // Системные функции
    ipcMain.handle('show-message-box', (_, options) => {
      return dialog.showMessageBox(this.mainWindow!, options)
    })

    ipcMain.handle('show-open-dialog', (_, options) => {
      return dialog.showOpenDialog(this.mainWindow!, options)
    })

    ipcMain.handle('show-save-dialog', (_, options) => {
      return dialog.showSaveDialog(this.mainWindow!, options)
    })

    // Управление окном
    ipcMain.handle('minimize-window', () => {
      this.mainWindow?.minimize()
    })

    ipcMain.handle('maximize-window', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow.unmaximize()
      } else {
        this.mainWindow?.maximize()
      }
    })

    ipcMain.handle('close-window', () => {
      this.mainWindow?.close()
    })
  }

  private setupAutoUpdater(): void {
    if (!isDev && this.config.updateCheck) {
      autoUpdater.checkForUpdatesAndNotify()

      autoUpdater.on('update-available', () => {
        this.mainWindow?.webContents.send('update-available')
      })

      autoUpdater.on('update-downloaded', () => {
        this.mainWindow?.webContents.send('update-downloaded')
      })
    }
  }

  private async startServer(): Promise<boolean> {
    if (this.serverProcess) {
      console.log('Server is already running')
      return true
    }

    try {
      const serverPath = this.getServerPath()
      const args = [
        '--port', this.config.proxyPort.toString(),
        '--log-level', this.config.logLevel
      ]

      this.serverProcess = spawn('node', [serverPath, ...args], {
        cwd: path.dirname(serverPath),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.serverProcess.stdout?.on('data', (data) => {
        console.log(`Server stdout: ${data}`)
        this.mainWindow?.webContents.send('server-log', { type: 'stdout', data: data.toString() })
      })

      this.serverProcess.stderr?.on('data', (data) => {
        console.error(`Server stderr: ${data}`)
        this.mainWindow?.webContents.send('server-log', { type: 'stderr', data: data.toString() })
      })

      this.serverProcess.on('close', (code) => {
        console.log(`Server process exited with code ${code}`)
        this.serverProcess = null
        this.mainWindow?.webContents.send('server-stopped', code)
      })

      this.mainWindow?.webContents.send('server-started')
      return true
    } catch (error) {
      console.error('Failed to start server:', error)
      this.mainWindow?.webContents.send('server-error', error)
      return false
    }
  }

  private async stopServer(): Promise<boolean> {
    if (!this.serverProcess) {
      console.log('Server is not running')
      return true
    }

    try {
      this.serverProcess.kill('SIGTERM')
      
      // Ждем завершения процесса
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.serverProcess) {
            this.serverProcess.kill('SIGKILL')
          }
          resolve()
        }, 5000)

        this.serverProcess!.on('close', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      this.serverProcess = null
      this.mainWindow?.webContents.send('server-stopped')
      return true
    } catch (error) {
      console.error('Failed to stop server:', error)
      return false
    }
  }

  private async restartServer(): Promise<boolean> {
    await this.stopServer()
    await new Promise(resolve => setTimeout(resolve, 1000))
    return this.startServer()
  }

  private getServerPath(): string {
    if (isDev) {
      return path.join(__dirname, '../../../server/ai-proxy-server.js')
    } else {
      return path.join(process.resourcesPath, 'server/ai-proxy-server.js')
    }
  }

  private getIconPath(): string {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 
                     process.platform === 'darwin' ? 'icon.icns' : 'icon.png'
    
    if (isDev) {
      return path.join(__dirname, '../build', iconName)
    } else {
      return path.join(process.resourcesPath, 'build', iconName)
    }
  }

  private showAbout(): void {
    dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: 'О программе',
      message: 'Traffic Router',
      detail: `Версия: ${app.getVersion()}\n\nСистема маршрутизации трафика с геолокацией\nдля обхода блокировок и оптимизации доступа к AI-сервисам.\n\nРазработано для обеспечения стабильного доступа\nк международным сервисам из России.`,
      buttons: ['OK']
    })
  }

  private cleanup(): void {
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM')
    }
  }
}

// Запуск приложения
new TrafficRouterApp()

// Расширение типов для app
declare global {
  namespace Electron {
    interface App {
      isQuiting?: boolean
    }
  }
}