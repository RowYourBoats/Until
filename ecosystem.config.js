module.exports = {
  apps: [
    {
      name: 'until',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: 'D:\\ClaudeCoding\\TaskBasedCalendar',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
