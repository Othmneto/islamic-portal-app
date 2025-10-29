// translator-backend/models/TokenBlacklist.js

const mongoose = require('mongoose');

const TokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reason: {
    type: String,
    enum: ['logout', 'security', 'admin_revoke'],
    default: 'logout'
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0 // TTL index for automatic cleanup
  }
}, {
  timestamps: true,
  collection: 'token_blacklist'
});

// Static method to check if token is blacklisted
TokenBlacklistSchema.statics.isBlacklisted = async function(token) {
  try {
    const blacklistedToken = await this.findOne({ token });
    return !!blacklistedToken;
  } catch (error) {
    console.error('Error checking token blacklist:', error);
    return false; // If there's an error, don't block the request
  }
};

// Static method to blacklist a token
TokenBlacklistSchema.statics.blacklistToken = async function(token, userId, reason = 'logout') {
  try {
    // Decode the token (base64url) to get expiration time without jsonwebtoken
    const parts = String(token).split('.');
    if (parts.length < 2) throw new Error('Invalid token format');
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadJson = Buffer.from(payloadB64, 'base64').toString('utf8');
    const decoded = JSON.parse(payloadJson);
    if (!decoded || !decoded.exp) throw new Error('Invalid token payload');
    const expiresAt = new Date(decoded.exp * 1000);

    // Create blacklist entry
    const blacklistEntry = new this({
      token,
      userId,
      reason,
      expiresAt
    });

    await blacklistEntry.save();
    console.log(`🔒 Token blacklisted for user ${userId}, reason: ${reason}`);
    return true;
  } catch (error) {
    console.error('Error blacklisting token:', error);
    return false;
  }
};

// Static method to clean up expired tokens
TokenBlacklistSchema.statics.cleanupExpired = async function() {
  try {
    const result = await this.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    console.log(`🧹 Cleaned up ${result.deletedCount} expired blacklisted tokens`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return 0;
  }
};

module.exports = mongoose.model('TokenBlacklist', TokenBlacklistSchema);
