import admin, { db } from './firebase-admin.js';
import logger from './logger.js';
import { emailQueue } from './queues.js';

// ──────────────────────────────────────────
// Distributed Idempotent Order Fulfillment
// ──────────────────────────────────────────
export async function fulfillOrder(razorpay_order_id, razorpay_payment_id, userId = null) {
  const fulfilledObj = await db.runTransaction(async (transaction) => {
    // Check if logic has already processed this Razorpay order
    const ordersRef = db.collection('orders');
    const orderQuery = await transaction.get(ordersRef.where('razorpayOrderId', '==', razorpay_order_id).limit(1));
    if (!orderQuery.empty) {
      return { success: true, orderId: orderQuery.docs[0].id, alreadyProcessed: true };
    }

    const pendingRef = db.collection('pending_orders').doc(razorpay_order_id);
    const pendingDoc = await transaction.get(pendingRef);

    if (!pendingDoc.exists) {
      throw new Error('Pending order not found');
    }

    const pendingOrder = pendingDoc.data();

    // Strict State Machine validation
    if (pendingOrder.status !== 'pending_payment') {
      throw new Error('Order is not in a valid state to be paid');
    }

    if (userId && pendingOrder.userId !== userId) {
      throw new Error('Unauthorized — order does not belong to you');
    }

    // Atomically decrement stock — both the per-size count (source of truth for
    // availability) and the aggregate total (used by low-stock/out-of-stock UI).
    for (const item of pendingOrder.items) {
      const productRef = db.collection('products').doc(item.product);
      const update = {
        stock: admin.firestore.FieldValue.increment(-item.quantity),
      };
      if (item.size !== undefined && item.size !== null) {
        update[`sizeStock.${item.size}`] = admin.firestore.FieldValue.increment(-item.quantity);
      }
      transaction.update(productRef, update);
    }

    // The coupon use is counted only now that the payment has gone through.
    if (pendingOrder.couponId) {
      transaction.update(db.collection('coupons').doc(pendingOrder.couponId), {
        usedCount: admin.firestore.FieldValue.increment(1),
      });
    }

    const newOrderRef = db.collection('orders').doc();
    transaction.set(newOrderRef, {
      ...pendingOrder,
      status: 'paid',
      paymentId: razorpay_payment_id,
      paymentMethod: 'razorpay',
      paidAt: new Date().toISOString(),
    });

    transaction.delete(pendingRef);

    return { success: true, orderId: newOrderRef.id, alreadyProcessed: false, pendingOrder };
  });

  // Execute external I/O (email) safely queueing it via BullMQ strictly decoupled
  if (fulfilledObj.success && fulfilledObj.pendingOrder && fulfilledObj.pendingOrder.shippingAddress?.email) {
    emailQueue.add('send-order-confirmation', {
      email: fulfilledObj.pendingOrder.shippingAddress.email,
      orderDetails: {
        id: fulfilledObj.orderId,
        amount: fulfilledObj.pendingOrder.totalAmount * 100
      }
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
    .catch(e => logger.warn('Order confirmation email enqueue fail'));
  }
  return fulfilledObj;
}
