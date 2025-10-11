const mongoose = require('mongoose');

/**
 * Live Translation Session Model
 * Manages real-time translation sessions between Imam (speaker) and Worshippers (listeners)
 */
const liveTranslationSessionSchema = new mongoose.Schema({
    // Session identification
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Imam (speaker) information
    imamId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    imamName: {
        type: String,
        required: true
    },
    
    // Session configuration
    sourceLanguage: {
        type: String,
        required: true,
        default: 'ar' // Default to Arabic
    },
    sourceLanguageName: {
        type: String,
        default: 'Arabic'
    },
    
    // Session status
    status: {
        type: String,
        enum: ['created', 'active', 'paused', 'ended'],
        default: 'created',
        index: true
    },
    
    // Session metadata
    title: {
        type: String,
        default: 'Live Translation Session'
    },
    description: {
        type: String,
        default: ''
    },
    
    // Optional password protection
    isPasswordProtected: {
        type: Boolean,
        default: false
    },
    passwordHash: {
        type: String,
        default: null
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    startTime: {
        type: Date,
        default: null
    },
    endTime: {
        type: Date,
        default: null
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    },
    
    // Worshippers (listeners)
    worshippers: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        userName: {
            type: String,
            required: true
        },
        targetLanguage: {
            type: String,
            required: true
        },
        targetLanguageName: {
            type: String,
            required: true
        },
        socketId: {
            type: String,
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        leftAt: {
            type: Date,
            default: null
        },
        isActive: {
            type: Boolean,
            default: true
        },
        connectionQuality: {
            type: String,
            enum: ['excellent', 'good', 'fair', 'poor'],
            default: 'good'
        },
        totalReceived: {
            type: Number,
            default: 0
        }
    }],
    
    // Translation history for this session
    translations: [{
        originalText: {
            type: String,
            required: true
        },
        audioUrl: {
            type: String,
            default: null
        },
        translations: {
            type: Map,
            of: {
                text: String,
                audioUrl: String,
                generatedAt: Date
            }
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        processingTime: {
            type: Number, // milliseconds
            default: 0
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.9
        }
    }],
    
    // Session analytics
    analytics: {
        totalDuration: {
            type: Number, // seconds
            default: 0
        },
        totalTranslations: {
            type: Number,
            default: 0
        },
        averageLatency: {
            type: Number, // milliseconds
            default: 0
        },
        averageConfidence: {
            type: Number,
            default: 0
        },
        peakWorshippersCount: {
            type: Number,
            default: 0
        },
        totalWorshippersJoined: {
            type: Number,
            default: 0
        },
        languagesUsed: [{
            language: String,
            count: Number
        }],
        audioQuality: {
            type: String,
            enum: ['excellent', 'good', 'fair', 'poor'],
            default: 'good'
        }
    },
    
    // Quality metrics
    qualityMetrics: {
        transcriptionErrors: {
            type: Number,
            default: 0
        },
        translationErrors: {
            type: Number,
            default: 0
        },
        audioGenerationErrors: {
            type: Number,
            default: 0
        },
        reconnections: {
            type: Number,
            default: 0
        },
        averageChunkSize: {
            type: Number,
            default: 0
        }
    },
    
    // Settings
    settings: {
        maxWorshippers: {
            type: Number,
            default: 100
        },
        allowRecording: {
            type: Boolean,
            default: false
        },
        autoTranscribe: {
            type: Boolean,
            default: true
        },
        showOriginalText: {
            type: Boolean,
            default: true
        },
        audioQuality: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'high'
        },
        chunkDuration: {
            type: Number, // milliseconds
            default: 3000 // 3 seconds
        }
    }
}, {
    timestamps: true,
    collection: 'live_translation_sessions'
});

// Indexes for performance
liveTranslationSessionSchema.index({ imamId: 1, status: 1 });
liveTranslationSessionSchema.index({ createdAt: -1 });
liveTranslationSessionSchema.index({ status: 1, lastActivityAt: -1 });
liveTranslationSessionSchema.index({ 'worshippers.userId': 1 });

// Virtual for active worshippers count
liveTranslationSessionSchema.virtual('activeWorshippersCount').get(function() {
    return this.worshippers.filter(w => w.isActive).length;
});

// Virtual for session duration
liveTranslationSessionSchema.virtual('duration').get(function() {
    if (!this.startTime) return 0;
    const endTime = this.endTime || new Date();
    return Math.floor((endTime - this.startTime) / 1000); // seconds
});

