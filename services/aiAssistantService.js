// translator-backend/services/aiAssistantService.js

const path = require('path');
// Create an absolute path to the ai-assistant.js file in the root directory
const { handleUserQuery } = require(path.join(__dirname, '..', 'ai-assistant.js'));
const logger = require('../utils/logger');

const ask = async (question, sessionId) => {
    if (!question) {
        throw new Error('Question is required.');
    }
    try {
        logger.info('Processing user query with AI Assistant', { sessionId });
        const answer = await handleUserQuery(question, sessionId);
        return answer;
    } catch (error) {
        logger.error("Error in AI Assistant service.", { sessionId, errorMessage: error.message });
        throw new Error('The assistant could not process your request.');
    }
};

module.exports = {
    ask,
};