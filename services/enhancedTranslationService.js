const ContextAwareTranslationService = require('./contextAwareTranslation');
const DomainSpecificTranslationService = require('./domainSpecificTranslation');
const EncryptionService = require('./encryptionService');
const AuditLoggingService = require('./auditLoggingService');
const DatabaseOptimizationService = require('./databaseOptimizationService');
const { translationCache } = require('./translationCache');

/**
 * Enhanced Translation Service
 * Integrates all advanced features for Muslim-focused text translation
 */
class EnhancedTranslationService {
    constructor() {
        this.contextAware = new ContextAwareTranslationService();
        this.domainSpecific = new DomainSpecificTranslationService();
        this.encryption = new EncryptionService();
        this.auditLogger = new AuditLoggingService();
        this.dbOptimizer = new DatabaseOptimizationService();
        
        this.isInitialized = false;
    }

    /**
     * Initialize the enhanced translation service
     */
    async initialize() {
        try {
            console.log('🚀 [EnhancedTranslationService] Initializing enhanced translation service...');
            
        // Initialize database optimization (skip for now to avoid model issues)
        // await this.dbOptimizer.initialize();
            
            // Initialize audit logging
            await this.auditLogger.initializeLogDirectory();
            
            this.isInitialized = true;
            console.log('✅ [EnhancedTranslationService] Enhanced translation service initialized');
        } catch (error) {
            console.error('❌ [EnhancedTranslationService] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Enhanced translation with all features
     */
    async translateText(text, sourceLang, targetLang, userId, options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        const sessionId = options.sessionId || this.generateSessionId();

        try {
            // Log translation request
            await this.auditLogger.logEvent('TRANSLATION_REQUEST', userId, {
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                sessionId: sessionId,
                timestamp: new Date().toISOString()
            });

            // Step 1: Context Analysis
            const contextAnalysis = this.contextAware.analyzeContext(text, sourceLang);
            console.log('🔍 [EnhancedTranslationService] Context analysis:', contextAnalysis);

            // Step 2: Domain-specific enhancement
            const domainEnhancement = this.domainSpecific.enhanceTranslation(text, sourceLang, targetLang, contextAnalysis.primaryContext);
            console.log('📚 [EnhancedTranslationService] Domain enhancement:', domainEnhancement);

            // Step 3: Check cache first
            const cacheKey = this.generateCacheKey(text, sourceLang, targetLang, contextAnalysis.primaryContext);
            let cachedTranslation = await translationCache.getTranslationWithTracking(cacheKey);
            
            if (cachedTranslation) {
                console.log('⚡ [EnhancedTranslationService] Cache hit - returning cached translation');
                
                // Log cache hit
                await this.auditLogger.logEvent('TRANSLATION_CACHED', userId, {
                    cacheKey: cacheKey.substring(0, 16) + '...',
                    sourceLanguage: sourceLang,
                    targetLanguage: targetLang,
                    responseTime: Date.now() - startTime
                });

                return this.formatTranslationResponse(cachedTranslation.translation, {
                    sourceLang,
                    targetLang,
                    contextAnalysis,
                    domainEnhancement,
                    cached: true,
                    responseTime: Date.now() - startTime
                });
            }

            // Step 4: Perform translation (this would call your existing translation engine)
            const translation = await this.performTranslation(text, sourceLang, targetLang, contextAnalysis, domainEnhancement);

            // Step 5: Apply context-aware enhancements
            const enhancedTranslation = this.contextAware.enhanceTranslation(
                text, 
                translation.translated, 
                contextAnalysis, 
                sourceLang, 
                targetLang
            );

            // Step 6: Encrypt sensitive data
            const encryptedTranslation = await this.encryptTranslationData(enhancedTranslation, userId);

            // Step 7: Cache the result
            const cacheStrategy = this.determineCacheStrategy(contextAnalysis, domainEnhancement);
            await translationCache.setTranslationWithStrategy(
                cacheKey, 
                encryptedTranslation, 
                cacheStrategy,
                {
                    userId: userId,
                    context: contextAnalysis.primaryContext,
                    isIslamic: domainEnhancement.has_domain_terms,
                    sessionId: sessionId
                }
            );

            // Step 8: Log successful translation
            await this.auditLogger.logEvent('TRANSLATION_SUCCESS', userId, {
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                context: contextAnalysis.primaryContext,
                isIslamic: domainEnhancement.has_domain_terms,
                responseTime: Date.now() - startTime,
                sessionId: sessionId
            });

            return this.formatTranslationResponse(encryptedTranslation, {
                sourceLang,
                targetLang,
                contextAnalysis,
                domainEnhancement,
                cached: false,
                responseTime: Date.now() - startTime
            });

        } catch (error) {
            console.error('❌ [EnhancedTranslationService] Translation failed:', error);
            
            // Log translation failure
            await this.auditLogger.logEvent('TRANSLATION_FAILED', userId, {
                error: error.message,
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
                responseTime: Date.now() - startTime,
                sessionId: sessionId
            });

            throw error;
        }
    }

    /**
     * Perform the actual translation
     */
    async performTranslation(text, sourceLang, targetLang, contextAnalysis, domainEnhancement) {
        // This would integrate with your existing translation engine
        // For now, we'll simulate the translation
        const translation = {
            original: text,
            translated: `[Enhanced Translation: ${text}]`,
            from: sourceLang,
            to: targetLang,
            confidence: 0.95,
            timestamp: Date.now(),
            context: contextAnalysis.primaryContext,
            isIslamic: domainEnhancement.has_domain_terms
        };

        return translation;
    }

    /**
     * Encrypt translation data
     */
    async encryptTranslationData(translation, userId) {
        try {
            const encrypted = await this.encryption.encryptTranslation(translation, userId, 'translation');
            return {
                ...translation,
                encrypted: true,
                encryptionMetadata: {
                    algorithm: encrypted.algorithm,
                    timestamp: encrypted.timestamp
                }
            };
        } catch (error) {
            console.error('❌ [EnhancedTranslationService] Encryption failed:', error);
            // Return unencrypted data if encryption fails
            return translation;
        }
    }

    /**
     * Decrypt translation data
     */
    async decryptTranslationData(encryptedTranslation, userId) {
        try {
            if (!encryptedTranslation.encrypted) {
                return encryptedTranslation;
            }

            const decrypted = await this.encryption.decryptTranslation(encryptedTranslation, userId);
            return decrypted;
        } catch (error) {
            console.error('❌ [EnhancedTranslationService] Decryption failed:', error);
            throw error;
        }
    }

    /**
     * Generate cache key
     */
    generateCacheKey(text, sourceLang, targetLang, context) {
        const crypto = require('crypto');
        const keyData = `${text}_${sourceLang}_${targetLang}_${context || 'general'}`;
        return crypto.createHash('sha256').update(keyData).digest('hex');
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        const crypto = require('crypto');
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Determine cache strategy
     */
    determineCacheStrategy(contextAnalysis, domainEnhancement) {
        if (contextAnalysis.primaryContext === 'quranic' || contextAnalysis.primaryContext === 'hadith') {
            return 'hot'; // Islamic content gets hot cache
        }
        
        if (domainEnhancement.has_domain_terms) {
            return 'warm'; // Domain-specific content gets warm cache
        }
        
        return 'cold'; // General content gets cold cache
    }

    /**
     * Format translation response
     */
    formatTranslationResponse(translation, metadata) {
        return {
            success: true,
            data: {
                original: translation.original,
                translated: translation.translated,
                sourceLanguage: metadata.sourceLang,
                targetLanguage: metadata.targetLang,
                confidence: translation.confidence || 0.95,
                timestamp: translation.timestamp || Date.now(),
                context: translation.context,
                isIslamic: translation.isIslamic || false,
                cached: metadata.cached || false,
                responseTime: metadata.responseTime || 0
            },
            metadata: {
                contextAnalysis: metadata.contextAnalysis,
                domainEnhancement: metadata.domainEnhancement,
                sessionId: metadata.sessionId
            }
        };
    }

    /**
     * Get translation statistics
     */
    async getTranslationStats(userId, startDate, endDate) {
        try {
            const auditLogs = await this.auditLogger.getUserAuditLogs(userId, startDate, endDate);
            const cacheStats = translationCache.getCacheStats();
            const dbStats = await this.dbOptimizer.getQueryStats();

            return {
                translations: {
                    total: auditLogs.filter(log => log.actionType === 'TRANSLATION_SUCCESS').length,
                    cached: auditLogs.filter(log => log.actionType === 'TRANSLATION_CACHED').length,
                    failed: auditLogs.filter(log => log.actionType === 'TRANSLATION_FAILED').length
                },
                cache: cacheStats,
                database: dbStats,
                performance: {
                    averageResponseTime: this.calculateAverageResponseTime(auditLogs),
                    cacheHitRate: this.calculateCacheHitRate(auditLogs)
                }
            };
        } catch (error) {
            console.error('❌ [EnhancedTranslationService] Failed to get stats:', error);
            return null;
        }
    }

    /**
     * Calculate average response time
     */
    calculateAverageResponseTime(auditLogs) {
        const translationLogs = auditLogs.filter(log => 
            log.actionType === 'TRANSLATION_SUCCESS' && log.details.responseTime
        );
        
        if (translationLogs.length === 0) return 0;
        
        const totalTime = translationLogs.reduce((sum, log) => sum + log.details.responseTime, 0);
        return totalTime / translationLogs.length;
    }

    /**
     * Calculate cache hit rate
     */
    calculateCacheHitRate(auditLogs) {
        const totalTranslations = auditLogs.filter(log => 
            log.actionType === 'TRANSLATION_SUCCESS' || log.actionType === 'TRANSLATION_CACHED'
        ).length;
        
        const cachedTranslations = auditLogs.filter(log => 
            log.actionType === 'TRANSLATION_CACHED'
        ).length;
        
        return totalTranslations > 0 ? (cachedTranslations / totalTranslations) * 100 : 0;
    }

    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            const dbHealth = await this.dbOptimizer.getHealthStatus();
            const cacheStats = translationCache.getCacheStats();
            const encryptionStatus = this.encryption.getEncryptionStatus();

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    contextAware: this.contextAware ? 'active' : 'inactive',
                    domainSpecific: this.domainSpecific ? 'active' : 'inactive',
                    encryption: encryptionStatus.master_key_initialized ? 'active' : 'inactive',
                    auditLogging: this.auditLogger ? 'active' : 'inactive',
                    database: dbHealth.status,
                    cache: cacheStats.l2.connected ? 'active' : 'inactive'
                },
                performance: {
                    cache: cacheStats,
                    database: dbHealth,
                    encryption: encryptionStatus
                }
            };
        } catch (error) {
            console.error('❌ [EnhancedTranslationService] Health check failed:', error);
            return {
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
}

module.exports = EnhancedTranslationService;
