// Brute Force Protection Service
const { get, set, del } = require('./diskPersistence');
const { safeLogSecurityViolation } = require('../middleware/securityLogging');
const { createError } = require('../middleware/errorHandler');

class BruteForceProtection {
    constructor() {
        // Configuration
        this.maxAttempts = 5; // Maximum failed attempts
        this.windowMs = 15 * 60 * 1000; // 15 minutes
        this.lockoutDuration = 30 * 60 * 1000; // 30 minutes
        this.progressiveDelay = true; // Increase delay with each attempt
        this.maxDelay = 300000; // 5 minutes max delay

        // IP-based protection
        this.ipMaxAttempts = 10;
        this.ipWindowMs = 60 * 60 * 1000; // 1 hour
        this.ipLockoutDuration = 2 * 60 * 60 * 1000; // 2 hours
    }

    /**
     * Check if user is locked out
     */
    async isUserLockedOut(userId) {
        try {
            const lockKey = `brute_force_lock:user:${userId}`;
            const lockData = await get(lockKey);

            if (!lockData) return false;

            const lock = JSON.parse(lockData);
            const now = Date.now();

            if (now < lock.lockedUntil) {
                return {
                    locked: true,
                    lockedUntil: lock.lockedUntil,
                    remainingTime: lock.lockedUntil - now,
                    reason: lock.reason
                };
            }

            // Lock expired, clean up
            await del(lockKey);

            return false;
        } catch (error) {
            console.error('❌ Brute Force: Error checking user lockout:', error);
            return false;
        }
    }

    /**
     * Check if IP is locked out
     */
    async isIPLockedOut(ip) {
        try {
            const lockKey = `brute_force_lock:ip:${ip}`;
            const lockData = await get(lockKey);

            if (!lockData) return false;

            const lock = JSON.parse(lockData);
            const now = Date.now();

            if (now < lock.lockedUntil) {
                return {
                    locked: true,
                    lockedUntil: lock.lockedUntil,
                    remainingTime: lock.lockedUntil - now,
                    reason: lock.reason
                };
            }

            // Lock expired, clean up
            await del(lockKey);

            return false;
        } catch (error) {
            console.error('❌ Brute Force: Error checking IP lockout:', error);
            return false;
        }
    }

    /**
     * Record failed attempt
     */
    async recordFailedAttempt(userId, ip, userAgent, reason = 'login_failed') {
        try {
            const now = Date.now();
            const userKey = `brute_force_attempts:user:${userId}`;
            const ipKey = `brute_force_attempts:ip:${ip}`;

            // Record user attempt
            const userAttempts = await this.getAttempts(userKey, this.windowMs);
            userAttempts.push({
                timestamp: now,
                ip: ip,
                userAgent: userAgent,
                reason: reason
            });

            // Record IP attempt
            const ipAttempts = await this.getAttempts(ipKey, this.ipWindowMs);
            ipAttempts.push({
                timestamp: now,
                userId: userId,
                userAgent: userAgent,
                reason: reason
            });

            // Check if user should be locked out
            const recentUserAttempts = userAttempts.filter(attempt =>
                now - attempt.timestamp <= this.windowMs
            );

            if (recentUserAttempts.length >= this.maxAttempts) {
                await this.lockUser(userId, ip, userAgent, 'max_attempts_exceeded');
            }

            // Check if IP should be locked out
            const recentIPAttempts = ipAttempts.filter(attempt =>
                now - attempt.timestamp <= this.ipWindowMs
            );

            if (recentIPAttempts.length >= this.ipMaxAttempts) {
                await this.lockIP(ip, userId, userAgent, 'ip_max_attempts_exceeded');
            }

            // Store attempts
            await this.storeAttempts(userKey, userAttempts, this.windowMs);
            await this.storeAttempts(ipKey, ipAttempts, this.ipWindowMs);

            // Log security violation
            await safeLogSecurityViolation('brute_force_attempt', {
                userId: userId,
                ip: ip,
                userAgent: userAgent,
                reason: reason,
                userAttempts: recentUserAttempts.length,
                ipAttempts: recentIPAttempts.length
            });

            return {
                userAttempts: recentUserAttempts.length,
                ipAttempts: recentIPAttempts.length,
                userLocked: recentUserAttempts.length >= this.maxAttempts,
                ipLocked: recentIPAttempts.length >= this.ipMaxAttempts
            };
        } catch (error) {
            console.error('❌ Brute Force: Error recording failed attempt:', error);
            throw error;
        }
    }

    /**
     * Record successful attempt
     */
    async recordSuccessfulAttempt(userId, ip, userAgent) {
        try {
            const now = Date.now();
            const userKey = `brute_force_attempts:user:${userId}`;
            const ipKey = `brute_force_attempts:ip:${ip}`;

            // Clear user attempts
            await del(userKey);

            // Clear IP attempts (only if not locked)
            const ipLocked = await this.isIPLockedOut(ip);
            if (!ipLocked) {
                await del(ipKey);
            }

            // Log successful login
            await safeLogSecurityViolation('brute_force_success', {
                userId: userId,
                ip: ip,
                userAgent: userAgent,
                message: 'Successful login after failed attempts'
            });

            return { success: true };
        } catch (error) {
            console.error('❌ Brute Force: Error recording successful attempt:', error);
            throw error;
        }
    }

