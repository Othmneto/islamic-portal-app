// translator-backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Saved location subdocument
 * - label: e.g., "Home", "Work", "Mosque"
 * - address: full display address from reverse geocoding
 * - lat/lon: coordinates
 * - tz: IANA timezone for that location
 */
const locationSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true }, // keep 'lon' (not 'lng') consistent with the rest of the app
    tz: { type: String, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // Identity
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/.+@.+\..+/, 'Please use a valid email address'],
    },
    password: {
      type: String,
      required: function () { return this.authProvider === 'local'; },
      minlength: 12,
      validate: {
        validator: function(v) {
          if (this.authProvider !== 'local') return true;
          // Password must contain at least one uppercase, one lowercase, one number, and one special character
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/.test(v);
        },
        message: 'Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }
    },

    // Social auth identifiers
    googleId:   { type: String, unique: true, sparse: true },
    facebookId: { type: String, unique: true, sparse: true },
    microsoftId:{ type: String, unique: true, sparse: true },
    twitterId:  { type: String, unique: true, sparse: true },
    tiktokId:   { type: String, unique: true, sparse: true },

    // Provider of authentication
    authProvider: {
      type: String,
      enum: ['local', 'google', 'facebook', 'microsoft', 'twitter', 'tiktok'],
      default: 'local'
    },

    // Required username (unique across all users)
    // For OAuth users, username is set after initial login
    username: {
      type: String,
      required: function() { 
        // Only require username for local auth users or if explicitly set
        return this.authProvider === 'local' || this.username !== undefined;
      },
      unique: true,
      sparse: true, // Allow multiple null values during OAuth flow
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'],
    },

    // Access & verification
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    
    // Security fields
    lastLogin: Date,
    lastLoginIP: String,
    failedLoginAttempts: { type: Number, default: 0 },
    accountLockedUntil: Date,
    passwordChangedAt: Date,
    passwordExpiresAt: Date, // Password expiration date
    passwordHistory: [String], // Store hashed passwords for history
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    backupCodes: [String],
    securityQuestions: [{
      question: String,
      answer: String // Hashed answer
    }],
    lastPasswordChange: Date,

    // Notifications (standardized)
    notificationPreferences: {
      prayerReminders: {
        fajr: { type: Boolean, default: true },
        dhuhr: { type: Boolean, default: true },
        asr: { type: Boolean, default: true },
        maghrib: { type: Boolean, default: true },
        isha: { type: Boolean, default: true },
      },
      // Pre-prayer reminder minutes (0 = disabled, 5/10/15/20 = minutes before)
      reminderMinutes: { type: Number, default: 0, min: 0, max: 60 },
      // kept from first model
      specialAnnouncements: { type: Boolean, default: true },
    },

    // Location (PRIMARY/CURRENT location)
    location: {
      city: String,
      country: String,
      lat: Number,
      lon: Number, // use 'lon' (not 'lng') for consistency
    },

    // --- NEW: Saved & labeled locations ---
    savedLocations: {
      type: [locationSchema],
      default: [],
    },

    // Canonical timezone for scheduling/services
    timezone: {
      type: String,
      default: 'UTC', // updated on user's first login / location update
    },

    // Preferences used by scheduling/services
    preferences: {
      calculationMethod: { type: String, default: 'MuslimWorldLeague' }, // allow 'auto' too; resolver handles it
      madhab: { type: String, enum: ['shafii', 'hanafi', 'auto'], default: 'shafii' },
      // language preference could be added here if needed
      // language: { type: String, default: 'en' },
    },

    // Other data
    bookmarks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bookmark',
      },
    ],
    loginAttempts: [
      {
        timestamp: { type: Date, default: Date.now },
        ipAddress: String,
        userAgent: String,
        success: Boolean,
      },
    ],
  },
  { timestamps: true }
);

// Hash password on change
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    // Use 12 salt rounds for production security
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(this.password, salt);
    
    // Add current password to history before updating
    if (this.passwordHistory && this.passwordHistory.length > 0) {
      this.passwordHistory.push(this.password);
      // Keep only last 5 passwords
      if (this.passwordHistory.length > 5) {
        this.passwordHistory = this.passwordHistory.slice(-5);
      }
    } else {
      this.passwordHistory = [this.password];
    }
    
    this.password = hashedPassword;
    this.passwordChangedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});

// Methods
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
// Backward-compat alias
userSchema.methods.matchPassword = userSchema.methods.comparePassword;

// Security methods
userSchema.methods.isAccountLocked = function() {
  return !!(this.accountLockedUntil && this.accountLockedUntil > Date.now());
};

userSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.accountLockedUntil && this.accountLockedUntil < Date.now()) {
    return this.updateOne({
      $unset: { accountLockedUntil: 1 },
      $set: { failedLoginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { failedLoginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.failedLoginAttempts + 1 >= 5 && !this.isAccountLocked()) {
    updates.$set = { accountLockedUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { failedLoginAttempts: 1, accountLockedUntil: 1 }
  });
};

userSchema.methods.isPasswordInHistory = async function(newPassword) {
  if (this.passwordHistory.length === 0) return false;
  
  for (const oldPassword of this.passwordHistory) {
    if (await bcrypt.compare(newPassword, oldPassword)) {
      return true;
    }
  }
  return false;
};

// Check if password has expired
userSchema.methods.isPasswordExpired = function() {
  if (!this.passwordExpiresAt) return false;
  return new Date() > this.passwordExpiresAt;
};

// Set password expiration (90 days from now)
userSchema.methods.setPasswordExpiration = function() {
  this.passwordExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
};

// Check if account needs password change
userSchema.methods.needsPasswordChange = function() {
  return this.isPasswordExpired() || 
         (this.lastPasswordChange && (Date.now() - this.lastPasswordChange.getTime()) > 90 * 24 * 60 * 60 * 1000);
};

// Enhanced account lockout with configurable timeout
userSchema.methods.lockAccount = function(hours = 2) {
  this.accountLockedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

// Check if account is temporarily locked
userSchema.methods.isTemporarilyLocked = function() {
  return !!(this.accountLockedUntil && this.accountLockedUntil > Date.now());
};

// Get remaining lockout time in minutes
userSchema.methods.getLockoutTimeRemaining = function() {
  if (!this.isTemporarilyLocked()) return 0;
  return Math.ceil((this.accountLockedUntil - Date.now()) / (1000 * 60));
};

// Indexes are automatically created from the schema field definitions above
// No need for explicit index creation as they're already defined with unique/sparse options

const User = mongoose.model('User', userSchema);
module.exports = User;
