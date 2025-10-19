const mongoose = require('mongoose');

/**
 * Database Optimization Service
 * Handles database indexing, query optimization, and performance monitoring
 */
class DatabaseOptimizationService {
    constructor() {
        this.indexes = {
            // User model indexes
            User: [
                { email: 1 }, // Unique index already exists
                { username: 1 }, // Unique index already exists
                { authProvider: 1 },
                { isVerified: 1 },
                { role: 1 },
                { lastLogin: -1 },
                { createdAt: -1 },
                { 'location.city': 1, 'location.country': 1 },
                { 'preferences.calculationMethod': 1 },
                { accountLockedUntil: 1 },
                { failedLoginAttempts: 1 },
                { passwordExpiresAt: 1 },
                // Compound indexes for common queries
                { email: 1, isVerified: 1 },
                { authProvider: 1, isVerified: 1 },
                { role: 1, isVerified: 1 },
                { lastLogin: -1, isVerified: 1 }
            ],

            // Translation model indexes
            Translation: [
                { userId: 1 },
                { sourceLanguage: 1 },
                { targetLanguage: 1 },
                { createdAt: -1 },
                { isFavorite: 1 },
                { context: 1 },
                { isIslamic: 1 },
                // Compound indexes
                { userId: 1, createdAt: -1 },
                { userId: 1, isFavorite: 1 },
                { sourceLanguage: 1, targetLanguage: 1 },
                { userId: 1, sourceLanguage: 1, targetLanguage: 1 },
                { isIslamic: 1, context: 1 }
            ],

            // Audit log indexes
            AuditLog: [
                { userId: 1 },
                { actionType: 1 },
                { timestamp: -1 },
                { severity: 1 },
                { category: 1 },
                { riskScore: -1 },
                { ipAddress: 1 },
                // Compound indexes
                { userId: 1, timestamp: -1 },
                { actionType: 1, timestamp: -1 },
                { severity: 1, timestamp: -1 },
                { riskScore: -1, timestamp: -1 }
            ],

            // Translation memory indexes
            TranslationMemory: [
                { userId: 1 },
                { sourceText: 'text' },
                { targetText: 'text' },
                { sourceLanguage: 1 },
                { targetLanguage: 1 },
                { usageCount: -1 },
                { lastUsed: -1 },
                { context: 1 },
                { isIslamic: 1 },
                // Compound indexes
                { userId: 1, sourceLanguage: 1, targetLanguage: 1 },
                { userId: 1, usageCount: -1 },
                { sourceLanguage: 1, targetLanguage: 1, usageCount: -1 }
            ]
        };

        this.queryOptimizations = {
            // Common query patterns and their optimizations
            getUserTranslations: {
                pattern: { userId: 1, createdAt: -1 },
                limit: 50,
                projection: { sourceText: 1, targetText: 1, createdAt: 1, isFavorite: 1 }
            },
            getRecentTranslations: {
                pattern: { createdAt: -1 },
                limit: 100,
                projection: { userId: 1, sourceText: 1, targetText: 1, createdAt: 1 }
            },
            searchTranslations: {
                pattern: { $text: { $search: '' } },
                projection: { score: { $meta: 'textScore' } },
                sort: { score: { $meta: 'textScore' } }
            }
        };
    }

