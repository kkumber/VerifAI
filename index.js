const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const timeout = require('connect-timeout');
const {z} = require('zod');
const NodeCache = require('node-cache');
const {GoogleGenAI} = require('@google/genai');
const compression = require('compression');
const logger = require('./logger');

dotenv.config();

// Validate environment variables
const REQUIRED_ENV_VARS = ['API_PORT', 'GEMMA_API_KEY'];
const OPTIONAL_ENV_VARS = ['CONTENT_CHAR_LIMIT', 'CORS_ORIGIN'];

function validateRequiredEnvVars() {
    REQUIRED_ENV_VARS.forEach((key) => {
        if (!process.env[key]) {
            logger.error(`Missing required environment variable: ${key}`);
            process.exit(1);
        }
    });
}

function checkOptionalEnvVars() {
    OPTIONAL_ENV_VARS.forEach((key) => {
        if (!process.env[key]) {
            logger.warn(`Optional environment variable ${key} is not defined - falling back to default value`);
        }
    });
}

validateRequiredEnvVars();
checkOptionalEnvVars();

const app = express();

// Middleware setup
if (!process.env.CORS_ORIGIN) {
    logger.warn('CORS_ORIGIN not set. Defaulting to "*". This may be insecure.');
}
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

app.use(bodyParser.urlencoded({extended: true, limit: '1mb'}));
app.use(bodyParser.json({limit: '1mb'}));

logger.info('Initializing CORS middleware with origin:', {origin: process.env.CORS_ORIGIN || '*'});
logger.info('Setting up rate limiter middleware for /api route');
logger.info('Request timeout middleware set to 30 seconds');

// Rate limiter middleware for the /api route
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {error: 'Too many requests. Please try again later.'},
});

// noinspection JSCheckFunctionSignatures
app.use('/api', limiter);

// Request timeout middleware
app.use(timeout('15s'));

// Helper functions
function enforceContentCharLimit(content) {
    const limit = parseInt(process.env.CONTENT_CHAR_LIMIT, 10) || 1000;
    if (!process.env.CONTENT_CHAR_LIMIT) {
        logger.warn('CONTENT_CHAR_LIMIT not set. Using default of 1000');
    }
    if (content.length > limit) {
        logger.error('Content exceeds character limit', {limit});
        throw new SyntaxError(`Content exceeds character limit of ${limit}.`);
    }
    return content;
}

async function normalizeContent(content) {
    if (typeof content !== 'string') {
        logger.error('Input is not a string', {content});
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

const gemmaResponseSchema = z.object({
    verdict: z.enum(['True', 'False', 'Partially True', 'Unverifiable']),
    errors: z.array(
        z.object({
            claim: z.string(),
            correction: z.string(),
            reason: z.string(),
            source: z.string(),
            url: z.string().url().or(z.literal('')),
        })
    ),
    overall_reason: z.string(),
    related_topics: z.array(z.string()),
});

async function convertToValidJson(response) {
    try {
        const json = JSON.parse(response);
        return gemmaResponseSchema.parse(json);
    } catch (parseErr) {
        logger.error('AI response is not valid or does not match schema', {error: parseErr});
        throw new SyntaxError('AI response is not valid or does not match schema.');
    }
}

const urlCache = new NodeCache({stdTTL: 300, checkperiod: 120});

async function retryFetch(url, options = {}, retries = 3, delay = 500) {
    logger.debug('Attempting to fetch URL', {url, retries});
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            logger.warn('Fetch attempt failed', {attempt: i + 1, status: res.status});
            if ([429, 500, 502, 503].includes(res.status)) {
                if (i === retries - 1) return res;
                await new Promise((r) => setTimeout(r, delay * 2 ** i));
                continue;
            }
            return res;
        } catch (e) {
            logger.error('Fetch attempt encountered an error', {
                attempt: i + 1,
                error: e.message
            });
            if (i === retries - 1) throw e;
            await new Promise((r) => setTimeout(r, delay * 2 ** i));
        }
    }
}

function timeoutSignal(ms = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return {signal: controller.signal, cancel: () => clearTimeout(id)};
}

async function checkUrlWithEnhancements(err) {
    if (!err.url) {
        logger.warn('No URL provided in error object', {error: err});
        return err;
    }
    if (urlCache.has(err.url)) return urlCache.get(err.url);

    const {signal, cancel} = timeoutSignal();
    try {
        const res = await retryFetch(err.url, {method: 'HEAD', signal});
        cancel();
        if (!res.ok || res.status === 404) {
            const cleaned = {...err, url: '', source: ''};
            urlCache.set(err.url, cleaned);
            return cleaned;
        }
        urlCache.set(err.url, err);
        return err;
    } catch (e) {
        cancel();
        const cleaned = {...err, url: '', source: ''};
        urlCache.set(err.url, cleaned);
        return cleaned;
    }
}

