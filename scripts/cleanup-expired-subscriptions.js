const mongoose = require('mongoose');
const PushSubscription = require('../models/PushSubscription');
const NotificationHistory = require('../models/NotificationHistory');
const { env } = require('../config');

async function cleanupExpiredSubscriptions() {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    console.log('Connected to MongoDB');
    
    console.log('Cleaning up expired subscriptions...');
    
    // Remove inactive subscriptions
    const result = await PushSubscription.deleteMany({ isActive: false });
    console.log(`Deleted ${result.deletedCount} inactive subscriptions`);
    
    // Remove old failed notifications
    const notifResult = await NotificationHistory.deleteMany({
      status: 'failed',
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // older than 24 hours
    });
    console.log(`Deleted ${notifResult.deletedCount} old failed notifications`);
    
    // Remove expired subscriptions (where expiresAt is in the past)
    const expiredResult = await PushSubscription.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    console.log(`Deleted ${expiredResult.deletedCount} expired subscriptions`);
    
    await mongoose.disconnect();
    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupExpiredSubscriptions();
