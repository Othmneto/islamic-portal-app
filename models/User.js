// translator-backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // For securely hashing passwords

// Define the structure of a User in our database
const UserSchema = new mongoose.Schema({
    // User's email address (must be unique)
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true, // Store emails in lowercase
        match: [/.+@.+\..+/, 'Please use a valid email address']
    },
    // User's password (will be stored as a scrambled hash)
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    // Optional username for display purposes
    username: {
        type: String,
        unique: true,
        sparse: true // Allows null values
    },
    // --- NEW: Notification Preferences ---
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
    // --- NEW: User Location for Prayer Time Calculations ---
    location: {
        city: String,
        country: String,
        lat: Number,
        lon: Number,
    },
    // User's general application preferences (e.g., default language, theme preference)
    preferences: {
        type: Object,
        default: {}
    },
    // An array to store references to their bookmarked Quran verses or Hadiths
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bookmark'
    }],
    // An array to store authentication history/sessions
    loginAttempts: [{
        timestamp: { type: Date, default: Date.now },
        ipAddress: String,
        userAgent: String,
        success: Boolean
    }]
}, {
    timestamps: true // Adds `createdAt` and `updatedAt` fields automatically
});

// --- Mongoose Middleware (Actions before saving to database) ---

// This code runs BEFORE a user is saved to the database to hash the password.
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

// --- Instance Method (Method available on a User object) ---

// This method compares a candidate password with the securely hashed password in the database.
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Create the Mongoose model from the schema
const User = mongoose.model('User', UserSchema);

module.exports = User;