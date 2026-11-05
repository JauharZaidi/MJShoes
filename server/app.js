import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import RedisStore from 'rate-limit-redis';
import multer from 'multer';
import sharp from 'sharp';
import logger from './logger.js';
import { CircuitBreaker } from './breaker.js';
import redis from './redis.js';
import admin, { db } from './firebase-admin.js';
import { webhookQueue } from './queues.js';
import { fulfillOrder } from './fulfillment.js';
import {
  register,
  recordMetric,
  imageOptimizationBytesCounter,
  apiLatencyHistogram,
  externalApiCounter,
  cartAbandonedCounter,
} from './metrics.js';
import { traceMiddleware, setTraceUserId } from './trace.js';
import { adaptiveThrottleMiddleware } from './throttle.js';
import { validateProductionEnv } from './env-check.js';

validateProductionEnv();

// ──────────────────────────────────────────
// 2. Razorpay Init
// ──────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});

const razorpayBreaker = new CircuitBreaker('RazorpayAPI', 3, 30000);

// ──────────────────────────────────────────
// 2b. Multer Setup for Image Upload
// ──────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WebP are allowed.`));
    }
  },
});

// ──────────────────────────────────────────
// 3. Express App Setup & Global Middlewares
// ──────────────────────────────────────────
const app = express();

// In production every request arrives through Vercel's rewrite and Railway's
// edge proxy, so without this req.ip is the proxy's address and every customer
// shares one rate-limit bucket. Vercel overwrites X-Forwarded-For with the real
// client IP and Railway appends its own hop — hence 2. Override with
// TRUST_PROXY_HOPS if the hosting chain changes.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === 'production' ? 2 : 0)));

app.use(traceMiddleware);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature', 'Idempotency-Key'],
}));

// We use express.raw for the webhook to access the raw buffer required for signature verification
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// For all other routes, parse JSON bodies
app.use(express.json({ limit: '10kb' }));

// Full Observability API Latency Measurement Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Map wildcard paths intelligently if caught by the router to avoid cardinality explosion
    const routePattern = req.route ? req.route.path : req.path;
    apiLatencyHistogram.labels(routePattern, req.method, res.statusCode).observe(duration);
  });
  next();
});

