// Suspicious Activity Detection Service
const { get, set, del } = require('./diskPersistence');
const { safeLogSecurityViolation } = require('../middleware/securityLogging');
const { createError } = require('../middleware/errorHandler');

class SuspiciousActivityDetection {
    constructor() {
        // Configuration
        this.riskThresholds = {
            low: 30,
            medium: 60,
            high: 80,
            critical: 90
        };

        this.timeWindows = {
            short: 5 * 60 * 1000, // 5 minutes
            medium: 30 * 60 * 1000, // 30 minutes
            long: 24 * 60 * 60 * 1000 // 24 hours
        };

        this.activityTypes = {
            LOGIN_ATTEMPT: { weight: 10, timeWindow: 'short' },
            FAILED_LOGIN: { weight: 20, timeWindow: 'short' },
            PASSWORD_CHANGE: { weight: 15, timeWindow: 'medium' },
            EMAIL_CHANGE: { weight: 25, timeWindow: 'medium' },
            MFA_DISABLE: { weight: 30, timeWindow: 'long' },
            UNUSUAL_LOCATION: { weight: 40, timeWindow: 'medium' },
            UNUSUAL_TIME: { weight: 20, timeWindow: 'medium' },
            RAPID_REQUESTS: { weight: 15, timeWindow: 'short' },
            SUSPICIOUS_USER_AGENT: { weight: 25, timeWindow: 'medium' },
            ACCOUNT_LOCKOUT: { weight: 35, timeWindow: 'long' }
        };
    }

    /**
     * Record activity and check for suspicious behavior
     */
    async recordActivity(userId, activityType, metadata = {}) {
        try {
            const now = Date.now();
            const activity = {
                userId: userId,
                type: activityType,
                timestamp: now,
                metadata: metadata,
                riskScore: this.calculateRiskScore(activityType, metadata)
            };

            // Store activity
            await this.storeActivity(activity);

            // Check for suspicious patterns
            const riskLevel = await this.analyzeRisk(userId, activity);

            // Log if suspicious
            if (riskLevel.level !== 'low') {
                await this.logSuspiciousActivity(userId, activity, riskLevel);
            }

            return {
                riskLevel: riskLevel.level,
                riskScore: riskLevel.score,
                actions: riskLevel.actions
            };
        } catch (error) {
            console.error('❌ Suspicious Activity: Error recording activity:', error);
            throw error;
        }
    }

    /**
     * Calculate risk score for an activity
     */
    calculateRiskScore(activityType, metadata) {
        const activityConfig = this.activityTypes[activityType];
        if (!activityConfig) return 0;

        let score = activityConfig.weight;

        // Adjust score based on metadata
        if (metadata.isUnusualLocation) score += 20;
        if (metadata.isUnusualTime) score += 15;
        if (metadata.isRapidRequest) score += 10;
        if (metadata.isSuspiciousUserAgent) score += 15;
        if (metadata.isFromNewDevice) score += 25;
        if (metadata.isFromNewIP) score += 20;

        return Math.min(score, 100); // Cap at 100
    }

    /**
     * Store activity in disk persistence
     */
    async storeActivity(activity) {
        try {
            const key = `suspicious_activity:${activity.userId}`;
            const now = Date.now();
            const window = this.timeWindows.long; // Store for 24 hours

            const existingActivities = await get(key);
            const activities = existingActivities ? JSON.parse(existingActivities) : [];
            activities.unshift(activity);
            activities.splice(1000); // Keep last 1000 activities
            await set(key, JSON.stringify(activities), window);
        } catch (error) {
            console.error('❌ Suspicious Activity: Error storing activity:', error);
        }
    }

