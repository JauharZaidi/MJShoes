import logger from './logger.js';
import { webhookQueue, emailQueue } from './queues.js';

const DLQ_THRESHOLD_WEBHOOK = 10;
const DLQ_THRESHOLD_EMAIL = 20;
const ALERT_INTERVAL_MS = 5 * 60 * 1000; // 5 mins

export function startWatchdog() {
  logger.info('DLQ Watchdog initialized. Monitoring active queues.');

  setInterval(async () => {
    try {
      const webhookCounts = await webhookQueue.getJobCounts();
      const emailCounts = await emailQueue.getJobCounts();

      // Monitor Webhook DLQ
      if (webhookCounts.failed > DLQ_THRESHOLD_WEBHOOK) {
         // This explicitly logs as an error, inherently triggering the AlertTransport for critical attention
         logger.error(`CRITICAL: Webhook DLQ Spiked! ${webhookCounts.failed} failed jobs currently stalled. Max threshold is ${DLQ_THRESHOLD_WEBHOOK}.`);
      } else if (webhookCounts.failed > 0) {
         logger.warn(`Watchdog: ${webhookCounts.failed} failed webhook jobs detected.`);
      }

      // Monitor Email DLQ
      if (emailCounts.failed > DLQ_THRESHOLD_EMAIL) {
         logger.error(`CRITICAL: Email DLQ Spiked! ${emailCounts.failed} failed job emails. Check SMTP configuration.`);
      }

    } catch (err) {
       logger.error('Watchdog encountered an error gathering queue metrics:', err);
    }
  }, ALERT_INTERVAL_MS);
}
