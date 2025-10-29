const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  // Unique identifier: country_year_date_name
  uniqueId: { type: String, required: true, unique: true, index: true },
  
  // Basic info
  name: { type: String, required: true, index: true },
  nameLocal: String, // Local language name
  nameAr: String, // Arabic name for Islamic holidays
  
  // Date info
  date: { type: Date, required: true, index: true },
  year: { type: Number, required: true, index: true },
  month: { type: Number, required: true },
  day: { type: Number, required: true },
  
  // Location
  countryCode: { type: String, required: true, index: true },
  countryName: String,
  region: String, // e.g., 'Middle East', 'Europe', 'Asia'
  
  // Holiday details
  type: { 
    type: String, 
    required: true,
    enum: ['national', 'religious', 'observance', 'islamic', 'public'],
    index: true
  },
  description: String,
  howCelebrated: String,
  historicalSignificance: String,
  
  // Multi-day events
  duration: { type: Number, default: 1 }, // days
  endDate: Date,
  
  // Islamic calendar info (if applicable)
  isIslamic: { type: Boolean, default: false, index: true },
  hijriDate: String, // e.g., "1-1" for Muharram 1
  hijriMonth: Number,
  hijriDay: Number,
  
  // Source tracking
  source: { 
    type: String, 
    enum: [
      'calendarific', 
      'nager', 
      'abstract', 
      'manual',
      'comprehensive',
      'comprehensive-database',
      'fallback',
      'fallback-json',
      'aladhan',
      'aladhan-api',
      'islamic-finder',
      'islamic-calendar',
      'islamic-calendar-calc',
      'holiday-api'
    ], 
    default: 'manual' 
  },
  sourceId: String,
  
  // Metadata
  isPublicHoliday: { type: Boolean, default: false },
  isObserved: { type: Boolean, default: true },
  tags: [String],
  
  // Data freshness
  lastUpdated: { type: Date, default: Date.now },
  expiresAt: { type: Date, index: true }, // TTL for auto-cleanup of stale data
  
  // Usage tracking
  requestCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
holidaySchema.index({ countryCode: 1, year: 1, type: 1 });
holidaySchema.index({ year: 1, isIslamic: 1 });
holidaySchema.index({ date: 1, countryCode: 1 });
holidaySchema.index({ name: 'text', description: 'text' }); // Full-text search

// TTL index: auto-delete holidays older than 2 years
holidaySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Helper method to generate unique ID
holidaySchema.statics.generateUniqueId = function(countryCode, year, date, name) {
  const dateStr = new Date(date).toISOString().split('T')[0];
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return `${countryCode}-${year}-${dateStr}-${cleanName}`;
};

module.exports = mongoose.model('Holiday', holidaySchema);