    /**
     * Initialize database optimization
     */
    async initialize() {
        try {
            console.log('🔧 [DatabaseOptimizationService] Initializing database optimization...');

            // Create indexes for all models
            await this.createIndexes();

            // Set up query monitoring
            this.setupQueryMonitoring();

            // Set up connection pooling
            this.setupConnectionPooling();

            console.log('✅ [DatabaseOptimizationService] Database optimization initialized');
        } catch (error) {
            console.error('❌ [DatabaseOptimizationService] Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Create indexes for all models
     */
    async createIndexes() {
        try {
            for (const [modelName, indexes] of Object.entries(this.indexes)) {
                const Model = mongoose.model(modelName);
                if (Model) {
                    console.log(`📊 [DatabaseOptimizationService] Creating indexes for ${modelName}...`);

                    for (const index of indexes) {
                        try {
                            await Model.collection.createIndex(index, { background: true });
                            console.log(`✅ [DatabaseOptimizationService] Created index for ${modelName}:`, index);
                        } catch (error) {
                            if (error.code === 85) { // Index already exists
                                console.log(`ℹ️ [DatabaseOptimizationService] Index already exists for ${modelName}:`, index);
                            } else {
                                console.error(`❌ [DatabaseOptimizationService] Failed to create index for ${modelName}:`, error);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ [DatabaseOptimizationService] Failed to create indexes:', error);
            throw error;
        }
    }

    /**
     * Setup query monitoring
     */
    setupQueryMonitoring() {
        // Monitor slow queries
        mongoose.set('debug', (collectionName, method, query, doc) => {
            const queryTime = Date.now();
            console.log(`🔍 [DatabaseOptimizationService] Query: ${collectionName}.${method}`, {
                query: JSON.stringify(query),
                doc: doc ? JSON.stringify(doc) : 'N/A',
                timestamp: new Date().toISOString()
            });
        });

        // Monitor connection events
        mongoose.connection.on('connected', () => {
            console.log('🔗 [DatabaseOptimizationService] MongoDB connected');
        });

        mongoose.connection.on('disconnected', () => {
            console.log('🔌 [DatabaseOptimizationService] MongoDB disconnected');
        });

        mongoose.connection.on('error', (error) => {
            console.error('❌ [DatabaseOptimizationService] MongoDB error:', error);
        });
    }

    /**
     * Setup connection pooling
     */
    setupConnectionPooling() {
        // Configure connection pool
        mongoose.connection.on('open', () => {
            console.log('📊 [DatabaseOptimizationService] Connection pool configured:', {
                maxPoolSize: mongoose.connection.db.serverConfig.s.pool.maxSize,
                minPoolSize: mongoose.connection.db.serverConfig.s.pool.minSize,
                maxIdleTimeMS: mongoose.connection.db.serverConfig.s.pool.maxIdleTimeMS
            });
        });
    }

    /**
     * Optimize query based on pattern
     */
    optimizeQuery(modelName, query, options = {}) {
        const optimization = this.queryOptimizations[query.type] || {};

        return {
            ...query,
            ...optimization.pattern,
            ...options,
            projection: optimization.projection || options.projection,
            sort: optimization.sort || options.sort,
            limit: optimization.limit || options.limit
        };
    }

    /**
     * Get query performance statistics
     */
    async getQueryStats() {
        try {
            const stats = await mongoose.connection.db.stats();
            const collections = await mongoose.connection.db.listCollections().toArray();

            const collectionStats = {};
            for (const collection of collections) {
                const collectionName = collection.name;
                const collectionStats = await mongoose.connection.db.collection(collectionName).stats();
                collectionStats[collectionName] = {
                    count: collectionStats.count,
                    size: collectionStats.size,
                    avgObjSize: collectionStats.avgObjSize,
                    storageSize: collectionStats.storageSize,
                    indexes: collectionStats.nindexes,
                    totalIndexSize: collectionStats.totalIndexSize
                };
            }

            return {
                database: {
                    collections: stats.collections,
                    objects: stats.objects,
                    dataSize: stats.dataSize,
                    storageSize: stats.storageSize,
                    indexes: stats.indexes,
                    indexSize: stats.indexSize
                },
                collections: collectionStats
            };
        } catch (error) {
            console.error('❌ [DatabaseOptimizationService] Failed to get query stats:', error);
            return null;
        }
    }

    /**
     * Analyze slow queries
     */
    async analyzeSlowQueries() {
        try {
            // This would typically use MongoDB's profiler
            // For now, we'll return a placeholder
            return {
                slowQueries: [],
                averageQueryTime: 0,
                recommendations: []
            };
        } catch (error) {
            console.error('❌ [DatabaseOptimizationService] Failed to analyze slow queries:', error);
            return null;
        }
    }

    /**
     * Get index usage statistics
     */
    async getIndexUsageStats() {
        try {
            const collections = await mongoose.connection.db.listCollections().toArray();
            const indexStats = {};

            for (const collection of collections) {
                const collectionName = collection.name;
                const indexes = await mongoose.connection.db.collection(collectionName).indexes();

                indexStats[collectionName] = indexes.map(index => ({
                    name: index.name,
                    key: index.key,
                    unique: index.unique || false,
                    sparse: index.sparse || false,
                    background: index.background || false
                }));
            }

            return indexStats;
        } catch (error) {
            console.error('❌ [DatabaseOptimizationService] Failed to get index usage stats:', error);
            return null;
        }
    }

    /**
     * Optimize collection
     */
    async optimizeCollection(collectionName) {
        try {
            console.log(`🔧 [DatabaseOptimizationService] Optimizing collection: ${collectionName}`);

            // Rebuild indexes
            await mongoose.connection.db.collection(collectionName).reIndex();

            // Compact collection (if supported)
            try {
                await mongoose.connection.db.collection(collectionName).compact();
            } catch (error) {
                console.log(`ℹ️ [DatabaseOptimizationService] Compact not supported for ${collectionName}`);
            }

            console.log(`✅ [DatabaseOptimizationService] Collection ${collectionName} optimized`);
        } catch (error) {
            console.error(`❌ [DatabaseOptimizationService] Failed to optimize collection ${collectionName}:`, error);
        }
    }

    /**
     * Get database health status
     */
    async getHealthStatus() {
        try {
            const stats = await this.getQueryStats();
            const indexStats = await this.getIndexUsageStats();

            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: stats?.database || {},
                collections: stats?.collections || {},
                indexes: indexStats || {},
                recommendations: this.generateRecommendations(stats, indexStats)
            };
        } catch (error) {
            console.error('❌ [DatabaseOptimizationService] Failed to get health status:', error);
            return {
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * Generate optimization recommendations
     */
    generateRecommendations(stats, indexStats) {
        const recommendations = [];

        if (stats?.database) {
            // Check database size
            if (stats.database.dataSize > 100 * 1024 * 1024) { // 100MB
                recommendations.push({
                    type: 'performance',
                    priority: 'medium',
                    message: 'Consider archiving old data to reduce database size',
                    action: 'archive_old_data'
                });
            }

            // Check index size
            if (stats.database.indexSize > stats.database.dataSize * 0.5) {
                recommendations.push({
                    type: 'performance',
                    priority: 'high',
                    message: 'Index size is large relative to data size. Review index usage.',
                    action: 'review_indexes'
                });
            }
        }

        return recommendations;
    }

    /**
     * Clean up old data
     */
    async cleanupOldData(collectionName, field, daysOld = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await mongoose.connection.db.collection(collectionName).deleteMany({
                [field]: { $lt: cutoffDate }
            });

            console.log(`🧹 [DatabaseOptimizationService] Cleaned up ${result.deletedCount} old records from ${collectionName}`);
            return result.deletedCount;
        } catch (error) {
            console.error(`❌ [DatabaseOptimizationService] Failed to cleanup old data from ${collectionName}:`, error);
            return 0;
        }
    }
}

module.exports = DatabaseOptimizationService;
