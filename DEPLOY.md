# Dhandha API — Deployment Guide

## What you need (all free)
- GitHub account (you have this)
- MongoDB Atlas account — mongodb.com/atlas
- Railway account — railway.app (deploy with GitHub)

---

## Step 1 — MongoDB Atlas setup

1. Go to mongodb.com/atlas → Create free account
2. Create a new project → name it "Dhandha"
3. Build a database → choose **M0 Free tier** → any region
4. Choose **Username and Password** authentication
   - Username: `dhandha-api`
   - Password: generate a strong one, **save it somewhere safe**
5. Under "Where would you like to connect from?" → choose **My Local Environment**
   - Add IP: `0.0.0.0/0` for now (Railway's IPs rotate, so we allow all)
   - You can tighten this later once Railway gives you a static IP
6. Go to **Database → Connect → Drivers**
7. Copy the connection string. It looks like:
   `mongodb+srv://dhandha-api:<password>@cluster0.xxxxx.mongodb.net/`
8. Replace `<password>` with your actual password
9. Add `/dhandha` before the `?` to name your database:
   `mongodb+srv://dhandha-api:YOURPASS@cluster0.xxxxx.mongodb.net/dhandha?retryWrites=true&w=majority`

---

## Step 2 — Create a new GitHub repo for the API

1. Go to github.com → New repository
2. Name it `dhandha-api`
3. Make it **Private** (your API keys will live here as env vars, not in code, but keep the repo private anyway)
4. Push the contents of the `dhandha-api/` folder to this repo:

```bash
cd dhandha-api
git init
git add .
git commit -m "Initial API"
git remote add origin https://github.com/daicikd/dhandha-api.git
git push -u origin main
```

---

## Step 3 — Deploy on Railway

1. Go to railway.app → Login with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `dhandha-api` repo
4. Railway detects Node.js automatically and runs `npm start`

### Set environment variables in Railway:
Click your service → **Variables** tab → Add these one by one:

| Variable | Value |
|---|---|
| `MONGO_URI` | Your Atlas connection string from Step 1 |
| `ALLOWED_ORIGINS` | `https://daicikd.github.io` |
| `ADMIN_KEY` | A long random string (run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate one) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Another long random string (for future use) |

5. Railway will redeploy automatically after you set the variables
6. Click **Settings** → note your public URL, e.g. `https://dhandha-api-production.up.railway.app`

---

## Step 4 — Wire the form in ScentStrip

1. Open `form-submit-snippet.js`
2. Copy all the code
3. Open `ideas/scentstrip/index.html`
4. Find the existing `submitFeedback()` function and the `selectReaction()` / `selectScale()` functions
5. Replace them with the code from the snippet
6. Replace `YOUR_RAILWAY_URL` with your actual Railway URL:
   ```javascript
   const API_URL = 'https://dhandha-api-production.up.railway.app/feedback'
   ```
7. Also add `id="feedback-email"` to your email input field in the form HTML:
   ```html
   <input class="form-input" type="email" id="feedback-email" placeholder="your@email.com">
   ```
8. Push to GitHub Pages

---

## Step 5 — Test it

### Test the health check:
```
https://YOUR-RAILWAY-URL.railway.app/health
```
Should return: `{"ok":true,"status":"operational",...}`

### Test a submission (terminal):
```bash
curl -X POST https://YOUR-RAILWAY-URL.railway.app/feedback \
  -H "Content-Type: application/json" \
  -d '{"idea":"scentstrip","reaction":"🔥 I need this","score":9,"message":"Love it","email":"test@test.com"}'
```
Should return: `{"ok":true,"message":"Feedback received. Thank you!"}`

### Read your feedback (terminal):
```bash
curl https://YOUR-RAILWAY-URL.railway.app/feedback \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

---

## Step 6 — Read your feedback

**Option A — Terminal:**
```bash
curl "https://YOUR-URL.railway.app/feedback?idea=scentstrip" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

**Option B — MongoDB Atlas dashboard:**
1. Go to atlas.mongodb.com
2. Browse Collections → dhandha → feedbacks
3. Read, filter, export as JSON or CSV from there

---

## Security checklist

- [x] `.env` is in `.gitignore` — secrets never pushed to GitHub
- [x] CORS whitelist — only your GitHub Pages domain can call the API
- [x] Rate limiting — max 5 feedback submissions per IP per 10 minutes
- [x] Body size limit — rejects payloads over 10KB
- [x] Input validation — every field checked server-side
- [x] HTML sanitisation — no XSS possible through message field
- [x] NoSQL injection protection — `$` and `.` stripped from all input
- [x] Strict Mongoose schema — unknown fields silently rejected
- [x] IP and User-Agent logged but hidden from API responses
- [x] Admin route protected by secret key header
- [x] Error messages never leak stack traces in production
- [x] Graceful shutdown — DB connection closes cleanly on deploy

## When you're ready to add more idea sites

In `models/Feedback.js`, add to the `ALLOWED_IDEAS` array:
```javascript
const ALLOWED_IDEAS = ['scentstrip', 'kiranapro']
```

In `middleware/validate.js`, update the same list:
```javascript
.isIn(['scentstrip', 'kiranapro']).withMessage('Unknown idea')
```

Then redeploy (Railway auto-deploys on git push).
