// Device Fingerprinting Service
const crypto = require('crypto');
const { get, set } = require('./diskPersistence');
const { safeLogAuthEvent, safeLogSecurityViolation } = require('../middleware/securityLogging');
const { createError } = require('../middleware/errorHandler');

class DeviceFingerprintingService {
    constructor() {
        this.fingerprintExpiry = 30 * 24 * 60 * 60 * 1000; // 30 days
        this.suspiciousThreshold = 0.7; // 70% similarity threshold
    }

    /**
     * Generate device fingerprint from request data
     */
    generateFingerprint(req) {
        try {
            const userAgent = req.get('User-Agent') || '';
            const acceptLanguage = req.get('Accept-Language') || '';
            const acceptEncoding = req.get('Accept-Encoding') || '';
            const acceptCharset = req.get('Accept-Charset') || '';
            const connection = req.get('Connection') || '';
            const upgradeInsecureRequests = req.get('Upgrade-Insecure-Requests') || '';
            const secFetchSite = req.get('Sec-Fetch-Site') || '';
            const secFetchMode = req.get('Sec-Fetch-Mode') || '';
            const secFetchDest = req.get('Sec-Fetch-Dest') || '';
            const secChUa = req.get('Sec-CH-UA') || '';
            const secChUaMobile = req.get('Sec-CH-UA-Mobile') || '';
            const secChUaPlatform = req.get('Sec-CH-UA-Platform') || '';
            const dnt = req.get('DNT') || '';
            const viewportWidth = req.body?.viewportWidth || '';
            const viewportHeight = req.body?.viewportHeight || '';
            const screenWidth = req.body?.screenWidth || '';
            const screenHeight = req.body?.screenHeight || '';
            const colorDepth = req.body?.colorDepth || '';
            const timezone = req.body?.timezone || '';
            const language = req.body?.language || '';
            const platform = req.body?.platform || '';
            const cookieEnabled = req.body?.cookieEnabled || '';
            const doNotTrack = req.body?.doNotTrack || '';
            const hardwareConcurrency = req.body?.hardwareConcurrency || '';
            const deviceMemory = req.body?.deviceMemory || '';
            const maxTouchPoints = req.body?.maxTouchPoints || '';

            // Create fingerprint data
            const fingerprintData = {
                userAgent: this.normalizeUserAgent(userAgent),
                acceptLanguage: acceptLanguage,
                acceptEncoding: acceptEncoding,
                acceptCharset: acceptCharset,
                connection: connection,
                upgradeInsecureRequests: upgradeInsecureRequests,
                secFetchSite: secFetchSite,
                secFetchMode: secFetchMode,
                secFetchDest: secFetchDest,
                secChUa: secChUa,
                secChUaMobile: secChUaMobile,
                secChUaPlatform: secChUaPlatform,
                dnt: dnt,
                viewportWidth: viewportWidth,
                viewportHeight: viewportHeight,
                screenWidth: screenWidth,
                screenHeight: screenHeight,
                colorDepth: colorDepth,
                timezone: timezone,
                language: language,
                platform: platform,
                cookieEnabled: cookieEnabled,
                doNotTrack: doNotTrack,
                hardwareConcurrency: hardwareConcurrency,
                deviceMemory: deviceMemory,
                maxTouchPoints: maxTouchPoints,
                ip: req.ip || 'unknown'
            };

            // Generate hash
            const fingerprint = this.generateHash(fingerprintData);

            return {
                fingerprint: fingerprint,
                data: fingerprintData,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('❌ Device Fingerprinting: Error generating fingerprint:', error);
            return {
                fingerprint: 'unknown',
                data: {},
                timestamp: Date.now()
            };
        }
    }

    /**
     * Normalize user agent string
     */
    normalizeUserAgent(userAgent) {
        // Remove version numbers and normalize common patterns
        return userAgent
            .replace(/\d+\.\d+\.\d+/g, 'X.X.X')
            .replace(/\d+\.\d+/g, 'X.X')
            .replace(/\d+/g, 'X')
            .toLowerCase();
    }

    /**
     * Generate hash from fingerprint data
     */
    generateHash(data) {
        const str = JSON.stringify(data, Object.keys(data).sort());
        return crypto.createHash('sha256').update(str).digest('hex');
    }

    /**
     * Store device fingerprint
     */
    async storeFingerprint(userId, fingerprintData) {
        try {
            const key = `device_fingerprint:${userId}`;
            const deviceKey = `device:${fingerprintData.fingerprint}`;

            // Store user's devices
            await set(deviceKey, JSON.stringify(fingerprintData), this.fingerprintExpiry);
            await set(key, fingerprintData.fingerprint, this.fingerprintExpiry);
        } catch (error) {
            console.error('❌ Device Fingerprinting: Error storing fingerprint:', error);
        }
    }

    /**
     * Check if device is known
     */
    async isKnownDevice(userId, fingerprint) {
        try {
            const key = `device_fingerprint:${userId}`;
            const storedFingerprint = await get(key);
            const isKnown = storedFingerprint === fingerprint;

            return isKnown;
        } catch (error) {
            console.error('❌ Device Fingerprinting: Error checking known device:', error);
            return false;
        }
    }

    /**
     * Get user's devices
     */
    async getUserDevices(userId) {
        try {
            const key = `device_fingerprint:${userId}`;
            const storedFingerprint = await get(key);
            const fingerprints = storedFingerprint ? [storedFingerprint] : [];

            const devices = [];
            for (const fingerprint of fingerprints) {
                const deviceData = await this.getDeviceData(fingerprint);
                if (deviceData) {
                    devices.push(deviceData);
                }
            }

            return devices.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.error('❌ Device Fingerprinting: Error getting user devices:', error);
            return [];
        }
    }

    /**
     * Get device data by fingerprint
     */
    async getDeviceData(fingerprint) {
        try {
            const deviceKey = `device:${fingerprint}`;
            const data = await get(deviceKey);

            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error('❌ Device Fingerprinting: Error getting device data:', error);
            return null;
        }
    }

    /**
     * Check for suspicious device patterns
     */
    async checkSuspiciousDevice(userId, fingerprintData) {
        try {
            const devices = await this.getUserDevices(userId);

            if (devices.length === 0) {
                return { isSuspicious: false, reason: null };
            }

            // Check for similar devices
            const similarDevices = devices.filter(device =>
                this.calculateSimilarity(device.data, fingerprintData.data) > this.suspiciousThreshold
            );

            if (similarDevices.length > 0) {
                return {
                    isSuspicious: true,
                    reason: 'Similar device fingerprint detected',
                    similarity: Math.max(...similarDevices.map(d =>
                        this.calculateSimilarity(d.data, fingerprintData.data)
                    ))
                };
            }

            // Check for rapid device changes
            const now = Date.now();
            const recentDevices = devices.filter(device =>
                now - device.timestamp <= 60 * 60 * 1000 // Last hour
            );

            if (recentDevices.length > 3) {
                return {
                    isSuspicious: true,
                    reason: 'Rapid device changes detected',
                    deviceCount: recentDevices.length
                };
            }

            return { isSuspicious: false, reason: null };
        } catch (error) {
            console.error('❌ Device Fingerprinting: Error checking suspicious device:', error);
            return { isSuspicious: false, reason: null };
        }
    }

    /**
     * Calculate similarity between two device fingerprints
     */
    calculateSimilarity(device1, device2) {
        const keys = new Set([...Object.keys(device1), ...Object.keys(device2)]);
        let matches = 0;
        let total = 0;

        for (const key of keys) {
            if (key === 'timestamp' || key === 'fingerprint') continue;

            total++;
            if (device1[key] === device2[key]) {
                matches++;
            }
        }

        return total > 0 ? matches / total : 0;
    }

    /**
     * Track device for user
     */
    async trackDevice(userId, req) {
        try {
            const fingerprintData = this.generateFingerprint(req);

            // Store fingerprint
            await this.storeFingerprint(userId, fingerprintData);

            // Check if device is known
            const isKnown = await this.isKnownDevice(userId, fingerprintData.fingerprint);

            // Check for suspicious patterns
            const suspicious = await this.checkSuspiciousDevice(userId, fingerprintData);

            if (suspicious.isSuspicious) {
                await safeLogSecurityViolation('suspicious_device', {
                    userId: userId,
                    ip: req.ip || 'unknown',
                    userAgent: req.get('User-Agent') || 'unknown',
                    fingerprint: fingerprintData.fingerprint,
                    reason: suspicious.reason,
                    similarity: suspicious.similarity,
                    deviceCount: suspicious.deviceCount
                });
            }

            if (!isKnown) {
                await safeLogAuthEvent('NEW_DEVICE_DETECTED', {
                    userId: userId,
                    ip: req.ip || 'unknown',
                    userAgent: req.get('User-Agent') || 'unknown',
                    fingerprint: fingerprintData.fingerprint,
                    deviceData: fingerprintData.data
                });
            }

            return {
                fingerprint: fingerprintData.fingerprint,
                isKnown: isKnown,
                isSuspicious: suspicious.isSuspicious,
                reason: suspicious.reason
            };
        } catch (error) {
            console.error('❌ Device Fingerprinting: Error tracking device:', error);
            return {
                fingerprint: 'unknown',
                isKnown: false,
                isSuspicious: false,
                reason: null
            };
        }
    }

    /**
     * Remove device from user's list
     */
    async removeDevice(userId, fingerprint) {
        try {
            const key = `device_fingerprint:${userId}`;
            const deviceKey = `device:${fingerprint}`;

            await del(deviceKey);
            await del(key);

            await safeLogAuthEvent('DEVICE_REMOVED', {
                userId: userId,
                fingerprint: fingerprint
            });

            return { success: true };
        } catch (error) {
            console.error('❌ Device Fingerprinting: Error removing device:', error);
            throw error;
        }
    }

    /**
     * Get device statistics
     */
    async getDeviceStats(userId) {
        try {
            const devices = await this.getUserDevices(userId);

            const stats = {
                totalDevices: devices.length,
                uniqueBrowsers: new Set(devices.map(d => d.data.userAgent)).size,
                uniquePlatforms: new Set(devices.map(d => d.data.platform)).size,
                uniqueCountries: new Set(devices.map(d => d.data.ip)).size, // Simplified
                lastSeen: devices.length > 0 ? Math.max(...devices.map(d => d.timestamp)) : null,
                devices: devices.map(device => ({
                    fingerprint: device.fingerprint,
                    userAgent: device.data.userAgent,
                    platform: device.data.platform,
                    lastSeen: device.timestamp,
                    isCurrent: false // This would need to be determined by comparing with current request
                }))
            };

            return stats;
        } catch (error) {
            console.error('❌ Device Fingerprinting: Error getting device stats:', error);
            return {
                totalDevices: 0,
                uniqueBrowsers: 0,
                uniquePlatforms: 0,
                uniqueCountries: 0,
                lastSeen: null,
                devices: []
            };
        }
    }
}

module.exports = new DeviceFingerprintingService();
