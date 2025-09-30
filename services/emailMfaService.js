// Email MFA Service
const crypto = require('crypto');
const User = require('../models/User');
const { safeLogAuthEvent, safeLogSecurityViolation } = require('../middleware/securityLogging');
const { createError } = require('../middleware/errorHandler');
const { get, set, del } = require('./diskPersistence');
const sendEmail = require('../utils/sendEmail');

class EmailMFAService {
    constructor() {
        this.codeExpiry = 5 * 60 * 1000; // 5 minutes
        this.maxAttempts = 3;
        this.attemptWindow = 15 * 60 * 1000; // 15 minutes
        this.memoryCodes = new Map(); // Fallback storage when disk persistence is disabled
    }

    /**
     * Generate email verification code
     */
    generateCode() {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Send email verification code
     */
    async sendVerificationCode(userId, email) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            // Check rate limiting
            const rateLimitKey = `email_mfa_rate_limit:${userId}`;
            let attempts = 0;
            
            // Try disk persistence first
            const diskAttempts = await get(rateLimitKey);

            if (diskAttempts !== null) {
                attempts = parseInt(diskAttempts) || 0;
            } else {
                // Fallback to memory storage for rate limiting
                const memoryRateLimitKey = `rate_limit:${userId}`;
                const memoryData = this.memoryCodes.get(memoryRateLimitKey);
                if (memoryData) {
                    attempts = memoryData.attempts || 0;
                    // Check if the window has expired
                    if (Date.now() - memoryData.createdAt > this.attemptWindow) {
                        attempts = 0; // Reset if window expired
                    }
                }
            }

            if (attempts >= this.maxAttempts) {
                console.warn('⚠️ [Email MFA] Rate limit exceeded for user:', userId, 'Attempts:', attempts);
                await safeLogSecurityViolation('email_mfa_rate_limit_exceeded', {
                    userId: userId,
                    ip: 'unknown',
                    userAgent: 'unknown',
                    attempts: attempts
                });
                throw createError('Too many email verification attempts. Please wait before requesting another code.', 429, 'RATE_LIMIT_EXCEEDED');
            }

            // Generate code
            const code = this.generateCode();
            const codeKey = `email_mfa_code:${userId}`;
            const codeData = {
                code: code,
                email: email,
                createdAt: Date.now(),
                attempts: 0
            };

            // Store code in disk persistence or memory fallback
            const diskStored = await set(codeKey, JSON.stringify(codeData), this.codeExpiry);
            await set(rateLimitKey, (attempts + 1).toString(), this.attemptWindow);

            // Fallback to memory storage if disk persistence is not available
            if (!diskStored) {
                console.log('📧 [Email MFA] Disk persistence not available, storing code in memory');
                this.memoryCodes.set(codeKey, codeData);
                
                // Store rate limit data in memory
                const memoryRateLimitKey = `rate_limit:${userId}`;
                const existingRateLimit = this.memoryCodes.get(memoryRateLimitKey);
                if (existingRateLimit) {
                    existingRateLimit.attempts = (existingRateLimit.attempts || 0) + 1;
                    this.memoryCodes.set(memoryRateLimitKey, existingRateLimit);
                } else {
                    this.memoryCodes.set(memoryRateLimitKey, {
                        attempts: 1,
                        createdAt: Date.now()
                    });
                }
                
                // Clean up expired codes from memory
                setTimeout(() => {
                    this.memoryCodes.delete(codeKey);
                }, this.codeExpiry);
            }

            // Send email (implement your email service here)
            await this.sendEmail(email, code);

            // Log code sent
            await safeLogAuthEvent('EMAIL_MFA_CODE_SENT', {
                userId: userId,
                email: email,
                ip: 'unknown',
                userAgent: 'unknown'
            });

            console.log(`✅ [Email MFA] Verification code sent successfully to ${email}`);
            console.log(`🔑 [Email MFA] VERIFICATION CODE: ${code}`);
            return {
                success: true,
                message: 'Verification code sent to your email',
                code: code, // Include code for development mode
                expiresIn: this.codeExpiry
            };
        } catch (error) {
            console.error('❌ Email MFA: Error sending verification code:', error);
            throw error;
        }
    }

    /**
     * Verify email code
     */
    async verifyCode(userId, code) {
        try {
            const codeKey = `email_mfa_code:${userId}`;
            let codeData = await get(codeKey);

            // Fallback to memory storage if disk persistence is not available
            if (!codeData) {
                console.log('📧 [Email MFA] Checking memory storage for code');
                codeData = this.memoryCodes.get(codeKey);
            }

            if (!codeData) {
                console.log('❌ [Email MFA] Code not found in disk persistence or memory');
                await safeLogSecurityViolation('email_mfa_code_not_found', {
                    userId: userId,
                    ip: 'unknown',
                    userAgent: 'unknown'
                });
                throw createError('Verification code not found or expired', 400, 'CODE_NOT_FOUND');
            }

            // Check if code is expired
            if (Date.now() - codeData.createdAt > this.codeExpiry) {
                await del(codeKey);
                throw createError('Verification code expired', 400, 'CODE_EXPIRED');
            }

            // Check attempts
            if (codeData.attempts >= this.maxAttempts) {
                await del(codeKey);
                await safeLogSecurityViolation('email_mfa_max_attempts_exceeded', {
                    userId: userId,
                    ip: 'unknown',
                    userAgent: 'unknown'
                });
                throw createError('Maximum verification attempts exceeded', 400, 'MAX_ATTEMPTS_EXCEEDED');
            }

            // Verify code
            if (codeData.code !== code) {
                codeData.attempts++;
                await set(codeKey, JSON.stringify(codeData), this.codeExpiry);

                await safeLogSecurityViolation('email_mfa_invalid_code', {
                    userId: userId,
                    ip: 'unknown',
                    userAgent: 'unknown',
                    attempts: codeData.attempts
                });
                throw createError('Invalid verification code', 400, 'INVALID_CODE');
            }

            // Code is valid, clean up
            await del(codeKey);
            
            // Also clean up from memory storage
            this.memoryCodes.delete(codeKey);

            // Log successful verification
            await safeLogAuthEvent('EMAIL_MFA_VERIFIED', {
                userId: userId,
                email: codeData.email,
                ip: 'unknown',
                userAgent: 'unknown'
            });

            return {
                success: true,
                message: 'Email verification successful'
            };
        } catch (error) {
            console.error('❌ Email MFA: Error verifying code:', error);
            throw error;
        }
    }

    /**
     * Send email (placeholder - implement with your email service)
     */
    async sendEmail(email, code) {
        try {
            console.log(`📧 [Email MFA] Sending verification code to ${email}: ${code}`);
            
            const emailOptions = {
                to: email,
                subject: 'Two-Factor Authentication Code - Islamic Translator',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; font-size: 24px;">🔐 Two-Factor Authentication</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Islamic Translator Security</p>
                        </div>
                        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <h2 style="color: #333; margin-top: 0;">Your Verification Code</h2>
                            <p style="color: #666; line-height: 1.6;">You requested a verification code for two-factor authentication. Use the code below to complete your setup:</p>
                            
                            <div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                                <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; font-family: 'Courier New', monospace;">${code}</div>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; margin-bottom: 0;">
                                <strong>Important:</strong> This code will expire in 5 minutes. If you didn't request this code, please ignore this email.
                            </p>
                            
                            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
                                <p>This is an automated message from Islamic Translator. Please do not reply to this email.</p>
                            </div>
                        </div>
                    </div>
                `
            };
            
            await sendEmail(emailOptions);
            console.log(`✅ [Email MFA] Verification code sent successfully to ${email}`);
            return true;
        } catch (error) {
            console.error(`❌ [Email MFA] Failed to send email to ${email}:`, error);
            throw createError('Failed to send verification email', 500, 'EMAIL_SEND_FAILED');
        }
    }

    /**
     * Enable email MFA for user
     */
    async enableEmailMFA(userId, email) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            // Update user with email MFA settings
            if (!user.mfa) {
                user.mfa = {};
            }
            user.mfa.emailMfaEnabled = true;
            user.mfa.emailMfaEmail = email;
            user.mfa.emailMfaEnabledAt = new Date();

            await user.save();

            // Log email MFA enablement
            await safeLogAuthEvent('EMAIL_MFA_ENABLED', {
                userId: userId,
                email: email,
                ip: 'unknown',
                userAgent: 'unknown'
            });

            return {
                success: true,
                message: 'Email MFA enabled successfully'
            };
        } catch (error) {
            console.error('❌ Email MFA: Error enabling email MFA:', error);
            throw error;
        }
    }

    /**
     * Disable email MFA for user
     */
    async disableEmailMFA(userId, password) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            // Verify password
            const bcrypt = require('bcryptjs');
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                await safeLogSecurityViolation('email_mfa_disable_invalid_password', {
                    userId: userId,
                    ip: 'unknown',
                    userAgent: 'unknown'
                });
                throw createError('Invalid password', 400, 'INVALID_PASSWORD');
            }

            // Disable email MFA
            user.emailMfaEnabled = false;
            user.emailMfaEmail = undefined;
            user.emailMfaDisabledAt = new Date();

            await user.save();

            // Log email MFA disablement
            await safeLogAuthEvent('EMAIL_MFA_DISABLED', {
                userId: userId,
                ip: 'unknown',
                userAgent: 'unknown'
            });

            return {
                success: true,
                message: 'Email MFA disabled successfully'
            };
        } catch (error) {
            console.error('❌ Email MFA: Error disabling email MFA:', error);
            throw error;
        }
    }

    /**
     * Get email MFA status
     */
    async getEmailMFAStatus(userId) {
        try {
            const user = await User.findById(userId).select('emailMfaEnabled emailMfaEmail emailMfaEnabledAt');
            if (!user) {
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            return {
                enabled: user.emailMfaEnabled || false,
                email: user.emailMfaEmail,
                enabledAt: user.emailMfaEnabledAt
            };
        } catch (error) {
            console.error('❌ Email MFA: Error getting email MFA status:', error);
            throw error;
        }
    }

    /**
     * Disable Email MFA for user
     */
    async disableEmailMFA(userId) {
        try {
            console.log('🔧 [Email MFA] Disabling Email MFA for user:', userId);
            
            const user = await User.findById(userId);
            if (!user) {
                console.error('❌ [Email MFA] User not found for disable:', userId);
                throw createError('User not found', 404, 'USER_NOT_FOUND');
            }

            // Update user MFA settings
            if (!user.mfa) {
                user.mfa = {};
            }
            user.mfa.emailMfaEnabled = false;
            user.mfa.emailMfaEmail = null;
            user.mfa.emailMfaEnabledAt = null;
            await user.save();

            // Clean up any pending verification codes
            await this.cleanupExpiredCodes();

            await safeLogAuthEvent('email_mfa_disabled', {
                userId: userId,
                ip: 'unknown',
                userAgent: 'unknown'
            });

            console.log('✅ [Email MFA] Email MFA disabled successfully for user:', userId);
            return {
                success: true,
                message: 'Email MFA disabled successfully'
            };
        } catch (error) {
            console.error('❌ [Email MFA] Error disabling Email MFA for user:', userId, error);
            throw error;
        }
    }
}

module.exports = new EmailMFAService();
