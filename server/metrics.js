import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

const orderSuccessCounter = new client.Counter({
  name: 'mjstore_orders_success_total',
  help: 'Total number of successfully captured orders',
});
const orderFailedCounter = new client.Counter({
  name: 'mjstore_orders_failed_total',
  help: 'Total number of failed transactions or webhooks',
});
export const imageOptimizationBytesCounter = new client.Counter({
  name: 'mjstore_image_optimization_bytes_total',
  help: 'Total bytes of images optimized via Sharp',
});
export const apiLatencyHistogram = new client.Histogram({
  name: 'mjstore_api_latency_ms',
  help: 'API latency in milliseconds',
  labelNames: ['route', 'method', 'status_code'],
  buckets: [50, 100, 300, 500, 1000, 3000]
});

register.registerMetric(orderSuccessCounter);
register.registerMetric(orderFailedCounter);
register.registerMetric(imageOptimizationBytesCounter);
register.registerMetric(apiLatencyHistogram);

export const externalApiCounter = new client.Counter({
  name: 'mjstore_external_api_calls_total',
  help: 'Total number of costly external API calls'
});
register.registerMetric(externalApiCounter);

export const queueProcessedCounter = new client.Counter({
  name: 'mjstore_queue_processed_total',
  help: 'Total number of successfully executed background isolated queues'
});
register.registerMetric(queueProcessedCounter);

export const cartAbandonedCounter = new client.Counter({
  name: 'mjstore_cart_abandoned_total',
  help: 'Total number of explicitly abandoned carts tracked from client sessions'
});
register.registerMetric(cartAbandonedCounter);

export function recordMetric(type) {
  if (type === 'success') orderSuccessCounter.inc();
  if (type === 'failure') orderFailedCounter.inc();
  if (type === 'queue_job') queueProcessedCounter.inc();
}
