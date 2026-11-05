import Razorpay from 'razorpay';
import { db } from './firebase-admin.js';
import logger from './logger.js';
import { fulfillOrder } from './fulfillment.js';

export async function runReconciliation() {
  logger.info('Starting daily Razorpay reconciliation job...');
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    // Fetch last 24 hours of payments from Razorpay
    const to = Math.floor(Date.now() / 1000);
    const from = to - (24 * 60 * 60);

    const payments = await razorpay.payments.all({
      from,
      to,
      count: 100 // Handle pagination if necessary for large scale
    });

    let fixedCount = 0;

    for (const payment of payments.items) {
      if (payment.status === 'captured') {
        const orderId = payment.order_id;
        if (!orderId) continue;

        // Check if DB explicitly has the order as captured
        const ordersRef = db.collection('orders');
        const orderQuery = await ordersRef.where('razorpayOrderId', '==', orderId).limit(1).get();
        
        if (orderQuery.empty) {
           // We have a payment captured in Razorpay, but NO order in our verified orders DB!
           logger.warn(`Reconciliation: Discovered orphaned payment ${payment.id} for order ${orderId}. Fulfilling forcefully.`);
           try {
             await fulfillOrder(orderId, payment.id);
             fixedCount++;
           } catch (e) {
             logger.error(`Reconciliation: Failed to forcefuly fix orphaned order ${orderId}: ${e.message}`);
           }
        }
      }
    }

    logger.info(`Reconciliation complete. Scanned ${payments.items.length} payments. Explicitly fixed ${fixedCount} mismatches.`);
  } catch (err) {
    logger.error('Reconciliation fatal error:', err);
  }
}
