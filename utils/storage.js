// utils/storage.js (Corrected to return insert result)
const { ObjectId } = require('mongodb');
const { connectToDb } = require('./db');

// --- Helper to get the 'history' collection ---
async function getHistoryCollection() {
    const db = await connectToDb();
    return db.collection('history');
}


/**
 * Fetches paginated and filtered history records from the database.
 * @param {object} options - Filtering, pagination, and sorting options.
 * @returns {Promise<object>} - An object containing the data and total count.
 */
async function getHistory({ page = 1, limit = 10, search = '', favoritesOnly = false, sessionId = '' }) {
    const collection = await getHistoryCollection();
    
    const query = {};
    if (sessionId) {
        query.sessionId = sessionId;
    }
    if (favoritesOnly) {
        query.isFavorite = true;
    }
    if (search) {
        query.$or = [
            { original: { $regex: search, $options: 'i' } },
            { translated: { $regex: search, $options: 'i' } }
        ];
    }
    
    const skip = (page - 1) * limit;
    
    const [total, data] = await Promise.all([
        collection.countDocuments(query),
        collection.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit)) // Ensure limit is an integer
            .toArray()
    ]);

    return { total, data };
}


/**
 * Adds one or more history entries to the database.
 * @param {Array<object>|object} entries - The history entry or entries to add.
 * @returns {Promise<object>} - The result from the insertMany operation.
 */
async function addHistoryEntries(entries) {
    const collection = await getHistoryCollection();
    const entriesArray = Array.isArray(entries) ? entries : [entries];
    if (entriesArray.length === 0) return;
    
    // <<< FIX: Added the 'return' statement here >>>
    return await collection.insertMany(entriesArray);
}

/**
 * Deletes multiple history items by their IDs.
 * @param {Array<string>} ids - An array of history item IDs to delete.
 */
async function deleteHistoryItems(ids) {
    const collection = await getHistoryCollection();
    const objectIds = ids.map(id => new ObjectId(id));
    await collection.deleteMany({ _id: { $in: objectIds } });
}

/**
 * Updates the favorite status of multiple history items.
 * @param {Array<string>} ids - An array of history item IDs to update.
 * @param {boolean} isFavorite - The new favorite status to set.
 */
async function updateFavoriteStatus(ids, isFavorite) {
    const collection = await getHistoryCollection();
    const objectIds = ids.map(id => new ObjectId(id));
    await collection.updateMany({ _id: { $in: objectIds } }, { $set: { isFavorite } });
}

/**
 * Increments the replay count for a single history item.
 * @param {string} id - The ID of the history item.
 */
async function incrementReplayCount(id) {
    const collection = await getHistoryCollection();
    await collection.updateOne({ _id: new ObjectId(id) }, { $inc: { replayCount: 1 } });
}

module.exports = { 
    getHistory, 
    addHistoryEntries,
    deleteHistoryItems,
    updateFavoriteStatus,
    incrementReplayCount
};