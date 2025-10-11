const mongoose = require('mongoose');

const oauthStateSchema = new mongoose.Schema({
  state: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  codeVerifier: {
    type: String,
    required: true
  },
  nonce: {
    type: String,
    required: true
  },
  timestamp: {
    type: Number,
    required: true,
    default: Date.now
  },
  provider: {
    type: String,
    required: true,
    enum: ['google', 'microsoft']
  },
  calendarReauth: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-delete records older than 10 minutes
oauthStateSchema.index({ timestamp: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model('OAuthState', oauthStateSchema);
