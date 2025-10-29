const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ip: { type: String },
  userAgent: { type: String },
  deviceInfo: {
    fingerprint: { type: String },
    platform: { type: String },
    browser: { type: String },
    os: { type: String }
  },
  rememberMe: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },

  // TTL expiration field - sessions expire after 90 days
  expires: {
    type: Date,
    default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    index: { expires: 0 } // TTL index
  },

  // Token rotation fields
  currentRefreshTokenHash: { type: String, default: null },
  previousRefreshTokenHash: { type: String, default: null },
  refreshTokenVersion: { type: Number, default: 0 },
  refreshTokenRotatedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });

// Indexes
sessionSchema.index({ userId: 1 });
sessionSchema.index({ refreshTokenRotatedAt: 1 });

module.exports = mongoose.model('Session', sessionSchema);

