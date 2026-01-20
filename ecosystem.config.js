module.exports = {
  apps: [
    {
      name: 'pivart',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        TZ: 'UTC',
        PORT: 3000
      },
      // 日志配置
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 自动重启配置
      exp_backoff_restart_delay: 100,
      max_restarts: 10
    }
  ]
};
