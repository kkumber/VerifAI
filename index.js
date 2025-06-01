const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();
// Load environment variables
if (!process.env.API_PORT) {
    console.error('API_PORT is not defined in .env file');
    process.exit(1);
}
if (!process.env.OPENROUTER_API_KEY) {
    console.error('OPENROUTER_API_KEY is not defined in .env file');
    process.exit(1);
}


const app = express();

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Logging middleware
app.use(morgan('dev'));

async function helloWorld() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "model": "google/gemma-3n-e4b-it:free",
            "messages": [
                {
                    "role": "user",
                    "content": "Hello, world! Please respond with a friendly greeting."
                }
            ]
        })
    });

    clearTimeout(timeout);

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
}

// API endpoint
app.post('/api', async (req, res) => {
    try {
        console.time("API Call Duration");

        // --- JSDoc type definitions ---
        /**
         * @typedef {Object} Message
         * @property {string} role
         * @property {string} content
         */

        /**
         * @typedef {Object} Choice
         * @property {{ role: string, content: string }} message
         */

        /**
         * @typedef {Object} ApiResponse
         * @property {Choice[]} choices
         */

        /** @type {ApiResponse} */
        const data =  await helloWorld();

        console.timeEnd("API Call Duration");
        console.log("Full response:", data);

        let content = data.choices?.[0]?.message?.content;

        content = content
            .replace(/\s+$/g, '') // Remove trailing whitespace
            // .replace(/\n{2,}/g, '\n\n') // Normalize multiple line breaks to just two

        if (content) {
            console.log(content);
        } else {
            console.log("No valid message content.");
        }

        res.status(200).json({ message: content || 'No valid response from the API.' });
    } catch (err) {
        console.timeEnd("API Call Duration");

        const status =
            err.name === 'AbortError' ? 408 :
            err instanceof SyntaxError ? 400 :
            err.message && err.message.includes('HTTP error') ? 500 : 500;

        const error =
            err.name === 'AbortError' ? 'Request timed out.' :
            err instanceof SyntaxError ? 'Invalid JSON format.' :
            err.message && err.message.includes('HTTP error') ? 'API request failed.' :
            'Something went wrong.';

        console.error("Request failed:", err.message);

        res.status(status).json({ error, details: err.message });
    }
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});
// Fallback route for undefined paths
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Start the server
app.listen(process.env.API_PORT, () => console.log(`http://localhost:${process.env.API_PORT}`));
