/**
 * Prayer Time Report Model
 * For user-reported prayer time inaccuracies
 */

const mongoose = require('mongoose');

const prayerTimeReportSchema = new mongoose.Schema({
  // User who reported
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Location information
  location: {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    city: String,
    country: String,
    display: String
  },

  // Date of the inaccuracy
  date: {
    type: Date,
    required: true,
    index: true
  },

  // Prayer name
  prayer: {
    type: String,
    required: true,
    enum: ['fajr', 'shuruq', 'dhuhr', 'asr', 'maghrib', 'isha'],
    index: true
  },

  // Reported times
  calculatedTime: {
    type: Date,
    required: true
  },

  correctTime: {
    type: Date,
    required: true
  },

  // Difference in minutes
  differenceMinutes: {
    type: Number,
    required: true
  },

  // Calculation method used
  calculationMethod: {
    type: String,
    required: true
  },

  madhab: {
    type: String,
    required: true
  },

  // User's description
  description: {
    type: String,
    maxlength: 1000
  },

  // Source of correct time (e.g., "Local Mosque", "Official App", "Manual Observation")
  source: {
    type: String,
    required: true,
    maxlength: 200
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'verified', 'rejected', 'fixed'],
    default: 'pending',
    index: true
  },

  // Admin review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  reviewedAt: Date,

  reviewNotes: {
    type: String,
    maxlength: 1000
  },

  // Action taken
  actionTaken: {
    type: String,
    enum: ['none', 'adjustment_applied', 'method_changed', 'user_error', 'needs_investigation'],
    default: 'none'
  },

  // Priority (based on number of reports for same location/prayer)
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true
  },

  // Votes from other users (to verify accuracy)
  votes: {
    agree: { type: Number, default: 0 },
    disagree: { type: Number, default: 0 },
    voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
prayerTimeReportSchema.index({ location: '2dsphere' });
prayerTimeReportSchema.index({ status: 1, priority: -1, createdAt: -1 });
prayerTimeReportSchema.index({ userId: 1, createdAt: -1 });

// Virtual for calculating accuracy percentage
prayerTimeReportSchema.virtual('accuracyPercentage').get(function() {
  const totalVotes = this.votes.agree + this.votes.disagree;
  if (totalVotes === 0) return null;
  return (this.votes.agree / totalVotes) * 100;
});

// Method to update priority based on similar reports
prayerTimeReportSchema.methods.updatePriority = async function() {
  const PrayerTimeReport = this.constructor;

  // Count similar reports (same location, prayer, within 7 days)
  const similarReports = await PrayerTimeReport.countDocuments({
    'location.lat': { $gte: this.location.lat - 0.1, $lte: this.location.lat + 0.1 },
    'location.lon': { $gte: this.location.lon - 0.1, $lte: this.location.lon + 0.1 },
    prayer: this.prayer,
    date: {
      $gte: new Date(this.date.getTime() - 7 * 24 * 60 * 60 * 1000),
      $lte: new Date(this.date.getTime() + 7 * 24 * 60 * 60 * 1000)
    },
    status: { $in: ['pending', 'reviewing'] }
  });

  // Update priority
  if (similarReports >= 10) {
    this.priority = 'critical';
  } else if (similarReports >= 5) {
    this.priority = 'high';
  } else if (similarReports >= 2) {
    this.priority = 'medium';
  } else {
    this.priority = 'low';
  }

  await this.save();
};

// Static method to get reports summary
prayerTimeReportSchema.statics.getSummary = async function() {
  const summary = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return summary.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
};

// Static method to get reports by location
prayerTimeReportSchema.statics.getByLocation = async function(lat, lon, radius = 0.5) {
  return this.find({
    'location.lat': { $gte: lat - radius, $lte: lat + radius },
    'location.lon': { $gte: lon - radius, $lte: lon + radius },
    status: { $in: ['pending', 'reviewing', 'verified'] }
  }).sort({ priority: -1, createdAt: -1 });
};

const PrayerTimeReport = mongoose.model('PrayerTimeReport', prayerTimeReportSchema);

module.exports = PrayerTimeReport;


