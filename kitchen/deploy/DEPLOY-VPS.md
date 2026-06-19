# Deploy Ocean Kitchen to VPS (wired to Uniform Desk)

Deploy path on VPS: `/var/www/ocean-kitchen`  
PM2 name: `kitchen`  
Port: `3002` (Nginx `/kitchen/` already proxies here on HTTPS)

## 1) Upload from Windows (PowerShell)

```powershell
cd "C:\Users\PRINCE\Documents\ocean kitchen"

# Pack app (no node_modules)
tar -czf "$env:USERPROFILE\Desktop\ocean-kitchen.tgz" --exclude=node_modules --exclude=.git .

scp "$env:USERPROFILE\Desktop\ocean-kitchen.tgz" root@185.214.134.41:/tmp/
```

Optional — copy your local kitchen database:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -U postgres -d kitchen_db -Fp -f "$env:USERPROFILE\Desktop\kitchen_local.sql"
scp "$env:USERPROFILE\Desktop\kitchen_local.sql" root@185.214.134.41:/tmp/
```

## 2) Install on VPS (SSH)

```bash
mkdir -p /var/www/ocean-kitchen
tar -xzf /tmp/ocean-kitchen.tgz -C /var/www/ocean-kitchen

cd /var/www/ocean-kitchen
npm install --production

cp deploy/vps.env.example .env
nano .env   # set SESSION_SECRET and verify DATABASE_URL

# First-time DB only (skip if kitchen_db already has your data):
# npm run init-db
# node scripts/seed-sample-users.js

# Or restore local kitchen SQL:
# sudo -u postgres psql -d kitchen_db -f /tmp/kitchen_local.sql

# Wire unified login URL into frontend config
sed -i "s|window.KITCHEN_UNIFIED_LOGIN_URL = .*|window.KITCHEN_UNIFIED_LOGIN_URL = 'http://185.214.134.41:8088/login?system=kitchen';|" public/config.js
cp public/config.production.js public/config.js

pm2 delete kitchen 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

curl -s http://127.0.0.1:3002/api/health
curl -I http://127.0.0.1:3002/
```

Expected health: `{"status":"ok","service":"kitchen"}`

## 3) Wire Uniform login to this kitchen

```bash
cd /var/www/toks-uniform/client
printf "VITE_KITCHEN_URL=/kitchen\n" > .env.production
npm run build
```

Hard refresh: `http://185.214.134.41:8088`

## 4) Verify

```bash
pm2 ls
curl -s http://127.0.0.1:5100/api/health
curl -s http://127.0.0.1:8088/api/health
curl -s http://127.0.0.1:3002/api/health
curl -I http://127.0.0.1:8088/kitchen/
```

Browser:
- Uniform: http://185.214.134.41:8088
- Kitchen direct: https://185.214.134.41/kitchen/

Sample kitchen logins (after `node scripts/seed-sample-users.js`):
- `chef_full` / `ChefFull1!`
- `chef_ops` / `ChefOps1!`

## 5) Kitchen logout → Uniform login (no “Kitchen Sign In” page)

After updating `public/app.js`, `public/index.html`, and `public/styles.css`, on the VPS:

```bash
cd /var/www/ocean-kitchen/public
cp config.production.js config.js
# or: sed as in step 2 for KITCHEN_UNIFIED_LOGIN_URL + set KITCHEN_API_BASE / KITCHEN_BASE_PATH
```

Logout and unauthenticated visits redirect to `http://185.214.134.41:8088/login?system=kitchen` (Uniform Desk with Kitchen selected).

## 6) Session / cookie rules (do not break login)

| Setting | Correct value | Wrong value (breaks login) |
|---------|---------------|----------------------------|
| `PORT` in `.env` / PM2 | `3002` | `3005` or `3000` while nginx uses `3002` |
| `COOKIE_PATH` | `/` | `/kitchen` (express-session skips `/api/*`) |
| nginx `proxy_pass` | `http://127.0.0.1:3002/` **with trailing slash** | no trailing slash |
| nginx `proxy_cookie_path` | **do not add** | any rewrite of cookie path |

Verify after deploy:

```bash
curl -s -c /tmp/k.cookies -b /tmp/k.cookies -X POST http://127.0.0.1:8088/kitchen/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"chef_full","password":"ChefFull1!"}'
# Must return {"user":{...}} not "Could not start session"
```

Note: PM2 restart clears in-memory sessions (users must sign in again once).

## 7) Nginx kitchen proxy (required)

`/kitchen/api/...` must reach the Node app as `/api/...`. Use a **trailing slash** on `proxy_pass`:

```nginx
location ^~ /kitchen/ {
    proxy_pass http://127.0.0.1:3002/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then: `nginx -t && systemctl reload nginx`

Do **not** use `proxy_cookie_path` here (see `deploy/nginx-kitchen-cookie.conf`).

```bash
cd /var/www/ocean-kitchen
# After uploading server.js + ecosystem.config.cjs:
pm2 restart kitchen --update-env
pm2 save

sudo -u postgres psql -d kitchen_db -f /var/www/ocean-kitchen/scripts/fix-user-display-names.sql
```

Rebuild Uniform login (after `Login.jsx` change):

```bash
cd /var/www/toks-uniform/client
printf "VITE_KITCHEN_URL=/kitchen\n" > .env.production
npm run build
```
