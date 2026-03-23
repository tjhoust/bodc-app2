# BODC — Business Operations Data Capture
## Developer Setup & Deployment Guide

---

## What's been built

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React PWA | Mobile-ready web app workers install on their phones |
| Backend API | Node.js + Express | All business logic, auth, GPS, approvals |
| Database | PostgreSQL | All data — users, entries, orgs, GPS, audit trail |
| Auth | JWT + bcrypt + TOTP | Secure login with optional 2FA |
| Hosting (test) | Railway + Vercel | Free tiers, deploy in ~30 minutes |

---

## Step 1 — Get the code onto GitHub (~10 minutes)

1. Go to https://github.com and create a free account if you don't have one
2. Click **New repository** → name it `bodc-app` → **Private** → **Create**
3. Download and install **GitHub Desktop**: https://desktop.github.com
4. Open GitHub Desktop → **Add** → **Add Existing Repository** → select the `bodc` folder you received
5. Click **Publish repository** → select your `bodc-app` repo → **Publish**

Your code is now safely stored and version-controlled.

---

## Step 2 — Deploy the database and backend on Railway (~15 minutes)

Railway gives you a free PostgreSQL database and Node.js server.

### 2a. Create Railway account
1. Go to https://railway.app → **Login with GitHub**
2. Click **New Project** → **Deploy from GitHub repo** → select `bodc-app`
3. Set the root directory to `backend`

### 2b. Add a PostgreSQL database
1. In your Railway project, click **New** → **Database** → **PostgreSQL**
2. Railway automatically creates `DATABASE_URL` — it will be linked to your backend

### 2c. Set environment variables
In Railway, click your backend service → **Variables** → add each of these:

```
NODE_ENV=production
RUN_MIGRATIONS=true
JWT_ACCESS_SECRET=    ← generate at: https://generate-secret.vercel.app/64
JWT_REFRESH_SECRET=   ← generate a different one
FRONTEND_URL=         ← leave blank for now, add after Vercel deploy
SMTP_USER=            ← your Gmail address (optional — for invitation emails)
SMTP_PASS=            ← Gmail App Password (optional)
EMAIL_FROM=           BODC <noreply@yourdomain.com>
```

**To generate a Gmail App Password** (for sending invitation emails):
1. Go to your Google Account → Security → 2-Step Verification → App Passwords
2. Create a new app password for "Mail"
3. Use that 16-character password as `SMTP_PASS`

### 2d. Deploy
Click **Deploy**. Railway will:
- Install Node.js dependencies
- Run database migrations (creates all tables automatically)
- Start the API server

After deploy, click your service URL — you should see:
```json
{"status":"ok","app":"BODC API","version":"1.0.0"}
```

**Copy your Railway backend URL** — you'll need it for the frontend.

### 2e. Seed test data
In Railway, open your backend service → **Terminal** → run:
```bash
node src/utils/seed.js
```
This creates:
- Organisation: **Ridgeline Mining**
- 5 users with test data (see login details below)
- Sample time entries, queries, and notifications

---

## Step 3 — Deploy the frontend on Vercel (~10 minutes)

1. Go to https://vercel.com → **Login with GitHub**
2. Click **New Project** → import `bodc-app` → set root directory to `frontend`
3. Add environment variable:
   ```
   REACT_APP_API_URL=https://your-railway-url.railway.app/api
   ```
4. Click **Deploy**

After deploy, copy your Vercel URL (e.g. `https://bodc-app.vercel.app`).

Go back to Railway → your backend service → Variables → add:
```
FRONTEND_URL=https://bodc-app.vercel.app
```
Redeploy the backend.

---

## Step 4 — Test it on your phone

1. Open your Vercel URL on your phone (Chrome on Android, Safari on iOS)
2. Log in with a test account (see below)
3. **To install as a PWA:**
   - **iPhone**: tap the Share button → **Add to Home Screen**
   - **Android**: tap the browser menu → **Install App** / **Add to Home Screen**

The app will appear on your home screen like a native app.

---

## Test accounts

