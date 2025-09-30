// routes/accountManagementRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { safeLogAuthEvent, safeLogSecurityViolation } = require('../middleware/securityLogging');
const { createError } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');

// @route   GET /api/user/account-info
// @desc    Get user account information
// @access  Private
router.get('/account-info', auth, async (req, res) => {
    try {
        console.log('👤 [Account Management] Getting account info for user:', req.user.id);
        const user = await User.findById(req.user.id).select('-password -passwordHistory');
        
        if (!user) {
            console.log('❌ [Account Management] User not found:', req.user.id);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('✅ [Account Management] User found:', user.email);

        const accountInfo = {
            id: user._id,
            email: user.email,
            username: user.username,
            authProvider: user.authProvider,
            googleId: user.googleId,
            microsoftId: user.microsoftId,
            isVerified: user.isVerified,
            role: user.role,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            mfaEnabled: user.mfa?.totpEnabled || false,
            emailMfaEnabled: user.mfa?.emailMfaEnabled || false,
            emailNotifications: user.notificationPreferences?.specialAnnouncements || false,
            biometricEnabled: user.biometricEnabled || false,
            twoFactorEnabled: user.twoFactorEnabled || false,
            accountLocked: user.accountLockedUntil && user.accountLockedUntil > new Date(),
            failedLoginAttempts: user.failedLoginAttempts || 0,
            activeSessions: user.activeSessions?.length || 0,
            deviceFingerprints: user.deviceFingerprints?.length || 0
        };

        console.log('📊 [Account Management] Account info retrieved:', {
            email: accountInfo.email,
            authProvider: accountInfo.authProvider,
            mfaEnabled: accountInfo.mfaEnabled,
            twoFactorEnabled: accountInfo.twoFactorEnabled
        });

        res.json(accountInfo);
    } catch (error) {
        console.error('❌ [Account Management] Error getting account info:', error);
        res.status(500).json({ error: 'Failed to get account information' });
    }
});

// @route   POST /api/user/email-notifications
// @desc    Toggle email notifications
// @access  Private
router.post('/email-notifications', auth, async (req, res) => {
    try {
        const { enabled } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize notificationPreferences if it doesn't exist
        if (!user.notificationPreferences) {
            user.notificationPreferences = {
                prayerReminders: {
                    fajr: true,
                    dhuhr: true,
                    asr: true,
                    maghrib: true,
                    isha: true
                },
                reminderMinutes: 0,
                specialAnnouncements: false
            };
        }
        
        // Update the specialAnnouncements field
        user.notificationPreferences.specialAnnouncements = enabled;

        await user.save();

        await safeLogAuthEvent('EMAIL_NOTIFICATIONS_TOGGLED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            enabled: enabled,
            description: `Email notifications ${enabled ? 'enabled' : 'disabled'}`
        });

        res.json({ 
            success: true, 
            message: `Email notifications ${enabled ? 'enabled' : 'disabled'}`,
            enabled: enabled
        });
    } catch (error) {
        console.error('Error toggling email notifications:', error);
        res.status(500).json({ error: 'Failed to toggle email notifications' });
    }
});

// @route   POST /api/auth/unlink-google
// @desc    Unlink Google account
// @access  Private
router.post('/unlink-google', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.googleId) {
            return res.status(400).json({ error: 'Google account not linked' });
        }

        // Check if user has other auth methods
        const hasOtherAuth = user.authProvider !== 'google' || user.microsoftId;
        if (!hasOtherAuth) {
            return res.status(400).json({ 
                error: 'Cannot unlink Google account. Please link another authentication method first.' 
            });
        }

        const oldGoogleId = user.googleId;
        user.googleId = undefined;
        
        // Update auth provider if it was Google
        if (user.authProvider === 'google') {
            user.authProvider = user.microsoftId ? 'microsoft' : 'local';
        }

        await user.save();

        await safeLogAuthEvent('GOOGLE_ACCOUNT_UNLINKED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            oldGoogleId: oldGoogleId,
            description: 'Google account unlinked from user account'
        });

        res.json({ 
            success: true, 
            message: 'Google account unlinked successfully' 
        });
    } catch (error) {
        console.error('Error unlinking Google account:', error);
        res.status(500).json({ error: 'Failed to unlink Google account' });
    }
});

// @route   POST /api/auth/unlink-microsoft
// @desc    Unlink Microsoft account
// @access  Private
router.post('/unlink-microsoft', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.microsoftId) {
            return res.status(400).json({ error: 'Microsoft account not linked' });
        }

        // Check if user has other auth methods
        const hasOtherAuth = user.authProvider !== 'microsoft' || user.googleId;
        if (!hasOtherAuth) {
            return res.status(400).json({ 
                error: 'Cannot unlink Microsoft account. Please link another authentication method first.' 
            });
        }

        const oldMicrosoftId = user.microsoftId;
        user.microsoftId = undefined;
        
        // Update auth provider if it was Microsoft
        if (user.authProvider === 'microsoft') {
            user.authProvider = user.googleId ? 'google' : 'local';
        }

        await user.save();

        await safeLogAuthEvent('MICROSOFT_ACCOUNT_UNLINKED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            oldMicrosoftId: oldMicrosoftId,
            description: 'Microsoft account unlinked from user account'
        });

        res.json({ 
            success: true, 
            message: 'Microsoft account unlinked successfully' 
        });
    } catch (error) {
        console.error('Error unlinking Microsoft account:', error);
        res.status(500).json({ error: 'Failed to unlink Microsoft account' });
    }
});

