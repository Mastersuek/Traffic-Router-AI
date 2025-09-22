module.exports = {
  apps: [
    {
      name: 'traffic-router-app',
      script: 'server.js',
      cwd: './',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_file: '.env.production',
      log_file: '/var/log/traffic-router/app.log',
      error_file: '/var/log/traffic-router/app-error.log',
      out_file: '/var/log/traffic-router/app-out.log',
      pid_file: '/var/run/traffic-router-app.pid',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'cache', '.next'],
      merge_logs: true,
      time: true
    },
    {
      name: 'ai-proxy-server',
      script: 'server/ai-proxy-server.js',
      cwd: './',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_file: '.env.production',
      log_file: '/var/log/traffic-router/ai-proxy.log',
      error_file: '/var/log/traffic-router/ai-proxy-error.log',
      out_file: '/var/log/traffic-router/ai-proxy-out.log',
      pid_file: '/var/run/traffic-router-ai-proxy.pid',
      max_memory_restart: '512M',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      merge_logs: true,
      time: true
    },
    {
      name: 'monitoring-server',
      script: 'server/monitoring-server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      env_file: '.env.production',
      log_file: '/var/log/traffic-router/monitoring.log',
      error_file: '/var/log/traffic-router/monitoring-error.log',
      out_file: '/var/log/traffic-router/monitoring-out.log',
      pid_file: '/var/run/traffic-router-monitoring.pid',
      max_memory_restart: '256M',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      merge_logs: true,
      time: true
    },
    {
      name: 'youtube-cache-server',
      script: 'server/youtube-cache-server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      },
      env_file: '.env.production',
      log_file: '/var/log/traffic-router/youtube-cache.log',
      error_file: '/var/log/traffic-router/youtube-cache-error.log',
      out_file: '/var/log/traffic-router/youtube-cache-out.log',
      pid_file: '/var/run/traffic-router-youtube-cache.pid',
      max_memory_restart: '512M',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      merge_logs: true,
      time: true
    },
    {
      name: 'mcp-server',
      script: 'server/mcp-server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      },
      env_file: '.env.production',
      log_file: '/var/log/traffic-router/mcp-server.log',
      error_file: '/var/log/traffic-router/mcp-server-error.log',
      out_file: '/var/log/traffic-router/mcp-server-out.log',
      pid_file: '/var/run/traffic-router-mcp-server.pid',
      max_memory_restart: '256M',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      merge_logs: true,
      time: true
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server-1', 'production-server-2'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/traffic-router.git',
      path: '/var/www/traffic-router',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build:ts && npm run build && pm2 reload ecosystem.production.config.js --env production',
      'pre-setup': '',
      'post-setup': 'ls -la',
      env: {
        NODE_ENV: 'production'
      }
    },
    staging: {
      user: 'deploy',
      host: 'staging-server',
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/traffic-router.git',
      path: '/var/www/traffic-router-staging',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build:ts && npm run build && pm2 reload ecosystem.staging.config.js --env staging',
      'pre-setup': '',
      'post-setup': 'ls -la',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
}