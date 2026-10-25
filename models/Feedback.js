// models/Feedback.js
// Strict schema — only the fields we define are ever stored.
// Mongoose discards any extra fields the client tries to send.

const mongoose = require('mongoose')

const ALLOWED_REACTIONS = [
  '🔥 I need this',
  '🤔 Interesting',
  '💡 Has potential',
  '😐 Not for me',
  '❓ Tell me more'
]

const ALLOWED_IDEAS = ['scentstrip']   // extend as you add idea sites

const feedbackSchema = new mongoose.Schema(
  {
    // Which idea page sent this
    idea: {
      type: String,
      required: [true, 'idea is required'],
      enum: {
        values: ALLOWED_IDEAS,
        message: 'Unknown idea "{VALUE}"'
      },
      trim: true
    },

    // Emoji reaction — must be one of the defined options
    reaction: {
      type: String,
      required: [true, 'reaction is required'],
      enum: {
        values: ALLOWED_REACTIONS,
        message: 'Invalid reaction'
      }
    },

    // 1-10 interest score
    score: {
      type: Number,
      required: [true, 'score is required'],
      min: [1, 'score must be at least 1'],
      max: [10, 'score must be at most 10'],
      validate: {
        validator: Number.isInteger,
        message: 'score must be a whole number'
      }
    },

    // Optional free-text feedback — stripped of HTML
    message: {
      type: String,
      default: '',
      maxlength: [2000, 'message cannot exceed 2000 characters'],
      trim: true
    },

    // Optional display name, stripped of HTML
    name: {
      type: String,
      default: '',
      maxlength: [100, 'name cannot exceed 100 characters'],
      trim: true
    },

    // Optional email — validated format, stored only if provided
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
      maxlength: [254, 'email too long'],
      validate: {
        validator: function (v) {
          if (!v) return true   // optional field
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        },
        message: 'Invalid email format'
      }
    },

    // Server-set fields — client cannot write these
    ip: { type: String, select: false },      // hidden by default in queries
    userAgent: { type: String, select: false }
  },
  {
    timestamps: true,       // adds createdAt, updatedAt automatically
    strict: true,           // REJECT any fields not in schema
    versionKey: false
  }
)

// Index for efficient querying by idea and date
feedbackSchema.index({ idea: 1, createdAt: -1 })

module.exports = mongoose.model('Feedback', feedbackSchema)
