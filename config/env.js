const dotenv = require('dotenv');
const logger = require('../logger');

dotenv.config();

const REQUIRED_ENV_VARS = ['API_PORT', 'GEMMA_API_KEY'];
const OPTIONAL_ENV_VARS = ['CONTENT_CHAR_LIMIT', 'CORS_ORIGIN'];

function loadEnv() {
    REQUIRED_ENV_VARS.forEach((key) => {
        if (!process.env[key]) {
            logger.error(`Missing required environment variable: ${key}`);
            process.exit(1);
        }
    });

    OPTIONAL_ENV_VARS.forEach((key) => {
        if (!process.env[key]) {
            logger.warn(`Optional environment variable ${key} is not defined - using default`);
        }
    });
}

module.exports = {loadEnv};
