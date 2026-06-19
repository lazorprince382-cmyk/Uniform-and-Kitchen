# ✅ Unified Single-Service Deployment - READY TO DEPLOY

## What Was Set Up

Your project is now configured for **Option 1: Single Render Web Service** with both systems running under one domain.

### 📁 Files Created:
- ✅ `render-server.js` - Gateway that routes `/api/*` and `/kitchen/api/*`
- ✅ `start-unified.js` - Starts all 3 services at once
- ✅ `ecosystem.config.js` - PM2 config (optional)
- ✅ `.env.production` - Production environment template
- ✅ `render.yaml` - Render deployment config
- ✅ `DEPLOYMENT.md` - Full deployment guide
- ✅ `GITHUB-STRUCTURE.md` - GitHub setup instructions
- ✅ `README-UNIFIED.md` - Complete project documentation

### 🔧 Code Updates:
- ✅ Updated `client/src/pages/Login.jsx` to support unified routing
- ✅ Kitchen login now uses `/kitchen/api/*` on production
- ✅ Root `package.json` updated with unified scripts

---

## 🚀 Next Steps (In Order)

### Step 1: Add Kitchen to Monorepo
```bash
cp -r ~/Documents/ocean\ kitchen ./kitchen
```

### Step 2: Test Locally (IMPORTANT!)
```bash
cd ~/Desktop/TOKS\ uniform

# Build client
npm run build:production

# Start all services
node start-unified.js

# Should see:
# 📚 Starting Uniform API on port 5001...
# 🍳 Starting Kitchen API on port 5002...
# 🌐 Starting Gateway on port 3000...

# Visit: http://localhost:3000
# Test both login systems
```

### Step 3: Create GitHub Repository
```bash
cd ~/Desktop/TOKS\ uniform

git init
git config user.name "Your Name"
git config user.email "your@email.com"

git add .
git commit -m "Unified single-service deployment setup"

# Create repo on github.com/your-username/toks-school-unified
git remote add origin https://github.com/your-username/toks-school-unified.git
git branch -M main
git push -u origin main
```

### Step 4: Deploy to Render
1. Go to **render.com** → Sign up/Login
2. Click **"New +"** → **"Web Service"**
3. Select your GitHub repo
4. Choose **"Deploy via render.yaml"**
5. Configuration will auto-populate from `render.yaml`
6. Set environment variables:
   - `JWT_SECRET` = (generate random string)
   - `SESSION_SECRET` = (generate random string)
7. Click **"Create Web Service"**

Render will automatically:
- Build React frontend
- Install server dependencies
- Create two PostgreSQL databases
- Start the gateway and both backends

---

## 🌐 What You'll Get

After deployment to `https://your-app-name.onrender.com`:

```
Login Page:          https://your-app-name.onrender.com/
Uniform API:         https://your-app-name.onrender.com/api/*
Kitchen API:         https://your-app-name.onrender.com/kitchen/api/*
Kitchen App:         https://your-app-name.onrender.com/kitchen
```

**One domain, two systems, unified login!**

---

## ✨ Local Development

For ongoing development:

```bash
# Run all services with hot reload
npm run dev

# Or run separately:
npm run dev:server    # Uniform backend
npm run dev:kitchen   # Kitchen backend
npm run dev:client    # React frontend
npm run dev:gateway   # Gateway (if needed)
```

---

## 📖 Reference Documents

- **[README-UNIFIED.md](README-UNIFIED.md)** - Full project overview
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Detailed deployment steps
- **[GITHUB-STRUCTURE.md](GITHUB-STRUCTURE.md)** - GitHub and Render setup
- **[render.yaml](render.yaml)** - Infrastructure configuration
- **[.env.production](.env.production)** - Environment variables

---

## 🐛 Troubleshooting

**Kitchen shows offline after switching tabs?**
- Refresh the page after the build completes locally

**Login fails?**
- Check that both databases have the correct schema
- Verify environment variables are set
- See [DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting)

**Build fails on Render?**
- Check that `kitchen/` folder exists with all files
- Verify all `package.json` files are present
- Check PostgreSQL databases are created

---

## 📋 Checklist Before Deploying

- [ ] Copy `kitchen/` folder into monorepo
- [ ] Test locally: `node start-unified.js`
- [ ] Can login to both Uniform and Kitchen
- [ ] Both systems work after login
- [ ] Create GitHub repository
- [ ] Push all code to GitHub
- [ ] Create Render account
- [ ] Create Web Service from render.yaml
- [ ] Set JWT_SECRET and SESSION_SECRET
- [ ] Deploy and test on Render

---

**Ready to deploy!** 🎉