// ──────────────────────────────────────────
// 4. Rate Limiting Setup
// ──────────────────────────────────────────
// Every RedisStore below needs its own `prefix`. express-rate-limit's
// internal double-count guard groups stores by `store.constructor.name`
// (just "RedisStore" for all of them, since none set `localKeys`) plus
// `store.prefix + key` — with the shared default prefix ("rl:") every
// limiter here was reading/writing the SAME Redis counter per IP, so they
// weren't actually enforcing independent budgets, and express-rate-limit's
// own consistency check on this threw ERR_ERL_DOUBLE_COUNT for any request
// that passed through more than one limiter (i.e. almost every request,
// since globalLimiter runs on all of them). See ERR_ERL_DOUBLE_COUNT docs.
const globalLimiter = rateLimit({
  store: new RedisStore({ prefix: 'rl:global:', sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Product photos are cached reads; one shop page loads a dozen of them.
  skip: (req) => req.method === 'GET' && req.path.startsWith('/api/images/'),
});
app.use(globalLimiter);
app.use(adaptiveThrottleMiddleware);

const createOrderLimiter = rateLimit({
  store: new RedisStore({ prefix: 'rl:create-order:', sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many order attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookLimiter = rateLimit({
  store: new RedisStore({ prefix: 'rl:webhook:', sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many webhook requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = rateLimit({
  store: new RedisStore({ prefix: 'rl:contact:', sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many contact requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ──────────────────────────────────────────
// 5. Auth Middleware
// ──────────────────────────────────────────
async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }
  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    req.email = decoded.email;
    setTraceUserId(decoded.uid);
    next();
  } catch (err) {
    logger.error('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized — invalid token' });
  }
}

// ──────────────────────────────────────────
// 5b. Distributed Fraud & Anomaly Middleware (Redis)
// ──────────────────────────────────────────
async function fraudGuard(req, res, next) {
  try {
    const fraudKey = `fraud_pts:${req.uid}`;
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;

    // Remove old entries (older than 15 mins)
    await redis.zremrangebyscore(fraudKey, '-inf', fifteenMinsAgo);

    // Calculate score using redis time-series sets
    const attempts = await redis.zcount(fraudKey, fifteenMinsAgo, '+inf');
    const riskScore = attempts * 10;

    if (riskScore >= 50) {
      logger.warn(`Distributed fraud guard tripped for user ${req.uid}. Score: ${riskScore}. IP: ${req.ip}`);
      return res.status(429).json({ error: 'Checkout disabled due to unusual activity. Try again later.' });
    }
    next();
  } catch (err) {
    logger.error('Fraud guard error:', err);
    next(); // Fail open: do not block legitimate users if Redis briefly fails
  }
}

// Mirrors src/utils/pricing.js (display side) — keep the two in sync.
// Products without their own delivery charge keep the old flat ₹499; an order
// ships as one parcel, so it pays the highest charge in it, free from ₹15,000.
const FREE_SHIPPING_THRESHOLD = 15000;
const DEFAULT_SHIPPING_CHARGE = 499;
function shippingChargeOf(product) {
  const n = Number(product.shippingCharge);
  return product.shippingCharge !== undefined && product.shippingCharge !== '' && !isNaN(n) && n >= 0 ? n : DEFAULT_SHIPPING_CHARGE;
}
function computeShipping(items, subtotal) {
  if (items.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return Math.max(...items.map(i => i.shippingCharge));
}

function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>'"&]/g, '');
}

// Constant-time comparison for HMAC signatures — a plain `!==` short-circuits
// on the first differing byte, which is a (low-severity but standard-to-close)
// timing side-channel for anything that compares attacker-suppliable signatures.
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function verifyAdmin(req, res, next) {
  try {
    const userDoc = await db.collection('users').doc(req.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden — admin access required' });
    }
    next();
  } catch (err) {
    logger.error('Admin verification error:', err);
    return res.status(500).json({ error: 'Failed to verify admin role' });
  }
}

async function trackAdminAction(req, res, next) {
  try {
    await db.collection('admin_logs').add({
      uid: req.uid,
      email: req.email,
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    logger.warn('Failed to log admin action:', err.message);
  }
  next();
}

// ──────────────────────────────────────────
// 6. POST /api/contact
// ──────────────────────────────────────────
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (name.trim().length === 0 || email.trim().length === 0 || message.trim().length === 0) {
      return res.status(400).json({ error: 'Fields cannot be empty' });
    }

    // Input length limits
    if (name.length > 100) return res.status(400).json({ error: 'Name must be under 100 characters' });
    if (email.length > 254) return res.status(400).json({ error: 'Invalid email address' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message must be under 2000 characters' });

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    // Basic sanitization
    const sanitizedName = sanitize(name);
    const sanitizedEmail = sanitize(email);
    const sanitizedMessage = sanitize(message);

    await db.collection('contact_queries').add({
      name: sanitizedName,
      email: sanitizedEmail,
      message: sanitizedMessage,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ip: req.ip
    });

    logger.info(`Contact message received from ${sanitizedEmail}`);
    res.json({ success: true, message: "Thanks — we've got your message and will reply by email soon." });
  } catch (err) {
    logger.error('Contact API Error:', err);
    res.status(500).json({ error: 'Internal server error while sending message' });
  }
});

// ──────────────────────────────────────────
// 7. POST /api/coupons/validate
// ──────────────────────────────────────────
app.post('/api/coupons/validate', createOrderLimiter, async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code || typeof subtotal !== 'number') return res.status(400).json({ error: 'Invalid coupon payload' });

    const couponStr = code.toUpperCase().trim();
    const couponQuery = await db.collection('coupons').where('code', '==', couponStr).limit(1).get();

    if (couponQuery.empty) return res.status(404).json({ error: 'Coupon not found' });

    const coupon = couponQuery.docs[0].data();

    // Validations
    if (new Date() > new Date(coupon.expiryDate)) return res.status(400).json({ error: 'Coupon has expired' });
    if (coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ error: 'Coupon usage limit reached' });
    if (subtotal < coupon.minOrderValue) return res.status(400).json({ error: `Minimum order value of ₹${coupon.minOrderValue} required` });

    let discountApplied = 0;
    if (coupon.discountType === 'percentage') {
       discountApplied = Math.round(subtotal * (coupon.value / 100));
    } else {
       discountApplied = coupon.value;
    }

    // Never let discount exceed subtotal
    if (discountApplied > subtotal) discountApplied = subtotal;

    res.json({
      valid: true,
      originalSubtotal: subtotal,
      discountApplied,
      finalSubtotal: subtotal - discountApplied,
      discountType: coupon.discountType,
      value: coupon.value,
      minOrderValue: coupon.minOrderValue || 0,
      message: `${couponStr} applied directly! (-₹${discountApplied})`
    });
  } catch (err) {
    logger.error('Coupon validation error:', err);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// ──────────────────────────────────────────
// 8. POST /api/payment/create-order
// ──────────────────────────────────────────
app.post('/api/payment/create-order', createOrderLimiter, verifyAuth, fraudGuard, async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header is required' });
  }

  // Bind the key to the request contents: a repeat click with the same cart is
  // deduped, but if the customer closes the Razorpay popup and changes their
  // cart/coupon/address, that's a new order, not a replay of the old amount.
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex').slice(0, 16);
  const keyString = `idempotency:${idempotencyKey}:${bodyHash}`;

  try {
    const existingRaw = await redis.get(keyString);
    if (existingRaw) {
      const stateObj = JSON.parse(existingRaw);
      if (stateObj.status === 'pending') {
        logger.warn(`Idempotency: Blocked duplicate concurrent request (PENDING). Key: ${idempotencyKey}`);
        return res.status(409).json({ error: 'Order is currently processing. Do not double click.' });
      } else if (stateObj.status === 'completed') {
        logger.info(`Idempotency: Re-serving successful idempotency mapped sequence (${idempotencyKey})`);
        return res.status(200).json(stateObj.responseData);
      }
      // If 'failed', we allow them to organically fall through and natively process a fresh Razorpay hook again down below.
    }

    // Set lock officially into distributed PENDING state natively
    await redis.set(keyString, JSON.stringify({ status: 'pending' }), 'EX', 86400);

  } catch(e) {
    logger.error('Redis Idempotency state validation failed natively:', e);
    // Fail open safely on cache crash
  }

  try {
    const { items, shippingAddress, couponCode } = req.body;

    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    if (!shippingAddress || !shippingAddress.firstName || !shippingAddress.address || !shippingAddress.city) {
      return res.status(400).json({ error: 'Invalid shipping address' });
    }

    let subtotal = 0;
    const verifiedItems = [];
    const requested = {};

    for (const item of items) {
      // Strict types: a string or fractional quantity would pass loose
      // comparisons here but break the stock decrement after payment.
      if (typeof item.productId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(item.productId) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
        return res.status(400).json({ error: `Invalid item: ${String(item.productId).slice(0, 64)}` });
      }

      // Try fetching from Redis products cache
      const cacheKey = `product:${item.productId}`;
      let product = null;
      let cachedRaw = await redis.get(cacheKey);

      if (cachedRaw) {
         product = JSON.parse(cachedRaw);
      } else {
         const productDoc = await db.collection('products').doc(item.productId).get();
         if (!productDoc.exists) {
           return res.status(400).json({ error: `Product not found: ${item.productId}` });
         }
         product = productDoc.data();
         await redis.set(cacheKey, JSON.stringify(product), 'EX', 3600); // 1 hour cache
      }

      if (product.available === false) {
        return res.status(400).json({ error: `${product.name} is no longer available` });
      }

      // Per-size stock is the source of truth once a product has been edited to use it;
      // legacy products that predate sizeStock fall back to the aggregate stock field.
      const sizeKey = item.size !== undefined && item.size !== null ? String(item.size) : null;
      // A product with per-size stock only sells the sizes it lists — an
      // unknown size must not fall back to the aggregate count.
      if (product.sizeStock && (sizeKey === null || !Object.prototype.hasOwnProperty.call(product.sizeStock, sizeKey))) {
        return res.status(400).json({ error: `${product.name} isn't available in size ${sizeKey ?? 'N/A'}` });
      }
      const availableStock = (product.sizeStock && sizeKey !== null && Object.prototype.hasOwnProperty.call(product.sizeStock, sizeKey))
        ? product.sizeStock[sizeKey]
        : product.stock;

      // Count the same product+size across all cart lines, so splitting an
      // order into several lines can't oversell.
      const reqKey = `${item.productId}|${sizeKey}`;
      requested[reqKey] = (requested[reqKey] || 0) + item.quantity;
      if (availableStock < requested[reqKey]) {
        return res.status(400).json({ error: `${product.name} (size ${item.size || 'N/A'}) is out of stock (${availableStock} left)` });
      }

      subtotal += product.price * item.quantity;
      verifiedItems.push({
        product: item.productId,
        name: product.name,
        image: product.images?.[0] || '/images/shoe-white.png',
        price: product.price,
        size: item.size || 'N/A',
        sizeType: item.sizeType || product.sizeType || 'UK',
        quantity: item.quantity,
        shippingCharge: shippingChargeOf(product),
      });
    }

    let discountApplied = 0;
    let couponId = null;

    // Coupon is re-validated here; the customer is told if it no longer applies
    // instead of silently being charged full price. Its use is counted in
    // fulfillOrder, once payment actually succeeds — not here, or abandoned
    // checkouts would burn through the usage limit.
    if (couponCode) {
      const parsedCode = String(couponCode).toUpperCase().trim();
      const couQ = await db.collection('coupons').where('code', '==', parsedCode).limit(1).get();
      if (couQ.empty) return res.status(400).json({ error: `Coupon ${parsedCode} is not valid` });
      const coupon = couQ.docs[0].data();
      if (new Date() > new Date(coupon.expiryDate)) return res.status(400).json({ error: `Coupon ${parsedCode} has expired` });
      if ((coupon.usedCount || 0) >= coupon.usageLimit) return res.status(400).json({ error: `Coupon ${parsedCode} has been fully used` });
      if (subtotal >= (coupon.minOrderValue || 0)) {
        discountApplied = Math.min(subtotal, coupon.discountType === 'percentage'
          ? Math.round(subtotal * (coupon.value / 100))
          : coupon.value);
        couponId = couQ.docs[0].id;
        logger.info(`Coupon ${parsedCode} validated. Discount applied: ₹${discountApplied}`);
      }
    }

    const shippingCost = computeShipping(verifiedItems, subtotal);
    const discountedTotal = subtotal - discountApplied;
    const tax = Math.round(discountedTotal * 0.18);
    const totalAmount = discountedTotal + shippingCost + tax;
    const amountInPaise = totalAmount * 100;

    const razorpayOrder = await razorpayBreaker.fire(() => {
      externalApiCounter.inc(); // Explicitly count outbound costs
      return razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `order_${Date.now()}`,
        notes: {
          userId: req.uid,
          email: req.email,
          couponCode: couponCode ? String(couponCode).toUpperCase() : 'None',
        },
      });
    });

    // Record attempt in Redis time-series for fraud guard
    const fraudKey = `fraud_pts:${req.uid}`;
    await redis.zadd(fraudKey, Date.now(), razorpayOrder.id);

    if (global.CHAOS_FIRESTORE_DELAY) {
      logger.warn('Chaos: Injecting explicit 5000ms latency simulating DB degradation');
      await new Promise(r => setTimeout(r, 5000));
    }

    await db.collection('pending_orders').doc(razorpayOrder.id).set({
      userId: req.uid,
      items: verifiedItems,
      shippingAddress: {
        firstName: sanitize(shippingAddress.firstName),
        lastName: sanitize(shippingAddress.lastName),
        email: sanitize(shippingAddress.email),
        phone: sanitize(shippingAddress.phone),
        address: sanitize(shippingAddress.address),
        city: sanitize(shippingAddress.city),
        state: sanitize(shippingAddress.state),
        zip: sanitize(shippingAddress.zip),
        country: sanitize(shippingAddress.country),
      },
      subtotal,
      discountApplied,
      shippingCost,
      tax,
      totalAmount,
      couponCode: couponId ? String(couponCode).toUpperCase().trim() : null,
      couponId,
      razorpayOrderId: razorpayOrder.id,
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
    });

    logger.info(`Created Razorpay Order ${razorpayOrder.id} for user ${req.uid}`);

    const responsePayload = {
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
    };

    // Safely lock into distributed completed state arrays resolving the mapped ID
    await redis.set(keyString, JSON.stringify({
      status: 'completed',
      responseData: responsePayload
    }), 'EX', 86400);

    res.json(responsePayload);
  } catch (err) {
    logger.error('Create order error processing pipeline catch (marking failed):', err);
    try {
      await redis.set(keyString, JSON.stringify({ status: 'failed' }), 'EX', 86400);
    } catch(redisErr) {}
    res.status(500).json({ error: 'Failed to create order securely' });
  }
});

// ──────────────────────────────────────────
// 9. POST /api/payment/verify (Frontend Fallback)
// ──────────────────────────────────────────
app.post('/api/payment/verify', verifyAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    // Verify signature cryptographically
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_SECRET)
      .update(body)
      .digest('hex');

    if (!safeCompare(expectedSignature, razorpay_signature)) {
      logger.error('Payment signature mismatch during frontend verification!');
      return res.status(400).json({ error: 'Payment verification failed — signature mismatch' });
    }

    // Verify status securely with Razorpay directly through Circuit Breaker
    const payment = await razorpayBreaker.fire(() => razorpay.payments.fetch(razorpay_payment_id));
    if (payment.status !== 'captured' || payment.order_id !== razorpay_order_id) {
      logger.error(`Payment ${razorpay_payment_id} was not fully captured on Razorpay.`);
      return res.status(400).json({ error: 'Payment has not been captured yet' });
    }

    // Process idempotently via transaction
    const result = await fulfillOrder(razorpay_order_id, razorpay_payment_id, req.uid);

    if (result.alreadyProcessed) {
      logger.info(`Order ${razorpay_order_id} was already fulfilled (likely by webhook). Returned cached success.`);
    } else {
      logger.info(`Order ${razorpay_order_id} successfully fulfilled via frontend verification fallback.`);
      recordMetric('success');
    }

    res.json({
      success: true,
      orderId: result.orderId,
      message: 'Payment verified and order confirmed',
    });
  } catch (err) {
    logger.error('Verify payment error:', err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// ──────────────────────────────────────────
// 10. POST /api/payment/webhook (Backend Source of Truth)
// ──────────────────────────────────────────
app.post('/api/payment/webhook', webhookLimiter, async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body; // express.raw makes this a Buffer

    // A dedicated webhook secret (set in the Razorpay dashboard) is required in
    // production — falling back to the payment API secret would mean anyone who
    // ever learns that key elsewhere could also forge webhook payloads.
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
      || (process.env.NODE_ENV !== 'production' ? process.env.RAZORPAY_SECRET : null);

    if (!secret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET is not configured in production. Rejecting webhook.');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify razorpay webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody.toString('utf8'))
      .digest('hex');

    if (!safeCompare(expectedSignature, signature)) {
      logger.warn('Webhook signature mismatch. Possible unauthorized access attempt.');
      return res.status(400).json({ error: 'Invalid Signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventId = req.headers['x-razorpay-event-id'] || event.event_id || `webhook_${crypto.randomUUID()}`;

    logger.info(`Webhook Ingested into Queue Server: ${event.event} (${eventId})`);

    // Fast path only: this flag is set by the worker AFTER a webhook job succeeds
    // (see worker.js), not at ingestion — so a job that fails all its retries can
    // still be re-enqueued by a redelivered webhook instead of being silently
    // dropped forever. Enqueueing itself is still safely deduped by BullMQ's
    // jobId (eventId) below.
    const alreadyProcessed = await redis.get(`processed_webhook:${eventId}`);
    if (alreadyProcessed) {
      logger.info(`Webhook ${eventId} already fully processed. Ignoring duplicate.`);
      return res.json({ status: 'ignored', msg: 'Duplicate event dropped' });
    }

    // Pushing onto BullMQ Queue for robust isolation execution
    await webhookQueue.add('process-webhook', { event, eventId }, {
       jobId: eventId,  // Bullmq naturally guarantees unique job ID idempotency
       attempts: 3,
       backoff: {
         type: 'exponential',
         delay: 5000
       }
    });

    res.json({ status: 'ok', msg: 'Queued' });
  } catch (err) {
    logger.error('Webhook ingestion error:', err);
    res.status(400).send('Webhook Ingestion Error');
  }
});

// ──────────────────────────────────────────
// 11. Health & Error Handling
// ──────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const isRedisHealthy = redis.status === 'ready';
    let isDbHealthy = false;
    try { await db.collection('products').limit(1).get(); isDbHealthy = true; } catch (e) {}

    // Queue#client resolves to the underlying ioredis client (it's a Promise, not the client itself)
    const isBullMqHealthy = (await webhookQueue.client).status === 'ready';
    const queueCounts = isBullMqHealthy ? await webhookQueue.getJobCounts() : {};

    const isHealthy = isRedisHealthy && isDbHealthy && isBullMqHealthy;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      dependencies: {
        redis: isRedisHealthy ? 'connected' : 'disconnected',
        firestore: isDbHealthy ? 'connected' : 'disconnected',
        bullmq: isBullMqHealthy ? 'connected' : 'disconnected'
      },
      queueCounts,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Health check fatal error:', err);
    res.status(503).json({ status: 'error', reason: 'Exception in health check' });
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ──────────────────────────────────────────
// 12. Custom Metrics Exposer
// ──────────────────────────────────────────
app.get('/api/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.post('/api/metrics/abandonment', async (req, res) => {
  try {
     const { sessionTag } = req.body;
     const tag = sessionTag || req.ip;

     // 1 Hour debouncer caching using redis to absolutely prevent spam metrics double counts
     const debounceResult = await redis.setnx(`abandonment:${tag}`, 1);
     if (debounceResult === 1) {
       await redis.expire(`abandonment:${tag}`, 3600);
       cartAbandonedCounter.inc();
       logger.info(`Session Abandonment verified and logged securely for identifier: ${tag}`);
     }
     res.sendStatus(200);
  } catch(e) {
     res.sendStatus(500);
  }
});

// ──────────────────────────────────────────
// 13. Add GET /api/order/status/:id
// ──────────────────────────────────────────
app.get('/api/order/status/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[A-Za-z0-9_]{1,64}$/.test(id)) return res.status(404).json({ error: 'Order not found' });

    // Customers see the order's own ID (Account page, emails); the success page
    // polls with the Razorpay order ID. Accept either.
    const summary = (orderId, data) => ({
      status: data.status,
      orderId,
      totalAmt: data.totalAmount ?? null,
      paymentId: data.paymentId || null,
      createdAt: data.createdAt || null,
      updatedAt: data.statusUpdatedAt || data.paidAt || data.createdAt || null,
    });

    const direct = await db.collection('orders').doc(id).get();
    if (direct.exists) {
      const data = direct.data();
      if (data.userId !== req.uid) return res.status(403).json({ error: 'Forbidden' });
      return res.json(summary(direct.id, data));
    }

    // Check main orders
    const orderDoc = await db.collection('orders').where('razorpayOrderId', '==', id).limit(1).get();
    if (!orderDoc.empty) {
      const data = orderDoc.docs[0].data();
      if (data.userId !== req.uid) return res.status(403).json({ error: 'Forbidden' });
      return res.json(summary(orderDoc.docs[0].id, data));
    }

    // Check pending_orders
    const pendingDoc = await db.collection('pending_orders').doc(id).get();
    if (pendingDoc.exists) {
      const data = pendingDoc.data();
      if (data.userId !== req.uid) return res.status(403).json({ error: 'Forbidden' });
      return res.json(summary(id, data));
    }

    return res.status(404).json({ error: 'Order not found' });
  } catch (err) {
    logger.error('Order status endpoint failure', err);
    return res.status(500).json({ error: 'Internal failure retrieving status' });
  }
});

// ──────────────────────────────────────────
// 14. POST /api/admin/upload-images
// ──────────────────────────────────────────
const adminLimiter = rateLimit({
  store: new RedisStore({ prefix: 'rl:admin:', sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 50,
});
app.post('/api/admin/upload-images', verifyAuth, verifyAdmin, trackAdminAction, adminLimiter, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    // Photos live in Firestore (product_images) rather than Cloud Storage so the
    // store runs on the free Spark plan: an 800px WebP is ~50–150 KB, well under
    // Firestore's 1 MiB document limit, and GET /api/images/:id serves them with
    // long-lived cache headers plus a Redis cache to keep Firestore reads low.
    const urls = [];

    for (const file of req.files) {
      const optimizedBuffer = await sharp(file.buffer)
        .rotate() // honour EXIF orientation from phone cameras
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      imageOptimizationBytesCounter.inc(file.buffer.length);

      if (optimizedBuffer.length > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: `${file.originalname} is too detailed to store — try a smaller or simpler photo` });
      }

      const ref = await db.collection('product_images').add({
        data: optimizedBuffer,
        contentType: 'image/webp',
        bytes: optimizedBuffer.length,
        uploadedBy: req.uid,
        createdAt: new Date().toISOString(),
      });
      urls.push(`/api/images/${ref.id}`);
    }

    logger.info(`Admin ${req.uid} uploaded ${urls.length} images`);
    res.json({ urls });
  } catch (err) {
    logger.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// ──────────────────────────────────────────
// 14c. Admin: contact-form messages
// ──────────────────────────────────────────
// contact_queries is server-only in firestore.rules (it holds customers'
// emails), so the dashboard reads and resolves messages through here.
app.get('/api/admin/messages', verifyAuth, verifyAdmin, adminLimiter, async (req, res) => {
  try {
    const snap = await db.collection('contact_queries').orderBy('createdAt', 'desc').limit(200).get();
    res.json({
      messages: snap.docs.map(d => {
        const m = d.data();
        return {
          id: d.id,
          name: m.name,
          email: m.email,
          message: m.message,
          status: m.status || 'pending',
          createdAt: m.createdAt?.toDate ? m.createdAt.toDate().toISOString() : m.createdAt || null,
        };
      }),
    });
  } catch (err) {
    logger.error('Admin messages fetch error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

app.post('/api/admin/messages/:id/status', verifyAuth, verifyAdmin, adminLimiter, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!/^[A-Za-z0-9]{1,64}$/.test(id) || !['pending', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  try {
    const ref = db.collection('contact_queries').doc(id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Message not found' });
    await ref.update({ status });
    res.json({ success: true });
  } catch (err) {
    logger.error('Admin message status error:', err);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// ──────────────────────────────────────────
// 14a. POST /api/reviews/sync-stats — recompute a product's rating
// ──────────────────────────────────────────
// Customers can't write products (firestore.rules), so after a review is
// added, edited or deleted the client asks the server to recompute the
// product's average from the reviews themselves — nothing client-supplied
// goes into the numbers.
const reviewSyncLimiter = rateLimit({
  store: new RedisStore({ prefix: 'rl:review-sync:', sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
app.post('/api/reviews/sync-stats', verifyAuth, reviewSyncLimiter, async (req, res) => {
  const { productId } = req.body || {};
  if (typeof productId !== 'string' || !/^[A-Za-z0-9]{1,64}$/.test(productId)) {
    return res.status(400).json({ error: 'Invalid product' });
  }
  try {
    const productRef = db.collection('products').doc(productId);
    if (!(await productRef.get()).exists) return res.status(404).json({ error: 'Product not found' });
    const snap = await db.collection('reviews').where('product', '==', productId).get();
    const ratings = snap.docs.map(d => Number(d.data().rating)).filter(r => Number.isInteger(r) && r >= 1 && r <= 5);
    const reviews = ratings.length;
    const rating = reviews > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / reviews) * 10) / 10 : 0;
    await productRef.update({ reviews, rating });
    await redis.del(`product:${productId}`);
    res.json({ reviews, rating });
  } catch (err) {
    logger.error('Review stats sync error:', err);
    res.status(500).json({ error: 'Failed to update rating' });
  }
});

// ──────────────────────────────────────────
// 14b. GET /api/images/:id — product photos stored in Firestore
// ──────────────────────────────────────────
const MAX_IMAGE_BYTES = 900 * 1024;
app.get('/api/images/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[A-Za-z0-9]{20}$/.test(id)) return res.status(404).end();
  try {
    const cacheKey = `img:${id}`;
    let buf = await redis.getBuffer(cacheKey);
    if (!buf) {
      const doc = await db.collection('product_images').doc(id).get();
      if (!doc.exists) return res.status(404).end();
      buf = Buffer.from(doc.data().data);
      await redis.set(cacheKey, buf, 'EX', 7 * 24 * 3600);
    }
    // Image ids are never reused, so browsers and Vercel's edge can keep them forever.
    res.set({
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(buf);
  } catch (err) {
    logger.error('Image fetch error:', err);
    res.status(500).end();
  }
});

// ──────────────────────────────────────────
// 15. POST /api/admin/invalidate-product-cache
// ──────────────────────────────────────────
// Admin.jsx writes product edits directly via the Firestore client SDK, but
// /api/payment/create-order caches product docs in Redis for 1 hour — without
// this, a price or stock change made from the admin dashboard could silently
// not take effect at checkout for up to an hour. Call this right after every
// product save/delete.
app.post('/api/admin/invalidate-product-cache', verifyAuth, verifyAdmin, adminLimiter, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ error: 'productId is required' });
    }
    await redis.del(`product:${productId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Cache invalidation error:', err);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

// ──────────────────────────────────────────
// 16. Local Chaos Testing
// ──────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/chaos', (req, res) => {
    const { action } = req.body;
    if (action === 'trip_razorpay') {
      (async () => {
        const current = await razorpayBreaker.getState();
        for(let i=0; i<razorpayBreaker.threshold; i++) await razorpayBreaker.fail(current);
      })();
      return res.json({ message: 'Razorpay CircuitBreaker manually tripped.' });
    }
    if (action === 'reset_razorpay') {
      razorpayBreaker.success();
      return res.json({ message: 'Razorpay CircuitBreaker reset.' });
    }
    if (action === 'simulate_memory_leak') {
      const leak = [];
      for(let i=0; i<100000; i++) leak.push(new Array(100).fill('chaos'));
      return res.json({ message: 'Memory bloat simulated', currentMemory: process.memoryUsage() });
    }
    if (action === 'trip_redis') {
      redis.disconnect();
      return res.json({ message: 'Redis connection simulated severe degradation' });
    }
    if (action === 'firestore_delay') {
      // Mocking global latency injection seamlessly simulating multi-region cold starts
      global.CHAOS_FIRESTORE_DELAY = true;
      return res.json({ message: 'Firestore simulated explicit 5-second IO degradation loops active.' });
    }
    res.status(400).json({ error: 'Unknown chaos action' });
  });
}

export default app;
