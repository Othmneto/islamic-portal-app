// translator-backend/config/passport.js

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// Microsoft OAuth is now handled by custom implementation in microsoftAuth.js
const User = require('../models/User');
const unifiedAuthService = require('../services/unifiedAuthService');

// Optional logger resolution (fallback to console)
let _lg;
try { _lg = require('./logger'); } catch {}
try { if (!_lg) _lg = require('../utils/logger'); } catch {}
const logger = (_lg && (_lg.logger || _lg)) || console;

/**
 * GOOGLE STRATEGY - DISABLED
 * - Using custom PKCE implementation in routes/enhancedOAuth.js instead
 * - This prevents conflicts with our custom OAuth flow
 */
// passport.use(
//   new GoogleStrategy(
//     {
//       clientID: process.env.GOOGLE_CLIENT_ID,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//       callbackURL: 'http://localhost:3000/api/auth/google/callback',
//     },
//     async (accessToken, refreshToken, profile, done) => {
//       try {
//         const email = profile.emails?.[0]?.value;

//         if (!email) {
//           logger.warn?.('Google OAuth: no email returned from provider');
//           return done(null, false, { message: 'Google account has no email.' });
//         }

//         // Use unified auth service (ip and userAgent will be set in the callback route)
//         const user = await unifiedAuthService.createOrUpdateUserFromOAuth(profile, 'google');
        
//         logger.info?.('Google OAuth: user found/created', { userId: user._id, email });
//         return done(null, user);
//       } catch (error) {
//         logger.error?.('Google OAuth error:', error);
//         return done(error, null);
//       }
//     }
//   )
// );

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
