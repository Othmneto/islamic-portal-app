// Test User model validation
const mongoose = require('mongoose');
const User = require('./models/User');

async function testUserModel() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ahmedothmanofff:geDtPI0AvWH6IvNR@cluster0.loizc98.mongodb.net/Shaik-pro?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Connected to MongoDB');

        // Test weak password
        console.log('\nTesting weak password validation...');
        try {
            const user = new User({
                email: 'test@example.com',
                username: 'testuser',
                password: '123456',
                authProvider: 'local'
            });
            
            await user.validate();
            console.log('❌ Weak password validation failed - password was accepted');
        } catch (error) {
            console.log('✅ Weak password validation working - password was rejected');
            console.log('Error:', error.message);
        }

        // Test strong password
        console.log('\nTesting strong password validation...');
        try {
            const user = new User({
                email: 'test2@example.com',
                username: 'testuser2',
                password: 'Password123@',
                authProvider: 'local'
            });
            
            await user.validate();
            console.log('✅ Strong password validation working - password was accepted');
        } catch (error) {
            console.log('❌ Strong password validation failed - password was rejected');
            console.log('Error:', error.message);
        }

    } catch (error) {
        console.error('Test error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

testUserModel();
