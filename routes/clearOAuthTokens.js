// Route to clear OAuth tokens for testing
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');

// Clear OAuth tokens for the authenticated user
router.post('/clear-oauth-tokens', requireAuth, async (req, res) => {
    try {
        console.log('🧹 Clearing OAuth tokens for user:', req.user.id);
        
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        console.log('📊 Current OAuth status:');
        console.log(`   - Google ID: ${user.googleId || 'Not set'}`);
        console.log(`   - Google Access Token: ${user.googleAccessToken ? 'Set' : 'Not set'}`);
        console.log(`   - Google Refresh Token: ${user.googleRefreshToken ? 'Set' : 'Not set'}`);
        console.log(`   - Microsoft ID: ${user.microsoftId || 'Not set'}`);
        console.log(`   - Microsoft Access Token: ${user.microsoftAccessToken ? 'Set' : 'Not set'}`);
        console.log(`   - Microsoft Refresh Token: ${user.microsoftRefreshToken ? 'Set' : 'Not set'}`);
        
        // Clear all OAuth tokens
        user.googleAccessToken = undefined;
        user.googleRefreshToken = undefined;
        user.googleTokenExpiry = undefined;
        user.microsoftAccessToken = undefined;
        user.microsoftRefreshToken = undefined;
        user.microsoftTokenExpiry = undefined;
        
        // Save the user
        await user.save();
        
        console.log('✅ OAuth tokens cleared successfully!');
        
        res.json({
            success: true,
            message: 'OAuth tokens cleared successfully',
            user: {
                email: user.email,
                googleId: user.googleId,
                microsoftId: user.microsoftId
            }
        });
        
    } catch (error) {
        console.error('❌ Error clearing OAuth tokens:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to clear OAuth tokens'
        });
    }
});

module.exports = router;