    /**
     * Analyze risk level for user
     */
    async analyzeRisk(userId, currentActivity) {
        try {
            const activities = await this.getRecentActivities(userId);
            const now = Date.now();

            let totalScore = 0;
            let riskFactors = [];

            // Analyze different time windows
            const shortTermActivities = activities.filter(a =>
                now - a.timestamp <= this.timeWindows.short
            );
            const mediumTermActivities = activities.filter(a =>
                now - a.timestamp <= this.timeWindows.medium
            );
            const longTermActivities = activities.filter(a =>
                now - a.timestamp <= this.timeWindows.long
            );

            // Check for rapid requests
            if (shortTermActivities.length > 10) {
                totalScore += 30;
                riskFactors.push('Rapid requests detected');
            }

            // Check for multiple failed logins
            const failedLogins = activities.filter(a => a.type === 'FAILED_LOGIN');
            if (failedLogins.length > 3) {
                totalScore += 25;
                riskFactors.push('Multiple failed login attempts');
            }

            // Check for unusual patterns
            const loginPatterns = this.analyzeLoginPatterns(activities);
            if (loginPatterns.isUnusual) {
                totalScore += loginPatterns.riskScore;
                riskFactors.push(...loginPatterns.factors);
            }

            // Check for account changes
            const accountChanges = activities.filter(a =>
                ['PASSWORD_CHANGE', 'EMAIL_CHANGE', 'MFA_DISABLE'].includes(a.type)
            );
            if (accountChanges.length > 2) {
                totalScore += 35;
                riskFactors.push('Multiple account changes');
            }

            // Check for location anomalies
            const locationAnomalies = this.analyzeLocationPatterns(activities);
            if (locationAnomalies.isSuspicious) {
                totalScore += locationAnomalies.riskScore;
                riskFactors.push(...locationAnomalies.factors);
            }

            // Check for time anomalies
            const timeAnomalies = this.analyzeTimePatterns(activities);
            if (timeAnomalies.isSuspicious) {
                totalScore += timeAnomalies.riskScore;
                riskFactors.push(...timeAnomalies.factors);
            }

            // Determine risk level
            let riskLevel = 'low';
            if (totalScore >= this.riskThresholds.critical) {
                riskLevel = 'critical';
            } else if (totalScore >= this.riskThresholds.high) {
                riskLevel = 'high';
            } else if (totalScore >= this.riskThresholds.medium) {
                riskLevel = 'medium';
            }

            // Determine actions
            const actions = this.determineActions(riskLevel, totalScore, riskFactors);

            return {
                level: riskLevel,
                score: totalScore,
                factors: riskFactors,
                actions: actions
            };
        } catch (error) {
            console.error('❌ Suspicious Activity: Error analyzing risk:', error);
            return {
                level: 'low',
                score: 0,
                factors: [],
                actions: []
            };
        }
    }

    /**
     * Analyze login patterns
     */
    analyzeLoginPatterns(activities) {
        const loginActivities = activities.filter(a =>
            ['LOGIN_ATTEMPT', 'FAILED_LOGIN'].includes(a.type)
        );

        if (loginActivities.length < 3) {
            return { isUnusual: false, riskScore: 0, factors: [] };
        }

        let riskScore = 0;
        let factors = [];

        // Check for rapid login attempts
        const recentLogins = loginActivities.filter(a =>
            Date.now() - a.timestamp <= this.timeWindows.short
        );
        if (recentLogins.length > 5) {
            riskScore += 20;
            factors.push('Rapid login attempts');
        }

        // Check for failed login patterns
        const failedLogins = loginActivities.filter(a => a.type === 'FAILED_LOGIN');
        if (failedLogins.length > loginActivities.length * 0.7) {
            riskScore += 25;
            factors.push('High failure rate');
        }

        return {
            isUnusual: riskScore > 0,
            riskScore: riskScore,
            factors: factors
        };
    }

    /**
     * Analyze location patterns
     */
    analyzeLocationPatterns(activities) {
        const locations = activities
            .map(a => a.metadata.location)
            .filter(loc => loc && loc.country);

        if (locations.length < 2) {
            return { isSuspicious: false, riskScore: 0, factors: [] };
        }

        let riskScore = 0;
        let factors = [];

        // Check for multiple countries
        const countries = new Set(locations.map(loc => loc.country));
        if (countries.size > 3) {
            riskScore += 30;
            factors.push('Multiple countries detected');
        }

        // Check for impossible travel
        const sortedLocations = locations.sort((a, b) => a.timestamp - b.timestamp);
        for (let i = 1; i < sortedLocations.length; i++) {
            const prev = sortedLocations[i - 1];
            const curr = sortedLocations[i];
            const timeDiff = curr.timestamp - prev.timestamp;
            const distance = this.calculateDistance(prev, curr);
            const maxSpeed = 1000; // km/h (commercial aircraft speed)

            if (distance / (timeDiff / 3600000) > maxSpeed) {
                riskScore += 40;
                factors.push('Impossible travel detected');
                break;
            }
        }

        return {
            isSuspicious: riskScore > 0,
            riskScore: riskScore,
            factors: factors
        };
    }

