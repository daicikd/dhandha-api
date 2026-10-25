// middleware/validate.js
// Validates and sanitises every incoming feedback submission.
// Uses express-validator for structural checks,
// sanitize-html to strip any HTML/script injection from text fields.

const { body, validationResult } = require('express-validator')
const sanitizeHtml = require('sanitize-html')

const ALLOWED_REACTIONS = [
  '🔥 I need this',
  '🤔 Interesting',
  '💡 Has potential',
  '😐 Not for me',
  '❓ Tell me more'
]

// Strips ALL HTML tags and attributes — returns plain text only
function stripHtml (value) {
  if (!value) return ''
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim()
}

// Validation chain for POST /feedback
const feedbackRules = [
  body('idea')
    .isString().withMessage('idea must be a string')
    .trim()
    .notEmpty().withMessage('idea is required')
    .isIn(['scentstrip']).withMessage('Unknown idea'),

  body('reaction')
    .isString().withMessage('reaction must be a string')
    .trim()
    .notEmpty().withMessage('reaction is required')
    .isIn(ALLOWED_REACTIONS).withMessage('Invalid reaction value'),

  body('score')
    .isInt({ min: 1, max: 10 }).withMessage('score must be an integer between 1 and 10'),

  body('message')
    .optional()
    .isString().withMessage('message must be a string')
    .isLength({ max: 2000 }).withMessage('message cannot exceed 2000 characters')
    .customSanitizer(stripHtml),

  body('name')
    .optional()
    .isString().withMessage('name must be a string')
    .isLength({ max: 100 }).withMessage('name cannot exceed 100 characters')
    .customSanitizer(stripHtml),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 254 }).withMessage('email too long')
]

// Middleware: runs after feedbackRules, rejects if any rule failed
function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({
      ok: false,
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    })
  }
  next()
}

module.exports = { feedbackRules, handleValidationErrors }
