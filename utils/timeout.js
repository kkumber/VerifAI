const logger = require('../logger');

async function retryFetch(url, options = {}, retries = 3, delay = 500) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;

            if ([429, 500, 502, 503].includes(res.status)) {
                if (i === retries - 1) return res;
                await new Promise((r) => setTimeout(r, delay * 2 ** i));
            } else {
                return res;
            }
        } catch (err) {
            logger.error('Fetch error', {url, attempt: i + 1, error: err.message});
            if (i === retries - 1) throw err;
            await new Promise((r) => setTimeout(r, delay * 2 ** i));
        }
    }
}

module.exports = {retryFetch};
