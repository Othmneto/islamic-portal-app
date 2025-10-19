const mongoose = require('mongoose');

const notificationHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  prayerName: { type: String, required: true, enum: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'unknown', 'test'] },
  notificationType: { type: String, required: true, enum: ['main', 'reminder'] },
  scheduledTime: { type: Date, required: true },
  sentTime: { type: Date, required: true },
  status: { type: String, required: true, enum: ['sent', 'failed', 'expired', 'delivered', 'confirmed'] },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PushSubscription' },
  error: { type: String },
  timezone: { type: String, required: true },
  reminderMinutes: { type: Number },

  // New fields for confirmation and retry
  notificationId: { type: String, unique: true, index: true },
  confirmedAt: { type: Date },
  retryCount: { type: Number, default: 0 },
  retryScheduledFor: { type: Date },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

notificationHistorySchema.index({ userId: 1, createdAt: -1 });
notificationHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
notificationHistorySchema.index({ notificationId: 1 }, { unique: true });
notificationHistorySchema.index({ retryScheduledFor: 1 });

module.exports = mongoose.model('NotificationHistory', notificationHistorySchema);
