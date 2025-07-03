const express = require('express');
const { ObjectId } = require('mongodb');
const { connectToDb } = require('../utils/db');
const { pineconeIndex } = require('../text-to-speech');
const { OpenAI } = require('openai');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- MONGODB HELPER ---
async function getCollection(name) {
    const db = await connectToDb();
    return db.collection(name);
}


// --- QURAN ENDPOINTS ---

// GET /api/explorer/quran/chapters
router.get('/quran/chapters', async (req, res) => {
    try {
        // In a full implementation, this would fetch from a 'quran_surahs' collection
        // or be pre-populated. For now, we use a sample.
        const sampleChapters = [
            { id: 1, name_arabic: "الفاتحة", name_english: "Al-Fatiha", verses_count: 7 },
            { id: 2, name_arabic: "البقرة", name_english: "Al-Baqarah", verses_count: 286 },
            { id: 18, name_arabic: "الكهف", name_english: "Al-Kahf", verses_count: 110 },
            { id: 112, name_arabic: "الإخلاص", name_english: "Al-Ikhlas", verses_count: 4 }
            // Add more chapters as needed
        ];
        res.json(sampleChapters);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Quran chapters.' });
    }
});

// GET /api/explorer/quran/chapter/:id
router.get('/quran/chapter/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const surahId = parseInt(id, 10);
        if (isNaN(surahId)) {
            return res.status(400).json({ error: 'Invalid Surah ID.' });
        }
        
        const collection = await getCollection('quran_verses');
        const verses = await collection.find({ surah_id: surahId }).sort({ verse_id: 1 }).toArray();
        
        if (!verses) {
            return res.status(404).json([]); // Return empty array to prevent frontend errors
        }
        
        res.json(verses);

    } catch (error) {
        console.error("Error fetching chapter content:", error);
        res.status(500).json({ error: `Failed to fetch verses for chapter ${id}.` });
    }
});

// --- HADITH ENDPOINTS ---

router.get('/hadith/collections', async (req, res) => {
    try {
        const hadithCollection = await getCollection('hadiths');
        const collections = await hadithCollection.distinct('collection_name');
        res.json(collections.map(c => ({ 
            id: c.toLowerCase().replace(/ /g, '-'), 
            name: c 
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Hadith collections.' });
    }
});

router.get('/hadith/collection/:collectionId', async (req, res) => {
    try {
        const { collectionId } = req.params;
        const hadithCollection = await getCollection('hadiths');
        // Use a case-insensitive regex to match the collection name, replacing dashes with spaces
        const searchRegex = new RegExp(collectionId.replace(/-/g, ' '), 'i');
        const hadiths = await hadithCollection.find({ collection_name: searchRegex }).limit(100).toArray();
        res.json(hadiths);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Hadith data.' });
    }
});


// --- SEARCH ENDPOINT ---

router.get('/search', async (req, res) => {
    const { q, type = 'keyword', source = 'quran' } = req.query;
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required.' });
    }

    try {
        const collectionName = source === 'quran' ? 'quran_verses' : 'hadiths';
        const collection = await getCollection(collectionName);
        let results = [];

        if (type === 'semantic') {
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: q
            });
            const vector = embeddingResponse.data[0].embedding;

            const namespace = pineconeIndex.namespace(collectionName);
            const queryResponse = await namespace.query({ topK: 5, vector });
            
            const matchIds = queryResponse.matches.map(match => match.id);
            // For Quran, IDs are strings. For Hadith, they might be ObjectIDs.
            // This handles both cases, but assumes string IDs for simplicity based on source files.
            results = await collection.find({ _id: { $in: matchIds } }).toArray();

        } else { // Keyword search
            const searchFields = source === 'quran' 
                ? [{ "translations.text": { $regex: q, $options: 'i' } }] 
                : [{ "text_english": { $regex: q, $options: 'i' } }, { "explanation": { $regex: q, $options: 'i' } }];

            results = await collection.find({
                $or: [
                    { text_arabic: { $regex: q, $options: 'i' } },
                    ...searchFields
                ]
            }).limit(10).toArray();
        }
        
        res.json(results);

    } catch (error) {
        console.error(`Search failed:`, error);
        res.status(500).json({ error: 'Search operation failed.' });
    }
});


// --- BOOKMARKS ENDPOINTS ---

router.get('/bookmarks', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required." });
    }
    try {
        const collection = await getCollection('bookmarks');
        const bookmarks = await collection.find({ sessionId }).sort({ timestamp: -1 }).toArray();
        res.json(bookmarks);
    } catch (error) {
        console.error("Error fetching bookmarks:", error);
        res.status(500).json({ error: 'Failed to fetch bookmarks.' });
    }
});

router.post('/bookmarks', async (req, res) => {
    const { sessionId, type, refId, text_arabic, text_english } = req.body;
    if (!sessionId || !type || !refId) {
        return res.status(400).json({ error: "Missing required fields for bookmark." });
    }
    
    try {
        const collection = await getCollection('bookmarks');
        
        const existing = await collection.findOne({ sessionId, refId });
        
        if (existing) {
            await collection.deleteOne({ _id: existing._id });
            return res.status(200).json({ message: 'Bookmark removed.', bookmarked: false });
        } else {
            const newBookmark = {
                sessionId,
                type,
                refId,
                text_arabic,
                text_english, // Storing this for display purposes
                timestamp: new Date()
            };
            await collection.insertOne(newBookmark);
            return res.status(201).json({ message: 'Bookmark added.', bookmarked: true });
        }
    } catch (error) {
        console.error("Error creating or removing bookmark:", error);
        res.status(500).json({ error: 'Failed to update bookmark.' });
    }
});


module.exports = router;