// translator-backend/models/Name.js
const mongoose = require('mongoose');

const NameSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true }, // The unique number for the Name (1-99)
    name: { type: String, required: true, trim: true }, // The Arabic name (e.g., "الرحمن")
    transliteration: { type: String, trim: true }, // Romanized pronunciation (e.g., "Ar-Rahman")

    // This will store explanations in multiple languages and from various sources
    // It's a flexible object structure as per your JSON
    explanations: {
        type: Object, // Stores an object where keys are language codes (e.g., 'en', 'ar')
        default: {},
        // We set 'required: true' on explanations to ensure it's present, even if empty
        // Individual language explanations can be optional.
    },

    is_unique_to_Allah: { type: Boolean, default: false }, // Indicates if the name is unique to Allah

    // This will store invocations (prayers) in multiple languages
    // Also a flexible object structure
    invocation: {
        type: Object, // Stores an object where keys are language codes (e.g., 'en', 'ar')
        default: {},
    }

    // Removed old 'english_meaning' and 'description' fields, as they are now
    // structured within 'explanations' and 'invocation' in the new JSON data.
}, {
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

const Name = mongoose.model('Name', NameSchema);

module.exports = Name;