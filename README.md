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

## Local
```bash
cd slacoin-deploy
npm start
```
Open http://localhost:3000
