// utils/db.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME;
const client = new MongoClient(uri);

let db;

async function connectToDb() {
    if (db) {
        return db;
    }
    try {
        await client.connect();
        console.log("✅ Successfully connected to MongoDB Atlas.");
        db = client.db(dbName);
        return db;
    } catch (e) {
        console.error("Could not connect to MongoDB", e);
        process.exit(1); // Exit the process with an error
    }
}

module.exports = { connectToDb };