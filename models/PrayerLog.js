const mongoose = require('mongoose');

const prayerLogSchema = new mongoose.Schema({
  /**
   * The user who performed the prayer.
   */
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  /**
   * The name of the prayer (e.g., 'fajr', 'dhuhr').
   */
  prayerName: {
    type: String,
    required: true,
    enum: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
  },
  /**
   * The specific date for which the prayer was performed.
   * We store the date at UTC midnight to make querying for a specific day easy,
   * regardless of the user's timezone.
   */
  prayerDate: {
    type: Date,
    required: true,
    index: true,
  },
  /**
   * The exact timestamp when the user marked the prayer as complete.
   */
  completedAt: {
    type: Date,
    default: Date.now,
  },
  /**
   * The status of the prayer. This allows for future features like
   * marking a prayer as 'missed' or 'prayed later'.
   */
  status: {
    type: String,
    enum: ['prayed', 'missed', 'qada'], // qada = prayed later
    default: 'prayed',
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
});

// Create a compound index to prevent a user from logging the same prayer on the same day twice.
prayerLogSchema.index({ userId: 1, prayerName: 1, prayerDate: 1 }, { unique: true });

const PrayerLog = mongoose.model('PrayerLog', prayerLogSchema);

module.exports = PrayerLog;