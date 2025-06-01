const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const timeout = require('connect-timeout');
const {z} = require('zod');
const {GoogleGenAI} = require('@google/genai');

dotenv.config();

// Validate environment variables
['API_PORT', 'GEMMA_API_KEY'].forEach((key) => {
    if (!process.env[key]) {
        console.error(`${key} is not defined in .env file`);
        process.exit(1);
    }
});

const app = express();
// Middleware setup
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// Request timeout
app.use(timeout('30s'));

function enforceContentCharLimit(content) {
    const limit = parseInt(process.env.CONTENT_CHAR_LIMIT, 10) || 1000;
    if (content.length > limit) {
        throw new SyntaxError(`Content exceeds character limit of ${limit}.`);
    }
    return content;
}

async function normalizeContent(content) {
    if (typeof content !== 'string') {
        console.error("Input is not a string:", content);
        throw new SyntaxError('Invalid JSON format. Expected a string.');
    }
    return content
        .replace(/[^\x20-\x7E\n\r\t]/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim();
}

function removeJsonMarkdown(jsonString) {
    return jsonString.replace(/^```json\s*|^```\s*|```$/gm, '').trim();
}

const gemmaResponseSchema = z.object({
    verdict: z.enum(["True", "False", "Partially True", "Unverifiable"]),
    errors: z.array(z.object({
        claim: z.string(),
        correction: z.string(),
        reason: z.string(),
        source: z.string(),
        url: z.string().url()
    })),
    overall_reason: z.string(),
    related_topics: z.array(z.string())
});

async function convertToValidJson(response) {
    try {
        const json = JSON.parse(response);
        return gemmaResponseSchema.parse(json);
    } catch (parseErr) {
        throw new SyntaxError('AI response is not valid or does not match schema.');
    }
}
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

app.post('/api', async (req, res) => {
    console.time("API Call Duration");
    try {
        let content = await normalizeContent(req.body.content);
        content = enforceContentCharLimit(content);
        let response = await gemma(content);
        response = removeJsonMarkdown(response);
        const json = await convertToValidJson(response);

        console.timeEnd("API Call Duration");
        res.status(200).json(json);
    } catch (err) {
        console.timeEnd("API Call Duration");
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

        console.error("Request failed:", err.message);
        res.status(status).json({ error, code: err.name || 'ERROR', details: err.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({status: 'OK'});
});

// 404 Not Found handler
app.use((req, res) => {
    res.status(404).json({error: 'Not Found'});
});

app.listen(process.env.API_PORT, () => console.log(`http://localhost:${process.env.API_PORT}`));
