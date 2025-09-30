// Session Management Service
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { get, set, del, keys } = require('./diskPersistence');
const { safeLogAuthEvent, safeLogSecurityViolation } = require('../middleware/securityLogging');
const { createError } = require('../middleware/errorHandler');
const { env } = require('../config');

class SessionManagementService {
    constructor() {
        // Extended JWT settings for better user experience
        this.accessTokenExpiry = 24 * 60 * 60 * 1000; // 24 hours (extended from 2 hours)
        this.refreshTokenExpiry = 90 * 24 * 60 * 60 * 1000; // 90 days (extended from 30 days)
        this.maxConcurrentSessions = 15; // Increased for better user experience
        this.sessionExpiry = 180 * 24 * 60 * 60 * 1000; // 180 days (extended from 90 days)
        
        // Auto-refresh settings
        this.autoRefreshThreshold = 2 * 60 * 60 * 1000; // Auto-refresh when 2 hours left (extended from 15 minutes)
        this.maxRefreshAttempts = 5; // Maximum refresh attempts before requiring re-login (increased from 3)
    }

    /**
     * Generate access token
     */
    generateAccessToken(user) {
        const payload = {
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                authProvider: user.authProvider,
                isVerified: user.isVerified
            },
            type: 'access',
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, env.JWT_SECRET, { 
            expiresIn: Math.floor(this.accessTokenExpiry / 1000) 
        });
    }

    /**
     * Generate refresh token
     */
    generateRefreshToken(userId, sessionId) {
        const payload = {
            userId: userId,
            sessionId: sessionId,
            type: 'refresh',
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, env.JWT_SECRET, { 
            expiresIn: Math.floor(this.refreshTokenExpiry / 1000) 
        });
    }

    /**
     * Create new session
     */
    async createSession(user, req) {
        try {
            const sessionId = crypto.randomUUID();
            const now = Date.now();
            
            const sessionData = {
                sessionId: sessionId,
                userId: user._id,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                createdAt: now,
                lastActivity: now,
                isActive: true,
                deviceInfo: {
                    fingerprint: req.body?.deviceFingerprint || 'unknown',
                    platform: req.body?.platform || 'unknown',
                    browser: this.extractBrowser(req.get('User-Agent') || ''),
                    os: this.extractOS(req.get('User-Agent') || '')
                },
                location: req.body?.location || null
            };

            // Check concurrent session limit
            await this.enforceConcurrentSessionLimit(user._id, sessionId);

            // Store session
            await this.storeSession(sessionData);

            // Generate tokens
            const accessToken = this.generateAccessToken(user);
            const refreshToken = this.generateRefreshToken(user._id, sessionId);

            // Log session creation
            await safeLogAuthEvent('SESSION_CREATED', {
                userId: user._id,
                sessionId: sessionId,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown'
            });

            return {
                accessToken: accessToken,
                refreshToken: refreshToken,
                sessionId: sessionId,
                expiresIn: this.accessTokenExpiry
            };
        } catch (error) {
            console.error('❌ Session Management: Error creating session:', error);
            throw error;
        }
    }

    /**
     * Check if access token needs refresh
     */
    needsRefresh(accessToken) {
        try {
            const decoded = jwt.decode(accessToken);
            if (!decoded || !decoded.exp) {
                return true; // Invalid token, needs refresh
            }
            
            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = (decoded.exp - now) * 1000; // Convert to milliseconds
            
            return timeUntilExpiry <= this.autoRefreshThreshold;
        } catch (error) {
            console.error('❌ Session Management: Error checking token expiry:', error);
            return true; // Error checking, assume needs refresh
        }
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwt.verify(refreshToken, env.JWT_SECRET);
            
            if (decoded.type !== 'refresh') {
                throw createError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
            }

            // Check if session exists and is active
            const session = await this.getSession(decoded.sessionId);
            if (!session || !session.isActive) {
                throw createError('Session not found or inactive', 401, 'SESSION_NOT_FOUND');
            }

            // Check if session is expired
            if (Date.now() - session.lastActivity > this.sessionExpiry) {
                await this.invalidateSession(decoded.sessionId);
                throw createError('Session expired', 401, 'SESSION_EXPIRED');
            }

            // Check refresh attempts
            if (session.refreshAttempts >= this.maxRefreshAttempts) {
                await this.invalidateSession(decoded.sessionId);
                throw createError('Too many refresh attempts', 401, 'TOO_MANY_REFRESH_ATTEMPTS');
            }

            // Update last activity and increment refresh attempts
            await this.updateSession(decoded.sessionId, { 
                lastActivity: Date.now(),
                refreshAttempts: (session.refreshAttempts || 0) + 1
            });

            // Get user data
            const User = require('../models/User');
            const user = await User.findById(decoded.userId);
            if (!user) {
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            // Generate new access token
            const accessToken = this.generateAccessToken(user);

            // Reset refresh attempts on successful refresh
            await this.updateSession(decoded.sessionId, { refreshAttempts: 0 });

            return {
                accessToken: accessToken,
                expiresIn: this.accessTokenExpiry,
                refreshToken: refreshToken, // Return the same refresh token
                sessionId: decoded.sessionId
            };
        } catch (error) {
            console.error('❌ Session Management: Error refreshing token:', error);
            throw error;
        }
    }

    /**
     * Invalidate session
     */
    async invalidateSession(sessionId) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                return { success: true, message: 'Session not found' };
            }

            // Mark session as inactive
            await this.updateSession(sessionId, { isActive: false, invalidatedAt: Date.now() });

            // Log session invalidation
            await safeLogAuthEvent('SESSION_INVALIDATED', {
                userId: session.userId,
                sessionId: sessionId,
                ip: session.ip,
                userAgent: session.userAgent
            });

            return { success: true, message: 'Session invalidated' };
        } catch (error) {
            console.error('❌ Session Management: Error invalidating session:', error);
            throw error;
        }
    }

    /**
     * Invalidate all user sessions
     */
    async invalidateAllUserSessions(userId, exceptSessionId = null) {
        try {
            const sessions = await this.getUserSessions(userId);
            let invalidatedCount = 0;

            for (const session of sessions) {
                if (exceptSessionId && session.sessionId === exceptSessionId) {
                    continue;
                }

                await this.invalidateSession(session.sessionId);
                invalidatedCount++;
            }

            await safeLogAuthEvent('ALL_SESSIONS_INVALIDATED', {
                userId: userId,
                invalidatedCount: invalidatedCount,
                exceptSessionId: exceptSessionId
            });

            return { success: true, invalidatedCount: invalidatedCount };
        } catch (error) {
            console.error('❌ Session Management: Error invalidating all sessions:', error);
            throw error;
        }
    }

    /**
     * Store session data
     */
    async storeSession(sessionData) {
        try {
            const key = `session:${sessionData.sessionId}`;
            const userSessionsKey = `user_sessions:${sessionData.userId}`;

            await set(key, JSON.stringify(sessionData), this.sessionExpiry);
            await set(userSessionsKey, sessionData.sessionId, this.sessionExpiry);
        } catch (error) {
            console.error('❌ Session Management: Error storing session:', error);
            throw error;
        }
    }

    /**
     * Get session data
     */
    async getSession(sessionId) {
        try {
            const key = `session:${sessionId}`;
            const data = await get(key);

            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error('❌ Session Management: Error getting session:', error);
            return null;
        }
    }

    /**
     * Update session data
     */
    async updateSession(sessionId, updates) {
        try {
            const session = await this.getSession(sessionId);
            if (!session) {
                throw createError('Session not found', 404, 'SESSION_NOT_FOUND');
            }

            const updatedSession = { ...session, ...updates };
            const key = `session:${sessionId}`;

            await set(key, JSON.stringify(updatedSession), this.sessionExpiry);

            return updatedSession;
        } catch (error) {
            console.error('❌ Session Management: Error updating session:', error);
            throw error;
        }
    }

    /**
     * Update session activity
     */
    async updateSessionActivity(sessionId) {
        try {
            await this.updateSession(sessionId, { lastActivity: Date.now() });
        } catch (error) {
            console.error('❌ Session Management: Error updating session activity:', error);
        }
    }

    /**
     * Get user sessions
     */
    async getUserSessions(userId) {
        try {
            const userSessionsKey = `user_sessions:${userId}`;
            const sessionId = await get(userSessionsKey);
            const sessionIds = sessionId ? [sessionId] : [];

            const sessions = [];
            for (const sessionId of sessionIds) {
                const session = await this.getSession(sessionId);
                if (session) {
                    sessions.push(session);
                }
            }

            return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
        } catch (error) {
            console.error('❌ Session Management: Error getting user sessions:', error);
            return [];
        }
    }

    /**
     * Enforce concurrent session limit
     */
    async enforceConcurrentSessionLimit(userId, newSessionId) {
        try {
            const sessions = await this.getUserSessions(userId);
            const activeSessions = sessions.filter(s => s.isActive);

            if (activeSessions.length >= this.maxConcurrentSessions) {
                // Remove oldest sessions
                const sessionsToRemove = activeSessions
                    .sort((a, b) => a.lastActivity - b.lastActivity)
                    .slice(0, activeSessions.length - this.maxConcurrentSessions + 1);

                for (const session of sessionsToRemove) {
                    await this.invalidateSession(session.sessionId);
                }

                await safeLogSecurityViolation('concurrent_session_limit_exceeded', {
                    userId: userId,
                    maxSessions: this.maxConcurrentSessions,
                    removedSessions: sessionsToRemove.length
                });
            }
        } catch (error) {
            console.error('❌ Session Management: Error enforcing concurrent session limit:', error);
        }
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        try {
            // This would require scanning all session keys, which is expensive
            // In production, you'd want to use a more efficient method
            console.log('🧹 Session cleanup: This would clean up expired sessions in production');
        } catch (error) {
            console.error('❌ Session Management: Error cleaning up sessions:', error);
        }
    }

    /**
     * Extract browser from user agent
     */
    extractBrowser(userAgent) {
        const browsers = [
            { name: 'Chrome', pattern: /Chrome\/(\d+)/ },
            { name: 'Firefox', pattern: /Firefox\/(\d+)/ },
            { name: 'Safari', pattern: /Safari\/(\d+)/ },
            { name: 'Edge', pattern: /Edg\/(\d+)/ },
            { name: 'Opera', pattern: /Opera\/(\d+)/ }
        ];

        for (const browser of browsers) {
            if (browser.pattern.test(userAgent)) {
                return browser.name;
            }
        }

        return 'Unknown';
    }

    /**
     * Extract OS from user agent
     */
    extractOS(userAgent) {
        const os = [
            { name: 'Windows', pattern: /Windows NT (\d+\.\d+)/ },
            { name: 'macOS', pattern: /Mac OS X (\d+[._]\d+)/ },
            { name: 'Linux', pattern: /Linux/ },
            { name: 'Android', pattern: /Android (\d+\.\d+)/ },
            { name: 'iOS', pattern: /iPhone OS (\d+[._]\d+)/ }
        ];

        for (const o of os) {
            if (o.pattern.test(userAgent)) {
                return o.name;
            }
        }

        return 'Unknown';
    }

    /**
     * Get token expiry information
     */
    getTokenInfo(accessToken) {
        try {
            const decoded = jwt.decode(accessToken);
            if (!decoded || !decoded.exp) {
                return null;
            }
            
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = decoded.exp;
            const timeUntilExpiry = (expiresAt - now) * 1000; // Convert to milliseconds
            const needsRefresh = timeUntilExpiry <= this.autoRefreshThreshold;
            
            return {
                expiresAt: new Date(expiresAt * 1000),
                timeUntilExpiry: timeUntilExpiry,
                needsRefresh: needsRefresh,
                isExpired: timeUntilExpiry <= 0,
                userId: decoded.user?.id || decoded.userId
            };
        } catch (error) {
            console.error('❌ Session Management: Error getting token info:', error);
            return null;
        }
    }

    /**
     * Auto-refresh token if needed
     */
    async autoRefreshToken(accessToken, refreshToken) {
        try {
            const tokenInfo = this.getTokenInfo(accessToken);
            if (!tokenInfo || !tokenInfo.needsRefresh) {
                return { accessToken, needsRefresh: false };
            }

            console.log('🔄 [Session Management] Auto-refreshing token...');
            const refreshResult = await this.refreshAccessToken(refreshToken);
            
            return {
                accessToken: refreshResult.accessToken,
                refreshToken: refreshResult.refreshToken,
                needsRefresh: true,
                expiresIn: refreshResult.expiresIn
            };
        } catch (error) {
            console.error('❌ Session Management: Error auto-refreshing token:', error);
            throw error;
        }
    }

    /**
     * Get session statistics
     */
    async getSessionStats(userId) {
        try {
            const sessions = await this.getUserSessions(userId);
            const activeSessions = sessions.filter(s => s.isActive);
            const totalSessions = sessions.length;

            const browsers = [...new Set(sessions.map(s => s.deviceInfo.browser))];
            const platforms = [...new Set(sessions.map(s => s.deviceInfo.platform))];
            const locations = [...new Set(sessions.map(s => s.location?.country).filter(Boolean))];

            return {
                totalSessions: totalSessions,
                activeSessions: activeSessions.length,
                browsers: browsers,
                platforms: platforms,
                locations: locations,
                lastActivity: sessions.length > 0 ? Math.max(...sessions.map(s => s.lastActivity)) : null,
                sessionExpiry: this.sessionExpiry,
                accessTokenExpiry: this.accessTokenExpiry,
                refreshTokenExpiry: this.refreshTokenExpiry
            };
        } catch (error) {
            console.error('❌ Session Management: Error getting session stats:', error);
            return {
                totalSessions: 0,
                activeSessions: 0,
                browsers: [],
                platforms: [],
                locations: [],
                lastActivity: null,
                sessionExpiry: this.sessionExpiry,
                accessTokenExpiry: this.accessTokenExpiry,
                refreshTokenExpiry: this.refreshTokenExpiry
            };
        }
    }
}

module.exports = new SessionManagementService();
