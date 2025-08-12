// translator-backend/debug-user.js

const mongoose = require('mongoose');
const User = require('./models/User');
const PushSubscription = require('./models/PushSubscription');
require('dotenv').config();

const USER_EMAIL_TO_DEBUG = 'ahmedothmanofff@gmail.com';

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME });
        console.log('✅ Connected to MongoDB.');

        console.log(`\n--- 1. Checking User: ${USER_EMAIL_TO_DEBUG} ---`);
        const user = await User.findOne({ email: USER_EMAIL_TO_DEBUG }).lean();

        if (!user) {
            console.error('❌ CRITICAL ERROR: User not found in the database.');
            return;
        }

        console.log(`✔️ User found. User ID: ${user._id}`);
        
        if (user.location && user.location.lat && user.location.lon) {
            console.log(`✔️ User has a location saved: Lat ${user.location.lat}, Lon ${user.location.lon}`);
        } else {
            console.log('⚠️ WARNING: User does NOT have a location saved in their profile. The scheduler cannot find them without it.');
        }

        console.log(`\n--- 2. Checking Push Subscriptions for this User ---`);
        const subscriptions = await PushSubscription.find({ userId: user._id }).lean();

        if (subscriptions.length > 0) {
            console.log(`✔️ Found ${subscriptions.length} subscription(s) linked to this user.`);
            subscriptions.forEach((sub, i) => {
                console.log(`  - Subscription ${i+1}: Endpoint exists, TZ: "${sub.tz}"`);
            });
        } else {
            console.log('⚠️ WARNING: NO push subscriptions are linked to this User ID in the database.');
        }
        
        console.log('\n--- 3. Checking for Anonymous Subscriptions ---');
        const anonSubs = await PushSubscription.find({ userId: null }).lean();
        if (anonSubs.length > 0) {
            console.log(`ℹ️ Found ${anonSubs.length} anonymous subscription(s). This is likely the problem if you subscribed before logging in.`);
        } else {
            console.log('✔️ No anonymous subscriptions found.');
        }


    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB.');
    }
};

run();