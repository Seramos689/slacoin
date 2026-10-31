# SLACOIN — Deploy on Render

## Files
- `server.js` — Node HTTP server + API
- `public/index.html` — User app (login, products, recharge, referrals…)
- `public/admin.html` — Admin panel
- `package.json` — start script

## Deploy on Render
1. Push this folder to a GitHub repo
2. Render → **New → Web Service**
3. Connect the repo
4. Settings:
   - **Runtime:** Node
   - **Build Command:** (leave empty)
   - **Start Command:** `npm start`
5. Create Web Service

App URL: `https://your-service.onrender.com/`  
Admin: `https://your-service.onrender.com/admin.html`

### Admin login
- Email: `admin@slacoin.io`
- Password: `Admin@123`

### Demo user
- Username: `demo`
- Password: `Demo@123`

## Storage (Render)
- Server persists users, balances, purchases, products, codes, and pending requests to `data.json` on disk.
- Client keeps a local copy (`localStorage`) and syncs via `/api/sync-user`.
- Earnings are credited to the user balance in real time and when the user returns (offline catch-up).
- **Note:** On Render free tier the filesystem is ephemeral (resets when the service sleeps/redeploys). For durable data, add a Render **persistent disk** mounted at the app root, or use a database.

## Local
```bash
cd slacoin-deploy
npm start
```
Open http://localhost:3000