All accounts use password: **Password1!**

| Email | Role | Purpose |
|-------|------|---------|
| superadmin@bodc.app | Super Admin | Platform-level management |
| admin@ridgeline.com.au | Org Admin | Ridgeline Mining admin |
| approver@ridgeline.com.au | Approver | Reviews and approves timesheets |
| jamie@ridgeline.com.au | Worker | Time capture (timer + manual) |
| ryan@ridgeline.com.au | Worker | Time capture (timer) |
| adeola@ridgeline.com.au | Worker | Time capture (manual only) |

---

## API endpoints reference

### Auth
```
POST /api/auth/login              Email + password login
POST /api/auth/refresh            Refresh access token
POST /api/auth/logout             Revoke refresh token
POST /api/auth/forgot-password    Send reset email
POST /api/auth/reset-password     Complete password reset
POST /api/auth/accept-invite      Accept invitation & set password
POST /api/auth/2fa/setup          Get TOTP QR code
POST /api/auth/2fa/verify         Verify and enable 2FA
GET  /api/auth/me                 Current user info
```

### Time Entries
```
GET    /api/entries               List entries (filtered, paginated)
GET    /api/entries/:id           Single entry with GPS track
POST   /api/entries               Create entry
PATCH  /api/entries/:id           Update entry
POST   /api/entries/:id/submit    Submit for approval
POST   /api/entries/:id/approve   Approve entry
POST   /api/entries/bulk-approve  Bulk approve
POST   /api/entries/:id/query     Raise query on entry
POST   /api/entries/sync          Offline batch sync
GET    /api/entries/export/csv    Export filtered CSV
```

### Users
```
GET   /api/users                  List users
POST  /api/users/invite           Invite new user
PATCH /api/users/:id              Update user
GET   /api/users/me/profile       My profile
PATCH /api/users/me/profile       Update my profile
```

### Organisations
```
GET   /api/orgs/me                Current org details
PATCH /api/orgs/me/branding       Update branding
PATCH /api/orgs/me/features       Update feature flags
GET   /api/orgs                   List all orgs (super admin)
POST  /api/orgs                   Create new org (super admin)
```

### Other
```
GET  /api/sites                   List sites
POST /api/sites                   Create site
GET  /api/notifications           My notifications
POST /api/notifications/read-all  Mark all read
GET  /api/reports/summary         Analytics summary
GET  /api/audit                   Audit log
```

---

## Project structure

```
bodc/
├── backend/
│   ├── src/
│   │   ├── index.js              ← Express app entry point
│   │   ├── routes/
│   │   │   ├── auth.js           ← Login, 2FA, password reset
│   │   │   ├── entries.js        ← Time entries, GPS, approvals
│   │   │   └── other.js          ← Users, orgs, sites, reports
│   │   ├── middleware/
│   │   │   └── auth.js           ← JWT verification, role guards
│   │   └── utils/
│   │       ├── db.js             ← PostgreSQL pool + org isolation
│   │       └── audit.js          ← Audit log, notifications, GPS, email
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  ← Full database schema
│   │   └── 002_seed_data.sql       ← Test organisation and data
│   ├── package.json
│   ├── railway.toml              ← Railway deploy config
│   └── .env.example             ← Environment variable template
└── frontend/
    └── (React PWA — next build phase)
```

---

## Next steps

The backend and database are complete. The next build phase is:

1. **React frontend** — all screens from the prototype, connected to this real API
2. **PWA config** — service worker, offline support, install prompt
3. **Push notifications** — via Web Push API

---

## Security notes

- All passwords hashed with bcrypt (12 rounds)
- JWT access tokens expire in 15 minutes; refresh tokens rotate on use
- Row-level security enforced at database level — organisations cannot see each other's data
- Audit log is append-only — no entry can be silently edited
- Rate limiting on all endpoints (20 auth attempts per 15 min, 200 API calls per minute)
- HTTPS enforced by Railway and Vercel in production

---

*BODC v1.0 — Built for Ridgeline Mining test deployment*
