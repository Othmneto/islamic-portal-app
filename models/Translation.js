const mongoose = require('mongoose');

/**
 * Translation Model
 * Stores translation data with enhanced features
 */
const translationSchema = new mongoose.Schema({
    // Basic translation data
    original: {
        type: String,
        required: true,
        trim: true
    },
    translated: {
        type: String,
        required: true,
        trim: true
    },
    sourceLanguage: {
        type: String,
        required: true,
        trim: true
    },
    targetLanguage: {
        type: String,
        required: true,
        trim: true
    },
    
    // User information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Translation metadata
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.95
    },
    context: {
        type: String,
        enum: ['general', 'religious_prayer', 'quranic_text', 'hadith_text', 'islamic_law', 'general_islamic'],
        default: 'general'
    },
    isIslamic: {
        type: Boolean,
        default: false
    },
    
    // Enhanced features
    alternatives: [{
        text: String,
        confidence: Number,
        style: String
    }],
    culturalContext: {
        type: Map,
        of: String
    },
    
    // User preferences
    isFavorite: {
        type: Boolean,
        default: false
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    notes: {
        type: String,
        trim: true
    },
    
    // Security and encryption
    encrypted: {
        type: Boolean,
        default: false
    },
    encryptionMetadata: {
        algorithm: String,
        timestamp: Date
    },
    
    // Analytics
    accessCount: {
        type: Number,
        default: 0
    },
    lastAccessed: {
        type: Date,
        default: Date.now
    },
    
    // Cache information
    cached: {
        type: Boolean,
        default: false
    },
    cacheStrategy: {
        type: String,
        enum: ['hot', 'warm', 'cold'],
        default: 'cold'
    }
}, {
    timestamps: true
});

// Indexes for performance
translationSchema.index({ userId: 1, createdAt: -1 });
translationSchema.index({ userId: 1, isFavorite: 1 });
translationSchema.index({ sourceLanguage: 1, targetLanguage: 1 });
translationSchema.index({ userId: 1, sourceLanguage: 1, targetLanguage: 1 });
translationSchema.index({ isIslamic: 1, context: 1 });
translationSchema.index({ original: 'text' });
translationSchema.index({ translated: 'text' });
translationSchema.index({ lastAccessed: -1 });
translationSchema.index({ accessCount: -1 });

// Methods
translationSchema.methods.incrementAccess = function() {
    this.accessCount += 1;
    this.lastAccessed = new Date();
    return this.save();
};

translationSchema.methods.toggleFavorite = function() {
    this.isFavorite = !this.isFavorite;
    return this.save();
};

translationSchema.methods.addAlternative = function(alternative) {
    this.alternatives.push(alternative);
    return this.save();
};

translationSchema.methods.updateRating = function(rating) {
    this.rating = rating;
    return this.save();
};

// Static methods
translationSchema.statics.findByUser = function(userId, options = {}) {
    const query = { userId };
    
    if (options.sourceLanguage) {
        query.sourceLanguage = options.sourceLanguage;
    }
    
    if (options.targetLanguage) {
        query.targetLanguage = options.targetLanguage;
    }
    
    if (options.context) {
        query.context = options.context;
    }
    
    if (options.isIslamic !== undefined) {
        query.isIslamic = options.isIslamic;
    }
    
    if (options.isFavorite !== undefined) {
        query.isFavorite = options.isFavorite;
    }
    
    return this.find(query)
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 50);
};

translationSchema.statics.findPopular = function(limit = 10) {
    return this.find()
        .sort({ accessCount: -1 })
        .limit(limit);
};

translationSchema.statics.findByContext = function(context, limit = 20) {
    return this.find({ context })
        .sort({ accessCount: -1 })
        .limit(limit);
};

translationSchema.statics.search = function(query, userId, options = {}) {
    const searchQuery = {
        userId,
        $or: [
            { original: { $regex: query, $options: 'i' } },
            { translated: { $regex: query, $options: 'i' } }
        ]
    };
    
    return this.find(searchQuery)
        .sort(options.sort || { createdAt: -1 })
        .limit(options.limit || 20);
};

// Pre-save middleware
translationSchema.pre('save', function(next) {
    // Update lastAccessed if not set
    if (!this.lastAccessed) {
        this.lastAccessed = new Date();
    }
    
    // Set cache strategy based on context
    if (this.context === 'quranic_text' || this.context === 'hadith_text') {
        this.cacheStrategy = 'hot';
    } else if (this.isIslamic) {
        this.cacheStrategy = 'warm';
    } else {
        this.cacheStrategy = 'cold';
    }
    
    next();
});

const Translation = mongoose.model('Translation', translationSchema);

module.exports = Translation;
