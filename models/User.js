// translator-backend/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
      required: true,
      minlength: 6,
    },
    // Optional username (keep sparse unique to allow nulls/duplicates among nulls)
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
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
    passwordResetToken: String,
    passwordResetExpires: Date,

    // Notifications (standardized)
    notificationPreferences: {
      prayerReminders: {
        fajr: { type: Boolean, default: true },
        dhuhr: { type: Boolean, default: true },
        asr: { type: Boolean, default: true },
        maghrib: { type: Boolean, default: true },
        isha: { type: Boolean, default: true },
      },
      // kept from first model
      specialAnnouncements: { type: Boolean, default: true },
    },

    // Location (consistent naming with frontend/scheduler)
    location: {
      city: String,
      country: String,
      lat: Number,
      lon: Number, // use 'lon' (not 'lng')
    },

    // Preferences used by scheduling/services
    preferences: {
      calculationMethod: { type: String, default: 'MuslimWorldLeague' },
      // allow 'auto' too; resolver will handle it
      madhab: { type: String, enum: ['shafii', 'hanafi', 'auto'], default: 'shafii' },
      // optional language preference
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

// Password hash on change
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
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

const User = mongoose.model('User', userSchema);
module.exports = User;
