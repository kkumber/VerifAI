const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();
// Load environment variables
if (!process.env.API_PORT) {
    console.error('API_PORT is not defined in .env file');
    process.exit(1); // Stop the server from starting
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

// API endpoint
app.post('/api', async (req, res) => {
    try {
        res.status(200).json({ response: 'Hello World!' });
    } catch (err) {
        res.status(500).json({ error: 'Something went wrong.' });
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
