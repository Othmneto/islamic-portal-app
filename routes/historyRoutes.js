// routes/historyRoutes.js (Corrected for Database Integration)
const express = require('express');
const { ObjectId } = require('mongodb'); // Needed for ID validation
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const { deleteFromMemory } = require('../text-to-speech');
const {
    getHistory,
    deleteHistoryItems,
    updateFavoriteStatus,
    incrementReplayCount
} = require('../utils/storage');

const router = express.Router();

// Helper function for PDF Generation
function _generatePdf(historyData, res) {
    const doc = new PDFDocument({ margin: 50, bufferPages: true });

    res.header('Content-Type', 'application/pdf');
    res.attachment('translation_history.pdf');
    doc.pipe(res);

    doc.fontSize(20).text('Translation History', { align: 'center' });
    doc.moveDown(2);

    historyData.forEach(item => {
        doc.fontSize(10).fillColor('grey').text(new Date(item.timestamp).toLocaleString());
        doc.fontSize(12).fillColor('black').text(`From: ${item.from} → To: ${item.to}`);
        doc.moveDown(0.5);
        doc.text(`Original: ${item.original}`);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text(`Translated: ${item.translated}`);
        doc.moveDown(2);
    });

    doc.end();
}

// GET /history
router.get('/', async (req, res) => {
    try {
        const options = {
            page: parseInt(req.query.page || 1),
            limit: parseInt(req.query.limit || 20),
            search: req.query.search || '',
            favoritesOnly: req.query.favoritesOnly === 'true',
            sessionId: req.query.sessionId || ''
        };

        const { total, data } = await getHistory(options);

        res.json({
            total: total,
            page: options.page,
            limit: options.limit,
            data: data
        });
    } catch (err) {
        console.error("Could not get history:", err);
        res.status(500).json({ error: 'Failed to retrieve history from the database.' });
    }
});

// DELETE /history/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid history item ID.' });
        }
        // Note: For Pinecone deletion, you may need to fetch the item first to get its sessionId
        // For now, this just deletes from the primary database.
        await deleteHistoryItems([id]);
        res.status(200).json({ message: 'History item deleted successfully.' });
    } catch (err) {
        console.error("Error deleting history item:", err);
        res.status(500).json({ error: 'Server error while deleting item.' });
    }
});

// DELETE /history/bulk
router.delete('/bulk', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.some(id => !ObjectId.isValid(id))) {
            return res.status(400).json({ error: 'Invalid request: "ids" must be an array of valid IDs.' });
        }
        await deleteHistoryItems(ids);
        // Note: Bulk deleting from Pinecone would require fetching all items first.
        res.status(200).json({ message: `${ids.length} items deleted successfully.` });
    } catch (err) {
        console.error("Error during bulk delete:", err);
        res.status(500).json({ error: 'Server error during bulk deletion.' });
    }
});

// PATCH /history/:id/favorite
router.patch('/:id/favorite', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid history item ID.' });
        }
        // This operation is simplified; we'd need to fetch the current status to toggle it.
        // Assuming the frontend sends the desired state:
        const { isFavorite } = req.body;
        if (typeof isFavorite !== 'boolean') {
             return res.status(400).json({ error: 'isFavorite must be true or false.' });
        }
        await updateFavoriteStatus([id], isFavorite);
        res.status(200).json({ message: 'Favorite status updated.' });
    } catch (err) {
        console.error("Error toggling favorite status:", err);
        res.status(500).json({ error: 'Server error while updating item.' });
    }
});

// POST /history/:id/replay
router.post('/:id/replay', async (req, res) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid history item ID.' });
        }
        await incrementReplayCount(id);
        res.status(200).json({ message: 'Replay count incremented.' });
    } catch (err) {
        console.error("Error incrementing replay count:", err);
        res.status(500).json({ error: 'Server error while updating item.' });
    }
});

// GET /history/export/csv
router.get('/export/csv', async (req, res) => {
    try {
        const { data } = await getHistory({ limit: 1000 }); // Fetch up to 1000 records for export
        const json2csvParser = new Parser({ fields: ["timestamp", "from", "to", "original", "translated", "replayCount", "isFavorite"] });
        const csv = json2csvParser.parse(data);
        res.header('Content-Type', 'text/csv');
        res.attachment('translation_history.csv');
        res.send(csv);
    } catch (err) {
        console.error("Error exporting to CSV:", err);
        res.status(500).send("Could not generate CSV file.");
    }
});

// GET /history/export/pdf
router.get('/export/pdf', async (req, res) => {
    try {
        const { data } = await getHistory({ limit: 200 }); // Fetch up to 200 records for PDF to avoid memory issues
        _generatePdf(data, res);
    } catch (err) {
        console.error("Error exporting to PDF:", err);
        res.status(500).send("Could not generate PDF file.");
    }
});

module.exports = router;