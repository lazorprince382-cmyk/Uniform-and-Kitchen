# Deployment Guide for Render (Single Web Service)

## Prerequisites
- GitHub account with repos for the project
- Render account (render.com)
- PostgreSQL databases (can use Render's PostgreSQL)

## Setup Steps

### 1. Prepare Database
- Create two Postgres databases on Render:
  - `toks_uniform` (uniform system)
  - `kitchen_db` (kitchen system)

### 2. GitHub Repository Structure
```
toks-school-unified/
├── server/           (Uniform backend)
├── client/           (React frontend)
├── kitchen/          (Kitchen backend - symlink or copy)
├── render-server.js  (Gateway)
├── package.json      (Root)
└── .env.production   (Production config)
```

### 3. Update Client API Configuration

The client now uses:
- `/api/*` for Uniform APIs (proxied from gateway)
- `/kitchen/api/*` for Kitchen APIs (proxied from gateway)

Update `client/src/api.js`:
```javascript
const API_BASE = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3000';

const KITCHEN_API = `${API_BASE}/kitchen`;

// Uniform requests
request(path) → `/api${path}`

// Kitchen requests (in login)
fetch(`${KITCHEN_API}/api/auth/login`)
```

### 4. Create render.yaml

In root directory, create `render.yaml`:
```yaml
services:
  - type: web
    name: toks-school-unified
    runtime: node
    plan: starter
    buildCommand: npm run build:production
    startCommand: node render-server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: UNIFORM_API_PORT
        value: 5001
      - key: KITCHEN_API_PORT
        value: 5002
      - key: UNIFORM_DATABASE_URL
        fromDatabase:
          name: toks_uniform
          property: connectionString
      - key: KITCHEN_DATABASE_URL
        fromDatabase:
          name: kitchen_db
          property: connectionString
```

### 5. Update Root package.json

```json
{
  "scripts": {
    "build:production": "cd client && npm install && npm run build && cd ../server && npm install && cd ../kitchen && npm install",
    "start": "node render-server.js",
    "dev": "concurrently \"npm run dev:uniform\" \"npm run dev:kitchen\" \"npm run dev:client\"",
    "dev:uniform": "cd server && npm run dev",
    "dev:kitchen": "cd kitchen && npm run dev",
    "dev:client": "cd client && npm run dev"
  }
}
```

### 6. Deploy to Render

- Push to GitHub
- Connect Render to GitHub repo
- Select "Deploy via render.yaml"
- Render will automatically:
  - Build the frontend
  - Install dependencies
  - Start both backends on internal ports
  - Run the gateway server

### 7. Both Backends Start as Separate Processes

The gateway (`render-server.js`) expects both backends to be running on their ports. You have two options:

**Option A: Monorepo with PM2 (Recommended for Render)**
- Install PM2 as a process manager
- Create ecosystem.config.js to start both backends
- Gateway proxies to them

**Option B: Docker Compose**
- Create docker-compose.yml with three services (gateway, uniform, kitchen)
- Render can deploy this

### 8. CORS Configuration

Update both backends to allow the gateway:
- Uniform: `cors({ origin: process.env.VITE_KITCHEN_URL || '*' })`
- Kitchen: Same CORS setup

## URL Structure on Render

After deployment at `https://your-app.onrender.com`:

```
Front-end:           https://your-app.onrender.com
Uniform API:         https://your-app.onrender.com/api/*
Kitchen API:         https://your-app.onrender.com/kitchen/api/*
Kitchen Health:      https://your-app.onrender.com/kitchen/api/health
```

## Testing

1. Visit `https://your-app.onrender.com` - Should see login
2. Click "Uniform Desk" - Should POST to `/api/auth/login`
3. Click "Kitchen System" - Should POST to `/kitchen/api/auth/login`
4. Both should work seamlessly from one domain

## Troubleshooting

- **Kitchen API 503**: Ensure `KITCHEN_API_PORT` is set and kitchen server started
- **CORS errors**: Check origin in both backends' CORS config
- **Static files 404**: Verify `client/dist` is built before server starts
- **Database connection**: Check `*_DATABASE_URL` env vars match Render postgres

