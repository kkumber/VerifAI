const cors = require('cors');
const logger = require('../logger');

const origin = process.env.CORS_ORIGIN || '*';
logger.info('Initializing CORS middleware with origin:', {origin});

if (origin === '*') {
    logger.warn('CORS_ORIGIN not set. Defaulting to "*". This may be insecure.');
}

module.exports = cors({
    origin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
});
