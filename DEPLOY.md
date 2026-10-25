# Dhandha API: Deployment Guide

The API runs on **Render** (free web service) with **MongoDB Atlas** (free M0 cluster). Everything below is free.

---

## 1. MongoDB Atlas

1. Create a free account at mongodb.com/atlas.
2. Create a project and an **M0 Free** cluster.
3. Under **Database & Network Access**:
   - Add a database user with a strong password.
   - Add `0.0.0.0/0` to the IP access list. Render's free instances do not have fixed outbound IPs.
4. Click **Connect → Drivers** and copy the connection string.
5. Put your password in place of `<password>` and add the database name before the `?`:
   ```
   mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/dhandha?retryWrites=true&w=majority
   ```

---

## 2. Render

1. Sign in at render.com with GitHub.
2. **New → Web Service**, then select this repo.
3. Settings:

   | Field | Value |
   |---|---|
   | Region | Singapore (closest to the Atlas cluster in Mumbai) |
   | Root Directory | leave empty |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | Free |
   | Health Check Path | `/health` |
   | Auto-Deploy | On Commit |

4. Environment variables:

   | Key | Value |
   |---|---|
   | `MONGO_URI` | Atlas connection string from step 1 |
   | `ALLOWED_ORIGINS` | `https://daicikd.github.io` (comma-separate to add more) |
   | `ADMIN_KEY` | a long random string (Render's **Generate** button works) |
   | `NODE_ENV` | `production` |

5. Deploy. The logs should show `MongoDB connected` and `Dhandha API running on port ...`.
6. Open `https://YOUR-SERVICE.onrender.com/health`. It should return `"db":"connected"`.

The server exits on startup if `MONGO_URI`, `ALLOWED_ORIGINS` or `ADMIN_KEY` is missing.

---

## 3. Connect the frontend

In the idea page (for example `Dhandha/ideas/scentstrip/index.html`), set:

```js
const FEEDBACK_API_URL = 'https://YOUR-SERVICE.onrender.com/feedback';
```

Push the Dhandha repo, submit the form once, and confirm the entry appears in Atlas under **Browse Collections → dhandha → feedbacks**.

---

## 4. Keep it awake

Render's free instances sleep after 15 minutes without traffic, and Atlas pauses idle free clusters.

1. Create a free account at uptimerobot.com.
2. **New monitor → HTTP(s)**, URL `https://YOUR-SERVICE.onrender.com/health`, interval 5 minutes.

`/health` pings the database, so this one monitor keeps both Render and Atlas active.

---

## Proxy configuration

`server.js` sets `app.set('trust proxy', 3)`. On Render, requests pass through Cloudflare and Render's internal router before reaching the app, so the visitor's IP is three entries from the end of `X-Forwarded-For`. The rate limiter depends on this value.

**If you move to another host,** measure it again:

1. Temporarily log `req.headers['x-forwarded-for']` in the POST route.
2. Submit the form once and read the log line.
3. Set `trust proxy` to the number of entries added by the host (everything after the visitor's IP, plus one for the hop that connects to the app).
4. Remove the debug log.

Do not set it to `true`: that trusts the whole header, which a client can fake to bypass rate limiting.

---

## Reading feedback

**Atlas:** Browse Collections → dhandha → feedbacks (filter, export to JSON or CSV).

**API:**
```bash
curl "https://YOUR-SERVICE.onrender.com/feedback?idea=scentstrip" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY"
```

**Test a submission:**
```bash
curl -X POST https://YOUR-SERVICE.onrender.com/feedback \
  -H "Content-Type: application/json" \
  -d '{"idea":"scentstrip","reaction":"🔥 I need this","score":9,"message":"Love it"}'
```
Requests from curl have no `Origin` header, so CORS allows them.

---

## Adding a new idea

Add the idea's slug in **both** places, then push (Render redeploys automatically):

- `models/Feedback.js`: `const ALLOWED_IDEAS = ['scentstrip', 'new-idea']`
- `middleware/validate.js`: `.isIn(['scentstrip', 'new-idea'])`

The new page sends `idea: 'new-idea'` in its request body.
