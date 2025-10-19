/**
 * Unified Authentication Service
 * Handles email login, Google OAuth, and Microsoft OAuth with seamless integration
 */

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { env } = require('../config');
const { safeLogAuthEvent, safeLogSecurityViolation } = require('../middleware/securityLogging');
const { createError, oauthErrorHandler, databaseErrorHandler } = require('../middleware/errorHandler');

class UnifiedAuthService {
    constructor() {
        this.jwtSecret = env.JWT_SECRET;
        this.jwtExpiresIn = env.JWT_EXPIRES_IN || '7d';
    }

    /**
     * Generate JWT token for user
     */
    generateToken(user) {
        const payload = {
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                authProvider: user.authProvider,
                isVerified: user.isVerified
            }
        };

        return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    }

    /**
     * Verify JWT token
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    /**
     * Create or update user from OAuth profile
     */
    async createOrUpdateUserFromOAuth(profile, provider, ip = 'unknown', userAgent = 'unknown') {
        try {
            // Handle different OAuth provider email formats
            console.log(`🔍 [UnifiedAuth] Processing ${provider} profile:`, {
                emails: profile.emails,
                email: profile.email,
                preferred_username: profile.preferred_username,
                userPrincipalName: profile.userPrincipalName,
                allKeys: Object.keys(profile)
            });

            let email;
            if (provider === 'google') {
                email = profile.emails?.[0]?.value || profile.email;
            } else if (provider === 'microsoft') {
                email = profile.email || profile.preferred_username || profile.userPrincipalName;
            } else {
                // Fallback for other providers
                email = profile.emails?.[0]?.value || profile.email || profile.preferred_username;
            }

            console.log(`🔍 [UnifiedAuth] Extracted email for ${provider}:`, email);

            if (!email) {
                console.error(`❌ [UnifiedAuth] No email found in ${provider} profile:`, {
                    emails: profile.emails,
                    email: profile.email,
                    preferred_username: profile.preferred_username,
                    userPrincipalName: profile.userPrincipalName,
                    allKeys: Object.keys(profile)
                });
                throw new Error(`No email found in ${provider} profile`);
            }

            const providerIdField = `${provider}Id`;
            const providerId = profile.id;

            // Check if user exists by email
            let user = await User.findOne({ email });

            if (user) {
                // User exists, update OAuth info
                const updateData = {
                    [providerIdField]: providerId,
                    authProvider: provider,
                    isVerified: true,
                    lastLogin: new Date(),
                    lastLoginIP: ip || 'unknown'
                };

                // If user was previously local auth, keep their password
                if (user.authProvider === 'local') {
                    updateData.authProvider = 'hybrid'; // Mark as hybrid auth
                }

                user = await User.findOneAndUpdate(
                    { email },
                    { $set: updateData },
                    { new: true }
                );

                console.log(`✅ [UnifiedAuth] Updated existing user ${email} with ${provider} OAuth`);
            } else {
                // Create new user
                user = new User({
                    email,
                    [providerIdField]: providerId,
                    authProvider: provider,
                    isVerified: true,
                    lastLogin: new Date(),
                    lastLoginIP: ip || 'unknown',
                    // Username will be set during username setup
                    username: undefined
                });

                await user.save();
                console.log(`✅ [UnifiedAuth] Created new user ${email} with ${provider} OAuth`);
            }

            // Log authentication event
            await safeLogAuthEvent('OAUTH_LOGIN_SUCCESS', {
                userId: user._id,
                email: user.email,
                authProvider: provider,
                ip: ip || 'unknown',
                userAgent: userAgent || 'unknown',
                success: true
            });

            return user;
        } catch (error) {
            console.error(`❌ [UnifiedAuth] Error creating/updating user from ${provider}:`, error);

            await safeLogSecurityViolation('oauth_user_creation_failed', {
                provider: provider,
                email: profile.emails?.[0]?.value || profile.email || 'unknown',
                error: error.message,
                ip: ip || 'unknown',
                userAgent: userAgent || 'unknown'
            });

            // Handle specific OAuth errors
            if (error.message.includes('No email found')) {
                throw oauthErrorHandler(error, provider);
            }

            // Handle database errors
            if (error.name === 'MongoError' || error.name === 'ValidationError') {
                throw databaseErrorHandler(error);
            }

            throw createError(`OAuth authentication failed for ${provider}`, 500, 'OAUTH_ERROR');
        }
    }

    /**
     * Authenticate user with email and password
     */
    async authenticateWithEmail(email, password, ip, userAgent) {
        try {
            // Find user by email
            const user = await User.findOne({ email });
            if (!user) {
                await safeLogSecurityViolation({
                    event: 'login_attempt_invalid_email',
                    email: email,
                    ip: ip,
                    userAgent: userAgent
                });
                throw new Error('Invalid credentials');
            }

            // Check if account is locked
            if (user.accountLockedUntil && user.accountLockedUntil > Date.now()) {
                await safeLogSecurityViolation({
                    event: 'login_attempt_locked_account',
                    userId: user._id,
                    email: email,
                    ip: ip,
                    userAgent: userAgent
                });
                throw new Error('Account is temporarily locked due to too many failed attempts');
            }

            // Check password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                // Increment failed login attempts
                user.failedLoginAttempts += 1;

                // Lock account after 5 failed attempts
                if (user.failedLoginAttempts >= 5) {
                    user.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
                }

                await user.save();

                await safeLogSecurityViolation({
                    event: 'login_attempt_invalid_password',
                    userId: user._id,
                    email: email,
                    ip: ip,
                    userAgent: userAgent,
                    failedAttempts: user.failedLoginAttempts
                });

                throw new Error('Invalid credentials');
            }

            // Reset failed login attempts on successful login
            user.failedLoginAttempts = 0;
            user.accountLockedUntil = undefined;
            user.lastLogin = new Date();
            user.lastLoginIP = ip;
            await user.save();

            // Log successful authentication
            await safeLogAuthEvent('LOGIN_SUCCESS', {
                userId: user._id,
                email: user.email,
                authProvider: 'email',
                ip: ip,
                userAgent: userAgent,
                success: true
            });

            return user;
        } catch (error) {
            console.error('❌ [UnifiedAuth] Email authentication error:', error);
            throw error;
        }
    }

    /**
     * Link OAuth account to existing email user
     */
    async linkOAuthToExistingUser(email, profile, provider) {
        try {
            const user = await User.findOne({ email });
            if (!user) {
                throw new Error('User not found');
            }

            const providerIdField = `${provider}Id`;
            const providerId = profile.id;

            // Check if OAuth account is already linked to another user
            const existingOAuthUser = await User.findOne({ [providerIdField]: providerId });
            if (existingOAuthUser && existingOAuthUser._id.toString() !== user._id.toString()) {
                throw new Error(`${provider} account is already linked to another user`);
            }

            // Link OAuth account
            user[providerIdField] = providerId;
            if (user.authProvider === 'local') {
                user.authProvider = 'hybrid';
            }
            user.isVerified = true;
            user.lastLogin = new Date();
            user.lastLoginIP = profile.lastLoginIP || 'unknown';

            await user.save();

            // Log account linking
            await safeLogAuthEvent('OAUTH_ACCOUNT_LINKED', {
                userId: user._id,
                email: user.email,
                authProvider: provider,
                ip: profile.lastLoginIP || 'unknown',
                userAgent: profile.lastLoginUserAgent || 'unknown',
                success: true
            });

            console.log(`✅ [UnifiedAuth] Linked ${provider} account to user ${email}`);
            return user;
        } catch (error) {
            console.error(`❌ [UnifiedAuth] Error linking ${provider} account:`, error);
            throw error;
        }
    }

    /**
     * Get user authentication methods
     */
    async getUserAuthMethods(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const authMethods = {
                email: !!user.password,
                google: !!user.googleId,
                microsoft: !!user.microsoftId,
                facebook: !!user.facebookId,
                twitter: !!user.twitterId,
                tiktok: !!user.tiktokId
            };

            return {
                user: {
                    id: user._id,
                    email: user.email,
                    username: user.username,
                    authProvider: user.authProvider,
                    isVerified: user.isVerified
                },
                authMethods
            };
        } catch (error) {
            console.error('❌ [UnifiedAuth] Error getting user auth methods:', error);
            throw error;
        }
    }

    /**
     * Unlink OAuth account
     */
    async unlinkOAuthAccount(userId, provider) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const providerIdField = `${provider}Id`;

            // Check if user has other auth methods
            const hasPassword = !!user.password;
            const hasOtherOAuth = Object.keys(user.toObject()).some(key =>
                key.endsWith('Id') && key !== providerIdField && user[key]
            );

            if (!hasPassword && !hasOtherOAuth) {
                throw new Error('Cannot unlink the only authentication method');
            }

            // Unlink the OAuth account
            user[providerIdField] = undefined;

            // Update auth provider if needed
            if (user.authProvider === provider) {
                if (hasPassword) {
                    user.authProvider = 'local';
                } else {
                    // Find another OAuth provider
                    const otherProvider = Object.keys(user.toObject()).find(key =>
                        key.endsWith('Id') && key !== providerIdField && user[key]
                    );
                    if (otherProvider) {
                        user.authProvider = otherProvider.replace('Id', '');
                    }
                }
            }

            await user.save();

            // Log unlinking event
            await safeLogAuthEvent('OAUTH_ACCOUNT_UNLINKED', {
                userId: user._id,
                email: user.email,
                authProvider: provider,
                ip: 'unknown',
                userAgent: 'unknown',
                success: true
            });

            console.log(`✅ [UnifiedAuth] Unlinked ${provider} account from user ${user.email}`);
            return user;
        } catch (error) {
            console.error(`❌ [UnifiedAuth] Error unlinking ${provider} account:`, error);
            throw error;
        }
    }

    /**
     * Create unified login response
     */
    createLoginResponse(user, token) {
        return {
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                authProvider: user.authProvider,
                isVerified: user.isVerified,
                needsUsernameSetup: !user.username && user.authProvider !== 'local'
            },
            message: 'Login successful'
        };
    }

    /**
     * Handle OAuth callback and create unified response
     */
    async handleOAuthCallback(profile, provider, ip, userAgent) {
        try {
            const user = await this.createOrUpdateUserFromOAuth(profile, provider, ip, userAgent);
            const token = this.generateToken(user);

            return this.createLoginResponse(user, token);
        } catch (error) {
            console.error(`❌ [UnifiedAuth] OAuth callback error for ${provider}:`, error);
            throw error;
        }
    }
}

module.exports = new UnifiedAuthService();
