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
const UNIFORM_DATABASE_URL =
  process.env.UNIFORM_DATABASE_URL ||
  process.env.KITCHEN_DATABASE_URL ||
  process.env.DATABASE_URL;

function deriveDatabaseUrl(url, dbName) {
  try {
    const parsed = new URL(url);
    parsed.pathname = `/${dbName}`;
    return parsed.toString();
  } catch (err) {
    return url;
  }
}

const KITCHEN_DATABASE_URL = (() => {
  if (process.env.KITCHEN_DATABASE_URL && process.env.KITCHEN_DATABASE_URL !== UNIFORM_DATABASE_URL) {
    return process.env.KITCHEN_DATABASE_URL;
  }
  if (UNIFORM_DATABASE_URL) {
    console.warn('Warning: using derived kitchen database URL from Uniform DB host; kitchen will use a separate database named kitchen_db.');
    return deriveDatabaseUrl(UNIFORM_DATABASE_URL, 'kitchen_db');
  }
  return process.env.DATABASE_URL;
})();

function maskDbUrl(url) {
  if (!url) return 'missing';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:*****@${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch (err) {
    return 'invalid';
  }
}

console.log(`
╔════════════════════════════════════════════════════════════╗
║       Starting Unified System Services                      ║
╚════════════════════════════════════════════════════════════╝
`);
console.log(`Uniform API port: ${UNIFORM_PORT}`);
console.log(`Kitchen API port: ${KITCHEN_PORT}`);
console.log(`Gateway port: ${GATEWAY_PORT}`);
console.log(`Uniform DB URL: ${maskDbUrl(UNIFORM_DATABASE_URL)}`);
console.log(`Kitchen DB URL: ${maskDbUrl(KITCHEN_DATABASE_URL)}`);
console.log(`Shared DB in use: ${UNIFORM_DATABASE_URL === KITCHEN_DATABASE_URL}`);

async function runKitchenInit() {
  return new Promise((resolve, reject) => {
    console.log('🔧 Initializing Kitchen database schema...');
    const initProcess = spawn('node', ['kitchen/scripts/init-db.js'], {
      cwd: __dirname,
      env: {
        ...process.env,
        DATABASE_URL: KITCHEN_DATABASE_URL,
      },
      stdio: 'inherit',
    });

    initProcess.on('error', (err) => reject(err));
    initProcess.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Kitchen init script exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function startServices() {
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
   * Initialize Kitchen database schema and start Kitchen Backend
   */
  console.log(`🍳 Initializing Kitchen database and starting Kitchen API on port ${KITCHEN_PORT}...`);
  try {
    await runKitchenInit();
  } catch (err) {
    console.error('❌ Kitchen database initialization failed:', err.message);
    process.exit(1);
  }

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
