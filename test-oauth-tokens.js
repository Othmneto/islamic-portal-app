const mongoose = require('mongoose');
const User = require('./models/User');

async function testOAuthTokens() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/translator-backend');
    console.log('✅ Connected to MongoDB');
    
    // Find the user
    const user = await User.findOne({ email: 'ahmedothmanofff@gmail.com' });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('👤 User found:', user.email);
    console.log('🔑 Google OAuth tokens:');
    console.log('  - googleAccessToken:', !!user.googleAccessToken);
    console.log('  - googleRefreshToken:', !!user.googleRefreshToken);
    console.log('  - googleTokenExpiry:', user.googleTokenExpiry);
    console.log('  - googleId:', user.googleId);
    
    console.log('🔑 Microsoft OAuth tokens:');
    console.log('  - microsoftAccessToken:', !!user.microsoftAccessToken);
    console.log('  - microsoftRefreshToken:', !!user.microsoftRefreshToken);
    console.log('  - microsoftTokenExpiry:', user.microsoftTokenExpiry);
    console.log('  - microsoftId:', user.microsoftId);
    
    // Test Google Calendar API access
    if (user.googleAccessToken) {
      console.log('\n🧪 Testing Google Calendar API access...');
      try {
        const axios = require('axios');
        const response = await axios.get('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
          headers: {
            'Authorization': `Bearer ${user.googleAccessToken}`
          }
        });
        console.log('✅ Google Calendar API access successful');
        console.log('📅 Calendars found:', response.data.items?.length || 0);
      } catch (error) {
        console.log('❌ Google Calendar API access failed:', error.response?.status, error.response?.data?.error?.message || error.message);
      }
    }
    
    // Test Microsoft Graph API access
    if (user.microsoftAccessToken) {
      console.log('\n🧪 Testing Microsoft Graph API access...');
      try {
        const axios = require('axios');
        const response = await axios.get('https://graph.microsoft.com/v1.0/me/calendars', {
          headers: {
            'Authorization': `Bearer ${user.microsoftAccessToken}`
          }
        });
        console.log('✅ Microsoft Graph API access successful');
        console.log('📅 Calendars found:', response.data.value?.length || 0);
      } catch (error) {
        console.log('❌ Microsoft Graph API access failed:', error.response?.status, error.response?.data?.error?.message || error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testOAuthTokens();