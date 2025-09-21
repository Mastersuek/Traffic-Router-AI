module.exports = {
  apps: [
    {
      name: "traffic-router-web",
      script: "npm",
      args: "start",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "traffic-router-proxy",
      script: "server/ai-proxy-server.js",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
        SOCKS_PROXY_PORT: 1080,
      },
    },
    {
      name: "traffic-router-monitor",
      script: "server/monitoring-server.js",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PORT: 8082,
      },
    },
  ],
}