// @route   POST /api/auth/enable-biometric
// @desc    Enable biometric authentication
// @access  Private
router.post('/enable-biometric', auth, async (req, res) => {
    try {
        const { credential, type, verified } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Handle different biometric types
        if (type === 'oauth-based' && verified) {
            // For OAuth users, enable biometric without WebAuthn credential
            user.biometricEnabled = true;
            user.biometricType = 'oauth-based';
            user.biometricCredentials = {
                type: 'oauth-based',
                verified: true,
                enabledAt: new Date()
            };

            await user.save();

            await safeLogAuthEvent('BIOMETRIC_AUTH_ENABLED', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'OAuth-based biometric authentication enabled for user'
            });

            res.json({ 
                success: true, 
                message: 'Biometric authentication enabled successfully (OAuth-based)' 
            });
        } else if (type === 'password-based' && verified) {
            // For password-verified users
            user.biometricEnabled = true;
            user.biometricType = 'password-based';
            user.biometricCredentials = {
                type: 'password-based',
                verified: true,
                enabledAt: new Date()
            };

            await user.save();

            await safeLogAuthEvent('BIOMETRIC_AUTH_ENABLED', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'Password-based biometric authentication enabled for user'
            });

            res.json({ 
                success: true, 
                message: 'Biometric authentication enabled successfully (Password-based)' 
            });
        } else if (credential) {
            // For WebAuthn credentials
            user.biometricEnabled = true;
            user.biometricType = 'webauthn';
            user.biometricCredentials = {
                id: credential.id,
                type: credential.type,
                rawId: credential.rawId,
                response: {
                    attestationObject: credential.response.attestationObject,
                    clientDataJSON: credential.response.clientDataJSON
                },
                enabledAt: new Date()
            };

            await user.save();

            await safeLogAuthEvent('BIOMETRIC_AUTH_ENABLED', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'WebAuthn biometric authentication enabled for user'
            });

            res.json({ 
                success: true, 
                message: 'Biometric authentication enabled successfully (WebAuthn)' 
            });
        } else {
            return res.status(400).json({ error: 'Invalid biometric authentication data' });
        }
    } catch (error) {
        console.error('Error enabling biometric authentication:', error);
        res.status(500).json({ error: 'Failed to enable biometric authentication' });
    }
});

// @route   POST /api/auth/disable-biometric
// @desc    Disable biometric authentication
// @access  Private
router.post('/disable-biometric', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.biometricEnabled = false;
        user.biometricCredentials = [];

        await user.save();

        await safeLogAuthEvent('BIOMETRIC_AUTH_DISABLED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'Biometric authentication disabled for user'
        });

        res.json({ 
            success: true, 
            message: 'Biometric authentication disabled successfully' 
        });
    } catch (error) {
        console.error('Error disabling biometric authentication:', error);
        res.status(500).json({ error: 'Failed to disable biometric authentication' });
    }
});

// @route   POST /api/user/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (newPassword.length < 12) {
            return res.status(400).json({ error: 'New password must be at least 12 characters long' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            await safeLogSecurityViolation('INVALID_PASSWORD_CHANGE_ATTEMPT', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'Invalid current password provided for password change'
            });
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Check if new password is different from current
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
            return res.status(400).json({ error: 'New password must be different from current password' });
        }

        // Check password history
        const isPasswordInHistory = await user.isPasswordInHistory(newPassword);
        if (isPasswordInHistory) {
            return res.status(400).json({ error: 'New password cannot be the same as any of your last 5 passwords' });
        }

        // Update password
        user.password = newPassword;
        user.passwordChangedAt = new Date();
        await user.save();

        await safeLogAuthEvent('PASSWORD_CHANGED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User password changed successfully'
        });

        res.json({ 
            success: true, 
            message: 'Password changed successfully' 
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// @route   GET /api/user/security-events
// @desc    Get user security events
// @access  Private
router.get('/security-events', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        // This would typically query a security events collection
        // For now, return a placeholder response
        const securityEvents = {
            events: [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 0,
                pages: 0
            }
        };

        res.json(securityEvents);
    } catch (error) {
        console.error('Error getting security events:', error);
        res.status(500).json({ error: 'Failed to get security events' });
    }
});

// @route   DELETE /api/user/account
// @desc    Delete user account
// @access  Private
router.delete('/account', auth, async (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ error: 'Password is required to delete account' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            await safeLogSecurityViolation('INVALID_ACCOUNT_DELETION_ATTEMPT', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'Invalid password provided for account deletion'
            });
            return res.status(400).json({ error: 'Password is incorrect' });
        }

        // Delete user account
        await User.findByIdAndDelete(req.user.id);

        await safeLogAuthEvent('ACCOUNT_DELETED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User account deleted'
        });

        res.json({ 
            success: true, 
            message: 'Account deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});


module.exports = router;
