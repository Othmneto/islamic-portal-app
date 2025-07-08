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
        lowercase: true, // Store emails in lowercase to avoid duplicates like "Test@example.com" and "test@example.com"
        match: [/.+@.+\..+/, 'Please use a valid email address'] // Basic email format validation
    },
    // User's password (will be stored as a scrambled hash)
    password: {
        type: String,
        required: true,
        minlength: 6 // Passwords should be at least 6 characters long for basic security
    },
    // Optional username for display purposes
    username: {
        type: String,
        unique: true, // Ensure usernames are unique if desired
        sparse: true // Allows null values, so users don't have to have a username
    },
    // User's general application preferences (e.g., default language, theme preference)
    preferences: {
        type: Object, // Can store various settings as a flexible object
        default: {} // Start with an empty object if no preferences are set
    },
    // An array to store references to their bookmarked Quran verses or Hadiths
    // This will link to the existing bookmarks data in the database
    bookmarks: [
        {
            type: mongoose.Schema.Types.ObjectId, // Refers to the unique ID of a bookmarked item
            ref: 'Bookmark' // Assumes a 'Bookmark' model will be created later or refers to existing history/quran items directly
        }
    ],
    // An array to store authentication history/sessions (optional, for advanced security)
    loginAttempts: [
        {
            timestamp: { type: Date, default: Date.now },
            ipAddress: String,
            userAgent: String, // Browser/device info
            success: Boolean
        }
    ]
}, {
    timestamps: true // Adds `createdAt` and `updatedAt` fields automatically
});

// --- Mongoose Middleware (Actions before saving to database) ---

// This code runs BEFORE a user is saved to the database.
// It's used to scramble (hash) the password if it's new or has been changed.
UserSchema.pre('save', async function(next) {
    // Only hash the password if it's new or if it has been modified
    if (!this.isModified('password')) {
        return next();
    }
    try {
        // Generate a random salt (extra random data to make hashing more secure)
        const salt = await bcrypt.genSalt(10); // 10 rounds of hashing
        // Hash the password using the generated salt
        this.password = await bcrypt.hash(this.password, salt);
        next(); // Continue with saving the user
    } catch (error) {
        next(error); // Pass any error to the next middleware
    }
});

// --- Instance Method (Method available on a User object) ---

// This method allows us to compare a provided password (e.g., during login)
// with the securely hashed password stored in the database.
UserSchema.methods.comparePassword = async function(candidatePassword) {
    // Use bcrypt to compare the provided password with the stored hash
    return await bcrypt.compare(candidatePassword, this.password);
};

// Create the Mongoose model from the schema
const User = mongoose.model('User', UserSchema);

module.exports = User;