    /**
     * Lock user
     */
    async lockUser(userId, ip, userAgent, reason) {
        try {
            const now = Date.now();
            const lockKey = `brute_force_lock:user:${userId}`;
            const lockData = {
                userId: userId,
                lockedAt: now,
                lockedUntil: now + this.lockoutDuration,
                reason: reason,
                ip: ip,
                userAgent: userAgent
            };

            await set(lockKey, JSON.stringify(lockData), this.lockoutDuration);

            // Log user lockout
            await safeLogSecurityViolation('user_locked_out', {
                userId: userId,
                ip: ip,
                userAgent: userAgent,
                reason: reason,
                lockoutDuration: this.lockoutDuration
            });

            return lockData;
        } catch (error) {
            console.error('❌ Brute Force: Error locking user:', error);
            throw error;
        }
    }

    /**
     * Lock IP
     */
    async lockIP(ip, userId, userAgent, reason) {
        try {
            const now = Date.now();
            const lockKey = `brute_force_lock:ip:${ip}`;
            const lockData = {
                ip: ip,
                lockedAt: now,
                lockedUntil: now + this.ipLockoutDuration,
                reason: reason,
                userId: userId,
                userAgent: userAgent
            };

            await set(lockKey, JSON.stringify(lockData), this.ipLockoutDuration);

            // Log IP lockout
            await safeLogSecurityViolation('ip_locked_out', {
                ip: ip,
                userId: userId,
                userAgent: userAgent,
                reason: reason,
                lockoutDuration: this.ipLockoutDuration
            });

            return lockData;
        } catch (error) {
            console.error('❌ Brute Force: Error locking IP:', error);
            throw error;
        }
    }

    /**
     * Get attempts for a key
     */
    async getAttempts(key, windowMs) {
        try {
            const data = await get(key);

            if (!data) return [];

            const attempts = JSON.parse(data);
            const now = Date.now();

            // Filter out expired attempts
            return attempts.filter(attempt => now - attempt.timestamp <= windowMs);
        } catch (error) {
            console.error('❌ Brute Force: Error getting attempts:', error);
            return [];
        }
    }

    /**
     * Store attempts
     */
    async storeAttempts(key, attempts, windowMs) {
        try {
            await set(key, JSON.stringify(attempts), windowMs);
        } catch (error) {
            console.error('❌ Brute Force: Error storing attempts:', error);
        }
    }

    /**
     * Get delay for next attempt (progressive delay)
     */
    async getDelay(userId, ip) {
        try {
            if (!this.progressiveDelay) return 0;

            const userKey = `brute_force_attempts:user:${userId}`;
            const ipKey = `brute_force_attempts:ip:${ip}`;

            const userAttempts = await this.getAttempts(userKey, this.windowMs);
            const ipAttempts = await this.getAttempts(ipKey, this.ipWindowMs);

            const userDelay = Math.min(userAttempts.length * 1000, this.maxDelay);
            const ipDelay = Math.min(ipAttempts.length * 500, this.maxDelay);

            return Math.max(userDelay, ipDelay);
        } catch (error) {
            console.error('❌ Brute Force: Error calculating delay:', error);
            return 0;
        }
    }

    /**
     * Unlock user (admin function)
     */
    async unlockUser(userId) {
        try {
            const lockKey = `brute_force_lock:user:${userId}`;
            await del(lockKey);

            // Clear attempts
            const userKey = `brute_force_attempts:user:${userId}`;
            await del(userKey);

            await safeLogSecurityViolation('user_unlocked', {
                userId: userId,
                ip: 'admin',
                userAgent: 'admin',
                reason: 'manual_unlock'
            });

            return { success: true };
        } catch (error) {
            console.error('❌ Brute Force: Error unlocking user:', error);
            throw error;
        }
    }

    /**
     * Unlock IP (admin function)
     */
    async unlockIP(ip) {
        try {
            const lockKey = `brute_force_lock:ip:${ip}`;
            await del(lockKey);

            // Clear attempts
            const ipKey = `brute_force_attempts:ip:${ip}`;
            await del(ipKey);

            await safeLogSecurityViolation('ip_unlocked', {
                ip: ip,
                userId: 'admin',
                userAgent: 'admin',
                reason: 'manual_unlock'
            });

            return { success: true };
        } catch (error) {
            console.error('❌ Brute Force: Error unlocking IP:', error);
            throw error;
        }
    }

    /**
     * Get brute force statistics
     */
    async getStatistics() {
        try {
            // This would require scanning disk persistence keys, which is expensive
            // In production, you'd want to use a more efficient method
            return {
                message: 'Statistics not implemented for performance reasons',
                suggestion: 'Use disk persistence monitoring tools or implement a separate analytics system'
            };
        } catch (error) {
            console.error('❌ Brute Force: Error getting statistics:', error);
            return { error: 'Failed to get statistics' };
        }
    }
}

module.exports = new BruteForceProtection();
