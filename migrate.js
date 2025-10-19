// migrate.js - A one-time script to move history from JSON to MongoDB
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { connectToDb } = require('./utils/db');

async function runMigration() {
    console.log("Starting migration from history.json to MongoDB...");

    try {
        // 1. Connect to the database
        const db = await connectToDb();
        const collection = db.collection('history');

        // 2. Read the old JSON file
        const historyFilePath = path.join(__dirname, 'history.json');
        const historyData = JSON.parse(await fs.readFile(historyFilePath, 'utf8'));

        if (!historyData || historyData.length === 0) {
            console.log("history.json is empty. No migration needed.");
            process.exit(0);
        }

        // 3. Clear any existing data in the collection to prevent duplicates
        await collection.deleteMany({});
        console.log("Cleared existing 'history' collection.");

        // 4. Insert the data into the collection
        const result = await collection.insertMany(historyData);
        console.log(`✅ Successfully inserted ${result.insertedCount} documents into the 'history' collection.`);

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        // Ensure you have a mechanism in db.js or here to close the client connection
        // For simplicity, we exit the process.
        process.exit(0);
    }
}

runMigration();