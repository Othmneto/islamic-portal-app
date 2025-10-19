// Password security service
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class PasswordSecurity {
    constructor() {
        this.minLength = 12;
        this.requireUppercase = true;
        this.requireLowercase = true;
        this.requireNumbers = true;
        this.requireSpecialChars = true;
        this.passwordHistorySize = 5; // Keep last 5 passwords
    }

    // Validate password strength
    validatePassword(password) {
        const errors = [];

        if (password.length < this.minLength) {
            errors.push(`Password must be at least ${this.minLength} characters long`);
        }

        if (this.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (this.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (this.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (this.requireSpecialChars && !/[@$!%*?&]/.test(password)) {
            errors.push('Password must contain at least one special character (@$!%*?&)');
        }

        // Check for common patterns
        if (this.hasCommonPatterns(password)) {
            errors.push('Password contains common patterns and is not secure');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Check for common password patterns
    hasCommonPatterns(password) {
        const commonPatterns = [
            /123456/,
            /password/i,
            /qwerty/i,
            /abc123/i,
            /admin/i,
            /letmein/i,
            /welcome/i,
            /monkey/i,
            /dragon/i,
            /master/i,
            /hello/i,
            /login/i,
            /princess/i,
            /welcome/i,
            /solo/i,
            /welcome/i,
            /welcome/i,
            /welcome/i,
            /welcome/i,
            /welcome/i
        ];

        return commonPatterns.some(pattern => pattern.test(password));
    }

    // Generate secure password
    generateSecurePassword(length = 16) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$!%*?&';
        let password = '';

        // Ensure at least one character from each required category
        password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
        password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
        password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
        password += '@$!%*?&'[Math.floor(Math.random() * 7)]; // Special char

        // Fill the rest with random characters
        for (let i = password.length; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }

        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }

    // Hash password with salt
    async hashPassword(password) {
        const saltRounds = 12; // Increased from 10 for better security
        return await bcrypt.hash(password, saltRounds);
    }

    // Compare password with hash
    async comparePassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    // Check if password is in history
    async isPasswordInHistory(password, passwordHistory) {
        for (const oldHash of passwordHistory) {
            if (await bcrypt.compare(password, oldHash)) {
                return true;
            }
        }
        return false;
    }

    // Update password history
    async updatePasswordHistory(user, newPasswordHash) {
        const passwordHistory = user.passwordHistory || [];

        // Add new password to history
        passwordHistory.push(newPasswordHash);

        // Keep only the last N passwords
        if (passwordHistory.length > this.passwordHistorySize) {
            passwordHistory.splice(0, passwordHistory.length - this.passwordHistorySize);
        }

        return passwordHistory;
    }

    // Generate password reset token
    generatePasswordResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Hash password reset token
    hashPasswordResetToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    // Generate secure random string
    generateSecureRandom(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
}

module.exports = new PasswordSecurity();
