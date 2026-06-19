module.exports = {
  apps: [
    {
      name: 'kitchen',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
        COOKIE_PATH: '/',
      },
    },
  ],
};
