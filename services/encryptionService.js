const crypto = require('crypto');

/**
 * End-to-End Encryption Service
 * Provides encryption for translations in transit and at rest
 */
class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16; // 128 bits
        this.tagLength = 16; // 128 bits
        this.saltLength = 32; // 256 bits

        // Initialize with environment variables or generate new keys
        this.masterKey = this.initializeMasterKey();
        this.encryptionKeys = new Map(); // Cache for derived keys
    }

    /**
     * Initialize master key from environment or generate new one
     */
    initializeMasterKey() {
        const envKey = process.env.ENCRYPTION_MASTER_KEY;
        if (envKey && envKey.length === 64) { // 32 bytes in hex
            return Buffer.from(envKey, 'hex');
        }

        // Generate new master key
        const newKey = crypto.randomBytes(this.keyLength);
        console.warn('⚠️ [EncryptionService] Generated new master key. Set ENCRYPTION_MASTER_KEY environment variable for production.');
        return newKey;
    }

    /**
     * Derive encryption key from master key and user context
     */
    deriveKey(userId, context = 'translation') {
        const keyId = `${userId}_${context}`;

        if (this.encryptionKeys.has(keyId)) {
            return this.encryptionKeys.get(keyId);
        }

        // Derive key using PBKDF2
        const salt = crypto.randomBytes(this.saltLength);
        const derivedKey = crypto.pbkdf2Sync(
            this.masterKey,
            Buffer.from(keyId, 'utf8'),
            100000, // iterations
            this.keyLength,
            'sha512'
        );

        this.encryptionKeys.set(keyId, derivedKey);
        return derivedKey;
    }

    /**
     * Encrypt translation data
     */
    encryptTranslation(translationData, userId, context = 'translation') {
        try {
            const key = this.deriveKey(userId, context);
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipherGCM(this.algorithm, key, iv);
            cipher.setAAD(Buffer.from(userId, 'utf8')); // Additional authenticated data

            const plaintext = JSON.stringify(translationData);
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const tag = cipher.getAuthTag();

            return {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                tag: tag.toString('hex'),
                algorithm: this.algorithm,
                timestamp: Date.now(),
                userId: userId,
                context: context
            };
        } catch (error) {
            console.error('❌ [EncryptionService] Encryption failed:', error);
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypt translation data
     */
    decryptTranslation(encryptedData, userId) {
        try {
            const key = this.deriveKey(userId, encryptedData.context);
            const decipher = crypto.createDecipherGCM(this.algorithm, key, Buffer.from(encryptedData.iv, 'hex'));
            decipher.setAAD(Buffer.from(userId, 'utf8')); // Additional authenticated data
            decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (error) {
            console.error('❌ [EncryptionService] Decryption failed:', error);
            throw new Error('Decryption failed');
        }
    }

    /**
     * Encrypt text for transmission
     */
    encryptText(text, userId, context = 'transmission') {
        try {
            const key = this.deriveKey(userId, context);
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipherGCM(this.algorithm, key, iv);
            cipher.setAAD(Buffer.from(userId, 'utf8'));

            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const tag = cipher.getAuthTag();

            return {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                tag: tag.toString('hex'),
                algorithm: this.algorithm
            };
        } catch (error) {
            console.error('❌ [EncryptionService] Text encryption failed:', error);
            throw new Error('Text encryption failed');
        }
    }

    /**
     * Decrypt text from transmission
     */
    decryptText(encryptedText, userId) {
        try {
            const key = this.deriveKey(userId, 'transmission');
            const decipher = crypto.createDecipherGCM(this.algorithm, key, Buffer.from(encryptedText.iv, 'hex'));
            decipher.setAAD(Buffer.from(userId, 'utf8'));
            decipher.setAuthTag(Buffer.from(encryptedText.tag, 'hex'));

            let decrypted = decipher.update(encryptedText.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('❌ [EncryptionService] Text decryption failed:', error);
            throw new Error('Text decryption failed');
        }
    }

    /**
     * Hash sensitive data for storage
     */
    hashSensitiveData(data, salt = null) {
        const actualSalt = salt || crypto.randomBytes(this.saltLength);
        const hash = crypto.pbkdf2Sync(
            Buffer.from(data, 'utf8'),
            actualSalt,
            100000,
            this.keyLength,
            'sha512'
        );

        return {
            hash: hash.toString('hex'),
            salt: actualSalt.toString('hex')
        };
    }

    /**
     * Verify hashed data
     */
    verifyHashedData(data, hashedData) {
        const salt = Buffer.from(hashedData.salt, 'hex');
        const hash = crypto.pbkdf2Sync(
            Buffer.from(data, 'utf8'),
            salt,
            100000,
            this.keyLength,
            'sha512'
        );

        return hash.toString('hex') === hashedData.hash;
    }

    /**
     * Generate secure random token
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Encrypt file data
     */
    encryptFile(fileBuffer, userId, context = 'file') {
        try {
            const key = this.deriveKey(userId, context);
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipherGCM(this.algorithm, key, iv);
            cipher.setAAD(Buffer.from(userId, 'utf8'));

            let encrypted = cipher.update(fileBuffer);
            encrypted = Buffer.concat([encrypted, cipher.final()]);

            const tag = cipher.getAuthTag();

            return {
                encrypted: encrypted.toString('base64'),
                iv: iv.toString('hex'),
                tag: tag.toString('hex'),
                algorithm: this.algorithm
            };
        } catch (error) {
            console.error('❌ [EncryptionService] File encryption failed:', error);
            throw new Error('File encryption failed');
        }
    }

    /**
     * Decrypt file data
     */
    decryptFile(encryptedFile, userId) {
        try {
            const key = this.deriveKey(userId, 'file');
            const decipher = crypto.createDecipherGCM(this.algorithm, key, Buffer.from(encryptedFile.iv, 'hex'));
            decipher.setAAD(Buffer.from(userId, 'utf8'));
            decipher.setAuthTag(Buffer.from(encryptedFile.tag, 'hex'));

            const encryptedBuffer = Buffer.from(encryptedFile.encrypted, 'base64');
            let decrypted = decipher.update(encryptedBuffer);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return decrypted;
        } catch (error) {
            console.error('❌ [EncryptionService] File decryption failed:', error);
            throw new Error('File decryption failed');
        }
    }

    /**
     * Get encryption status and statistics
     */
    getEncryptionStatus() {
        return {
            algorithm: this.algorithm,
            key_length: this.keyLength,
            iv_length: this.ivLength,
            tag_length: this.tagLength,
            salt_length: this.saltLength,
            cached_keys: this.encryptionKeys.size,
            master_key_initialized: !!this.masterKey
        };
    }

    /**
     * Clear cached keys (for security)
     */
    clearCachedKeys() {
        this.encryptionKeys.clear();
        console.log('🔒 [EncryptionService] Cached encryption keys cleared');
    }

    /**
     * Rotate master key (for security)
     */
    rotateMasterKey() {
        this.masterKey = crypto.randomBytes(this.keyLength);
        this.clearCachedKeys();
        console.log('🔄 [EncryptionService] Master key rotated');
    }
}

module.exports = EncryptionService;
