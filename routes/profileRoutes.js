const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { safeLogAuthEvent, safeLogSecurityViolation } = require('../middleware/securityLogging');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `avatar-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// @route   GET /api/user/profile
// @desc    Get user profile data
// @access  Private
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        console.log('👤 [Profile Routes] Getting profile for user:', req.user.id);
        
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Calculate stats
        const stats = {
            translations: user.translationCount || 0,
            logins: user.loginCount || 0,
            timeSpent: user.timeSpent || 0,
            favorites: user.favoritesCount || 0
        };

        await safeLogAuthEvent('PROFILE_VIEWED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User viewed their profile'
        });

        const userData = {
            id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            bio: user.bio,
            location: user.location,
            avatar: user.avatar,
            authProvider: user.authProvider,
            preferences: user.preferences,
            notificationPreferences: user.notificationPreferences,
            mfaEnabled: user.mfa?.totpEnabled || false,
            twoFactorEnabled: user.twoFactorEnabled || false,
            biometricEnabled: user.biometricEnabled || false,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        };
        
        console.log('👤 [Profile Routes] User data being sent:', userData);
        console.log('👤 [Profile Routes] Stats being sent:', stats);
        
        res.json({
            success: true,
            user: userData,
            stats
        });
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ error: 'Failed to get profile data' });
    }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        console.log('👤 [Profile Routes] Updating profile for user:', req.user.id);
        console.log('👤 [Profile Routes] Update data:', req.body);
        
        const { username, firstName, lastName, bio, location } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if username is already taken
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username: username });
            if (existingUser) {
                return res.status(400).json({ error: 'Username already taken' });
            }
        }

        // Update user data
        user.username = username || user.username;
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.bio = bio || user.bio;
        user.location = location || user.location;
        user.updatedAt = new Date();

        await user.save();

        await safeLogAuthEvent('PROFILE_UPDATED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User updated their profile information'
        });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                bio: user.bio,
                location: user.location,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// @route   POST /api/user/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        console.log('👤 [Profile Routes] Uploading avatar for user:', req.user.id);
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete old avatar if exists
        if (user.avatar) {
            const oldAvatarPath = path.join(__dirname, '../public', user.avatar);
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        // Update user avatar
        user.avatar = `/uploads/avatars/${req.file.filename}`;
        await user.save();

        await safeLogAuthEvent('AVATAR_UPLOADED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User uploaded a new avatar'
        });

        res.json({
            success: true,
            message: 'Avatar uploaded successfully',
            avatarUrl: user.avatar
        });
    } catch (error) {
        console.error('Error uploading avatar:', error);
        res.status(500).json({ error: 'Failed to upload avatar' });
    }
});

// @route   PUT /api/user/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', authMiddleware, async (req, res) => {
    try {
        console.log('👤 [Profile Routes] Updating preferences for user:', req.user.id);
        console.log('👤 [Profile Routes] Preferences data:', req.body);
        
        const { preferences, notificationPreferences } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update preferences
        if (preferences) {
            user.preferences = {
                ...user.preferences,
                ...preferences
            };
        }

        // Update notification preferences
        if (notificationPreferences) {
            user.notificationPreferences = {
                ...user.notificationPreferences,
                ...notificationPreferences
            };
        }

        user.updatedAt = new Date();
        await user.save();

        await safeLogAuthEvent('PREFERENCES_UPDATED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User updated their preferences'
        });

        res.json({
            success: true,
            message: 'Preferences updated successfully'
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// @route   GET /api/user/activity
// @desc    Get user activity history
// @access  Private
router.get('/activity', authMiddleware, async (req, res) => {
    try {
        console.log('👤 [Profile Routes] Getting activity for user:', req.user.id);
        
        // This would typically come from an Activity model
        // For now, we'll return mock data
        const activities = [
            {
                id: 1,
                action: 'Profile updated',
                type: 'profile_update',
                timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 2,
                action: 'Translation completed',
                type: 'translation',
                timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 3,
                action: 'Password changed',
                type: 'password_change',
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 4,
                action: 'Two-factor authentication enabled',
                type: 'mfa_enabled',
                timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];

        res.json({
            success: true,
            activities
        });
    } catch (error) {
        console.error('Error getting activity:', error);
        res.status(500).json({ error: 'Failed to get activity data' });
    }
});

// @route   POST /api/user/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        console.log('👤 [Profile Routes] Changing password for user:', req.user.id);
        
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // For OAuth users, they don't have a password
        if (!user.password) {
            return res.status(400).json({ error: 'Password change not available for OAuth users' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            await safeLogSecurityViolation('INVALID_PASSWORD_ATTEMPT', {
                userId: user._id,
                email: user.email,
                ip: req.ip || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                description: 'Invalid current password provided for password change'
            });
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        user.password = hashedPassword;
        user.updatedAt = new Date();
        await user.save();

        await safeLogAuthEvent('PASSWORD_CHANGED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User changed their password'
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

// @route   GET /api/user/export-data
// @desc    Export user data
// @access  Private
router.get('/export-data', authMiddleware, async (req, res) => {
    try {
        console.log('👤 [Profile Routes] Exporting data for user:', req.user.id);
        
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prepare export data
        const exportData = {
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                bio: user.bio,
                location: user.location,
                authProvider: user.authProvider,
                preferences: user.preferences,
                notificationPreferences: user.notificationPreferences,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            },
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        await safeLogAuthEvent('DATA_EXPORTED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User exported their data'
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="my-data-export.json"');
        res.json(exportData);
    } catch (error) {
        console.error('Error exporting data:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// @route   GET /api/user/privacy-settings
// @desc    Get user privacy settings
// @access  Private
router.get('/privacy-settings', authMiddleware, async (req, res) => {
    try {
        console.log('🔒 [Profile Routes] Getting privacy settings for user:', req.user.id);
        
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const settings = {
            analyticsEnabled: user.privacySettings?.analyticsEnabled ?? true,
            translationHistoryEnabled: user.privacySettings?.translationHistoryEnabled ?? true,
            personalizationEnabled: user.privacySettings?.personalizationEnabled ?? true,
            dataRetentionPeriod: user.privacySettings?.dataRetentionPeriod ?? '2',
            emailNotifications: user.notificationPreferences?.emailNotifications ?? true,
            marketingEmails: user.privacySettings?.marketingEmails ?? false,
            prayerReminders: user.notificationPreferences?.prayerReminders ?? true,
            securityAlerts: user.privacySettings?.securityAlerts ?? true,
            thirdPartySharing: user.privacySettings?.thirdPartySharing ?? false,
            researchData: user.privacySettings?.researchData ?? false,
            publicProfile: user.privacySettings?.publicProfile ?? false
        };

        const usage = {
            translations: user.translationCount || 0,
            prayerLogs: user.prayerLogCount || 0,
            favorites: user.favoritesCount || 0,
            profileDataSize: calculateProfileDataSize(user)
        };

        res.json({
            success: true,
            settings,
            usage
        });
    } catch (error) {
        console.error('Error getting privacy settings:', error);
        res.status(500).json({ error: 'Failed to get privacy settings' });
    }
});

// @route   PUT /api/user/privacy-settings
// @desc    Update user privacy settings
// @access  Private
router.put('/privacy-settings', authMiddleware, async (req, res) => {
    try {
        console.log('🔒 [Profile Routes] Updating privacy settings for user:', req.user.id);
        console.log('🔒 [Profile Routes] Privacy settings data:', req.body);
        
        const { settings } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update privacy settings
        user.privacySettings = {
            ...user.privacySettings,
            ...settings
        };

        // Update notification preferences if they're in the settings
        if (settings.emailNotifications !== undefined) {
            user.notificationPreferences = {
                ...user.notificationPreferences,
                emailNotifications: settings.emailNotifications
            };
        }

        if (settings.prayerReminders !== undefined) {
            user.notificationPreferences = {
                ...user.notificationPreferences,
                prayerReminders: settings.prayerReminders
            };
        }

        user.updatedAt = new Date();
        await user.save();

        await safeLogAuthEvent('PRIVACY_SETTINGS_UPDATED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User updated their privacy settings'
        });

        res.json({
            success: true,
            message: 'Privacy settings updated successfully'
        });
    } catch (error) {
        console.error('Error updating privacy settings:', error);
        res.status(500).json({ error: 'Failed to update privacy settings' });
    }
});

// @route   DELETE /api/user/clear-translation-history
// @desc    Clear user translation history
// @access  Private
router.delete('/clear-translation-history', authMiddleware, async (req, res) => {
    try {
        console.log('🗑️ [Profile Routes] Clearing translation history for user:', req.user.id);
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Reset translation count
        user.translationCount = 0;
        user.updatedAt = new Date();
        await user.save();

        // TODO: Clear actual translation history from translation collection
        // This would require access to the translation model

        await safeLogAuthEvent('TRANSLATION_HISTORY_CLEARED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User cleared their translation history'
        });

        res.json({
            success: true,
            message: 'Translation history cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing translation history:', error);
        res.status(500).json({ error: 'Failed to clear translation history' });
    }
});

// @route   GET /api/user/remember-me-settings
// @desc    Get user remember me settings
// @access  Private
router.get('/remember-me-settings', authMiddleware, async (req, res) => {
    try {
        console.log('💾 [Profile Routes] Getting remember me settings for user:', req.user.id);
        
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const settings = {
            rememberMeEnabled: user.rememberMeSettings?.rememberMeEnabled ?? true,
            sessionDuration: user.rememberMeSettings?.sessionDuration ?? '30',
            autoLoginEnabled: user.rememberMeSettings?.autoLoginEnabled ?? false,
            biometricLoginEnabled: user.rememberMeSettings?.biometricLoginEnabled ?? false,
            requireReauth: user.rememberMeSettings?.requireReauth ?? true,
            loginNotifications: user.rememberMeSettings?.loginNotifications ?? true,
            sessionTimeout: user.rememberMeSettings?.sessionTimeout ?? '60',
            offlineTranslations: user.rememberMeSettings?.offlineTranslations ?? true,
            prayerTimesCache: user.rememberMeSettings?.prayerTimesCache ?? true,
            userPreferences: user.rememberMeSettings?.userPreferences ?? true
        };

        res.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Error getting remember me settings:', error);
        res.status(500).json({ error: 'Failed to get remember me settings' });
    }
});

// @route   PUT /api/user/remember-me-settings
// @desc    Update user remember me settings
// @access  Private
router.put('/remember-me-settings', authMiddleware, async (req, res) => {
    try {
        console.log('💾 [Profile Routes] Updating remember me settings for user:', req.user.id);
        console.log('💾 [Profile Routes] Remember me settings data:', req.body);
        
        const { settings } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update remember me settings
        user.rememberMeSettings = {
            ...user.rememberMeSettings,
            ...settings
        };

        user.updatedAt = new Date();
        await user.save();

        await safeLogAuthEvent('REMEMBER_ME_SETTINGS_UPDATED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User updated their remember me settings'
        });

        res.json({
            success: true,
            message: 'Remember me settings updated successfully'
        });
    } catch (error) {
        console.error('Error updating remember me settings:', error);
        res.status(500).json({ error: 'Failed to update remember me settings' });
    }
});

// @route   GET /api/user/trusted-devices
// @desc    Get user trusted devices
// @access  Private
router.get('/trusted-devices', authMiddleware, async (req, res) => {
    try {
        console.log('📱 [Profile Routes] Getting trusted devices for user:', req.user.id);
        
        // This would typically come from a TrustedDevice model
        // For now, we'll return mock data
        const devices = [
            {
                id: '1',
                name: 'Chrome on Windows',
                type: 'desktop',
                browser: 'Chrome 120.0',
                os: 'Windows 11',
                lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                isActive: true
            },
            {
                id: '2',
                name: 'Safari on iPhone',
                type: 'mobile',
                browser: 'Safari 17.0',
                os: 'iOS 17.2',
                lastUsed: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                isActive: true
            },
            {
                id: '3',
                name: 'Firefox on Mac',
                type: 'desktop',
                browser: 'Firefox 121.0',
                os: 'macOS 14.2',
                lastUsed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: false
            }
        ];

        res.json({
            success: true,
            devices
        });
    } catch (error) {
        console.error('Error getting trusted devices:', error);
        res.status(500).json({ error: 'Failed to get trusted devices' });
    }
});

// @route   DELETE /api/user/trusted-devices/:deviceId
// @desc    Revoke trusted device
// @access  Private
router.delete('/trusted-devices/:deviceId', authMiddleware, async (req, res) => {
    try {
        console.log('🚫 [Profile Routes] Revoking trusted device:', req.params.deviceId);
        
        const { deviceId } = req.params;
        
        // This would typically delete from a TrustedDevice model
        // For now, we'll just return success
        
        await safeLogAuthEvent('TRUSTED_DEVICE_REVOKED', {
            userId: req.user.id,
            email: req.user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: `User revoked trusted device: ${deviceId}`
        });

        res.json({
            success: true,
            message: 'Device access revoked successfully'
        });
    } catch (error) {
        console.error('Error revoking trusted device:', error);
        res.status(500).json({ error: 'Failed to revoke device access' });
    }
});

// Helper function to calculate profile data size
function calculateProfileDataSize(user) {
    let size = 0;
    
    // Calculate size of text fields
    const textFields = [
        user.username, user.email, user.firstName, user.lastName,
        user.bio, user.location, JSON.stringify(user.preferences),
        JSON.stringify(user.notificationPreferences),
        JSON.stringify(user.privacySettings)
    ];
    
    textFields.forEach(field => {
        if (field) {
            size += new Blob([field]).size;
        }
    });
    
    return size;
}

// @route   DELETE /api/user/delete-account
// @desc    Delete user account
// @access  Private
router.delete('/delete-account', authMiddleware, async (req, res) => {
    try {
        console.log('👤 [Profile Routes] Deleting account for user:', req.user.id);
        
        const { password } = req.body;
        
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // For OAuth users, no password verification needed
        if (user.password) {
            if (!password) {
                return res.status(400).json({ error: 'Password is required to delete account' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                await safeLogSecurityViolation('INVALID_PASSWORD_ATTEMPT', {
                    userId: user._id,
                    email: user.email,
                    ip: req.ip || 'unknown',
                    userAgent: req.get('User-Agent') || 'unknown',
                    description: 'Invalid password provided for account deletion'
                });
                return res.status(401).json({ error: 'Password is incorrect' });
            }
        }

        // Delete user
        await User.findByIdAndDelete(req.user.id);

        await safeLogAuthEvent('ACCOUNT_DELETED', {
            userId: user._id,
            email: user.email,
            ip: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            description: 'User deleted their account'
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
