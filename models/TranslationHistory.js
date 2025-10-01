const mongoose = require('mongoose');

const translationHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  from: {
    type: String,
    required: true,
    maxlength: 10
  },
  to: {
    type: String,
    required: true,
    maxlength: 10
  },
  original: {
    type: String,
    required: true,
    maxlength: 5000
  },
  translated: {
    type: String,
    maxlength: 5000
  },
  error: {
    type: String,
    maxlength: 1000
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  model: {
    type: String,
    maxlength: 100
  },
  sessionId: {
    type: String,
    maxlength: 100,
    index: true
  },
  conversationId: {
    type: String,
    maxlength: 100,
    index: true
  },
  context: {
    type: String,
    maxlength: 500
  },
  source: {
    type: String,
    enum: ['api', 'web', 'mobile', 'voice'],
    default: 'web'
  },
  processingTime: {
    type: Number, // in milliseconds
    min: 0
  },
  userAgent: {
    type: String,
    maxlength: 500
  },
  ipAddress: {
    type: String,
    maxlength: 45
  },
  isPartial: {
    type: Boolean,
    default: false
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  tags: [{
    type: String,
    maxlength: 50
  }]
}, {
  timestamps: true,
  collection: 'translation_history'
});

// Indexes for better query performance
translationHistorySchema.index({ userId: 1, timestamp: -1 });
translationHistorySchema.index({ userId: 1, from: 1, to: 1 });
translationHistorySchema.index({ sessionId: 1 });
translationHistorySchema.index({ timestamp: -1 });
translationHistorySchema.index({ error: 1 });

// Virtual for success status
translationHistorySchema.virtual('isSuccessful').get(function() {
  return !this.error && this.translated;
});

// Virtual for duration since translation
translationHistorySchema.virtual('durationAgo').get(function() {
  const now = new Date();
  const diff = now - this.timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// Static method to get user statistics
translationHistorySchema.statics.getUserStats = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalTranslations: { $sum: 1 },
        successfulTranslations: {
          $sum: { $cond: [{ $eq: ['$error', null] }, 1, 0] }
        },
        failedTranslations: {
          $sum: { $cond: [{ $ne: ['$error', null] }, 1, 0] }
        },
        avgConfidence: { $avg: '$confidence' },
        avgProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);
  
  return stats[0] || {
    totalTranslations: 0,
    successfulTranslations: 0,
    failedTranslations: 0,
    avgConfidence: 0,
    avgProcessingTime: 0
  };
};

// Static method to get language pair statistics
translationHistorySchema.statics.getLanguagePairStats = async function(userId, limit = 10) {
  return await this.aggregate([
    {
      $match: {
        userId,
        error: { $exists: false }
      }
    },
    {
      $group: {
        _id: { from: '$from', to: '$to' },
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

// Static method to get daily activity
translationHistorySchema.statics.getDailyActivity = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return await this.aggregate([
    {
      $match: {
        userId,
        timestamp: { $gte: startDate },
        error: { $exists: false }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$timestamp' },
          month: { $month: '$timestamp' },
          day: { $dayOfMonth: '$timestamp' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
    }
  ]);
};

// Pre-save middleware to clean up data
translationHistorySchema.pre('save', function(next) {
  // Trim whitespace
  if (this.original) this.original = this.original.trim();
  if (this.translated) this.translated = this.translated.trim();
  if (this.error) this.error = this.error.trim();
  
  // Ensure translated text exists for successful translations
  if (!this.error && !this.translated) {
    this.error = 'Translation result missing';
  }
  
  next();
});

// Static method to find translations by user with options
translationHistorySchema.statics.findByUser = async function(userId, options = {}) {
  const {
    limit = 20,
    skip = 0,
    fromLanguage,
    toLanguage,
    sessionId,
    conversationId,
    isPartial,
    isFavorite
  } = options;

  const query = {
    userId,
    isDeleted: false
  };

  if (fromLanguage) query.from = fromLanguage;
  if (toLanguage) query.to = toLanguage;
  if (sessionId) query.sessionId = sessionId;
  if (conversationId) query.conversationId = conversationId;
  if (isPartial !== undefined) query.isPartial = isPartial;
  if (isFavorite !== undefined) query.isFavorite = isFavorite;

  return await this.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

// Instance method to mark as favorite
translationHistorySchema.methods.markAsFavorite = function() {
  this.isFavorite = true;
  return this.save();
};

// Instance method to unmark as favorite
translationHistorySchema.methods.unmarkAsFavorite = function() {
  this.isFavorite = false;
  return this.save();
};

// Instance method to add tags
translationHistorySchema.methods.addTags = function(tags) {
  if (!this.tags) this.tags = [];
  const newTags = tags.filter(tag => !this.tags.includes(tag));
  this.tags = [...this.tags, ...newTags];
  return this.save();
};

// Instance method to remove tags
translationHistorySchema.methods.removeTags = function(tags) {
  if (!this.tags) return this.save();
  this.tags = this.tags.filter(tag => !tags.includes(tag));
  return this.save();
};

// Instance method to soft delete
translationHistorySchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('TranslationHistory', translationHistorySchema);