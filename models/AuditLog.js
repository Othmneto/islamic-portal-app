const mongoose = require('mongoose');

/**
 * Audit Log Model
 * Stores audit logs for security and compliance
 */
const auditLogSchema = new mongoose.Schema({
    // Event identification
    eventId: {
        type: String,
        required: true,
        unique: true
    },
    actionType: {
        type: String,
        required: true,
        enum: [
            'AUTH_LOGIN', 'AUTH_LOGOUT', 'AUTH_FAILED_LOGIN', 'AUTH_PASSWORD_CHANGE', 'AUTH_ACCOUNT_LOCKED',
            'TRANSLATION_REQUEST', 'TRANSLATION_SUCCESS', 'TRANSLATION_FAILED', 'TRANSLATION_CACHED', 'TRANSLATION_DELETED',
            'DATA_READ', 'DATA_WRITE', 'DATA_DELETE', 'DATA_EXPORT', 'DATA_IMPORT',
            'SECURITY_VIOLATION', 'RATE_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY', 'UNAUTHORIZED_ACCESS', 'CSRF_ATTEMPT',
            'SYSTEM_START', 'SYSTEM_SHUTDOWN', 'CONFIGURATION_CHANGE', 'ERROR_OCCURRED',
            'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_SUSPENDED', 'USER_ACTIVATED'
        ]
    },
    
    // User information
    userId: {
        type: String,
        required: true
    },
    
    // Event details
    severity: {
        type: String,
        enum: ['debug', 'info', 'warning', 'error'],
        required: true
    },
    category: {
        type: String,
        enum: ['authentication', 'translation', 'data_access', 'security', 'system', 'user_management'],
        required: true
    },
    
    // Event data
    details: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    
    // Request information
    request: {
        method: String,
        url: String,
        headers: Map,
        body: Map,
        query: Map,
        params: Map
    },
    
    // Session and network
    sessionId: String,
    ipAddress: String,
    userAgent: String,
    
    // Risk assessment
    riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    
    // Timestamps
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    }
}, {
    timestamps: true
});

// Indexes for performance
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ actionType: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ category: 1, timestamp: -1 });
auditLogSchema.index({ riskScore: -1, timestamp: -1 });
auditLogSchema.index({ ipAddress: 1 });
auditLogSchema.index({ eventId: 1 }, { unique: true });
auditLogSchema.index({ sessionId: 1 });

// TTL index for automatic cleanup (90 days)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static methods
auditLogSchema.statics.findByUser = function(userId, startDate, endDate, limit = 100) {
    const query = { userId };
    
    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    return this.find(query)
        .sort({ timestamp: -1 })
        .limit(limit);
};

auditLogSchema.statics.findByActionType = function(actionType, startDate, endDate, limit = 100) {
    const query = { actionType };
    
    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    return this.find(query)
        .sort({ timestamp: -1 })
        .limit(limit);
};

auditLogSchema.statics.findHighRisk = function(riskThreshold = 70, startDate, endDate, limit = 100) {
    const query = { riskScore: { $gte: riskThreshold } };
    
    if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    return this.find(query)
        .sort({ riskScore: -1, timestamp: -1 })
        .limit(limit);
};

auditLogSchema.statics.getStatistics = function(startDate, endDate) {
    const matchQuery = {};
    
    if (startDate || endDate) {
        matchQuery.timestamp = {};
        if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
        if (endDate) matchQuery.timestamp.$lte = new Date(endDate);
    }
    
    return this.aggregate([
        { $match: matchQuery },
        {
            $group: {
                _id: null,
                totalEvents: { $sum: 1 },
                bySeverity: {
                    $push: {
                        severity: '$severity',
                        count: 1
                    }
                },
                byCategory: {
                    $push: {
                        category: '$category',
                        count: 1
                    }
                },
                byActionType: {
                    $push: {
                        actionType: '$actionType',
                        count: 1
                    }
                },
                highRiskEvents: {
                    $sum: {
                        $cond: [{ $gte: ['$riskScore', 70] }, 1, 0]
                    }
                },
                securityAlerts: {
                    $sum: {
                        $cond: [
                            { $or: [
                                { $regex: ['$actionType', 'SECURITY'] },
                                { $regex: ['$actionType', 'AUTH_FAILED'] }
                            ]}, 1, 0
                        ]
                    }
                }
            }
        }
    ]);
};

auditLogSchema.statics.cleanupOldLogs = function(retentionDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    return this.deleteMany({
        timestamp: { $lt: cutoffDate }
    });
};

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
    // Generate event ID if not provided
    if (!this.eventId) {
        const crypto = require('crypto');
        this.eventId = `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    
    next();
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
