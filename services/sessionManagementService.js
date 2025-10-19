const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Session = require('../models/Session');
const User = require('../models/User');
const { env } = require('../config');
const { promisify } = require('util');

const signAsync = promisify(jwt.sign);

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

class SessionManagementService {
  constructor() {
    this.shortExpiry = env.JWT_EXPIRY_SHORT || '24h';
    this.longExpiry = env.JWT_EXPIRY_LONG || '90d';
  }

  // Issue access token (Remember Me aware)
  async issueAccessTokenRememberMe(user, rememberMe = false) {
    const expiresIn = rememberMe ? this.longExpiry : this.shortExpiry;
    const payload = {
      sub: String(user._id),
      type: 'access',
      aud: env.JWT_AUDIENCE || 'translator-backend',
      iss: env.JWT_ISSUER || 'translator-backend',
      jti: crypto.randomUUID(),
      role: user.role
    };
    return signAsync(payload, env.JWT_SECRET, { expiresIn });
  }

  // Issue refresh token (Remember Me aware)
  async issueRefreshTokenRememberMe(userId, sessionId, rememberMe = false) {
    const expiresIn = rememberMe ? this.longExpiry : this.shortExpiry;
    const payload = {
      sub: String(userId),
      sessionId,
      type: 'refresh',
      aud: env.JWT_AUDIENCE || 'translator-backend',
      iss: env.JWT_ISSUER || 'translator-backend',
      jti: crypto.randomUUID()
    };
    return signAsync(payload, env.JWT_SECRET, { expiresIn });
  }

  // Create session and return tokens
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

    // Issue tokens
    const accessToken = await this.issueAccessTokenRememberMe(user, rememberMe);
    const refreshToken = await this.issueRefreshTokenRememberMe(user._id, sessionId, rememberMe);

    // Hash and store refresh token hash
    const refreshHash = sha256Hex(String(refreshToken) + String(user._id));
    sessionDoc.currentRefreshTokenHash = refreshHash;
    sessionDoc.refreshTokenVersion = 1;
    sessionDoc.refreshTokenRotatedAt = Date.now();

    await sessionDoc.save();

    // Return tokens and minimal user data
    return {
      sessionId,
      accessToken,
      refreshToken,
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

  // Rotate refresh token: verify given refresh token, ensure matches current hash,
  // then issue new access + refresh tokens and update session doc (hash rotation).
  async rotateRefreshTokenHashedRotation(oldRefreshToken) {
    // Verify token first
    let decoded;
    try {
      decoded = jwt.verify(oldRefreshToken, env.JWT_SECRET, {
        audience: env.JWT_AUDIENCE,
        issuer: env.JWT_ISSUER
      });
    } catch (err) {
      throw new Error('Invalid refresh token');
    }

    const userId = decoded.sub;
    const sessionId = decoded.sessionId;
    if (!userId || !sessionId) throw new Error('Malformed refresh token');

    const sessionDoc = await Session.findOne({ sessionId, userId });
    if (!sessionDoc || !sessionDoc.isActive) {
      throw new Error('Session not found or inactive');
    }

    const oldHash = sha256Hex(String(oldRefreshToken) + String(userId));
    if (sessionDoc.currentRefreshTokenHash !== oldHash) {
      // Detected reuse or mismatch
      // Revoke session to be safe
      sessionDoc.isActive = false;
      sessionDoc.revokedAt = Date.now();
      await sessionDoc.save();
      throw new Error('Refresh token already used or invalid (possible reuse)');
    }

    // Everything checks: issue new tokens
    const user = await User.findById(userId).select('-password');
    if (!user) throw new Error('User not found');

    const rememberMe = !!sessionDoc.rememberMe;
    const newAccessToken = await this.issueAccessTokenRememberMe(user, rememberMe);
    const newRefreshToken = await this.issueRefreshTokenRememberMe(userId, sessionId, rememberMe);
    const newHash = sha256Hex(String(newRefreshToken) + String(userId));

    // Keep previous hash for short grace period then rotate
    sessionDoc.previousRefreshTokenHash = sessionDoc.currentRefreshTokenHash;
    sessionDoc.currentRefreshTokenHash = newHash;
    sessionDoc.refreshTokenVersion = (sessionDoc.refreshTokenVersion || 0) + 1;
    sessionDoc.refreshTokenRotatedAt = Date.now();
    sessionDoc.lastActivity = Date.now();
    await sessionDoc.save();

    return {
      accessToken: newAccessToken,
      newRefreshToken: newRefreshToken,
      expiresIn: rememberMe ? this.longExpiry : this.shortExpiry,
      sessionId: sessionId
    };
  }

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
  getTokenInfo(accessToken) {
    try {
      const decoded = jwt.verify(accessToken, env.JWT_SECRET, {
        audience: env.JWT_AUDIENCE || 'translator-backend',
        issuer: env.JWT_ISSUER || 'translator-backend'
      });

      const now = Math.floor(Date.now() / 1000);
      const isExpired = decoded.exp < now;
      const timeUntilExpiry = decoded.exp - now;

      // Check if token needs refresh (past 50% of lifetime)
      const tokenAge = now - decoded.iat;
      const tokenLifetime = decoded.exp - decoded.iat;
      const threshold = parseFloat(env.SESSION_SLIDING_WINDOW_THRESHOLD || '0.5');
      const needsRefresh = tokenAge > tokenLifetime * threshold;

      return {
        userId: decoded.sub,
        isExpired,
        needsRefresh,
        expiresAt: new Date(decoded.exp * 1000),
        timeUntilExpiry: timeUntilExpiry * 1000, // Convert to milliseconds
        issuedAt: new Date(decoded.iat * 1000),
        jti: decoded.jti
      };
    } catch (error) {
      console.error('❌ [SessionManagement] Error getting token info:', error.message);
      return null;
    }
  }

  /**
   * Auto-refresh token if needed
   */
  async autoRefreshToken(accessToken, refreshToken) {
    try {
      const tokenInfo = this.getTokenInfo(accessToken);

      if (!tokenInfo) {
        throw new Error('Invalid access token');
      }

      if (tokenInfo.isExpired) {
        throw new Error('Access token is expired');
      }

      if (!tokenInfo.needsRefresh) {
        return {
          accessToken,
          refreshToken,
          needsRefresh: false,
          expiresIn: tokenInfo.timeUntilExpiry
        };
      }

      // Token needs refresh, use the refresh token
      const result = await this.rotateRefreshTokenHashedRotation(refreshToken);

      return {
        accessToken: result.accessToken,
        refreshToken: result.newRefreshToken,
        needsRefresh: true,
        expiresIn: result.expiresIn
      };
    } catch (error) {
      console.error('❌ [SessionManagement] Auto refresh error:', error.message);
      throw error;
    }
  }

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