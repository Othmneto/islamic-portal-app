// Multi-Factor Authentication Service
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const User = require('../models/User');
const { safeLogAuthEvent, safeLogSecurityViolation } = require('../middleware/securityLogging');
const { createError } = require('../middleware/errorHandler');

class MFAService {
    constructor() {
        this.issuer = 'Text Translator App';
        this.algorithm = 'sha1';
        this.digits = 6;
        this.window = 2; // Allow 2 time steps (60 seconds) tolerance
    }

    /**
     * Generate TOTP secret for user
     */
    generateSecret(user) {
        try {
            console.log('🔐 [MFA] Generating TOTP secret for user:', user.email);
            
            const secret = speakeasy.generateSecret({
                name: `${this.issuer} (${user.email})`,
                issuer: this.issuer,
                length: 32
            });

            console.log('✅ [MFA] TOTP secret generated successfully');
            console.log('🔐 [MFA] Secret details:', {
                base32: secret.base32.substring(0, 8) + '...',
                qrCodeUrl: secret.otpauth_url.substring(0, 50) + '...',
                issuer: this.issuer
            });

            return {
                secret: secret.base32,
                qrCodeUrl: secret.otpauth_url,
                manualEntryKey: secret.base32
            };
        } catch (error) {
            console.error('❌ [MFA] Error generating secret:', error);
            throw createError('Failed to generate MFA secret', 500, 'MFA_GENERATION_ERROR');
        }
    }

    /**
     * Generate QR code for TOTP setup
     */
    async generateQRCode(secret) {
        try {
            console.log('📱 [MFA] Generating QR code for TOTP setup');
            const qrCodeUrl = await QRCode.toDataURL(secret.qrCodeUrl);
            console.log('✅ [MFA] QR code generated successfully');
            return qrCodeUrl;
        } catch (error) {
            console.error('❌ [MFA] Error generating QR code:', error);
            throw createError('Failed to generate QR code', 500, 'QR_CODE_ERROR');
        }
    }

    /**
     * Verify TOTP token
     */
    verifyToken(secret, token) {
        try {
            console.log('🔐 [MFA] Verifying token:', {
                tokenLength: token ? token.length : 0,
                token: token ? token.substring(0, 3) + '***' : 'null',
                expectedDigits: this.digits
            });

            // Validate token format
            if (!token || typeof token !== 'string') {
                console.log('❌ [MFA] Invalid token format');
                return false;
            }

            // Check if token is numeric
            if (!/^\d+$/.test(token)) {
                console.log('❌ [MFA] Token contains non-numeric characters');
                return false;
            }

            // Check token length
            if (token.length !== this.digits) {
                console.log(`❌ [MFA] Token length mismatch: expected ${this.digits}, got ${token.length}`);
                return false;
            }

            const verified = speakeasy.totp.verify({
                secret: secret,
                encoding: 'base32',
                token: token,
                window: this.window,
                algorithm: this.algorithm
            });

            console.log('🔐 [MFA] Token verification result:', verified);
            return verified;
        } catch (error) {
            console.error('❌ [MFA] Error verifying token:', error);
            return false;
        }
    }

    /**
     * Enable MFA for user
     */
    async enableMFA(userId, secret, token) {
        try {
            console.log('🔐 [MFA] Enabling MFA for user:', userId);
            console.log('🔐 [MFA] Verifying token with secret:', secret ? 'provided' : 'not provided');
            
            // Verify the token first
            if (!this.verifyToken(secret, token)) {
                console.log('❌ [MFA] Invalid token provided during MFA setup');
                await safeLogSecurityViolation('mfa_invalid_token', {
                    userId: userId,
                    ip: 'unknown',
                    userAgent: 'unknown',
                    reason: 'Invalid TOTP token during MFA setup'
                });
                throw createError('Invalid verification code', 400, 'INVALID_MFA_TOKEN');
            }

            console.log('✅ [MFA] Token verified successfully');

            const user = await User.findById(userId);
            if (!user) {
                console.log('❌ [MFA] User not found:', userId);
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            console.log('👤 [MFA] User found:', user.email);

            // Generate backup codes
            console.log('🔑 [MFA] Generating backup codes');
            const backupCodes = this.generateBackupCodes();
            console.log('✅ [MFA] Generated', backupCodes.length, 'backup codes');

            // Update user with MFA settings
            console.log('💾 [MFA] Updating user with MFA settings');
            user.twoFactorEnabled = true;
            user.twoFactorSecret = secret;
            user.backupCodes = backupCodes.map(code => ({
                code: crypto.createHash('sha256').update(code).digest('hex'),
                used: false,
                createdAt: new Date()
            }));
            user.mfaEnabledAt = new Date();

            await user.save();
            console.log('✅ [MFA] User updated successfully');

            // Log MFA enablement
            await safeLogAuthEvent('MFA_ENABLED', {
                userId: userId,
                ip: 'unknown',
                userAgent: 'unknown'
            });

            console.log('🎉 [MFA] MFA enabled successfully for user:', user.email);

            return {
                success: true,
                backupCodes: backupCodes, // Only return plain text backup codes once
                message: 'MFA enabled successfully'
            };
        } catch (error) {
            console.error('❌ [MFA] Error enabling MFA:', error);
            throw error;
        }
    }

    /**
     * Disable MFA for user
     */
    async disableMFA(userId, password) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            // Verify password
            const bcrypt = require('bcryptjs');
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                await safeLogSecurityViolation('mfa_disable_invalid_password', {
                    userId: userId,
                    ip: 'unknown',
                    userAgent: 'unknown'
                });
                throw createError('Invalid password', 400, 'INVALID_PASSWORD');
            }

