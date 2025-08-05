const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
    },
    endpoint: { 
        type: String, 
        required: true,
        unique: true, // Prevents duplicate subscriptions for the same endpoint
    },
    // The keys are part of the standard Web Push Subscription object
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
    },
    platform: {
        type: String,
        enum: ['web'], // We only support 'web' for now
        required: true,
    },
}, { timestamps: true });

// Index for quickly finding all subscriptions for a given user
subscriptionSchema.index({ userId: 1 });

module.exports = mongoose.model('PushSubscription', subscriptionSchema);