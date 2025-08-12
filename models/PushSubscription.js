// translator-backend/models/PushSubscription.js

const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    // May be null for anonymous (not logged in) devices
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true, // quick lookups by user
    },

    // Web Push endpoint – unique per device/browser
    endpoint: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // VAPID keys
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },

    // IANA timezone for this specific subscription/device
    tz: {
      type: String,
      default: 'UTC',
      trim: true,
    },

    // Optional future fields (uncomment if you want later)
    // location: { lat: Number, lon: Number },
    // userAgent: String,
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
module.exports = PushSubscription;
