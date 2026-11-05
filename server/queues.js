import { Queue } from 'bullmq';
import Redis from 'ioredis';
import logger from './logger.js';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Queue Configuration (Hardened defaults for memory safety & crash resilience)
const sharedJobOpts = {
  removeOnComplete: { age: 3600, count: 500 }, // Expire after 1 hr, keep history of 500
  removeOnFail: { age: 86400 * 7, count: 1000 }, // Keep fails for 7 days, max 1000
  // Note: there is no `timeout` field in BullMQ v5 job options (that was a `bull`-library
  // concept) — a stuck job is not force-failed by one. If a hard per-job timeout is ever
  // needed, implement it inside the processor (Promise.race) or tune lockDuration/stalledInterval
  // on the Worker instead of relying on a job option here.
};

export const webhookQueue = new Queue('webhook-events', {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null }),
  defaultJobOptions: sharedJobOpts
});

export const emailQueue = new Queue('email-events', {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null }),
  defaultJobOptions: sharedJobOpts
});

export const reconcileQueue = new Queue('reconcile-events', {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null }),
  defaultJobOptions: sharedJobOpts
});

export const cleanupQueue = new Queue('cleanup-events', {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null }),
  defaultJobOptions: sharedJobOpts
});

// Register the two recurring jobs. Registering a repeat job with the same pattern
// again just upserts it (BullMQ dedupes by repeat key), so this is safe to run from
// the single `mjstore-worker` instance without creating duplicate schedules.
reconcileQueue.add('daily-reconciliation', {}, {
  repeat: { pattern: '0 0 * * *' } // Midnight daily
}).catch(err => logger.error('Failed to register daily-reconciliation repeat job:', err));

cleanupQueue.add('weekly-cleanup', {}, {
  repeat: { pattern: '0 0 * * 0' } // Sunday midnight
}).catch(err => logger.error('Failed to register weekly-cleanup repeat job:', err));