            // Disable MFA
            user.twoFactorEnabled = false;
            user.twoFactorSecret = undefined;
            user.backupCodes = [];
            user.mfaDisabledAt = new Date();

            await user.save();

            // Log MFA disablement
            await safeLogAuthEvent('MFA_DISABLED', {
                userId: userId,
                ip: 'unknown',
                userAgent: 'unknown'
            });

            return {
                success: true,
                message: 'MFA disabled successfully'
            };
        } catch (error) {
            console.error('❌ MFA: Error disabling MFA:', error);
            throw error;
        }
    }

    /**
     * Verify MFA token during login
     */
    async verifyMFAToken(userId, token) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.twoFactorEnabled) {
                throw createError('MFA not enabled for user', 400, 'MFA_NOT_ENABLED');
            }

            // Check if it's a backup code
            if (this.isBackupCode(user, token)) {
                return await this.useBackupCode(user, token);
            }

            // Verify TOTP token
            const isValid = this.verifyToken(user.twoFactorSecret, token);
            if (!isValid) {
                await safeLogSecurityViolation('mfa_invalid_login_token', {
                    userId: userId,
                    ip: 'unknown',
                    userAgent: 'unknown'
                });
                throw createError('Invalid MFA token', 400, 'INVALID_MFA_TOKEN');
            }

            // Log successful MFA verification
            await safeLogAuthEvent('MFA_VERIFIED', {
                userId: userId,
                ip: 'unknown',
                userAgent: 'unknown'
            });

            return { success: true };
        } catch (error) {
            console.error('❌ MFA: Error verifying MFA token:', error);
            throw error;
        }
    }

    /**
     * Generate backup codes
     */
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }

    /**
     * Check if token is a backup code
     */
    isBackupCode(user, token) {
        if (!user.backupCodes || user.backupCodes.length === 0) {
            return false;
        }

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        return user.backupCodes.some(backupCode => 
            backupCode.code === hashedToken && !backupCode.used
        );
    }

    /**
     * Use backup code
     */
    async useBackupCode(user, token) {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const backupCode = user.backupCodes.find(code => 
            code.code === hashedToken && !code.used
        );

        if (!backupCode) {
            throw createError('Invalid backup code', 400, 'INVALID_BACKUP_CODE');
        }

        // Mark backup code as used
        backupCode.used = true;
        backupCode.usedAt = new Date();
        await user.save();

        // Log backup code usage
        await safeLogAuthEvent('MFA_BACKUP_CODE_USED', {
            userId: user._id,
            ip: 'unknown',
            userAgent: 'unknown'
        });

        return { success: true, isBackupCode: true };
    }

    /**
     * Regenerate backup codes
     */
    async regenerateBackupCodes(userId, password) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            // Verify password
            const bcrypt = require('bcryptjs');
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                throw createError('Invalid password', 400, 'INVALID_PASSWORD');
            }

            // Generate new backup codes
            const backupCodes = this.generateBackupCodes();
            user.backupCodes = backupCodes.map(code => ({
                code: crypto.createHash('sha256').update(code).digest('hex'),
                used: false,
                createdAt: new Date()
            }));

            await user.save();

            return {
                success: true,
                backupCodes: backupCodes
            };
        } catch (error) {
            console.error('❌ MFA: Error regenerating backup codes:', error);
            throw error;
        }
    }

    /**
     * Get MFA status for user
     */
    async getMFAStatus(userId) {
        try {
            const user = await User.findById(userId).select('twoFactorEnabled mfaEnabledAt backupCodes');
            if (!user) {
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            return {
                enabled: user.twoFactorEnabled || false,
                enabledAt: user.mfaEnabledAt,
                backupCodesCount: user.backupCodes ? user.backupCodes.filter(code => !code.used).length : 0
            };
        } catch (error) {
            console.error('❌ MFA: Error getting MFA status:', error);
            throw error;
        }
    }
}

module.exports = new MFAService();
