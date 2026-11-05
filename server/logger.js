import winston from 'winston';
import fs from 'fs';
import path from 'path';

import AlertTransport from './alert-transport.js';
import { getTraceContext } from './trace.js';

const logDir = 'logs';

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const traceFormat = winston.format((info) => {
  const context = getTraceContext();
  if (context) {
    info.traceId = context.traceId;
    info.uid = context.uid;
    info.route = context.route;
    
    // Explicitly modify the format explicitly for terminal readability mapping
    info.message = `[Trace: ${context.traceId.slice(0,8)}] [UID: ${context.uid}] [Route: ${context.route}] ${info.message}`;
  }
  return info;
});

const customFormat = winston.format.combine(
  traceFormat(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'payment-server' },
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    new AlertTransport({ level: 'error' })
  ]
});

// If we're not in production then also log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
