import 'dotenv/config';
import app from './app.js';
import logger from './logger.js';
import { startWatchdog } from './monitor.js';

startWatchdog();

const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  logger.info(`Payment server running on port ${PORT}`);
  if (process.send) {
    process.send('ready'); // Native PM2 cluster handshake guarantees zero-loss routing
  }
});

// Zero-Downtime Deployment Trap
function gracefulShutdown() {
  logger.info('SIGTERM/SIGINT received. Halting new inbound TCP connections...');
  server.close(async () => {
    logger.info('Express server active connections drained gracefully.');
    process.exit(0);
  });

  // Failsafe 30s timeout
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Force quitting...');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
