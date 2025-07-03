// data_importer.js - A one-time script to import Quran/Hadith data and generate embeddings.
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { connectToDb } = require('./utils/db');
const { pineconeIndex } = require('./text-to-speech');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BATCH_SIZE = 100;

async function getOrCreateCollection(db, collectionName) {
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length > 0) {
        console.log(`Collection '${collectionName}' already exists. Clearing it for re-import.`);
        await db.collection(collectionName).deleteMany({});
    }
    return db.collection(collectionName);
}

async function generateEmbeddings(texts) {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-ada-002",
            input: texts.map(t => t.replace(/\n/g, ' ')),
        });
        return response.data.map(data => data.embedding);
    } catch (error) {
        console.error("Error generating embeddings:", error);
        throw error;
    }
}

async function runImport() {
    console.log("Starting data import process...");
    let db;

    try {
        db = await connectToDb();
        console.log("✅ Connected to MongoDB and Pinecone.");

        // --- Process Quran Data ---
        console.log("\n--- Processing Quran Data ---");
        // (Assuming this part is already done and commented out if not needed again)
        // ... previous Quran import logic ...
        console.log("Skipping Quran import as it's likely complete.");


        // --- NEW: Process Hadith Data ---
        console.log("\n--- Processing Hadith Data ---");
        const hadithCollection = await getOrCreateCollection(db, 'hadiths');
        const hadithPineconeNamespace = pineconeIndex.namespace('hadiths');
        
        const hadithDataPath = path.join(__dirname, 'data', 'hadith_source.json');
        const hadithData = JSON.parse(await fs.readFile(hadithDataPath, 'utf8'));

        for (let i = 0; i < hadithData.length; i += BATCH_SIZE) {
            const batch = hadithData.slice(i, i + BATCH_SIZE);
            console.log(`Processing Hadith batch ${i / BATCH_SIZE + 1}...`);

            await hadithCollection.insertMany(batch);

            const textsToEmbed = batch.map(hadith => `${hadith.text_english}\n${hadith.explanation}`);
            const embeddings = await generateEmbeddings(textsToEmbed);

            const vectors = batch.map((hadith, index) => ({
                id: hadith._id,
                values: embeddings[index],
                metadata: { collection: hadith.collection_name, number: hadith.hadith_number }
            }));
            
            await hadithPineconeNamespace.upsert(vectors);
        }
        console.log(`✅ Successfully imported and embedded ${hadithData.length} hadiths.`);

    } catch (error) {
        console.error("❌ Migration failed:", error);
    } finally {
        console.log("\nImport process finished.");
        process.exit(0);
    }
}

runImport();