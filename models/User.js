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
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&#]+$/.test(v);
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

    // OAuth tokens for calendar integration
    googleAccessToken: { type: String, sparse: true },
    googleRefreshToken: { type: String, sparse: true },
    googleTokenExpiry: { type: Date, sparse: true },
    microsoftAccessToken: { type: String, sparse: true },
    microsoftRefreshToken: { type: String, sparse: true },
    microsoftTokenExpiry: { type: Date, sparse: true },

    // Location tracking for persistent authentication
    lastKnownLocation: {
      lat: { type: Number },
      lon: { type: Number },
      accuracy: { type: Number, default: 0 },
      timestamp: { type: Date, default: Date.now },
      isDefault: { type: Boolean, default: false }
    },

    // Calendar events
    calendarEvents: [{
      id: { type: String, required: true },
      googleEventId: { type: String, default: null }, // Google Calendar event ID for sync
      microsoftEventId: { type: String, default: null }, // Microsoft Calendar event ID for sync
      title: { type: String, required: true },
      description: { type: String, default: '' },
      startDate: { type: Date, required: true },
      endDate: { type: Date },
      category: { type: String, default: 'personal' },
      priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
      location: { type: String, default: '' },
      tags: [{ type: String }],
      isIslamicEvent: { type: Boolean, default: false },
      prayerTime: { type: String },
      isExternal: { type: Boolean, default: false }, // True if synced from external calendar
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],

    // Provider of authentication
    authProvider: {
      type: String,
      enum: ['local', 'google', 'facebook', 'microsoft', 'twitter', 'tiktok', 'hybrid'],
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

    // Profile fields
    firstName: String,
    lastName: String,
    bio: String,
    location: String,
    avatar: String,
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'dark' },
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'UTC' },
      dateFormat: { type: String, default: 'MM/DD/YYYY' },
      loginNotifications: { type: Boolean, default: true },
      is24Hour: { type: Boolean, default: false },
      audioEnabled: { type: Boolean, default: true },
      selectedAdhanSrc: { type: String, default: '/audio/adhan.mp3' },
      adhanVolume: { type: Number, default: 1.0, min: 0, max: 1 }
    },

    // Activity tracking
    translationCount: { type: Number, default: 0 },
    loginCount: { type: Number, default: 0 },
    timeSpent: { type: Number, default: 0 }, // in seconds
    favoritesCount: { type: Number, default: 0 },
    prayerLogCount: { type: Number, default: 0 },

    // Privacy settings
    privacySettings: {
      analyticsEnabled: { type: Boolean, default: true },
      translationHistoryEnabled: { type: Boolean, default: true },
      personalizationEnabled: { type: Boolean, default: true },
      dataRetentionPeriod: { type: String, enum: ['1', '2', '5', 'indefinite'], default: '2' },
      marketingEmails: { type: Boolean, default: false },
      securityAlerts: { type: Boolean, default: true },
      thirdPartySharing: { type: Boolean, default: false },
      researchData: { type: Boolean, default: false },
      publicProfile: { type: Boolean, default: false }
    },

    // Remember me settings
    rememberMeSettings: {
      rememberMeEnabled: { type: Boolean, default: true },
      sessionDuration: { type: String, enum: ['1', '7', '30', '90', '365'], default: '30' },
      autoLoginEnabled: { type: Boolean, default: false },
      biometricLoginEnabled: { type: Boolean, default: false },
      requireReauth: { type: Boolean, default: true },
      loginNotifications: { type: Boolean, default: true },
      sessionTimeout: { type: String, enum: ['15', '30', '60', '120', '0'], default: '60' },
      offlineTranslations: { type: Boolean, default: true },
      prayerTimesCache: { type: Boolean, default: true },
      userPreferences: { type: Boolean, default: true }
    },

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
    backupCodes: [{
        code: String,
        used: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
    }],

    // Biometric authentication
    biometricEnabled: { type: Boolean, default: false },
    biometricType: { type: String, enum: ['webauthn', 'password-based', 'oauth-based'], default: null },
    biometricCredentials: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // MFA settings
    mfa: {
      totpEnabled: { type: Boolean, default: false },
      emailMfaEnabled: { type: Boolean, default: false },
      emailMfaEmail: String,
      emailMfaEnabledAt: Date
    },
    securityQuestions: [{
      question: String,
      answer: String // Hashed answer
    }],
    lastPasswordChange: Date,

    // Notifications (standardized)
    notificationPreferences: {
      enabled: { type: Boolean, default: false },
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

      // Enhanced Audio Preferences (OPTIONAL - backward compatible)
      audioProfileMain: {
        name: { type: String, default: 'madinah' },
        file: { type: String, default: '/audio/adhan_madinah.mp3' }
      },
      audioProfileReminder: {
        name: { type: String, default: 'short' },
        file: { type: String, default: '/audio/adhan.mp3' }
      },
      audioSettings: {
        volume: { type: Number, default: 0.8, min: 0, max: 1 },
        fadeInMs: { type: Number, default: 3000, min: 0, max: 10000 },
        vibrateOnly: { type: Boolean, default: false },
        cooldownSeconds: { type: Number, default: 30, min: 0, max: 300 }
      },
      // Per-prayer audio overrides (optional)
      audioOverrides: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
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
  
  // Check if password is already hashed (starts with $2a$ or $2b$)
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
    return next();
  }
  
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

// Enhanced indexing for performance optimization
// Note: email, googleId, microsoftId, facebookId, twitterId, tiktokId already have unique indexes
// All other indexes are commented out to prevent duplicate index warnings
// They can be re-enabled after database connection is established

// userSchema.index({ username: 1 }, { sparse: true }); // Username lookup
// userSchema.index({ authProvider: 1 }); // Filter by auth provider
// userSchema.index({ isVerified: 1 }); // Filter verified users
// userSchema.index({ role: 1 }); // Filter by role
// userSchema.index({ lastLogin: -1 }); // Sort by last login
// userSchema.index({ createdAt: -1 }); // Sort by creation date
// userSchema.index({ updatedAt: -1 }); // Sort by update date
// userSchema.index({ failedLoginAttempts: 1 }); // Find users with failed attempts
// userSchema.index({ accountLockedUntil: 1 }); // Find locked accounts
// userSchema.index({ lastLoginIP: 1 }); // Track IP addresses
// userSchema.index({ 'loginAttempts.timestamp': -1 }); // Sort login attempts
// userSchema.index({ 'location.city': 1 }); // Filter by city
// userSchema.index({ 'location.country': 1 }); // Filter by country
// userSchema.index({ 'location.lat': 1, 'location.lon': 1 }); // Geospatial queries
// userSchema.index({ timezone: 1 }); // Filter by timezone
// userSchema.index({ 'preferences.calculationMethod': 1 }); // Filter by calculation method
// userSchema.index({ 'preferences.madhab': 1 }); // Filter by madhab
// userSchema.index({ 'notificationPreferences.prayerReminders.fajr': 1 }); // Filter by notification preferences
// userSchema.index({ email: 1, isVerified: 1 }); // Verified user lookup
// userSchema.index({ authProvider: 1, isVerified: 1 }); // Provider and verification status
// userSchema.index({ role: 1, isVerified: 1 }); // Role and verification status
// userSchema.index({ lastLogin: -1, isVerified: 1 }); // Recent active users
// userSchema.index({ createdAt: -1, role: 1 }); // Recent users by role

const User = mongoose.model('User', userSchema);

// Index creation is handled automatically by Mongoose
// No manual index creation needed

module.exports = User;
