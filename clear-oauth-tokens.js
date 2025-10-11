// clear-oauth-tokens.js - Direct database script to clear OAuth tokens
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function clearOAuthTokens() {
    try {
        console.log('🔗 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/translator-backend');
        console.log('✅ Connected to database');

        // Find user by email
        const userEmail = 'ahmedothmanofff@gmail.com'; // Your email from the logs
        console.log(`🔍 Looking for user: ${userEmail}`);
        
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log(`✅ User found: ${user.email}`);
        console.log('🔍 Current OAuth tokens:');
        console.log('  Google:', {
            hasToken: !!user.googleAccessToken,
            hasId: !!user.googleId
        });
        console.log('  Microsoft:', {
            hasToken: !!user.microsoftAccessToken,
            hasId: !!user.microsoftId
        });

        // Clear OAuth tokens
        user.googleAccessToken = undefined;
        user.googleRefreshToken = undefined;
        user.googleTokenExpiry = undefined;
        user.googleId = undefined;
        user.lastGoogleSync = undefined;

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

        console.log('🎉 Done! You can now re-authorize with calendar permissions.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

// Run the script
clearOAuthTokens();