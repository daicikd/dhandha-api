// routes/feedback.js

const express  = require('express')
const router   = express.Router()
const Feedback = require('../models/Feedback')
const logger   = require('../logger')
const { feedbackRules, handleValidationErrors } = require('../middleware/validate')

// ── POST /feedback ────────────────────────────────────────────────────────
// Accepts a new feedback submission from a Dhandha idea page.
// Validates → sanitises → stores → responds.
router.post(
  '/',
  feedbackRules,
  handleValidationErrors,
  async (req, res) => {
    try {
      logger.info(`XFF debug: ${req.headers['x-forwarded-for']}`)
      const { idea, reaction, score, message, name, email } = req.body

      const entry = await Feedback.create({
        idea,
        reaction,
        score:     Number(score),
        message:   message || '',
        name:      name    || '',
        email:     email   || '',
        // Server-set only — never from client body
        ip:        req.ip,
        userAgent: req.headers['user-agent'] || ''
      })

      logger.info(`Feedback saved: idea=${idea} score=${score} id=${entry._id}`)

      // Return minimal confirmation — never echo back the full stored document
      return res.status(201).json({
        ok: true,
        message: 'Feedback received. Thank you!'
      })
    } catch (err) {
      logger.error('Failed to save feedback', err)
      return res.status(500).json({ ok: false, message: 'Something went wrong. Try again later.' })
    }
  }
)

// ── GET /feedback ─────────────────────────────────────────────────────────
// Returns all feedback for a given idea.
// IMPORTANT: This route must be protected before going public.
// Right now it checks for a secret key in the request header.
// Replace with proper auth (JWT) when you add a dashboard.

router.get('/', async (req, res) => {
  // Simple secret-key guard — set ADMIN_KEY in your .env
  const adminKey = process.env.ADMIN_KEY
  const provided  = req.headers['x-admin-key']

  if (!adminKey || provided !== adminKey) {
    return res.status(401).json({ ok: false, message: 'Unauthorised' })
  }

  try {
    const { idea, limit = 100, skip = 0 } = req.query

    const filter = {}
    if (idea) filter.idea = idea

    const entries = await Feedback
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 500))  // hard cap at 500 per request
      .skip(Number(skip))
      .select('-ip -userAgent')             // strip PII from the response

    const total = await Feedback.countDocuments(filter)

    return res.json({ ok: true, total, count: entries.length, data: entries })
  } catch (err) {
    logger.error('Failed to fetch feedback', err)
    return res.status(500).json({ ok: false, message: 'Something went wrong.' })
  }
})

module.exports = router
