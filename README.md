# Dhandha API

The backend for [Dhandha](https://github.com/daicikd/Dhandha), my public lab for validating business ideas. Every idea gets a landing page with a feedback form, and this API receives, validates and stores those submissions so I can measure real interest.

**Live:** https://dhandha-api-y7dr.onrender.com/health
**Used by:** [ScentStrip](https://daicikd.github.io/Dhandha/ideas/scentstrip/index.html), the first idea on the board

---

## Architecture

```
Landing page (GitHub Pages)  →  Express API (Render)  →  MongoDB Atlas
                                       ↑
                         UptimeRobot pings /health every 5 min
```

- **Frontend:** static HTML on GitHub Pages, sends feedback with `fetch`
- **API:** Node.js and Express, deployed on Render (Singapore region)
- **Database:** MongoDB Atlas with Mongoose (Mumbai region)
- **Monitoring:** UptimeRobot hits `/health`, which pings the database, so neither the free Render instance nor the free Atlas cluster goes idle

---

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | none | Server and database status |
| `POST` | `/feedback` | none | Submit feedback from an idea page |
| `GET` | `/feedback` | `X-Admin-Key` header | Read submissions (optional `?idea=`, `limit`, `skip`) |

**Example submission:**

```json
{
  "idea": "scentstrip",
  "reaction": "🔥 I need this",
  "score": 9,
  "name": "Optional",
  "message": "Optional free text",
  "email": "optional@example.com"
}
```

---

## Security

Requests pass through these layers in order:

1. **Helmet:** secure HTTP headers
2. **CORS whitelist:** only the Dhandha GitHub Pages origin can call the API from a browser
3. **Rate limiting:** 5 submissions per IP per 10 minutes, 30 reads per minute
4. **Body size limit:** payloads over 10 KB are rejected
5. **NoSQL injection protection:** `$` and `.` stripped from keys (express-mongo-sanitize)
6. **HTTP parameter pollution protection:** hpp
7. **Validation:** every field checked server-side with express-validator
8. **Sanitization:** HTML stripped from free-text fields with sanitize-html
9. **Strict Mongoose schema:** unknown fields are discarded

Also:
- IP and user agent are recorded for abuse checks but never returned by the API
- Stack traces are never sent to clients in production
- Secrets live only in environment variables, never in the repo
- The process closes its database connection cleanly on redeploy (SIGTERM)

---

## Engineering notes

**Finding the real client IP behind Render's proxies.** After moving from Railway to Render, every submission was logged with the same internal `10.x` address, which meant all visitors shared a single rate limit. Logging `X-Forwarded-For` on a live request showed three hops (visitor, Cloudflare, Render's internal router), so `trust proxy` is set to exactly `3`. Trusting every hop would let a client spoof its IP and bypass the rate limit.

**Keeping free tiers awake.** Render's free instances sleep after 15 minutes idle, and Atlas pauses free clusters with no activity. The health check runs a real database ping, so one external monitor keeps both alive.

---

## Run locally

```bash
git clone https://github.com/daicikd/dhandha-api.git
cd dhandha-api
npm install
cp .env.example .env    # then fill in your values
npm run dev
```

Required environment variables: `MONGO_URI`, `ALLOWED_ORIGINS`, `ADMIN_KEY`. Optional: `PORT`, `NODE_ENV`.

Deployment steps are in [DEPLOY.md](DEPLOY.md).

---

## Project structure

```
server.js              App setup, security middleware, health check, startup
routes/feedback.js     POST and GET /feedback
middleware/validate.js Validation and sanitization rules
models/Feedback.js     Mongoose schema
logger.js              Winston logging
```

---

Built by [Daivik Domadiya](https://github.com/daicikd)
