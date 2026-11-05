import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import logger from './logger.js';
import redis from './redis.js';
import { fulfillOrder } from './fulfillment.js';
import { recordMetric } from './metrics.js';
import { db } from './firebase-admin.js';
import { sendPaymentFailure, sendOrderConfirmation } from './mailer.js';
import { runReconciliation } from './reconcile.js';
import { runRetentionCleanup } from './cleanup.js';
import { traceStorage } from './trace.js';
import { validateProductionEnv } from './env-check.js';
import { emailQueue } from './queues.js';
import crypto from 'crypto';

validateProductionEnv();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const worker = new Worker('webhook-events', async job => {
  const { event, eventId } = job.data;

  // Wrap entire processing loop natively inside OpenTelemetry-like trace contexts
  return traceStorage.run({ traceId: eventId || crypto.randomUUID() }, async () => {
    logger.info(`Worker processing webhook job ${job.id} for event ${eventId}`);

  if (event.event === 'payment.captured') {
    const paymentData = event.payload.payment.entity;
    const razorpay_order_id = paymentData.order_id;
    const razorpay_payment_id = paymentData.id;

    const result = await fulfillOrder(razorpay_order_id, razorpay_payment_id);
    if (result.alreadyProcessed) {
      logger.info(`Worker: Webhook Order ${razorpay_order_id} already processed. Skipping.`);
    } else {
      logger.info(`Worker: Successfully fulfilled order ${razorpay_order_id}`);
      recordMetric('success');
    }
  } else if (event.event === 'payment.failed') {
    const paymentData = event.payload.payment.entity;
    const razorpay_order_id = paymentData.order_id;
    logger.warn(`Worker: Payment failed event for ${paymentData.id} (Order: ${razorpay_order_id})`);

    try {
      const orderRef = db.collection('pending_orders').doc(razorpay_order_id);
      const doc = await orderRef.get();
      if (doc.exists && doc.data().status === 'pending_payment') {
        await orderRef.update({
           status: 'failed',
           failedAt: new Date().toISOString()
        });
        if (paymentData.email) {
          await emailQueue.add('send-payment-failure', { email: paymentData.email, orderId: razorpay_order_id }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
        }
      } else {
        logger.info(`Worker: Order ${razorpay_order_id} is not in pending_payment state or doesn't exist.`);
      }
    } catch (e) {
       logger.info(`Worker: Could not update failed status for ${razorpay_order_id} (not pending)`);
    }
  }

  // Mark the event as fully processed only now that it has actually succeeded —
  // marking it at ingestion (in app.js, before this job ran) meant a job that
  // exhausted all its retries would be permanently skipped, since Razorpay
  // wouldn't redeliver a webhook that already got a 200 OK.
  try {
    await redis.set(`processed_webhook:${eventId}`, '1', 'EX', 86400 * 2);
  } catch (e) {
    logger.warn(`Failed to set processed_webhook flag for ${eventId}:`, e.message);
  }
  }); // End trace wrap
}, {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null }), // Isolated connection for blocking Worker loop
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000,
  }
});

worker.on('completed', job => {
  logger.info(`Worker: Job ${job.id} has completed successfully!`);
  recordMetric('queue_job');
});

worker.on('failed', (job, err) => {
  if (job && job.attemptsMade === job.opts.attempts) {
    logger.error(`Worker: CRITICAL Alert! Job ${job?.id} failed completely after ${job.attemptsMade} attempts. Error: ${err.message}`);
  } else {
    logger.warn(`Worker: Job ${job?.id} failed attempt ${job?.attemptsMade} with ${err.message}`);
  }
});

export const emailWorker = new Worker('email-events', async job => {
  if (job.name === 'send-order-confirmation') {
    await sendOrderConfirmation(job.data.email, job.data.orderDetails);
  } else if (job.name === 'send-payment-failure') {
    await sendPaymentFailure(job.data.email, job.data.orderId);
  }
}, {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null }),
  concurrency: 10
});

emailWorker.on('failed', (job, err) => {
  logger.error(`Email Worker: Job ${job?.id} (${job?.name}) failed: ${err.message}`);
});

export const reconcileWorker = new Worker('reconcile-events', async job => {
  if (job.name === 'daily-reconciliation') {
     await runReconciliation();
  }
}, {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null }),
  concurrency: 1
});

reconcileWorker.on('failed', (job, err) => {
  logger.error(`Reconcile Worker: Job failed: ${err.message}`);
});

export const cleanupWorker = new Worker('cleanup-events', async job => {
  if (job.name === 'weekly-cleanup') {
     await runRetentionCleanup();
  }
}, {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null }),
  concurrency: 1
});

cleanupWorker.on('failed', (job, err) => {
  logger.error(`Cleanup Worker: Job failed: ${err.message}`);
});

// Graceful Lifecycle Teardown
async function shutdown() {
  logger.info('Shutting down workers gracefully...');
  await Promise.all([worker.close(), emailWorker.close(), reconcileWorker.close(), cleanupWorker.close()]);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default worker;
