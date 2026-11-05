import redis from './redis.js';
import logger from './logger.js';

const WINDOW_SECS = 60; // 1 min window
const THRESHOLD = 50;   // Start slowing after 50 reqs

export const adaptiveThrottleMiddleware = async (req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api/images/')) return next();
  // req.ip honours app's 'trust proxy' setting; the raw X-Forwarded-For header
  // is client-controlled and would let anyone dodge the throttle.
  const ip = req.ip;
  const key = `throttle:${ip}`;
  
  try {
    const hits = await redis.incr(key);
    if (hits === 1) {
      await redis.expire(key, WINDOW_SECS);
    }
    
    if (hits > THRESHOLD) {
      // Escalating latency logarithmically: (51 - 50) * 100ms = 100ms up to bounds
      const delayMs = Math.min((hits - THRESHOLD) * 200, 2500); 
      logger.warn(`Adaptive Throttler: Delaying IP ${ip} artificially by ${delayMs}ms (Hit ${hits})`);
      setTimeout(next, delayMs);
      return;
    }
    next();
  } catch(err) {
    logger.error('Throttler Exception, degraded fail-open:', err);
    next();
  }
};
