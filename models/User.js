// translator-backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please use a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    username: {
        type: String,
        unique: true,
        sparse: true
    },
    // --- Standardized Notification Preferences ---
    notificationPreferences: {
        prayerReminders: {
            fajr: { type: Boolean, default: true },
            dhuhr: { type: Boolean, default: true },
            asr: { type: Boolean, default: true },
            maghrib: { type: Boolean, default: true },
            isha: { type: Boolean, default: true },
        },
        specialAnnouncements: {
            type: Boolean,
            default: true,
        },
    },
    // --- Standardized User Location ---
    location: {
        city: String,
        country: String,
        // Use 'lat' and 'lon' consistently
        lat: Number,
        lon: Number,
    },
    // --- Other User Data ---
    preferences: {
        type: Object,
        default: {}
    },
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bookmark'
    }],
    loginAttempts: [{
        timestamp: { type: Date, default: Date.now },
        ipAddress: String,
        userAgent: String,
        success: Boolean
    }]
}, {
    timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;