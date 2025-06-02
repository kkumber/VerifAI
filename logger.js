const winston = require('winston');
const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        // Console output
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // File output - error logs
        new winston.transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error'
        }),
        // File output - all logs
        new winston.transports.File({
            filename: path.join('logs', 'combined.log')
        }),
        // Add to transports:
        new DailyRotateFile({
            filename: path.join('logs', '%DATE%-combined.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d'
        })
    ]
});

module.exports = logger;