async function checkErrorUrls(json) {
    const checkedErrors = await Promise.all(
        json.errors.map(err => checkUrlWithEnhancements(err))
    );

    const had404 = checkedErrors.some((err) => !err.url);
    if (had404) {
        checkedErrors.push({
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

    json.errors = checkedErrors;
    return json;
}

// AI fact-check function
async function gemma(userStatement) {
    const ai = new GoogleGenAI({apiKey: process.env.GEMMA_API_KEY});

    const prompt = `
    Goal:
    You are an AI fact-checker. Your task is to analyze the following user-submitted statement, identify any factual inaccuracies, and provide corrected information with credible sources.
    
    User Statement:
    "${userStatement}"
    
    Instructions:
    - Check for factual errors, misleading claims, or unverified assertions.
    - For every inaccuracy, explain what’s wrong and correct it with reliable and publicly known information.
    - If the statement is accurate, say so and explain why.
    - If the statement refers to very recent or speculative information that cannot be verified, mark it as "Unverifiable".
    
    Return Format:
    {
      "verdict": "True" | "False" | "Partially True" | "Unverifiable",
      "errors": [
        {
          "claim": "The specific incorrect part of the statement",
          "correction": "The correct information",
          "reason": "Brief explanation why this is incorrect",
          "source": "Name of credible source",
          "url": "https://..."
        }
      ],
      "overall_reason": "A concise explanation of why the statement was rated this way",
      "related_topics": ["keyword1", "keyword2", "etc"]
    }
    
    Warnings:
    - DO NOT guess or invent URLs, sources, or publication dates.
    - If you cannot verify something with confidence, say so clearly.
    - Remain neutral, clear, and concise.
    - Only include sources that you are confident are real and reliable.
    
    --
    
    Context:
    This tool helps users fact-check statements they find on social media or in conversation. The goal is to correct misinformation with evidence-based facts and trusted sources.
    `;

    const response = await ai.models.generateContentStream({
        model: process.env.GEMMA_MODEL,
        config: {responseMimeType: 'text/plain'},
        contents: {role: 'user', parts: [{text: prompt}]},
    });

    let fullResponse = '';
    for await (const chunk of response) {
        fullResponse += chunk.text || '';
    }

    return fullResponse;
}

const responseCache = new NodeCache({stdTTL: 3600}); // Cache for 1 hour

app.use(compression());

// API endpoint
app.post('/api', async (req, res) => {
    const startTime = process.hrtime();
    logger.info('Received POST /api request', {payload: req.body});

    try {
        let content = await normalizeContent(req.body.content);
        content = enforceContentCharLimit(content);

        const cacheKey = content.toLowerCase().trim();
        const cachedResponse = responseCache.get(cacheKey);
        if (cachedResponse) {
            logger.info('Cache hit', {cacheKey});
            return res.status(200).json(cachedResponse);
        }

        let response = await gemma(content);
        response = removeJsonMarkdown(response);

        let json = await convertToValidJson(response);
        json = await checkErrorUrls(json);

        const [seconds, nanoseconds] = process.hrtime(startTime);
        logger.info('API call completed', {
            duration: `${seconds}s ${nanoseconds / 1000000}ms`
        });

        res.status(200).json(json);
        responseCache.set(cacheKey, json);
    } catch (err) {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        logger.error('Error processing POST /api request', {
            error: err.message,
            stack: err.stack,
            duration: `${seconds}s ${nanoseconds / 1000000}ms`
        });

        const status =
            err.name === 'AbortError' ? 408 :
                err instanceof SyntaxError ? 400 :
                    err.message && err.message.includes('HTTP error') ? 500 :
                        500;

        const error =
            err.name === 'AbortError' ? 'Request timed out.' :
                err instanceof SyntaxError ? 'Invalid JSON format or validation error.' :
                    err.message && err.message.includes('HTTP error') ? 'API request failed.' :
                        'Something went wrong.';

        res.status(status).json({error, code: err.name || 'ERROR', details: err.message});
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    logger.info('Health check endpoint accessed');
    res.status(200).json({status: 'OK'});
});

// 404 Not Found handler
app.use((req, res) => {
    logger.warn('404 Not Found', {url: req.originalUrl});
    res.status(404).json({error: 'Not Found'});
});

// Start server
app.listen(process.env.API_PORT, () => {
    logger.info('Server started', {
        port: process.env.API_PORT,
        url: `http://localhost:${process.env.API_PORT}`,
        environment: process.env.NODE_ENV || 'development'
    });
});
