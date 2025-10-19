// middleware/validators.js

const validateSpeakRequest = (req, res, next) => {
    const { text, from, to, voiceId, sessionId } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0 || text.length > 5000) {
        return res.status(400).json({ error: 'Field "text" must be a non-empty string up to 5000 characters.' });
    }
    if (!from || typeof from !== 'string') {
        return res.status(400).json({ error: 'Field "from" is a required string.' });
    }
    if (!to || !Array.isArray(to) || to.length === 0) {
        return res.status(400).json({ error: 'Field "to" must be a non-empty array of target languages.' });
    }
    if (!voiceId || typeof voiceId !== 'string') {
        return res.status(400).json({ error: 'Field "voiceId" is a required string.' });
    }
    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: 'Field "sessionId" is a required string.' });
    }

    // If all checks pass, proceed to the next middleware or route handler
    next();
};

const validateAutoDetectSpeakRequest = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio or video file was uploaded.' });
    }

    const { toLang, voiceId, sessionId } = req.body;

    if (!voiceId || typeof voiceId !== 'string') {
        return res.status(400).json({ error: 'Field "voiceId" is required.' });
    }
    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: 'Field "sessionId" is required.' });
    }
    if (!toLang) {
        return res.status(400).json({ error: 'Field "toLang" containing target languages is required.'});
    }

    try {
        const toLanguages = JSON.parse(toLang);
        if (!Array.isArray(toLanguages) || toLanguages.length === 0) {
            return res.status(400).json({ error: 'Field "toLang" must be a non-empty array of target languages.' });
        }
    } catch (e) {
        return res.status(400).json({ error: 'Field "toLang" must be a valid JSON array string.' });
    }

    next();
};


module.exports = {
    validateSpeakRequest,
    validateAutoDetectSpeakRequest
};