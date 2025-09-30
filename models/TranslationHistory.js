// models/TranslationHistory.js
const mongoose = require('mongoose');

const translationHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    conversationId: {
        type: String,
        required: true,
        index: true
    },
    originalText: {
        type: String,
        required: true,
        maxlength: 10000
    },
    translatedText: {
        type: String,
        required: true,
        maxlength: 10000
    },
    fromLanguage: {
        type: String,
        required: true,
        maxlength: 10
    },
    toLanguage: {
        type: String,
        required: true,
        maxlength: 10
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.9
    },
    islamicContext: {
        hasIslamicContent: {
            type: Boolean,
            default: false
        },
        englishTerms: [String],
        arabicTerms: [String],
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.7
        }
    },
    audioData: {
        type: Buffer,
        required: false
    },
    audioFormat: {
        type: String,
        enum: ['mp3', 'wav', 'ogg'],
        required: false
    },
    model: {
        type: String,
        default: 'gpt-5'
    },
    processingTime: {
        type: Number, // in milliseconds
        required: false
    },
    isPartial: {
        type: Boolean,
        default: false
    },
    partialIndex: {
        type: Number,
        required: function() {
            return this.isPartial;
        }
    },
    tags: [String],
    isFavorite: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
translationHistorySchema.index({ userId: 1, createdAt: -1 });
translationHistorySchema.index({ sessionId: 1, createdAt: -1 });
translationHistorySchema.index({ conversationId: 1, createdAt: -1 });
translationHistorySchema.index({ fromLanguage: 1, toLanguage: 1 });
translationHistorySchema.index({ isPartial: 1, partialIndex: 1 });
translationHistorySchema.index({ isDeleted: 1, createdAt: -1 });

// Text search index for searching translations
translationHistorySchema.index({
    originalText: 'text',
    translatedText: 'text'
});

// Virtual for formatted date
translationHistorySchema.virtual('formattedDate').get(function() {
    return this.createdAt.toLocaleString();
});

// Virtual for duration since creation
translationHistorySchema.virtual('timeAgo').get(function() {
    const now = new Date();
    const diff = now - this.createdAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
});

// Static methods
translationHistorySchema.statics.findByUser = function(userId, options = {}) {
    const query = { userId, isDeleted: false };
    
    if (options.fromLanguage) query.fromLanguage = options.fromLanguage;
    if (options.toLanguage) query.toLanguage = options.toLanguage;
    if (options.sessionId) query.sessionId = options.sessionId;
    if (options.conversationId) query.conversationId = options.conversationId;
    if (options.isPartial !== undefined) query.isPartial = options.isPartial;
    if (options.isFavorite !== undefined) query.isFavorite = options.isFavorite;
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);
};

translationHistorySchema.statics.searchTranslations = function(userId, searchTerm, options = {}) {
    const query = {
        userId,
        isDeleted: false,
        $text: { $search: searchTerm }
    };
    
    if (options.fromLanguage) query.fromLanguage = options.fromLanguage;
    if (options.toLanguage) query.toLanguage = options.toLanguage;
    
    return this.find(query, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);
};

translationHistorySchema.statics.getUserStats = function(userId) {
    return this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId), isDeleted: false } },
        {
            $group: {
                _id: null,
                totalTranslations: { $sum: 1 },
                totalCharacters: { $sum: { $strLenCP: '$originalText' } },
                averageConfidence: { $avg: '$confidence' },
                languages: { $addToSet: '$fromLanguage' },
                targetLanguages: { $addToSet: '$toLanguage' },
                lastTranslation: { $max: '$createdAt' },
                firstTranslation: { $min: '$createdAt' }
            }
        }
    ]);
};

translationHistorySchema.statics.getConversationHistory = function(conversationId, options = {}) {
    const query = { conversationId, isDeleted: false };
    
    if (options.includePartial !== false) {
        // Include partial translations by default
    } else {
        query.isPartial = false;
    }
    
    return this.find(query)
        .sort({ partialIndex: 1, createdAt: 1 })
        .limit(options.limit || 100);
};

// Instance methods
translationHistorySchema.methods.markAsFavorite = function() {
    this.isFavorite = true;
    return this.save();
};

translationHistorySchema.methods.unmarkAsFavorite = function() {
    this.isFavorite = false;
    return this.save();
};

translationHistorySchema.methods.softDelete = function() {
    this.isDeleted = true;
    return this.save();
};

translationHistorySchema.methods.addTags = function(tags) {
    const newTags = Array.isArray(tags) ? tags : [tags];
    this.tags = [...new Set([...this.tags, ...newTags])];
    return this.save();
};

translationHistorySchema.methods.removeTags = function(tags) {
    const tagsToRemove = Array.isArray(tags) ? tags : [tags];
    this.tags = this.tags.filter(tag => !tagsToRemove.includes(tag));
    return this.save();
};

// Pre-save middleware
translationHistorySchema.pre('save', function(next) {
    // Ensure partialIndex is set for partial translations
    if (this.isPartial && this.partialIndex === undefined) {
        this.partialIndex = 0;
    }
    
    // Truncate text if too long
    if (this.originalText.length > 10000) {
        this.originalText = this.originalText.substring(0, 10000);
    }
    if (this.translatedText.length > 10000) {
        this.translatedText = this.translatedText.substring(0, 10000);
    }
    
    next();
});

module.exports = mongoose.model('TranslationHistory', translationHistorySchema);
