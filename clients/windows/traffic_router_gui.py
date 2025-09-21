import tkinter as tk
from tkinter import ttk, messagebox
import threading
import time
import json
import requests
from typing import Dict, Any, Optional

class TrafficRouterGUI:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Traffic Router - Система маршрутизации трафика")
        self.root.geometry("800x600")
        self.root.resizable(True, True)
        
        # Конфигурация
        self.config = {
            "server_url": "http://localhost:8080",
            "proxy_port": 1080,
            "auto_start": True,
            "minimize_to_tray": True,
            "start_with_system": False,
            "log_level": "info",
            "theme": "auto",
            "language": "ru",
            "notifications": True,
            "update_check": True
        }
        
        # Состояние
        self.status = {
            "connected": False,
            "server_reachable": False,
            "proxy_active": False,
            "current_region": "Unknown",
            "bytes_transferred": 0,
            "active_connections": 0,
            "last_error": None
        }
        
        self.stats = {
            "total_requests": 0,
            "proxied_requests": 0,
            "direct_requests": 0,
            "blocked_requests": 0,
            "average_latency": 0,
            "data_transferred": {"upload": 0, "download": 0},
            "top_domains": []
        }
        
        self.is_connecting = False
        self.update_thread = None
        self.running = True
        
        self.setup_ui()
        self.start_update_thread()
        
    def setup_ui(self):
        """Настройка пользовательского интерфейса"""
        # Стиль
        style = ttk.Style()
        style.theme_use('clam')
        
        # Главное меню
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Файл", menu=file_menu)
        file_menu.add_command(label="Настройки", command=self.show_settings)
        file_menu.add_separator()
        file_menu.add_command(label="Выход", command=self.on_closing)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Справка", menu=help_menu)
        help_menu.add_command(label="О программе", command=self.show_about)
        
        # Основной фрейм
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Заголовок
        title_frame = ttk.Frame(main_frame)
        title_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(title_frame, text="Traffic Router", font=('Arial', 16, 'bold')).grid(row=0, column=0, sticky=tk.W)
        
        self.status_label = ttk.Label(title_frame, text="Отключено", foreground="red")
        self.status_label.grid(row=0, column=1, sticky=tk.E)
        
        # Управление подключением
        connection_frame = ttk.LabelFrame(main_frame, text="Управление подключением", padding="10")
        connection_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(connection_frame, text="Сервер:").grid(row=0, column=0, sticky=tk.W, padx=(0, 10))
        ttk.Label(connection_frame, text="localhost:8080").grid(row=0, column=1, sticky=tk.W)
        
        self.connect_button = ttk.Button(connection_frame, text="Подключиться", command=self.toggle_connection)
        self.connect_button.grid(row=0, column=2, sticky=tk.E, padx=(10, 0))
        
        ttk.Label(connection_frame, text="Прокси:").grid(row=1, column=0, sticky=tk.W, padx=(0, 10), pady=(10, 0))
        ttk.Label(connection_frame, text="Порт 1080").grid(row=1, column=1, sticky=tk.W, pady=(10, 0))
        
        self.proxy_var = tk.BooleanVar()
        self.proxy_checkbox = ttk.Checkbutton(connection_frame, text="Активен", variable=self.proxy_var, command=self.toggle_proxy)
        self.proxy_checkbox.grid(row=1, column=2, sticky=tk.E, padx=(10, 0), pady=(10, 0))
        
        # Notebook для вкладок
        notebook = ttk.Notebook(main_frame)
        notebook.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # Вкладка "Статус"
        status_frame = ttk.Frame(notebook, padding="10")
        notebook.add(status_frame, text="Статус")
        
        # Статистика в реальном времени
        stats_frame = ttk.LabelFrame(status_frame, text="Текущее состояние", padding="10")
        stats_frame.grid(row=0, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(stats_frame, text="Регион:").grid(row=0, column=0, sticky=tk.W)
        self.region_label = ttk.Label(stats_frame, text="Unknown")
        self.region_label.grid(row=0, column=1, sticky=tk.W, padx=(10, 0))
        
        ttk.Label(stats_frame, text="Соединения:").grid(row=1, column=0, sticky=tk.W)
        self.connections_label = ttk.Label(stats_frame, text="0")
        self.connections_label.grid(row=1, column=1, sticky=tk.W, padx=(10, 0))
        
        ttk.Label(stats_frame, text="Передано:").grid(row=2, column=0, sticky=tk.W)
        self.transferred_label = ttk.Label(stats_frame, text="0 B")
        self.transferred_label.grid(row=2, column=1, sticky=tk.W, padx=(10, 0))
        
        # Вкладка "Статистика"
        statistics_frame = ttk.Frame(notebook, padding="10")
        notebook.add(statistics_frame, text="Статистика")
        
        # Счетчики запросов
        requests_frame = ttk.LabelFrame(statistics_frame, text="Запросы", padding="10")
        requests_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(requests_frame, text="Всего:").grid(row=0, column=0, sticky=tk.W)
        self.total_requests_label = ttk.Label(requests_frame, text="0")
        self.total_requests_label.grid(row=0, column=1, sticky=tk.W, padx=(10, 0))
        
        ttk.Label(requests_frame, text="Через прокси:").grid(row=1, column=0, sticky=tk.W)
        self.proxied_requests_label = ttk.Label(requests_frame, text="0", foreground="blue")
        self.proxied_requests_label.grid(row=1, column=1, sticky=tk.W, padx=(10, 0))
        
        ttk.Label(requests_frame, text="Напрямую:").grid(row=2, column=0, sticky=tk.W)
        self.direct_requests_label = ttk.Label(requests_frame, text="0", foreground="green")
        self.direct_requests_label.grid(row=2, column=1, sticky=tk.W, padx=(10, 0))
        
        ttk.Label(requests_frame, text="Заблокировано:").grid(row=3, column=0, sticky=tk.W)
        self.blocked_requests_label = ttk.Label(requests_frame, text="0", foreground="red")
        self.blocked_requests_label.grid(row=3, column=1, sticky=tk.W, padx=(10, 0))
        
        # Передача данных
        transfer_frame = ttk.LabelFrame(statistics_frame, text="Передача данных", padding="10")
        transfer_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(transfer_frame, text="Загружено:").grid(row=0, column=0, sticky=tk.W)
        self.upload_label = ttk.Label(transfer_frame, text="0 B")
        self.upload_label.grid(row=0, column=1, sticky=tk.W, padx=(10, 0))
        
        ttk.Label(transfer_frame, text="Скачано:").grid(row=1, column=0, sticky=tk.W)
        self.download_label = ttk.Label(transfer_frame, text="0 B")
        self.download_label.grid(row=1, column=1, sticky=tk.W, padx=(10, 0))
        
        ttk.Label(transfer_frame, text="Задержка:").grid(row=2, column=0, sticky=tk.W)
        self.latency_label = ttk.Label(transfer_frame, text="0 ms")
        self.latency_label.grid(row=2, column=1, sticky=tk.W, padx=(10, 0))
        
        # Вкладка "Домены"
        domains_frame = ttk.Frame(notebook, padding="10")
        notebook.add(domains_frame, text="Домены")
        
        # Список топ доменов
        domains_list_frame = ttk.LabelFrame(domains_frame, text="Топ доменов", padding="10")
        domains_list_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Treeview для доменов
        self.domains_tree = ttk.Treeview(domains_list_frame, columns=('requests',), show='tree headings')
        self.domains_tree.heading('#0', text='Домен')
        self.domains_tree.heading('requests', text='Запросы')
        self.domains_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Scrollbar для списка доменов
        domains_scrollbar = ttk.Scrollbar(domains_list_frame, orient=tk.VERTICAL, command=self.domains_tree.yview)
        domains_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.domains_tree.configure(yscrollcommand=domains_scrollbar.set)
        
        # Кнопки управления
        buttons_frame = ttk.Frame(main_frame)
        buttons_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E))
        
        ttk.Button(buttons_frame, text="Очистить статистику", command=self.clear_stats).grid(row=0, column=0, padx=(0, 10))
        ttk.Button(buttons_frame, text="Тест соединения", command=self.test_connection).grid(row=0, column=1, padx=(0, 10))
        
        # Настройка растягивания
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(2, weight=1)
        
        # Обработка закрытия окна
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
    def start_update_thread(self):
        """Запуск потока обновления данных"""
        self.update_thread = threading.Thread(target=self.update_loop, daemon=True)
        self.update_thread.start()
        
    def update_loop(self):
        """Цикл обновления данных"""
        while self.running:
            try:
                if self.status["connected"]:
                    self.fetch_stats()
                self.update_ui()
                time.sleep(5)  # Обновление каждые 5 секунд
            except Exception as e:
                print(f"Error in update loop: {e}")
                time.sleep(10)
                
    def fetch_stats(self):
        """Получение статистики с сервера"""
        try:
            response = requests.get(f"{self.config['server_url']}/stats", timeout=5)
            if response.ok:
                server_stats = response.json()
                self.update_stats_from_server(server_stats)
        except Exception as e:
            print(f"Failed to fetch stats: {e}")
            
    def update_stats_from_server(self, server_stats: Dict[str, Any]):
        """Обновление статистики из данных сервера"""
        self.stats.update({
            "total_requests": server_stats.get("totalRequests", 0),
            "proxied_requests": server_stats.get("proxiedRequests", 0),
            "direct_requests": server_stats.get("directRequests", 0),
            "blocked_requests": server_stats.get("blockedRequests", 0),
            "average_latency": server_stats.get("averageLatency", 0),
            "data_transferred": server_stats.get("dataTransferred", {"upload": 0, "download": 0}),
            "top_domains": server_stats.get("topDomains", [])
        })
        
        self.status.update({
            "active_connections": server_stats.get("activeConnections", 0),
            "bytes_transferred": server_stats.get("bytesTransferred", 0),
            "current_region": server_stats.get("currentRegion", "Unknown")
        })
        
    def update_ui(self):
        """Обновление пользовательского интерфейса"""
        def update():
            # Обновление статуса подключения
            if self.status["connected"]:
                self.status_label.config(text="Подключено", foreground="green")
                self.connect_button.config(text="Отключиться")
                self.proxy_checkbox.config(state="normal")
            else:
                self.status_label.config(text="Отключено", foreground="red")
                self.connect_button.config(text="Подключиться")
                self.proxy_checkbox.config(state="disabled")
                
            # Обновление состояния прокси
            self.proxy_var.set(self.status["proxy_active"])
            
            # Обновление текущего состояния
            self.region_label.config(text=self.status["current_region"])
            self.connections_label.config(text=str(self.status["active_connections"]))
            self.transferred_label.config(text=self.format_bytes(self.status["bytes_transferred"]))
            
            # Обновление статистики запросов
            self.total_requests_label.config(text=f"{self.stats['total_requests']:,}")
            self.proxied_requests_label.config(text=f"{self.stats['proxied_requests']:,}")
            self.direct_requests_label.config(text=f"{self.stats['direct_requests']:,}")
            self.blocked_requests_label.config(text=f"{self.stats['blocked_requests']:,}")
            
            # Обновление передачи данных
            self.upload_label.config(text=self.format_bytes(self.stats["data_transferred"]["upload"]))
            self.download_label.config(text=self.format_bytes(self.stats["data_transferred"]["download"]))
            self.latency_label.config(text=f"{self.stats['average_latency']} ms")
            
            # Обновление списка доменов
            self.update_domains_list()
            
        self.root.after(0, update)
        
    def update_domains_list(self):
        """Обновление списка доменов"""
        # Очистка существующих элементов
        for item in self.domains_tree.get_children():
            self.domains_tree.delete(item)
            
        # Добавление новых элементов
        for i, domain in enumerate(self.stats["top_domains"][:10]):
            self.domains_tree.insert('', 'end', text=domain["domain"], values=(domain["requests"],))
            
    def toggle_connection(self):
        """Переключение подключения"""
        if self.is_connecting:
            return
            
        if self.status["connected"]:
            self.disconnect()
        else:
            self.connect()
            
    def connect(self):
        """Подключение к серверу"""
        def connect_thread():
            self.is_connecting = True
            try:
                response = requests.get(f"{self.config['server_url']}/health", timeout=5)
                if response.ok:
                    self.status["connected"] = True
                    self.status["server_reachable"] = True
                    self.status["last_error"] = None
                else:
                    raise Exception(f"Server responded with status: {response.status}")
            except Exception as e:
                self.status["connected"] = False
                self.status["server_reachable"] = False
                self.status["last_error"] = str(e)
                self.root.after(0, lambda: messagebox.showerror("Ошибка подключения", str(e)))
            finally:
                self.is_connecting = False
                
        threading.Thread(target=connect_thread, daemon=True).start()
        
    def disconnect(self):
        """Отключение от сервера"""
        self.status["connected"] = False
        self.status["server_reachable"] = False
        self.status["proxy_active"] = False
        
    def toggle_proxy(self):
        """Переключение прокси"""
        if not self.status["connected"]:
            return
            
        def proxy_thread():
            try:
                if self.proxy_var.get():
                    response = requests.post(f"{self.config['server_url']}/proxy/start", 
                                           json={"port": self.config["proxy_port"]}, timeout=5)
                    if response.ok:
                        self.status["proxy_active"] = True
                    else:
                        raise Exception(f"Failed to start proxy: {response.status}")
                else:
                    response = requests.post(f"{self.config['server_url']}/proxy/stop", timeout=5)
                    if response.ok:
                        self.status["proxy_active"] = False
                    else:
                        raise Exception(f"Failed to stop proxy: {response.status}")
            except Exception as e:
                self.status["last_error"] = str(e)
                self.root.after(0, lambda: messagebox.showerror("Ошибка прокси", str(e)))
                
        threading.Thread(target=proxy_thread, daemon=True).start()
        
    def clear_stats(self):
        """Очистка статистики"""
        if not self.status["connected"]:
            messagebox.showwarning("Предупреждение", "Необходимо подключение к серверу")
            return
            
        def clear_thread():
            try:
                response = requests.post(f"{self.config['server_url']}/stats/clear", timeout=5)
                if response.ok:
                    # Сброс локальной статистики
                    self.stats = {
                        "total_requests": 0,
                        "proxied_requests": 0,
                        "direct_requests": 0,
                        "blocked_requests": 0,
                        "average_latency": 0,
                        "data_transferred": {"upload": 0, "download": 0},
                        "top_domains": []
                    }
                    self.root.after(0, lambda: messagebox.showinfo("Успех", "Статистика очищена"))
                else:
                    raise Exception(f"Failed to clear stats: {response.status}")
            except Exception as e:
                self.root.after(0, lambda: messagebox.showerror("Ошибка", str(e)))
                
        threading.Thread(target=clear_thread, daemon=True).start()
        
    def test_connection(self):
        """Тест соединения"""
        def test_thread():
            try:
                start_time = time.time()
                response = requests.get(f"{self.config['server_url']}/test", timeout=10)
                latency = int((time.time() - start_time) * 1000)
                
                if response.ok:
                    message = f"Соединение успешно!\nЗадержка: {latency} мс"
                    self.root.after(0, lambda: messagebox.showinfo("Тест соединения", message))
                else:
                    message = f"Ошибка: HTTP {response.status}\nЗадержка: {latency} мс"
                    self.root.after(0, lambda: messagebox.showerror("Тест соединения", message))
            except Exception as e:
                self.root.after(0, lambda: messagebox.showerror("Тест соединения", f"Ошибка: {str(e)}"))
                
        threading.Thread(target=test_thread, daemon=True).start()
        
    def show_settings(self):
        """Показать окно настроек"""
        messagebox.showinfo("Настройки", "Окно настроек будет реализовано в следующей версии")
        
    def show_about(self):
        """Показать информацию о программе"""
        about_text = """Traffic Router v1.0

Система маршрутизации трафика с геолокацией
для обхода блокировок и оптимизации доступа к AI-сервисам.

Разработано для обеспечения стабильного доступа
к международным сервисам из России."""
        messagebox.showinfo("О программе", about_text)
        
    def format_bytes(self, bytes_count: int) -> str:
        """Форматирование байтов в читаемый вид"""
        if bytes_count == 0:
            return "0 B"
        k = 1024
        sizes = ["B", "KB", "MB", "GB", "TB"]
        i = int(math.floor(math.log(bytes_count) / math.log(k)))
        return f"{round(bytes_count / math.pow(k, i), 2)} {sizes[i]}"
        
    def on_closing(self):
        """Обработка закрытия окна"""
        self.running = False
        if self.update_thread and self.update_thread.is_alive():
            self.update_thread.join(timeout=1)
        self.root.destroy()
        
    def run(self):
        """Запуск приложения"""
        self.root.mainloop()

if __name__ == "__main__":
    import math
    app = TrafficRouterGUI()
    app.run()
