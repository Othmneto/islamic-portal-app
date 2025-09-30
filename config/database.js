// config/database.js
const mongoose = require('mongoose');
const { env } = require('./index');
const { safeLogSecurityViolation } = require('../middleware/securityLogging');

class DatabaseManager {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000; // 5 seconds
        
        // Connection pool configuration
        this.poolConfig = {
            maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 10,
            minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 2,
            maxIdleTimeMS: parseInt(process.env.MONGO_MAX_IDLE_TIME_MS) || 30000,
            serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000,
            socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000,
            connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS) || 10000,
            // bufferMaxEntries: 0, // Deprecated in newer Mongoose versions
            // bufferCommands: false, // Deprecated in newer Mongoose versions
            retryWrites: true,
            retryReads: true,
            readPreference: 'primary',
            readConcern: { level: 'majority' },
            writeConcern: { w: 'majority', j: true }
        };
    }

    /**
     * Connect to MongoDB with optimized connection pooling
     */
    async connect() {
        try {
            console.log('🔄 Database: Connecting to MongoDB...');
            
            const mongoOptions = {
                ...this.poolConfig,
                useNewUrlParser: true,
                useUnifiedTopology: true,
            };

            this.connection = await mongoose.connect(env.MONGO_URI, mongoOptions);
            this.isConnected = true;
            this.connectionRetries = 0;

            this.setupEventHandlers();
            this.logConnectionStats();
            
            console.log('✅ Database: Connected to MongoDB successfully');
            return this.connection;
        } catch (error) {
            console.error('❌ Database: Connection failed:', error.message);
            await this.handleConnectionError(error);
            throw error;
        }
    }

    /**
     * Setup database event handlers
     */
    setupEventHandlers() {
        if (!this.connection) return;

        // Connection events
        mongoose.connection.on('connected', () => {
            console.log('✅ Database: Mongoose connected to MongoDB');
            this.isConnected = true;
        });

        mongoose.connection.on('error', async (error) => {
            console.error('❌ Database: Mongoose connection error:', error.message);
            this.isConnected = false;
            await this.logDatabaseError(error);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ Database: Mongoose disconnected from MongoDB');
            this.isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ Database: Mongoose reconnected to MongoDB');
            this.isConnected = true;
        });

        // Process termination handlers
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGUSR2', () => this.gracefulShutdown('SIGUSR2')); // For nodemon
    }

    /**
     * Handle connection errors with retry logic
     */
    async handleConnectionError(error) {
        this.connectionRetries++;
        
        if (this.connectionRetries < this.maxRetries) {
            console.log(`🔄 Database: Retrying connection (${this.connectionRetries}/${this.maxRetries}) in ${this.retryDelay}ms...`);
            
            setTimeout(async () => {
                try {
                    await this.connect();
                } catch (retryError) {
                    console.error('❌ Database: Retry failed:', retryError.message);
                }
            }, this.retryDelay);
        } else {
            console.error('❌ Database: Max retries reached. Connection failed permanently.');
            await this.logDatabaseError(error);
        }
    }

    /**
     * Log database errors for security monitoring
     */
    async logDatabaseError(error) {
        try {
            await safeLogSecurityViolation('DATABASE_ERROR', {
                error: error.message,
                stack: error.stack,
                connectionRetries: this.connectionRetries,
                isConnected: this.isConnected,
                description: 'Database connection or operation error'
            });
        } catch (logError) {
            console.error('Failed to log database error:', logError.message);
        }
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            connectionRetries: this.connectionRetries,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    /**
     * Get connection pool statistics
     */
    getPoolStats() {
        if (!this.connection) return null;

        const stats = {
            readyState: mongoose.connection.readyState,
            poolSize: this.poolConfig.maxPoolSize,
            minPoolSize: this.poolConfig.minPoolSize,
            maxIdleTimeMS: this.poolConfig.maxIdleTimeMS,
            serverSelectionTimeoutMS: this.poolConfig.serverSelectionTimeoutMS,
            socketTimeoutMS: this.poolConfig.socketTimeoutMS,
            connectTimeoutMS: this.poolConfig.connectTimeoutMS
        };

        return stats;
    }

    /**
     * Log connection statistics
     */
    logConnectionStats() {
        const status = this.getConnectionStatus();
        const poolStats = this.getPoolStats();
        
        console.log('📊 Database: Connection Statistics');
        console.log(`   Status: ${status.isConnected ? 'Connected' : 'Disconnected'}`);
        console.log(`   Host: ${status.host}:${status.port}`);
        console.log(`   Database: ${status.name}`);
        console.log(`   Pool Size: ${poolStats.poolSize}`);
        console.log(`   Min Pool Size: ${poolStats.minPoolSize}`);
        console.log(`   Max Idle Time: ${poolStats.maxIdleTimeMS}ms`);
    }

    /**
     * Graceful shutdown
     */
    async gracefulShutdown(signal) {
        console.log(`\n🔄 Database: Received ${signal}. Starting graceful shutdown...`);
        
        try {
            if (this.connection) {
                await mongoose.connection.close();
                console.log('✅ Database: Connection closed gracefully');
            }
            process.exit(0);
        } catch (error) {
            console.error('❌ Database: Error during graceful shutdown:', error.message);
            process.exit(1);
        }
    }

    /**
     * Health check for database connection
     */
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return {
                    status: 'disconnected',
                    message: 'Database not connected',
                    timestamp: new Date().toISOString()
                };
            }

            // Simple ping to check connection
            await mongoose.connection.db.admin().ping();
            
            return {
                status: 'healthy',
                message: 'Database connection is healthy',
                timestamp: new Date().toISOString(),
                poolStats: this.getPoolStats()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Database health check failed: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Optimize connection pool based on load
     */
    async optimizePool() {
        try {
            if (!this.connection) return;

            // Get current connection stats
            const admin = mongoose.connection.db.admin();
            const serverStatus = await admin.serverStatus();
            
            // Adjust pool size based on current connections
            const currentConnections = serverStatus.connections?.current || 0;
            const maxConnections = serverStatus.connections?.available || 100;
            
            if (currentConnections > maxConnections * 0.8) {
                console.log('⚠️ Database: High connection usage detected, consider increasing pool size');
            }
            
            return {
                currentConnections,
                maxConnections,
                poolUtilization: (currentConnections / maxConnections) * 100
            };
        } catch (error) {
            console.error('❌ Database: Pool optimization failed:', error.message);
            return null;
        }
    }

    /**
     * Create read replica connection (if configured)
     */
    async createReadReplica() {
        try {
            const readReplicaUri = process.env.MONGO_READ_REPLICA_URI;
            if (!readReplicaUri) {
                console.log('ℹ️ Database: No read replica configured');
                return null;
            }

            const readReplicaOptions = {
                ...this.poolConfig,
                readPreference: 'secondary',
                readConcern: { level: 'majority' },
                useNewUrlParser: true,
                useUnifiedTopology: true,
            };

            const readConnection = await mongoose.createConnection(readReplicaUri, readReplicaOptions);
            console.log('✅ Database: Read replica connected');
            return readConnection;
        } catch (error) {
            console.error('❌ Database: Read replica connection failed:', error.message);
            return null;
        }
    }

    /**
     * Disconnect from database
     */
    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.connection.close();
                this.isConnected = false;
                console.log('✅ Database: Disconnected from MongoDB');
            }
        } catch (error) {
            console.error('❌ Database: Error during disconnect:', error.message);
        }
    }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

module.exports = {
    databaseManager,
    connect: () => databaseManager.connect(),
    disconnect: () => databaseManager.disconnect(),
    getConnectionStatus: () => databaseManager.getConnectionStatus(),
    getPoolStats: () => databaseManager.getPoolStats(),
    healthCheck: () => databaseManager.healthCheck(),
    optimizePool: () => databaseManager.optimizePool(),
    createReadReplica: () => databaseManager.createReadReplica()
};
