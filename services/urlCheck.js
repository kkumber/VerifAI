// noinspection JSUnusedLocalSymbols

const NodeCache = require('node-cache');
const logger = require('../logger');
const {retryFetch} = require('../utils/timeout');

const urlCache = new NodeCache({stdTTL: 300, checkperiod: 120});

async function checkUrlWithEnhancements(err) {
    if (!err.url) return err;
    if (urlCache.has(err.url)) return urlCache.get(err.url);

    try {
        const res = await retryFetch(err.url, {method: 'HEAD'});
        if (!res.ok || res.status === 404) {
            const cleaned = {...err, url: '', source: ''};
            urlCache.set(err.url, cleaned);
            return cleaned;
        }
        urlCache.set(err.url, err);
        return err;
    } catch {
        const cleaned = {...err, url: '', source: ''};
        urlCache.set(err.url, cleaned);
        return cleaned;
    }
}

async function checkErrorUrls(json) {
    const checked = await Promise.all(json.errors.map(checkUrlWithEnhancements));

    if (checked.some((e) => !e.url)) {
        checked.push({
            claim: 'Some sources or URLs could not be verified (404 or not found).',
            correction: 'Please verify the information with additional research.',
            reason: 'One or more sources/URLs returned 404 or could not be reached.',
            source: 'General Search',
            url: `https://www.google.com/search?q=${encodeURIComponent(
                (json.related_topics || []).join('+')
            )}`,
        });

        json.overall_reason +=
            (json.overall_reason ? ' ' : '') +
            'Some sources/URLs could not be verified and were removed. Further research is recommended.';
    }

    json.errors = checked;
    return json;
}

module.exports = {checkErrorUrls};
