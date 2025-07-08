// translator-backend - full/data_importer.js
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const Dua = require('./models/Dua');
const Name = require('./models/Name'); // Our updated Name blueprint

const duasFilePath = path.join(__dirname, 'duas.json');
// Point to the new merged file for 99 Names
const namesFilePath = path.join(__dirname, 'asmaa_001_to_099_merged_final.json'); // NEW PATH FOR NAMES FILE

const quranSourcePath = path.join(__dirname, 'data', 'quran_source.json');
const hadithSourcePath = path.join(__dirname, 'data', 'hadith_source.json');


async function importData() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.DB_NAME,
        });
        console.log("✅ Data Importer: Connected to MongoDB Atlas via Mongoose.");

        // --- Import Duas (No change here from previous step) ---
        //if (fs.existsSync(duasFilePath)) {
        //    const duasData = JSON.parse(fs.readFileSync(duasFilePath, 'utf8'));
        //    console.log(`Found ${duasData.length} duas in ${duasFilePath}`);
        //    await Dua.deleteMany({});
        //    console.log("Cleared existing Duas collection.");
        //    await Dua.insertMany(duasData);
        //    console.log(`✅ Successfully imported ${duasData.length} duas to MongoDB.`);
        // } else {
        //    console.warn(`⚠️ Duas file not found at ${duasFilePath}. Skipping Dua import.`);
        //}

        // --- Import 99 Names (MODIFIED for new JSON structure) ---
        if (fs.existsSync(namesFilePath)) {
            const rawNamesData = JSON.parse(fs.readFileSync(namesFilePath, 'utf8'));

            // The JSON is an object with numeric keys, not an array.
            // We need to convert it into an array of objects for insertMany.
            const namesData = Object.values(rawNamesData).map((nameEntry, index) => {
                // Ensure the 'id' field is present and correct, if it's not part of the object values directly
                // Assuming 'id' is implicitly the key + 1, or that the objects themselves contain an ID.
                // Based on your previous Name.js, the `id` property is needed.
                // The asmaa_001_to_099_merged_final.json keys (1-99) seem to represent the id.
                return {
                    id: parseInt(Object.keys(rawNamesData)[index]), // Take the key as the ID
                    name: nameEntry.name,
                    transliteration: nameEntry.transliteration,
                    explanations: nameEntry.explanations,
                    is_unique_to_Allah: nameEntry.is_unique_to_Allah,
                    invocation: nameEntry.invocation
                };
            });

            console.log(`Found ${namesData.length} names in ${namesFilePath}`);

            await Name.deleteMany({});
            console.log("Cleared existing Names collection.");

            await Name.insertMany(namesData);
            console.log(`✅ Successfully imported ${namesData.length} names to MongoDB.`);
        } else {
            console.warn(`⚠️ Names file not found at ${namesFilePath}. Skipping Name import.`);
        }

        // --- (Existing or Future Quran/Hadith Import logic) ---
        if (fs.existsSync(quranSourcePath)) {
            // console.log(`Found Quran data in ${quranSourcePath}. This import is more complex`);
        }
        if (fs.existsSync(hadithSourcePath)) {
            // console.log(`Found Hadith data in ${hadithSourcePath}. Your existing data_importer might handle this differently.`);
        }


    } catch (error) {
        console.error("❌ Data Import failed:", error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log("Data Importer: Disconnected from MongoDB.");
        process.exit(0);
    }
}

importData();