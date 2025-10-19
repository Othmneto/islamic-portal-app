// translator-backend/services/analyticsService.js

const { readHistory } = require('../utils/storage');
const logger = require('../utils/logger');

const getTranslationStats = async () => {
    try {
        const history = await readHistory();
        const langUsage = {};
        history.forEach(item => {
            const pair = `${item.from} → ${item.to}`;
            langUsage[pair] = (langUsage[pair] || 0) + 1;
        });

        const mostReplayed = history
            .filter(item => item.replayCount > 0)
            .sort((a, b) => b.replayCount - a.replayCount)
            .slice(0, 5);

        return {
            totalTranslations: history.length,
            languageUsage: langUsage,
            mostReplayed: mostReplayed
        };
    } catch (err) {
        logger.error("Error reading analytics data.", { errorMessage: err.message });
        throw new Error('Could not read analytics data.');
    }
};

module.exports = {
    getTranslationStats,
};