// scripts/add-session-ttl-index.js
// Add MongoDB TTL index to auto-expire sessions after 90 days

const mongoose = require('mongoose');
const { env } = require('../config');

async function addSessionTTL() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(env.MONGO_URI, {
      dbName: env.DB_NAME,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    const db = mongoose.connection.db;
    console.log('✅ Connected to MongoDB');
    
    // Check if TTL index already exists
    const indexes = await db.collection('sessions').indexes();
    const hasTTL = indexes.some(idx => idx.key.expires && idx.expireAfterSeconds !== undefined);
    
    if (hasTTL) {
      console.log('ℹ️  TTL index already exists on sessions collection');
    } else {
      // TTL index: expire sessions after 90 days of inactivity
      // expireAfterSeconds: 0 means expire at the time specified in the 'expires' field
      await db.collection('sessions').createIndex(
        { expires: 1 },
        { expireAfterSeconds: 0 }
      );
      
      console.log('✅ TTL index added to sessions collection');
      console.log('   Sessions will auto-expire based on their "expires" field');
    }
    
    // List all indexes for verification
    console.log('\n📋 Current indexes on sessions collection:');
    indexes.forEach(idx => {
      console.log(`   - ${JSON.stringify(idx.key)}${idx.expireAfterSeconds !== undefined ? ` (TTL: ${idx.expireAfterSeconds}s)` : ''}`);
    });
    
    await mongoose.connection.close();
    console.log('\n✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding TTL index:', error);
    process.exit(1);
  }
}

addSessionTTL();


