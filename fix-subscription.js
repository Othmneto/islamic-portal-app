require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to MongoDB');

  const PushSubscription = require('./models/PushSubscription');

  try {
    // Update the existing subscription to have the correct userId
    const result = await PushSubscription.updateOne(
      { _id: '68eba2960dffdffea5bd6a0b' },
      {
        $set: {
          userId: '6888c9391815657294913e8d',
          updatedAt: new Date()
        }
      }
    );

    console.log('Update result:', result);

    // Check the updated subscription
    const updated = await PushSubscription.findById('68eba2960dffdffea5bd6a0b');
    console.log('Updated subscription:');
    console.log('  userId:', updated.userId);
    console.log('  endpoint present:', !!updated.subscription?.endpoint);

    // Now check if the user has subscriptions
    const userSubs = await PushSubscription.find({ userId: '6888c9391815657294913e8d' });
    console.log('Subscriptions for user after update:', userSubs.length);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}).catch(console.error);

