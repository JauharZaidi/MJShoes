import logger from './logger.js';

// Non-fatal on purpose: logs a loud warning instead of crashing so local
// dev keeps working, but the gaps below are the ones that silently degrade
// production behavior (webhooks trusting the wrong secret, emails going to
// nowhere, rate limiting/idempotency falling back to a local Redis that
// isn't there) instead of failing loudly on their own.
export function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = [];
  if (!process.env.REDIS_URL) missing.push('REDIS_URL');
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) missing.push('RAZORPAY_WEBHOOK_SECRET');
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    missing.push('SMTP_HOST/SMTP_USER/SMTP_PASS');
  }

  if (missing.length > 0) {
    logger.error(
      `PRODUCTION STARTUP WARNING: missing env vars: ${missing.join(', ')}. ` +
      'Affected features are running in a degraded/insecure fallback (webhook signature may reuse RAZORPAY_SECRET, ' +
      'emails may go to a throwaway test inbox, Redis-backed features may default to 127.0.0.1). ' +
      'Set these in server/.env before going live.'
    );
  }
}
