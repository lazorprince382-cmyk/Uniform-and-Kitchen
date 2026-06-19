/**
 * PM2 Ecosystem Config - Manages both Uniform and Kitchen backends
 * Used by Render to start both services alongside the gateway
 * 
 * Usage: pm2 start ecosystem.config.js --env production
 */

module.exports = {
  apps: [
    {
      name: 'uniform-api',
      script: './server/src/index.js',
      args: '',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 5001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
    {
      name: 'kitchen-api',
      script: './kitchen/server.js',
      args: '',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 5002,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5002,
      },
    },
    {
      name: 'gateway',
      script: './render-server.js',
      args: '',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        UNIFORM_API_PORT: 5001,
        KITCHEN_API_PORT: 5002,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        UNIFORM_API_PORT: 5001,
        KITCHEN_API_PORT: 5002,
      },
    },
  ],
};
