const mongoose = require('mongoose');
const PushSubscription = require('../models/PushSubscription');
const { env } = require('../config');

async function cleanupOldSubscriptions() {
  try {
    await mongoose.connect(env.MONGO_URI, { dbName: env.DB_NAME });
    console.log('Connected to MongoDB');

    // Get all users with subscriptions
    const users = await PushSubscription.distinct('userId');
    console.log(`Found ${users.length} users with subscriptions`);

    let totalCleaned = 0;

    for (const userId of users) {
      if (!userId) continue;

      // Get all subscriptions for this user, sorted by creation date
      const subs = await PushSubscription.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

      if (subs.length <= 1) continue;

      // Keep only the most recent, deactivate the rest
      const idsToDeactivate = subs.slice(1).map(s => s._id);
      
      await PushSubscription.updateMany(
        { _id: { $in: idsToDeactivate } },
        { $set: { isActive: false } }
      );

      console.log(`User ${userId}: Kept 1 subscription, deactivated ${idsToDeactivate.length}`);
      totalCleaned += idsToDeactivate.length;
    }

    console.log(`\nCleanup complete! Deactivated ${totalCleaned} old subscriptions`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupOldSubscriptions();

