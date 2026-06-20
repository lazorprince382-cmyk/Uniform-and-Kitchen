/**
 * Unified Render Production Gateway
 * Routes both Uniform and Kitchen services through a single Express server
 * - Frontend served at root /
 * - Uniform API at /api/*
 * - Kitchen application and API at /kitchen/*
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Proxy config for internal services
const UNIFORM_API_PORT = process.env.UNIFORM_API_PORT || 5001;
const KITCHEN_API_PORT = process.env.KITCHEN_API_PORT || 5002;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

/**
 * Proxy middleware - forwards requests to backend services
 */
async function proxyRequest(targetPort, pathPrefix = '') {
  return async (req, res) => {
    try {
      // `req.url` has the Express mount path removed. For example, a request to
      // /api/health reaches this middleware as /health, but the Uniform server
      // actually exposes /api/health. Always start with originalUrl so mounted
      // API prefixes survive proxying. Kitchen is the only service whose public
      // /kitchen prefix must be stripped before forwarding.
      const sourcePath = req.originalUrl;
      const targetPath = pathPrefix && sourcePath.startsWith(pathPrefix)
        ? sourcePath.slice(pathPrefix.length) || '/'
        : sourcePath;
      const targetUrl = `http://localhost:${targetPort}${targetPath}`;

      const fetchOptions = {
        method: req.method,
        headers: {
          ...req.headers,
          host: `localhost:${targetPort}`,
        },
      };

      // Include body for POST/PATCH/PUT
      if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, fetchOptions);
      const data = await response.text();

      // Copy response headers
      response.headers.forEach((value, name) => {
        if (!['content-encoding', 'transfer-encoding'].includes(name.toLowerCase())) {
          res.setHeader(name, value);
        }
      });

      res.status(response.status);
      res.send(data);
    } catch (err) {
      console.error(`[Proxy Error to port ${targetPort}]`, err.message);
      res.status(503).json({ error: 'Backend service unavailable' });
    }
  };
}

/**
 * Uniform API proxy
 * All requests to /api/* are routed to the Uniform backend
 */
app.use('/api', await proxyRequest(UNIFORM_API_PORT));

/**
 * Kitchen application proxy
 * Route the entire /kitchen subtree to the Kitchen service. The Kitchen
 * server owns both its public frontend and /api routes; proxying only its API
 * would make /kitchen/ fall through to the Uniform React SPA.
 */
app.get('/kitchen', (req, res) => res.redirect(308, '/kitchen/'));
app.use('/kitchen', await proxyRequest(KITCHEN_API_PORT, '/kitchen'));

/**
 * Serve static frontend (React build)
 */
const frontendPath = path.join(__dirname, 'client', 'dist');
app.use(express.static(frontendPath));

/**
 * SPA fallback - serve index.html for client-side routing
 */
app.get('*', (req, res) => {
  // Don't serve HTML for actual API errors
  if (req.path.startsWith('/api') || req.path.startsWith('/kitchen')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

/**
 * Error handling
 */
app.use((err, req, res, next) => {
  console.error('[Gateway Error]', err);
  res.status(500).json({ error: 'Gateway error' });
});

/**
 * Start the gateway
 */
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║       The Ocean of Knowledge - Unified Gateway              ║
╚════════════════════════════════════════════════════════════╝

🌐 Gateway:     http://localhost:${PORT}
📚 Uniform API: http://localhost:${UNIFORM_API_PORT}
🍳 Kitchen API: http://localhost:${KITCHEN_API_PORT}

Routing:
  /api/*              → Uniform Backend
  /kitchen/*          → Kitchen Backend (frontend and API)
  /                   → React Frontend

  `);
});
