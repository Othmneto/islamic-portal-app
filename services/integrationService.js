const EnhancedTranslationService = require('./enhancedTranslationService');
const ContextAwareTranslationService = require('./contextAwareTranslation');
const DomainSpecificTranslationService = require('./domainSpecificTranslation');
const EncryptionService = require('./encryptionService');
const AuditLoggingService = require('./auditLoggingService');
const DatabaseOptimizationService = require('./databaseOptimizationService');

/**
 * Integration Service
 * Coordinates all enhanced translation services
 */
class IntegrationService {
    constructor() {
        this.services = {
            enhancedTranslation: null,
            contextAware: null,
            domainSpecific: null,
            encryption: null,
            auditLogging: null,
            databaseOptimization: null
        };
        
        this.isInitialized = false;
    }

    /**
     * Initialize all services
     */
    async initialize() {
        try {
            console.log('🔧 [IntegrationService] Initializing all enhanced services...');
            
            // Initialize individual services
            this.services.contextAware = new ContextAwareTranslationService();
            this.services.domainSpecific = new DomainSpecificTranslationService();
            this.services.encryption = new EncryptionService();
            this.services.auditLogging = new AuditLoggingService();
            // this.services.databaseOptimization = new DatabaseOptimizationService(); // Skip for now
            
            // Initialize enhanced translation service
            this.services.enhancedTranslation = new EnhancedTranslationService();
            await this.services.enhancedTranslation.initialize();
            
            this.isInitialized = true;
            console.log('✅ [IntegrationService] All services initialized successfully');
            
            // Log system initialization
            await this.services.auditLogging.logEvent('SYSTEM_START', 'system', {
                services: Object.keys(this.services),
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ [IntegrationService] Failed to initialize services:', error);
            throw error;
        }
    }

    /**
     * Get enhanced translation service
     */
    getEnhancedTranslationService() {
        if (!this.isInitialized) {
            throw new Error('IntegrationService not initialized');
        }
        return this.services.enhancedTranslation;
    }

    /**
     * Get context aware service
     */
    getContextAwareService() {
        if (!this.isInitialized) {
            throw new Error('IntegrationService not initialized');
        }
        return this.services.contextAware;
    }

    /**
     * Get domain specific service
     */
    getDomainSpecificService() {
        if (!this.isInitialized) {
            throw new Error('IntegrationService not initialized');
        }
        return this.services.domainSpecific;
    }

    /**
     * Get encryption service
     */
    getEncryptionService() {
        if (!this.isInitialized) {
            throw new Error('IntegrationService not initialized');
        }
        return this.services.encryption;
    }

    /**
     * Get audit logging service
     */
    getAuditLoggingService() {
        if (!this.isInitialized) {
            throw new Error('IntegrationService not initialized');
        }
        return this.services.auditLogging;
    }

    /**
     * Get database optimization service
     */
    getDatabaseOptimizationService() {
        if (!this.isInitialized) {
            throw new Error('IntegrationService not initialized');
        }
        return this.services.databaseOptimization;
    }

    /**
     * Get all services status
     */
    async getServicesStatus() {
        if (!this.isInitialized) {
            return {
                status: 'not_initialized',
                services: {}
            };
        }

        const status = {
            status: 'initialized',
            timestamp: new Date().toISOString(),
            services: {}
        };

        // Check each service
        for (const [serviceName, service] of Object.entries(this.services)) {
            try {
                if (service && typeof service.getHealthStatus === 'function') {
                    status.services[serviceName] = await service.getHealthStatus();
                } else if (service) {
                    status.services[serviceName] = { status: 'active' };
                } else {
                    status.services[serviceName] = { status: 'inactive' };
                }
            } catch (error) {
                status.services[serviceName] = { 
                    status: 'error', 
                    error: error.message 
                };
            }
        }

        return status;
    }

    /**
     * Shutdown all services
     */
    async shutdown() {
        try {
            console.log('🔄 [IntegrationService] Shutting down all services...');
            
            // Log system shutdown
            if (this.services.auditLogging) {
                await this.services.auditLogging.logEvent('SYSTEM_SHUTDOWN', 'system', {
                    timestamp: new Date().toISOString()
                });
            }
            
            // Clear encryption keys
            if (this.services.encryption) {
                this.services.encryption.clearCachedKeys();
            }
            
            this.isInitialized = false;
            console.log('✅ [IntegrationService] All services shut down successfully');
        } catch (error) {
            console.error('❌ [IntegrationService] Error during shutdown:', error);
        }
    }
}

// Singleton instance
const integrationService = new IntegrationService();

module.exports = integrationService;
