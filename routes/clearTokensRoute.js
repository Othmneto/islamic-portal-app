// routes/clearTokensRoute.js - Direct token clearing route
const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Clear all OAuth tokens for the authenticated user
router.post('/clear-all-tokens', requireAuth, async (req, res) => {
    try {
        console.log('🗑️ Clearing OAuth tokens for user:', req.user.id);

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        console.log('🔍 Current OAuth tokens before clearing:');
        console.log('  Google:', {
            hasToken: !!user.googleAccessToken,
            hasId: !!user.googleId
        });
        console.log('  Microsoft:', {
            hasToken: !!user.microsoftAccessToken,
            hasId: !!user.microsoftId
        });

        // Clear Google OAuth tokens
        user.googleAccessToken = undefined;
        user.googleRefreshToken = undefined;
        user.googleTokenExpiry = undefined;
        user.googleId = undefined;
        user.lastGoogleSync = undefined;

        // Clear Microsoft OAuth tokens
        user.microsoftAccessToken = undefined;
        user.microsoftRefreshToken = undefined;
        user.microsoftTokenExpiry = undefined;
        user.microsoftId = undefined;
        user.lastMicrosoftSync = undefined;

        await user.save();

        console.log('✅ OAuth tokens cleared successfully!');
        console.log('🔍 After clearing:');
        console.log('  Google:', {
            hasToken: !!user.googleAccessToken,
            hasId: !!user.googleId
        });
        console.log('  Microsoft:', {
            hasToken: !!user.microsoftAccessToken,
            hasId: !!user.microsoftId
        });

        res.json({
            success: true,
            message: "All OAuth tokens cleared successfully",
            user: {
                email: user.email,
                googleCleared: true,
                microsoftCleared: true
            }
        });

    } catch (error) {
        console.error('❌ Error clearing OAuth tokens:', error);
        res.status(500).json({
            success: false,
            error: "Failed to clear OAuth tokens",
            details: error.message
        });
    }
});

module.exports = router;

