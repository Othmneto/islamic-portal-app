// Persistent Authentication Middleware
// Checks for location and device changes to invalidate sessions

const sessionManagementService = require('../services/sessionManagementService');

/**
 * Middleware to check for location and device changes
 * Invalidates session if significant changes are detected
 */
async function checkPersistentAuth(req, res, next) {
    try {
        // Skip if no user or session
        if (!req.user || !req.sessionId) {
            return next();
        }

        // Extract current location and device info
        const currentLocation = req.body?.location || req.query?.location || null;
        const currentDeviceInfo = {
            userAgent: req.get('User-Agent') || 'unknown',
            platform: req.body?.platform || 'unknown',
            browser: extractBrowser(req.get('User-Agent') || ''),
            os: extractOS(req.get('User-Agent') || ''),
            fingerprint: req.body?.deviceFingerprint || 'unknown'
        };

        // Check if session should be invalidated
        const invalidationCheck = await sessionManagementService.shouldInvalidateSession(
            req.sessionId,
            currentLocation,
            currentDeviceInfo
        );

        if (invalidationCheck.shouldInvalidate) {
            console.log('🚨 [Persistent Auth] Session invalidated:', invalidationCheck.reason);

            // Invalidate the session
            await sessionManagementService.invalidateSession(req.sessionId);

            // Clear session data
            req.session = null;
            req.user = null;
            req.sessionId = null;

            return res.status(401).json({
                success: false,
                error: 'Session invalidated due to security changes',
                reason: invalidationCheck.reason,
                requiresReauth: true
            });
        }

        // Update session with current location and device info
        if (currentLocation || currentDeviceInfo) {
            await sessionManagementService.updateSession(req.sessionId, {
                location: currentLocation || req.session?.location,
                deviceInfo: currentDeviceInfo || req.session?.deviceInfo,
                lastActivity: Date.now()
            });
        }

        next();
    } catch (error) {
        console.error('❌ [Persistent Auth] Error checking persistent auth:', error);
        // Don't block the request on error, just log it
        next();
    }
}

/**
 * Extract browser from user agent
 */
function extractBrowser(userAgent) {
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
function extractOS(userAgent) {
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

module.exports = {
    checkPersistentAuth
};
