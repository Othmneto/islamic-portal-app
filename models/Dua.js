// translator-backend - full/models/Dua.js

const mongoose = require('mongoose');

const DuaSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true }, // Unique ID for the Dua
    category: { type: String, trim: true }, // e.g., "Morning", "Evening", "Travel" (can be empty initially)
    arabic_text: { type: String, required: true, trim: true }, // The Dua in Arabic
    transliteration: { type: String, trim: true }, // How to pronounce it
    english_translation: { type: String, required: true, trim: true }, // English meaning
    // Add more fields if your duas.json has them, e.g., 'source', 'reference'
    source: { type: String, trim: true },
    reference: { type: String, trim: true }
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

const Dua = mongoose.model('Dua', DuaSchema);

module.exports = Dua;