# GitHub Repository Structure for Unified Render Deployment

## Overview
For a single Render web service deploying both systems, organize as a monorepo:

```
toks-school-unified/
│
├── server/                  # Uniform backend (Express + PostgreSQL)
│   ├── src/
│   │   ├── index.js        # Entry point
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── db/
│   │   └── services/
│   ├── package.json
│   └── .env.example
│
├── kitchen/                 # Kitchen backend (Express + PostgreSQL)
│   ├── server.js           # Entry point
│   ├── public/             # Static HTML
│   ├── db/                 # Database setup scripts
│   ├── package.json
│   └── .env.example
│
├── client/                  # React Frontend (Vite)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/
│   │   ├── api.js          # API calls to /api/*
│   │   └── App.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
│
├── render-server.js        # Express gateway (routes both APIs)
├── start-unified.js        # Unified starter (spawns both backends + gateway)
├── ecosystem.config.js     # PM2 config (optional)
├── package.json            # Root scripts
├── .env.production         # Production env vars
├── .env.example            # Example env
├── render.yaml             # Render deployment config
├── DEPLOYMENT.md           # Deployment guide
└── README.md
```

## Setup Steps

### 1. Create GitHub Repository
```bash
git init toks-school-unified
cd toks-school-unified
```

### 2. Copy Uniform System
```bash
cp -r ~/Desktop/TOKS\ uniform/* .
# or git clone your existing uniform repo
```

### 3. Add Kitchen System
```bash
# Option A: Copy kitchen folder
cp -r ~/Documents/ocean\ kitchen ./kitchen

# Option B: Git submodule (if kitchen is in a separate repo)
git submodule add <kitchen-repo-url> kitchen
```

### 4. Create .env.example
```bash
# Uniform
UNIFORM_DATABASE_URL=postgresql://user:password@db.render.com/toks_uniform
UNIFORM_API_PORT=5001

# Kitchen
KITCHEN_DATABASE_URL=postgresql://user:password@db.render.com/kitchen_db
KITCHEN_API_PORT=5002

# Gateway
PORT=3000
NODE_ENV=production

# JWT & Sessions
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret
```

### 5. Push to GitHub
```bash
git add .
git commit -m "Initial unified deployment setup"
git push origin main
```

## Render Deployment

### 1. Create Render Account
- Sign up at render.com
- Connect GitHub

### 2. Create PostgreSQL Databases
- Create two databases:
  - `toks_uniform`
  - `kitchen_db`
- Note the connection strings

### 3. Create Web Service
- Click "New +" → "Web Service"
- Select GitHub repository
- Configuration:
  - **Name:** `toks-school-unified`
  - **Runtime:** Node
  - **Build Command:** 
    ```
    npm install && cd server && npm install && cd ../client && npm run build && cd ../kitchen && npm install
    ```
  - **Start Command:** 
    ```
    node start-unified.js
    ```
  - **Plan:** Choose based on usage (Starter = free)

### 4. Set Environment Variables
In Render dashboard:
- `NODE_ENV` = `production`
- `PORT` = `3000`
- `UNIFORM_API_PORT` = `5001`
- `KITCHEN_API_PORT` = `5002`
- `UNIFORM_DATABASE_URL` = (PostgreSQL connection string from Render)
- `KITCHEN_DATABASE_URL` = (PostgreSQL connection string from Render)
- `JWT_SECRET` = (generate random string)
- `SESSION_SECRET` = (generate random string)

### 5. Deploy
- Click "Create Web Service"
- Render automatically:
  - Installs dependencies
  - Builds React frontend
  - Starts unified.js which spawns both backends
  - Routes traffic through render-server.js

## URL Structure on Render

After deployment (e.g., `https://toks-school-unified.onrender.com`):

```
Home:                 https://toks-school-unified.onrender.com/
Login:                https://toks-school-unified.onrender.com/login

Uniform API:          https://toks-school-unified.onrender.com/api/*
  - POST /api/auth/login
  - GET /api/dashboard/stats
  - etc.

Kitchen API:          https://toks-school-unified.onrender.com/kitchen/api/*
  - POST /kitchen/api/auth/login
  - GET /kitchen/api/health
  - etc.

Kitchen App:          https://toks-school-unified.onrender.com/kitchen
```

## Local Testing (Unified Mode)

Before pushing to GitHub, test locally:

```bash
# Build frontend
cd client && npm run build && cd ..

# Start all services (gateway, both backends)
npm start   # runs start-unified.js

# Should see all three starting:
# 📚 Starting Uniform API on port 5001...
# 🍳 Starting Kitchen API on port 5002...
# 🌐 Starting Gateway on port 3000...

# Visit: http://localhost:3000
# Test login and both systems
```

## Troubleshooting

### Gateway can't reach backends
- Check `UNIFORM_API_PORT` and `KITCHEN_API_PORT` env vars
- Ensure both backends start before gateway (2s delay in start-unified.js)

### Kitchen login 401
- Check kitchen database credentials
- Verify kitchen_db has users table
- Ensure kitchen server started successfully

### Static files 404
- Confirm `npm run build` runs in build command
- Check `client/dist` folder exists

### CORS errors
- Both backends should allow the gateway origin
- Update CORS in `server/src/index.js` and `kitchen/server.js`:
  ```javascript
  cors({
    origin: [process.env.VITE_KITCHEN_URL || '*'],
    credentials: true
  })
  ```

## Database Setup

### First time on Render:

1. **Uniform Database:**
   ```bash
   cd server && npm run db:setup
   ```

2. **Kitchen Database:**
   ```bash
   cd kitchen && npm run init-db
   ```

Run these manually in Render shell after deployment, or add to build command.

## Scaling

If you need separate instances per service later, you can:
- Deploy `server/` as a separate Web Service
- Deploy `kitchen/` as a separate Web Service
- Deploy `client/` as a Static Site
- Use Render's Internal Networking for service-to-service calls

For now, a single service with all three components is simpler and cheaper.
