const mongoose = require('mongoose');

/**
 * Translation Memory Model
 * Stores translation memory for suggestions and learning
 */
const translationMemorySchema = new mongoose.Schema({
    // User information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Translation data
    sourceText: {
        type: String,
        required: true,
        trim: true
    },
    targetText: {
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

    // Memory metadata
    key: {
        type: String,
        required: true,
        unique: true
    },
    usageCount: {
        type: Number,
        default: 1
    },
    lastUsed: {
        type: Date,
        default: Date.now
    },

    // Context and quality
    context: {
        type: String,
        enum: ['general', 'religious_prayer', 'quranic_text', 'hadith_text', 'islamic_law', 'general_islamic'],
        default: 'general'
    },
    isIslamic: {
        type: Boolean,
        default: false
    },
    quality: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor'],
        default: 'good'
    },

    // Similarity and matching
    similarity: {
        type: Number,
        min: 0,
        max: 1,
        default: 1.0
    },
    tags: [{
        type: String,
        trim: true
    }],

    // User feedback
    userRating: {
        type: Number,
        min: 1,
        max: 5
    },
    userNotes: {
        type: String,
        trim: true
    },

    // Analytics
    accessCount: {
        type: Number,
        default: 0
    },
    successRate: {
        type: Number,
        min: 0,
        max: 1,
        default: 1.0
    }
}, {
    timestamps: true
});

// Indexes for performance
translationMemorySchema.index({ userId: 1, sourceLanguage: 1, targetLanguage: 1 });
translationMemorySchema.index({ userId: 1, usageCount: -1 });
translationMemorySchema.index({ sourceLanguage: 1, targetLanguage: 1, usageCount: -1 });
translationMemorySchema.index({ sourceText: 'text' });
translationMemorySchema.index({ targetText: 'text' });
translationMemorySchema.index({ isIslamic: 1, context: 1 });
translationMemorySchema.index({ lastUsed: -1 });
translationMemorySchema.index({ key: 1 }, { unique: true });

// Methods
translationMemorySchema.methods.incrementUsage = function() {
    this.usageCount += 1;
    this.lastUsed = new Date();
    this.accessCount += 1;
    return this.save();
};

translationMemorySchema.methods.updateQuality = function(quality) {
    this.quality = quality;
    return this.save();
};

translationMemorySchema.methods.addTag = function(tag) {
    if (!this.tags.includes(tag)) {
        this.tags.push(tag);
    }
    return this.save();
};

translationMemorySchema.methods.updateUserFeedback = function(rating, notes) {
    this.userRating = rating;
    this.userNotes = notes;
    return this.save();
};

// Static methods
translationMemorySchema.statics.findSimilar = function(sourceText, sourceLang, targetLang, userId, limit = 5) {
    return this.find({
        userId,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        sourceText: { $regex: sourceText, $options: 'i' }
    })
    .sort({ usageCount: -1, similarity: -1 })
    .limit(limit);
};

translationMemorySchema.statics.findByContext = function(context, userId, limit = 10) {
    return this.find({
        userId,
        context
    })
    .sort({ usageCount: -1 })
    .limit(limit);
};

translationMemorySchema.statics.findIslamic = function(userId, limit = 10) {
    return this.find({
        userId,
        isIslamic: true
    })
    .sort({ usageCount: -1 })
    .limit(limit);
};

translationMemorySchema.statics.getPopular = function(userId, limit = 20) {
    return this.find({ userId })
        .sort({ usageCount: -1 })
        .limit(limit);
};

translationMemorySchema.statics.search = function(query, userId, options = {}) {
    const searchQuery = {
        userId,
        $or: [
            { sourceText: { $regex: query, $options: 'i' } },
            { targetText: { $regex: query, $options: 'i' } }
        ]
    };

    if (options.context) {
        searchQuery.context = options.context;
    }

    if (options.isIslamic !== undefined) {
        searchQuery.isIslamic = options.isIslamic;
    }

    return this.find(searchQuery)
        .sort({ usageCount: -1 })
        .limit(options.limit || 20);
};

// Pre-save middleware
translationMemorySchema.pre('save', function(next) {
    // Generate key if not provided
    if (!this.key) {
        const crypto = require('crypto');
        const keyData = `${this.sourceText}_${this.sourceLanguage}_${this.targetLanguage}`;
        this.key = crypto.createHash('md5').update(keyData).digest('hex');
    }

    // Update lastUsed if not set
    if (!this.lastUsed) {
        this.lastUsed = new Date();
    }

    next();
});

const TranslationMemory = mongoose.model('TranslationMemory', translationMemorySchema);

module.exports = TranslationMemory;
