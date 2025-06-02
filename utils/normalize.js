const logger = require('../logger');

function enforceContentCharLimit(content) {
    const limit = parseInt(process.env.CONTENT_CHAR_LIMIT, 10) || 1000;
    if (content.length > limit) {
        logger.error('Content exceeds character limit', {limit});
        throw new SyntaxError(`Content exceeds character limit of ${limit}.`);
    }
    return content;
}

async function normalizeContent(content) {
    if (typeof content !== 'string') {
        throw new SyntaxError('Invalid JSON format. Expected a string.');
    }
    return content
        .replace(/[^\x20-\x7E\n\r\t]/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[`"<>\\]/g, '')
        .trim();
}

function removeJsonMarkdown(jsonString) {
    return jsonString.replace(/^```json\s*|^```\s*|```$/gm, '').trim();
}

module.exports = {
    enforceContentCharLimit,
    normalizeContent,
    removeJsonMarkdown,
};
