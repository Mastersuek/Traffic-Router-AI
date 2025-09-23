const { contextBridge, ipcRenderer } = require('electron')

// Безопасный API для рендерера
contextBridge.exposeInMainWorld('electronAPI', {
  // Конфигурация
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Управление сервером
  startServer: () => ipcRenderer.invoke('start-server'),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  restartServer: () => ipcRenderer.invoke('restart-server'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),

  // Системные диалоги
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  // Управление окном
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // События от главного процесса
  onServerStarted: (callback) => ipcRenderer.on('server-started', callback),
  onServerStopped: (callback) => ipcRenderer.on('server-stopped', callback),
  onServerError: (callback) => ipcRenderer.on('server-error', callback),
  onServerLog: (callback) => ipcRenderer.on('server-log', callback),
  onShowSettings: (callback) => ipcRenderer.on('show-settings', callback),
  onShowLogs: (callback) => ipcRenderer.on('show-logs', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),

  // Удаление обработчиков
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
})