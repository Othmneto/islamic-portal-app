const crypto = require('crypto');
const Session = require('../models/Session');
const User = require('../models/User');
const { env } = require('../config');

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

class SessionManagementService {
    constructor() {
    this.shortExpiry = env.JWT_EXPIRY_SHORT || '24h';
    this.longExpiry = env.JWT_EXPIRY_LONG || '90d';
  }

  // JWT issuance removed - session-only architecture

  // Create session and return session metadata (no tokens)
  async createSessionRememberMeAware(user, req, rememberMe = false) {
    // Create session document
            const sessionId = crypto.randomUUID();
            const now = Date.now();
    const deviceFingerprint = (req.body && req.body.deviceFingerprint) || 'unknown';
    const dd = {
      sessionId,
                userId: user._id,
      ip: req.ip || (req.headers && req.headers['x-forwarded-for']) || 'unknown',
      userAgent: req.get ? (req.get('User-Agent') || 'unknown') : 'unknown',
      deviceInfo: {
        fingerprint: deviceFingerprint,
        platform: (req.body && req.body.platform) || 'unknown',
        browser: this.extractBrowser(req.get ? req.get('User-Agent') : ''),
        os: this.extractOS(req.get ? req.get('User-Agent') : '')
      },
      rememberMe: !!rememberMe,
                createdAt: now,
                lastActivity: now,
      isActive: true
    };

    const sessionDoc = new Session(dd);
    // Set TTL expiry field explicitly
    sessionDoc.expires = new Date(Date.now() + (rememberMe ? 90 : 1) * 24 * 60 * 60 * 1000);
    await sessionDoc.save();

    // Return session metadata and minimal user data
    return {
      sessionId,
      expiresIn: rememberMe ? this.longExpiry : this.shortExpiry,
      user: {
        id: String(user._id),
        email: user.email,
        username: user.username,
        role: user.role
      }
    };
  }

  // helper browser/os extraction (minimal)
  extractBrowser(userAgent = '') {
    // Very small UA parsing fallback - keep simple
    if (!userAgent) return 'unknown';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Chrome') && userAgent.includes('Safari')) return 'Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    return 'unknown';
  }

  extractOS(userAgent = '') {
    if (!userAgent) return 'unknown';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Macintosh')) return 'MacOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'unknown';
  }

  // Refresh tokens removed - session-only architecture

  // Revoke any session tokens by version or sessionId
  async revokeRefreshTokenVersioned(sessionId, version) {
    const sessionDoc = await Session.findOne({ sessionId });
    if (!sessionDoc) return false;
    if (typeof version === 'number' && sessionDoc.refreshTokenVersion === version) {
      sessionDoc.isActive = false;
      sessionDoc.revokedAt = Date.now();
      await sessionDoc.save();
      return true;
    }
    return false;
  }

  /**
   * Get token information including expiry and refresh status
     */
    getTokenInfo() { return null; }

    /**
     * Auto-refresh token if needed
     */
    async autoRefreshToken() { throw new Error('Not supported in session-only mode'); }

    /**
   * Get session statistics for a user
     */
    async getSessionStats(userId) {
        try {
      const sessions = await Session.find({ userId, isActive: true });

      const stats = {
        totalActiveSessions: sessions.length,
        rememberMeSessions: sessions.filter(s => s.rememberMe).length,
        sessionOnlySessions: sessions.filter(s => !s.rememberMe).length,
        sessions: sessions.map(session => ({
          sessionId: session.sessionId,
          rememberMe: session.rememberMe,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          ip: session.ip,
          userAgent: session.userAgent,
          deviceInfo: session.deviceInfo
        }))
      };

      return stats;
    } catch (error) {
      console.error('❌ [SessionManagement] Error getting session stats:', error.message);
      throw error;
    }
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(sessionId) {
    try {
      const session = await Session.findOne({ sessionId });

      if (!session) {
        throw new Error('Session not found');
      }

      session.isActive = false;
      session.revokedAt = new Date();
      await session.save();

            return {
        sessionId,
        invalidated: true,
        invalidatedAt: new Date()
            };
        } catch (error) {
      console.error('❌ [SessionManagement] Error invalidating session:', error.message);
      throw error;
        }
    }
}

module.exports = new SessionManagementService();