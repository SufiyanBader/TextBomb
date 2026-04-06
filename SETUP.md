# Quick Setup (No Docker)

## 1. Install PostgreSQL + Redis

### macOS
```bash
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis
createdb textbomb
```

### Ubuntu/Debian
```bash
sudo apt update && sudo apt install -y postgresql redis-server
sudo systemctl start postgresql redis-server
sudo -u postgres createdb textbomb
```

### Windows
- PostgreSQL: https://postgresql.org/download/windows (use default installer)
- Redis: https://github.com/microsoftarchive/redis/releases
- After installing, create database in pgAdmin: `CREATE DATABASE textbomb;`

---

## 2. Run Setup Script
```bash
cd textbomb
npm install          # installs concurrently
node scripts/setup.js
```
Follow the prompts — auto-generates JWT secrets and encryption keys.

---

## 3. Install All Dependencies
```bash
npm run install:all
```

---

## 4. Start
```bash
npm run dev
```
Opens both backend (port 5000) and frontend (port 3000).

Or separately:
```bash
# Terminal 1
cd server && node index.js

# Terminal 2
cd client && npm start
```

---

## 5. Create Your Account
Go to **http://localhost:3000/signup** and create your organization.

---

## Common Issues

| Problem | Fix |
|---|---|
| `ECONNREFUSED 5432` | PostgreSQL not running. Run `brew services start postgresql@15` |
| `ECONNREFUSED 6379` | Redis not running. Run `brew services start redis` |
| `Port 5000 in use` | Change `PORT=5001` in `server/.env` |
| `Port 3000 in use` | React will prompt to use 3001 — press Y |
| Database errors | Drop + recreate: `dropdb textbomb && createdb textbomb` then restart server |
