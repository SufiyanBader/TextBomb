# TextBomb — WhatsApp Business Messaging Platform

Production-grade multi-tenant SaaS for WhatsApp Business API messaging.
Fully Meta-compliant: opt-in enforced, approved templates only, real delivery receipts.

---

## Prerequisites

Install these directly on your machine (no Docker needed):

- **Node.js 18+** — https://nodejs.org
- **PostgreSQL 14+** — https://postgresql.org/download
- **Redis 7+** — https://redis.io/download

---

## 1. Install PostgreSQL (no Docker)

### macOS
```bash
brew install postgresql@15
brew services start postgresql@15
createdb textbomb
```

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo -u postgres psql -c "CREATE DATABASE textbomb;"
sudo -u postgres psql -c "CREATE USER textbomb_user WITH PASSWORD 'yourpassword';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE textbomb TO textbomb_user;"
```

### Windows
Download installer from https://postgresql.org/download/windows
Then open pgAdmin or psql and run:
```sql
CREATE DATABASE textbomb;
```

---

## 2. Install Redis (no Docker)

### macOS
```bash
brew install redis
brew services start redis
```

### Ubuntu / Debian
```bash
sudo apt update
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
# Verify:
redis-cli ping   # should return PONG
```

### Windows
Download from https://github.com/microsoftarchive/redis/releases
Or use WSL2 and follow Ubuntu steps above.

---

## 3. Clone & Configure

```bash
git clone <your-repo-url>
cd textbomb
```

### Configure server environment
```bash
cp server/.env.example server/.env
```

Open `server/.env` and fill in:

```env
PORT=5000
NODE_ENV=development

# PostgreSQL — adjust user/password/host to match your install
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/textbomb

# Redis
REDIS_URL=redis://localhost:6379

# JWT — generate strong secrets:
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_REFRESH_SECRET=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# Encryption key — MUST be exactly 64 hex characters (32 bytes):
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your64hexcharacterencryptionkey

# Meta / WhatsApp Business API
META_APP_SECRET=your_meta_app_secret
META_WEBHOOK_VERIFY_TOKEN=any_string_you_choose

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:3000
```

### Generate all secrets at once
```bash
node -e "
  const c = require('crypto');
  console.log('JWT_SECRET=' + c.randomBytes(32).toString('hex'));
  console.log('JWT_REFRESH_SECRET=' + c.randomBytes(32).toString('hex'));
  console.log('ENCRYPTION_KEY=' + c.randomBytes(32).toString('hex'));
"
```

---

## 4. Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend (open a new terminal)
cd client
npm install
```

---

## 5. Start the Backend

```bash
cd server
node index.js
```

You should see:
```
✅ PostgreSQL connected
✅ Database synced
✅ Redis connected
✅ Job queues initialized
✅ Cron jobs started
🚀 TextBomb server running on port 5000
```

For development with auto-restart on file changes:
```bash
npm run dev   # uses nodemon
```

---

## 6. Start the Frontend

Open a **new terminal**:

```bash
cd client
npm start
```

App opens at **http://localhost:3000**

---

## 7. First-time Setup

1. Go to **http://localhost:3000/signup**
2. Create your organization and Super Admin account
3. Follow the 3-step onboarding:
   - Connect a WhatsApp Business number
   - Create a department
   - Invite a team member

---

## Meta WhatsApp API Setup

### Step 1: Get API credentials
1. Go to https://developers.facebook.com
2. Create a new App → Business type
3. Add **WhatsApp** product
4. Go to **WhatsApp → API Setup**
5. Copy your **Phone Number ID** and **Temporary Access Token**

### Step 2: Generate a permanent token
In Meta Developer Console:
- Go to **System Users** → Create a system user
- Generate a permanent token with `whatsapp_business_messaging` permission

### Step 3: Configure webhook (for delivery receipts)
After deploying to a public server:
- Webhook URL: `https://yourdomain.com/api/webhooks/whatsapp`
- Verify Token: same value as `META_WEBHOOK_VERIFY_TOKEN` in `.env`
- Subscribe to: `messages`, `message_deliveries`, `message_reads`

