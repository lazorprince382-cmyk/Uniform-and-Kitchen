/**
 * Unified Production Starter (No PM2 Required)
 * Spawns both backends and the gateway in a single Node process
 * Suitable for containerized environments like Render
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UNIFORM_PORT = process.env.UNIFORM_API_PORT || 5001;
const KITCHEN_PORT = process.env.KITCHEN_API_PORT || 5002;
const GATEWAY_PORT = process.env.PORT || 3000;
const UNIFORM_DATABASE_URL = process.env.UNIFORM_DATABASE_URL || process.env.DATABASE_URL;
const KITCHEN_DATABASE_URL = process.env.KITCHEN_DATABASE_URL || process.env.DATABASE_URL;
console.log(`
╔════════════════════════════════════════════════════════════╗
║       Starting Unified System Services                      ║
╚════════════════════════════════════════════════════════════╝
`);

/**
 * Start Uniform Backend
 */
console.log(`📚 Starting Uniform API on port ${UNIFORM_PORT}...`);
const uniformProcess = spawn('node', ['server/src/index.js'], {
  cwd: __dirname,
  env: {
    ...process.env,
    PORT: UNIFORM_PORT,
    DATABASE_URL: UNIFORM_DATABASE_URL,
  },
  stdio: 'inherit',
});

uniformProcess.on('error', (err) => {
  console.error('❌ Uniform process error:', err.message);
  process.exit(1);
});

/**
 * Start Kitchen Backend
 */
console.log(`🍳 Starting Kitchen API on port ${KITCHEN_PORT}...`);
const kitchenProcess = spawn('node', ['kitchen/server.js'], {
  cwd: __dirname,
  env: {
    ...process.env,
    PORT: KITCHEN_PORT,
    DATABASE_URL: KITCHEN_DATABASE_URL,
  },
  stdio: 'inherit',
});

kitchenProcess.on('error', (err) => {
  console.error('❌ Kitchen process error:', err.message);
  process.exit(1);
});

/**
 * Wait for both backends to be ready, then start gateway
 */
setTimeout(() => {
  console.log(`\n🌐 Starting Gateway on port ${GATEWAY_PORT}...`);
  const gatewayProcess = spawn('node', ['render-server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: GATEWAY_PORT,
      UNIFORM_API_PORT: UNIFORM_PORT,
      KITCHEN_API_PORT: KITCHEN_PORT,
    },
    stdio: 'inherit',
  });

  gatewayProcess.on('error', (err) => {
    console.error('❌ Gateway process error:', err.message);
    process.exit(1);
  });

  /**
   * Graceful shutdown
   */
  process.on('SIGTERM', () => {
    console.log('\n⏹️  Shutting down services...');
    uniformProcess.kill();
    kitchenProcess.kill();
    gatewayProcess.kill();
    process.exit(0);
  });
}, 2000);
