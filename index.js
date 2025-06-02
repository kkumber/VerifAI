// noinspection JSCheckFunctionSignatures

const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');
const timeout = require('connect-timeout');
const rateLimit = require('express-rate-limit');

const {loadEnv} = require('./config/env');
const logger = require('./logger');
const corsMiddleware = require('./middlewares/cors');
const errorHandler = require('./middlewares/errorHandler');
const apiRoutes = require('./routes/api');

loadEnv();

const app = express();

// Middleware
app.use(corsMiddleware);
app.use(bodyParser.urlencoded({extended: true, limit: '1mb'}));
app.use(bodyParser.json({limit: '1mb'}));
app.use(compression());
app.use(timeout('15s'));

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {error: 'Too many requests. Please try again later.'},
});
app.use('/api', limiter);

// Routes
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
    logger.info('Health check endpoint accessed');
    res.status(200).json({status: 'OK'});
});

// 404 Handler
app.use((req, res) => {
    logger.warn('404 Not Found', {url: req.originalUrl});
    res.status(404).json({error: 'Not Found'});
});

// Central Error Handler
app.use(errorHandler);

// Server
app.listen(process.env.API_PORT, () => {
    logger.info('Server started', {
        port: process.env.API_PORT,
        url: `http://localhost:${process.env.API_PORT}`,
        environment: process.env.NODE_ENV || 'development',
    });
});