For local development, use **ngrok** to expose your local server:
```bash
npx ngrok http 5000
# Use the https URL as your webhook URL in Meta Console
```

---

## Running Both Servers Simultaneously

### Option A: Two terminals
```bash
# Terminal 1
cd server && node index.js

# Terminal 2
cd client && npm start
```

### Option B: Using concurrently (install once)
```bash
npm install -g concurrently

# From the textbomb root directory
concurrently \
  "cd server && node index.js" \
  "cd client && npm start"
```

### Option C: PM2 (recommended for always-on local dev)
```bash
npm install -g pm2

# Start both
pm2 start server/index.js --name textbomb-api
pm2 start "npm start" --name textbomb-ui --cwd ./client

# View logs
pm2 logs

# Stop all
pm2 stop all

# Auto-start on system boot
pm2 startup
pm2 save
```

---

## Troubleshooting

### PostgreSQL connection refused
```bash
# macOS — check if running
brew services list | grep postgresql

# Ubuntu — check status
sudo systemctl status postgresql

# Test connection manually
psql -U postgres -h localhost -d textbomb
```

### Redis connection refused
```bash
# macOS
brew services list | grep redis
redis-cli ping

# Ubuntu
sudo systemctl status redis-server
redis-cli ping
```

### Port 5000 already in use
```bash
# Find what's using it
lsof -i :5000
# Kill it
kill -9 <PID>

# Or change the port in server/.env
PORT=5001
```

### Port 3000 already in use
```bash
# React will ask if you want to use a different port — press Y
# Or set it explicitly:
PORT=3001 npm start
```

### Database sync errors
```bash
# Drop and recreate (development only — loses all data)
psql -U postgres -c "DROP DATABASE textbomb;"
psql -U postgres -c "CREATE DATABASE textbomb;"
# Then restart the server — it will re-sync automatically
```

### npm install fails
```bash
# Clear cache and retry
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

---

## Project Structure

```
textbomb/
├── client/                          # React + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx                  # Routes
│   │   ├── index.css                # Dark design system
│   │   ├── context/AuthContext.tsx  # Auth state
│   │   ├── utils/api.ts             # Axios + auto token refresh
│   │   ├── components/layout/       # Sidebar, TopBar, Layout
│   │   └── pages/
│   │       ├── admin/NumberPool.tsx # Super Admin number management
│   │       ├── auth/                # Login, Signup, Onboarding
│   │       ├── campaigns/           # List, Create, Analytics
│   │       ├── templates/           # List, Create
│   │       ├── contacts/            # Lists, Upload, Suppression
│   │       ├── accounts/            # WA Accounts
│   │       ├── dashboard/           # Overview
│   │       └── organization/        # Departments, Members, Settings
│   └── package.json
│
├── server/                          # Node.js + Express backend
│   ├── index.js                     # App entry point
│   ├── models/index.js              # 12 Sequelize models
│   ├── middleware/auth.js           # JWT + RBAC
│   ├── routes/                      # 12 route files
│   ├── services/                    # WhatsApp API, Redis, Notifications
│   ├── jobs/                        # Bull.js queue + cron jobs
│   ├── utils/encryption.js          # AES-256-GCM
│   └── .env.example
│
└── README.md
```

---

## User Roles

| Role | Access |
|---|---|
| **Super Admin** | Everything — org settings, number pool, all campaigns, billing |
| **Dept Admin** | Their department — members, campaigns, templates |
| **Member** | View analytics, optionally send campaigns |

## Number Pool (Super Admin)

The Number Pool (`/admin/number-pool`) lets Super Admins:
- Add WhatsApp Business numbers centrally
- Assign numbers to specific departments
- Rotate API keys without breaking campaigns
- View per-number stats and assignment history

Dept Admins and Members only see numbers assigned to their department — credentials are never exposed to the frontend.

---

## Security Notes

- All API keys encrypted at rest with AES-256-GCM
- Passwords hashed with bcrypt (12 rounds)
- JWT with 24h expiry + Redis-stored refresh tokens (7 days)
- Every DB query scoped to `organization_id` via middleware
- Meta webhook verified with HMAC-SHA256
- Opt-in enforced at queue level — non-opted contacts never messaged