    /**
     * Analyze time patterns
     */
    analyzeTimePatterns(activities) {
        const hours = activities.map(a => new Date(a.timestamp).getHours());
        const nightHours = [0, 1, 2, 3, 4, 5]; // 12 AM - 5 AM
        const nightActivities = hours.filter(h => nightHours.includes(h));

        let riskScore = 0;
        let factors = [];

        // Check for unusual time activity
        if (nightActivities.length > hours.length * 0.3) {
            riskScore += 15;
            factors.push('Unusual time activity');
        }

        // Check for consistent timing (bot-like behavior)
        const timeIntervals = [];
        for (let i = 1; i < activities.length; i++) {
            timeIntervals.push(activities[i].timestamp - activities[i - 1].timestamp);
        }

        if (timeIntervals.length > 5) {
            const avgInterval = timeIntervals.reduce((a, b) => a + b, 0) / timeIntervals.length;
            const variance = timeIntervals.reduce((acc, interval) =>
                acc + Math.pow(interval - avgInterval, 2), 0) / timeIntervals.length;

            if (variance < 1000) { // Very consistent timing
                riskScore += 20;
                factors.push('Consistent timing pattern');
            }
        }

        return {
            isSuspicious: riskScore > 0,
            riskScore: riskScore,
            factors: factors
        };
    }

    /**
     * Determine actions based on risk level
     */
    determineActions(riskLevel, score, factors) {
        const actions = [];

        if (riskLevel === 'critical') {
            actions.push('LOCK_ACCOUNT');
            actions.push('NOTIFY_ADMIN');
            actions.push('REQUIRE_MFA');
        } else if (riskLevel === 'high') {
            actions.push('REQUIRE_MFA');
            actions.push('NOTIFY_USER');
            actions.push('INCREASE_MONITORING');
        } else if (riskLevel === 'medium') {
            actions.push('NOTIFY_USER');
            actions.push('INCREASE_MONITORING');
        }

        return actions;
    }

    /**
     * Get recent activities for user
     */
    async getRecentActivities(userId) {
        try {
            const key = `suspicious_activity:${userId}`;
            const data = await get(key);
            const activities = data ? JSON.parse(data) : [];

            return activities;
        } catch (error) {
            console.error('❌ Suspicious Activity: Error getting activities:', error);
            return [];
        }
    }

    /**
     * Log suspicious activity
     */
    async logSuspiciousActivity(userId, activity, riskLevel) {
        try {
            await safeLogSecurityViolation('suspicious_activity_detected', {
                userId: userId,
                ip: activity.metadata.ip || 'unknown',
                userAgent: activity.metadata.userAgent || 'unknown',
                activityType: activity.type,
                riskLevel: riskLevel.level,
                riskScore: riskLevel.score,
                factors: riskLevel.factors,
                actions: riskLevel.actions,
                metadata: activity.metadata
            });
        } catch (error) {
            console.error('❌ Suspicious Activity: Error logging suspicious activity:', error);
        }
    }

    /**
     * Calculate distance between two locations
     */
    calculateDistance(loc1, loc2) {
        if (!loc1.lat || !loc1.lon || !loc2.lat || !loc2.lon) return 0;

        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(loc2.lat - loc1.lat);
        const dLon = this.toRadians(loc2.lon - loc1.lon);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(loc1.lat)) * Math.cos(this.toRadians(loc2.lat)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Get risk summary for user
     */
    async getRiskSummary(userId) {
        try {
            const activities = await this.getRecentActivities(userId);
            const riskLevel = await this.analyzeRisk(userId, { timestamp: Date.now() });

            return {
                userId: userId,
                riskLevel: riskLevel.level,
                riskScore: riskLevel.score,
                recentActivities: activities.length,
                lastActivity: activities[0]?.timestamp,
                factors: riskLevel.factors,
                actions: riskLevel.actions
            };
        } catch (error) {
            console.error('❌ Suspicious Activity: Error getting risk summary:', error);
            return {
                userId: userId,
                riskLevel: 'unknown',
                riskScore: 0,
                recentActivities: 0,
                lastActivity: null,
                factors: [],
                actions: []
            };
        }
    }
}

module.exports = new SuspiciousActivityDetection();
