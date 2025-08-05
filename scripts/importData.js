const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const Name = require('../models/name');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected for script.');
  } catch (err) {
    console.error('❌ MongoDB script connection error:', err);
    process.exit(1);
  }
};

const importData = async () => {
  try {
    // --- UPDATED FILE PATH ---
    const filePath = path.resolve(__dirname, '../data/new_1_cleaned.json');

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: File not found at ${filePath}`);
      process.exit(1);
    }

    const namesObject = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Transform the object into an array
    const formattedNames = Object.keys(namesObject).map(key => {
      const nameData = namesObject[key];
      return {
        id: parseInt(key),
        ...nameData
      };
    });

    console.log('🗑️  Clearing existing data...');
    await Name.deleteMany();

    console.log('📥 Inserting new data from new_1_cleaned.json...');
    await Name.insertMany(formattedNames);

    console.log('✅ All names have been successfully imported from the new source!');
  } catch (err) {
    console.error('❌ An error occurred during the data import process:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB connection closed.');
    process.exit();
  }
};

const run = async () => {
  await connectDB();
  await importData();
};

run();