// Methods
liveTranslationSessionSchema.methods.addWorshipper = function(worshipperData) {
    // Check if worshipper already exists
    const existingIndex = this.worshippers.findIndex(
        w => w.userId.toString() === worshipperData.userId.toString()
    );
    
    if (existingIndex >= 0) {
        // Update existing worshipper
        this.worshippers[existingIndex] = {
            ...this.worshippers[existingIndex],
            ...worshipperData,
            isActive: true,
            joinedAt: new Date()
        };
    } else {
        // Add new worshipper
        this.worshippers.push({
            ...worshipperData,
            isActive: true,
            joinedAt: new Date()
        });
        this.analytics.totalWorshippersJoined += 1;
    }
    
    // Update peak count
    const activeCount = this.worshippers.filter(w => w.isActive).length;
    if (activeCount > this.analytics.peakWorshippersCount) {
        this.analytics.peakWorshippersCount = activeCount;
    }
    
    // Update language stats
    const langIndex = this.analytics.languagesUsed.findIndex(
        l => l.language === worshipperData.targetLanguage
    );
    if (langIndex >= 0) {
        this.analytics.languagesUsed[langIndex].count += 1;
    } else {
        this.analytics.languagesUsed.push({
            language: worshipperData.targetLanguage,
            count: 1
        });
    }
    
    this.lastActivityAt = new Date();
    return this.save();
};

liveTranslationSessionSchema.methods.removeWorshipper = function(userId) {
    const worshipper = this.worshippers.find(
        w => w.userId.toString() === userId.toString() && w.isActive
    );
    
    if (worshipper) {
        worshipper.isActive = false;
        worshipper.leftAt = new Date();
        this.lastActivityAt = new Date();
        return this.save();
    }
    
    return Promise.resolve(this);
};

liveTranslationSessionSchema.methods.addTranslation = function(translationData) {
    this.translations.push(translationData);
    this.analytics.totalTranslations += 1;
    
    // Update average latency
    if (translationData.processingTime) {
        const totalLatency = this.analytics.averageLatency * (this.analytics.totalTranslations - 1);
        this.analytics.averageLatency = (totalLatency + translationData.processingTime) / this.analytics.totalTranslations;
    }
    
    // Update average confidence
    if (translationData.confidence) {
        const totalConfidence = this.analytics.averageConfidence * (this.analytics.totalTranslations - 1);
        this.analytics.averageConfidence = (totalConfidence + translationData.confidence) / this.analytics.totalTranslations;
    }
    
    this.lastActivityAt = new Date();
    return this.save();
};

liveTranslationSessionSchema.methods.updateStatus = function(status) {
    this.status = status;
    
    if (status === 'active' && !this.startTime) {
        this.startTime = new Date();
    } else if (status === 'ended' && !this.endTime) {
        this.endTime = new Date();
        if (this.startTime) {
            this.analytics.totalDuration = Math.floor((this.endTime - this.startTime) / 1000);
        }
    }
    
    this.lastActivityAt = new Date();
    return this.save();
};

liveTranslationSessionSchema.methods.incrementError = function(errorType) {
    if (this.qualityMetrics[errorType] !== undefined) {
        this.qualityMetrics[errorType] += 1;
    }
    return this.save();
};

// Static methods
liveTranslationSessionSchema.statics.findActiveByImam = function(imamId) {
    return this.find({
        imamId,
        status: { $in: ['created', 'active', 'paused'] }
    }).sort({ createdAt: -1 });
};

liveTranslationSessionSchema.statics.findBySessionId = function(sessionId) {
    return this.findOne({ sessionId });
};

liveTranslationSessionSchema.statics.findActiveByWorshipper = function(userId) {
    return this.find({
        'worshippers.userId': userId,
        'worshippers.isActive': true,
        status: { $in: ['active', 'paused'] }
    }).sort({ createdAt: -1 });
};

liveTranslationSessionSchema.statics.cleanupInactiveSessions = async function(hoursInactive = 24) {
    const cutoffTime = new Date(Date.now() - hoursInactive * 60 * 60 * 1000);
    
    return this.updateMany(
        {
            status: { $in: ['created', 'active', 'paused'] },
            lastActivityAt: { $lt: cutoffTime }
        },
        {
            $set: {
                status: 'ended',
                endTime: new Date()
            }
        }
    );
};

const LiveTranslationSession = mongoose.model('LiveTranslationSession', liveTranslationSessionSchema);

module.exports = LiveTranslationSession;

