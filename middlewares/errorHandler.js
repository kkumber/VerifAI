// noinspection JSUnusedLocalSymbols

const logger = require('../logger');

module.exports = (err, req, res, next) => {
    const status =
        err.name === 'AbortError' ? 408 :
            err instanceof SyntaxError ? 400 :
                err.message?.includes('HTTP error') ? 500 :
                    500;

    const errorMsg =
        err.name === 'AbortError' ? 'Request timed out.' :
            err instanceof SyntaxError ? 'Invalid JSON format or validation error.' :
                err.message?.includes('HTTP error') ? 'API request failed.' :
                    'Something went wrong.';

    logger.error('Unhandled error in request', {
        error: err.message,
        stack: err.stack,
        status,
    });

    res.status(status).json({
        error: errorMsg,
        code: err.name || 'ERROR',
        details: err.message,
    });
};
