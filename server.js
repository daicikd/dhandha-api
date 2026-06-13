// server.js — Dhandha Feedback API
// Security layers applied in order:
//   1. Helmet        — HTTP security headers
//   2. CORS          — whitelist only your GitHub Pages domain
//   3. Rate limiting — block abuse / brute force
//   4. Body limits   — reject oversized payloads
//   5. Mongo sanitise — prevent NoSQL injection
//   6. HPP           — prevent HTTP parameter pollution
//   7. Validation    — per-route field validation (express-validator)
//   8. Sanitisation  — strip HTML from text fields (sanitize-html)
//   9. Strict schema — Mongoose rejects any unknown fields

'use strict'
require('dotenv').config()

const express       = require('express')
const mongoose      = require('mongoose')
const helmet        = require('helmet')
const cors          = require('cors')
const rateLimit     = require('express-rate-limit')
const mongoSanitize = require('express-mongo-sanitize')
const hpp           = require('hpp')
const logger        = require('./logger')
const feedbackRouter= require('./routes/feedback')

// ── Validate required env vars on startup ────────────────────────────────
const REQUIRED_ENV = ['MONGO_URI', 'ALLOWED_ORIGINS', 'ADMIN_KEY']
const missing = REQUIRED_ENV.filter(k => !process.env[k])
if (missing.length) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const app  = express()
const PORT = process.env.PORT || 3000

// ── 1. Helmet — sets secure HTTP headers ────────────────────────────────
// Disables X-Powered-By, sets CSP, HSTS, etc.
app.use(helmet())

// ── 2. CORS — only allow your GitHub Pages domain ────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

app.use(cors({
  origin (origin, callback) {
    // Allow requests with no origin (e.g. curl during dev, same-origin)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    logger.warn(`CORS blocked request from origin: ${origin}`)
    callback(new Error('Not allowed by CORS'))
  },
  methods:     ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Admin-Key'],
  credentials: false
}))

// Handle preflight for all routes
app.options('*', cors())

// ── 3. Rate limiting ─────────────────────────────────────────────────────
// POST (submit feedback): max 5 submissions per IP per 10 minutes
const submitLimiter = rateLimit({
  windowMs:    10 * 60 * 1000,   // 10 minutes
  max:         5,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, message: 'Too many submissions. Please try again in 10 minutes.' },
  skip: req => req.method !== 'POST'   // only restrict POST
})

// GET (admin read): max 30 requests per minute per IP
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, message: 'Too many requests.' }
})

// ── 4. Body parser — with size limit ─────────────────────────────────────
// Rejects any payload over 10KB — protects against payload bombs
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ extended: false, limit: '10kb' }))

// ── 5. MongoDB injection sanitisation ────────────────────────────────────
// Strips $ and . from keys — prevents NoSQL injection attacks
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Sanitised key "${key}" from ${req.ip}`)
  }
}))

// ── 6. HTTP parameter pollution protection ───────────────────────────────
app.use(hpp())

// ── Trust proxy (Railway / Render sit behind a reverse proxy) ────────────
app.set('trust proxy', 1)

// ── Health check — public, no auth ──────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'operational',
    timestamp: new Date().toISOString()
  })
})

// ── Routes ───────────────────────────────────────────────────────────────
app.use('/feedback', submitLimiter, readLimiter, feedbackRouter)

// ── 404 handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Route not found' })
})

// ── Global error handler ─────────────────────────────────────────────────
// Never leaks stack traces to the client in production
app.use((err, req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ ok: false, message: 'CORS: origin not allowed' })
  }
  logger.error(err)
  res.status(500).json({
    ok: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  })
})

// ── MongoDB connection ────────────────────────────────────────────────────
async function connectDB () {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000
    })
    logger.info('MongoDB connected')
  } catch (err) {
    logger.error('MongoDB connection failed', err)
    process.exit(1)
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────
// Closes DB connection cleanly when process receives SIGTERM/SIGINT
// (Railway sends SIGTERM on redeploy)
async function shutdown (signal) {
  logger.info(`${signal} received — shutting down gracefully`)
  await mongoose.connection.close()
  logger.info('MongoDB connection closed')
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

// Catch unhandled promise rejections — log and exit so Railway can restart
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason)
  process.exit(1)
})

// ── Start ────────────────────────────────────────────────────────────────
;(async () => {
  await connectDB()
  app.listen(PORT, () => {
    logger.info(`Dhandha API running on port ${PORT} [${process.env.NODE_ENV}]`)
  })
})()
