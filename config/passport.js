// translator-backend/config/passport.js

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// Microsoft OAuth is now handled by custom implementation in microsoftAuth.js
const User = require('../models/User');

// Optional logger resolution (fallback to console)
let _lg;
try { _lg = require('./logger'); } catch {}
try { if (!_lg) _lg = require('../utils/logger'); } catch {}
const logger = (_lg && (_lg.logger || _lg)) || console;

/**
 * GOOGLE STRATEGY
 * - Atomic link-or-create by email to avoid E11000 duplicate key errors
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;

        if (!email) {
          logger.warn?.('Google OAuth: no email returned from provider');
          return done(null, false, { message: 'Google account has no email.' });
        }

        const user = await User.findOneAndUpdate(
          { email },
          {
            $set: {
              googleId,
              isVerified: true,
              authProvider: 'google',
            },
            $setOnInsert: {
              email,
              // Username will be required - user will be redirected to setup page
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: false, // Skip validation for now, will handle username requirement separately
            setDefaultsOnInsert: true,
            context: 'query',
          }
        );

        logger.info?.('Google login: user linked/created', { userId: user.id });
        return done(null, user);
      } catch (err) {
        if (err && err.code === 11000) {
          // Handle rare race-condition on unique indexes
          try {
            const fallback = await User.findOne({
              $or: [{ googleId: profile.id }, { email: profile.emails?.[0]?.value }],
            });
            if (fallback) {
              logger.warn?.('Google OAuth: resolved via existing user after 11000', { userId: fallback.id });
              return done(null, fallback);
            }
          } catch (e) {
            logger.error?.('Google OAuth: lookup after 11000 failed', { error: e });
          }
        }
        logger.error?.('Error in Google OAuth strategy', { error: err });
        return done(err, false);
      }
    }
  )
);

// Microsoft OAuth is now handled by custom implementation in microsoftAuth.js

// Session management
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
