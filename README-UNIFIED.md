# The Ocean of Knowledge - Unified System

Single-platform management system for The Ocean of Knowledge School combining:
- **Uniform Desk**: Student uniform inventory, orders, and returns
- **Kitchen System**: Meal planning, ingredient management, and budgeting

## Architecture

**Single Express Gateway** (`render-server.js`) routes both backend services:
```
Client (React) 
    ↓
Gateway (Port 3000) 
    ├─→ /api/* → Uniform Backend (Port 5001)
    └─→ /kitchen/api/* → Kitchen Backend (Port 5002)
```

Both backends share:
- Single Render Web Service
- Separate PostgreSQL databases
- Session/JWT authentication
- Shared frontend login

## Quick Start

### Local Development

```bash
# Install everything
npm run install:all

# Start all services (gateway + both backends + client)
npm run dev

# Or start individual services
npm run dev:server    # Uniform only
npm run dev:kitchen   # Kitchen only
npm run dev:client    # Client only
npm run dev:gateway   # Gateway only
```

**URLs:**
- Frontend: `http://localhost:3000`
- Uniform API: `http://localhost:5000`
- Kitchen API: `http://localhost:3005`

### Production (Render)

1. Copy `kitchen/` folder into this monorepo
2. Update `KITCHEN_DATABASE_URL` in `.env.production`
3. Push to GitHub
4. Connect to Render
5. Deploy with `render.yaml`

**See:** [DEPLOYMENT.md](DEPLOYMENT.md) and [GITHUB-STRUCTURE.md](GITHUB-STRUCTURE.md)

## Project Structure

```
.
├── server/              Uniform backend (Express + JWT)
├── kitchen/             Kitchen backend (Express + Sessions)
├── client/              React frontend (Vite)
├── render-server.js     Express gateway/router
├── start-unified.js     Unified service starter
├── ecosystem.config.js  PM2 process manager config
└── render.yaml          Render deployment config
```

## Key Files

- `render-server.js` - Main gateway that routes both APIs
- `start-unified.js` - Starts all three services for production
- `client/src/pages/Login.jsx` - Unified login (both systems)
- `client/src/api.js` - HTTP client (uses /api/*)
- `.env.production` - Production environment variables
- `render.yaml` - Render deployment configuration

## Login Behavior

The unified login page lets users choose:

1. **Uniform Desk**
   - Email: `bursar@toks.com`
   - Post to: `/api/auth/login`
   - Redirect: `/` (dashboard)

2. **Kitchen System**
   - Username: `chef_full`
   - Post to: `/kitchen/api/auth/login` (or port 3005 in dev)
   - Redirect: `/kitchen` (kitchen app)

## Database Schema

### Uniform (`toks_uniform`)
- Users, Parents, Students
- Products, Categories, Inventory
- Orders, Returns, Stock movements
- Reports and Dashboard data

### Kitchen (`kitchen_db`)
- Users, Roles (admin/chef)
- Ingredients, Units, Allergens
- Meals, Meal ingredients
- Stock movements, Budgets

## API Reference

### Uniform API (`/api/*`)
```
POST   /api/auth/login           Login with email/password
GET    /api/auth/me              Current user
PATCH  /api/auth/profile         Update profile
PATCH  /api/auth/password        Change password

GET    /api/dashboard/stats      Dashboard metrics
GET    /api/products             List products
POST   /api/orders               Create order
GET    /api/reports/stock        Stock report
... etc
```

### Kitchen API (`/kitchen/api/*`)
```
POST   /kitchen/api/auth/login   Login with username/password
GET    /kitchen/api/auth/me      Current user
POST   /kitchen/api/logout       Logout

GET    /kitchen/api/ingredients  List ingredients
POST   /kitchen/api/meals        Create meal
GET    /kitchen/api/budgets      Budget data
... etc
```

## Environment Variables

### Required (Production)
```
NODE_ENV=production
PORT=3000
UNIFORM_API_PORT=5001
KITCHEN_API_PORT=5002
UNIFORM_DATABASE_URL=postgresql://...
KITCHEN_DATABASE_URL=postgresql://...
JWT_SECRET=<random>
SESSION_SECRET=<random>
```

### Optional
```
VITE_KITCHEN_URL=https://your-domain.onrender.com/kitchen
COOKIE_SECURE=true          (production only)
SESSION_MAX_AGE_MS=600000   (10 minutes)
```

## Deployment

### To Render (Single Web Service)

1. **Create Render account** and connect GitHub
2. **Create two PostgreSQL databases**:
   - `toks_uniform`
   - `kitchen_db`
3. **Deploy via render.yaml**:
   - Render → New → Web Service
   - Select GitHub repo
   - Choose "Deploy via render.yaml"
   - Set secrets: `JWT_SECRET`, `SESSION_SECRET`

### To Other Platforms

- **Vercel + Backend**: Deploy frontend to Vercel, backends elsewhere
- **Docker**: See `Dockerfile` (not included, but can be added)
- **Traditional VPS**: Run both backends with PM2 (`npm run start:pm2`)

## Scripts

```bash
# Development
npm run dev                  # All services with hot reload
npm run dev:server          # Uniform only
npm run dev:kitchen         # Kitchen only
npm run dev:client          # Frontend only

# Production
npm run build               # Build React frontend
npm run build:production    # Full production build
npm start                   # Start all services (unified)
npm run start:pm2           # Start with PM2 (optional)

# Database
npm run db:setup            # Setup uniform DB
cd kitchen && npm run init-db  # Setup kitchen DB
```

## Troubleshooting

### Login shows both systems offline
- Check both backends are running
- Verify database connections
- Check browser console for errors

### Kitchen login fails
- Confirm kitchen user exists
- Check kitchen database URL
- Verify session configuration

### Static files 404
- Run `npm run build` to rebuild frontend
- Check `client/dist/` exists
- Verify gateway serves static files

### CORS errors
- Check both backends have `cors()` configured
- Verify origin whitelist in backend CORS config

## Future Improvements

- [ ] Docker containerization
- [ ] Shared authentication service
- [ ] Unified user management
- [ ] Inter-system API communication
- [ ] Unified reporting dashboard
- [ ] Mobile app support

## Support

For deployment issues, see:
- [DEPLOYMENT.md](DEPLOYMENT.md) - Step-by-step guide
- [GITHUB-STRUCTURE.md](GITHUB-STRUCTURE.md) - Repository setup
- `.env.example` - Environment template

## License

Private - The Ocean of Knowledge School
