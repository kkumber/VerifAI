const express = require('express');
const {gemma} = require('../services/gemma');
const {
    normalizeContent,
    enforceContentCharLimit,
    removeJsonMarkdown,
} = require('../utils/normalize');
const {convertToValidJson} = require('../services/jsonSchema');
const {checkErrorUrls} = require('../services/urlCheck');
const NodeCache = require('node-cache');
const logger = require('../logger');

const router = express.Router();
const responseCache = new NodeCache({stdTTL: 3600});

router.post('/', async (req, res, next) => {
    const startTime = process.hrtime();
    logger.info('Received POST /api request', {payload: req.body});

    try {
        let content = await normalizeContent(req.body.content);
        content = enforceContentCharLimit(content);

        const cacheKey = content.toLowerCase().trim();
        const cached = responseCache.get(cacheKey);
        if (cached) {
            logger.info('Cache hit', {cacheKey});
            return res.status(200).json(cached);
        }

        let response = await gemma(content);
        response = removeJsonMarkdown(response);

        let json = await convertToValidJson(response);
        json = await checkErrorUrls(json);

        const [s, ns] = process.hrtime(startTime);
        logger.info('API call completed', {duration: `${s}s ${ns / 1e6}ms`});

        responseCache.set(cacheKey, json);
        res.status(200).json(json);
    } catch (err) {
        const [s, ns] = process.hrtime(startTime);
        logger.error('Error in /api route', {
            error: err.message,
            duration: `${s}s ${ns / 1e6}ms`,
        });
        next(err);
    }
});

module.exports = router;
