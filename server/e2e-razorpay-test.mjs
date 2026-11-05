import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import admin, { db } from './firebase-admin.js';

// Run against the emulators by default — set E2E_LIVE=1 to deliberately hit
// the real Firebase project instead.
if (!process.env.E2E_LIVE && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('Refusing to run against the live project. Start the emulators and set FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST, or set E2E_LIVE=1.');
  process.exit(1);
}

const BASE = 'http://localhost:5002';
const UID = 'e2e-razorpay-test-user';
const feEnv = Object.fromEntries(fs.readFileSync('../.env', 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.split('=')[0].trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]));
const rzAuth = 'Basic ' + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_SECRET}`).toString('base64');
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const post = (path, body, headers = {}) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

let orderId;
const extraOrders = [], couponIds = [];
try {
  // ── Auth guard ──
  let r = await post('/api/payment/create-order', {});
  check('create-order without token → 401', r.status === 401, `(got ${r.status})`);
  r = await post('/api/payment/create-order', {}, { Authorization: 'Bearer not-a-real-token' });
  check('create-order with forged token → 401', r.status === 401, `(got ${r.status})`);
  r = await post('/api/payment/verify', {});
  check('verify without token → 401', r.status === 401, `(got ${r.status})`);

  // ── Real Firebase sign-in (custom token → ID token) ──
  const custom = await admin.auth().createCustomToken(UID, {});
  // With FIREBASE_AUTH_EMULATOR_HOST set, sign in against the local emulator.
  const authBase = process.env.FIREBASE_AUTH_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com`
    : 'https://identitytoolkit.googleapis.com';
  const sr = await fetch(`${authBase}/v1/accounts:signInWithCustomToken?key=${feEnv.VITE_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const { idToken } = await sr.json();
  check('Firebase sign-in for test user', !!idToken);
  const auth = { Authorization: `Bearer ${idToken}` };

  // ── Pick an in-stock product ──
  const snap = await db.collection('products').get();
  const p = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(p => (p.stock ?? 0) > 0 && !p.sizeStock) ||
            snap.docs.map(d => ({ id: d.id, ...d.data() })).find(p => p.sizeStock && Object.values(p.sizeStock).some(v => v > 0));
  const size = p.sizeStock ? Object.keys(p.sizeStock).find(k => p.sizeStock[k] > 0) : (p.sizes?.[0] ?? null);
  console.log(`      product: ${p.name} ₹${p.price} size ${size}`);

  const body = { items: [{ productId: p.id, quantity: 1, size }], shippingAddress: { firstName: 'Test', lastName: 'User', email: 'test@mjshoes.xyz', phone: '9999999999', address: '1 Test St', city: 'Mumbai', state: 'MH', zip: '400001', country: 'India' } };

  r = await post('/api/payment/create-order', body, auth);
  check('create-order missing Idempotency-Key → 400', r.status === 400, `(got ${r.status})`);

  const key = crypto.randomUUID();
  r = await post('/api/payment/create-order', body, { ...auth, 'Idempotency-Key': key });
  const created = await r.json();
  orderId = created.orderId;
  check('create-order (authenticated) → 200', r.status === 200 && orderId?.startsWith('order_'), JSON.stringify(created));
  check('returned key is a TEST key', created.key?.startsWith('rzp_test_'));

  const sub = p.price, ship = sub >= 15000 ? 0 : (Number.isFinite(p.shippingCharge) ? p.shippingCharge : 499), expected = (sub + ship + Math.round(sub * 0.18)) * 100;
  check('amount = price + shipping + 18% GST', created.amount === expected, `(${created.amount} vs ${expected})`);

  const ro = await (await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, { headers: { Authorization: rzAuth } })).json();
  check('order exists on Razorpay with same amount', !!orderId && ro.id === orderId && ro.amount === created.amount, `(status ${ro.status})`);

  const pend = await db.collection('pending_orders').doc(orderId).get();
  check('pending_order saved in Firestore', pend.exists && pend.data().userId === UID);

  r = await post('/api/payment/create-order', body, { ...auth, 'Idempotency-Key': key });
  const again = await r.json();
  check('idempotent replay returns same order', again.orderId === orderId);

  // ── Changed cart under the same Idempotency-Key must be a NEW order ──
  const body2 = { ...body, items: [{ ...body.items[0], quantity: 2 }] };
  r = await post('/api/payment/create-order', body2, { ...auth, 'Idempotency-Key': key });
  const changed = await r.json();
  check('same key + changed cart → new order, new amount', changed.orderId && changed.orderId !== orderId && changed.amount !== created.amount, `(${changed.amount})`);
  if (changed.orderId) extraOrders.push(changed.orderId);

  // ── Coupons ──
  const couponRef = await db.collection('coupons').add({ code: 'E2ETEST10', discountType: 'percentage', value: 10, minOrderValue: 0, usageLimit: 5, usedCount: 0, expiryDate: new Date(Date.now() + 864e5).toISOString() });
  couponIds.push(couponRef.id);
  r = await post('/api/coupons/validate', { code: 'e2etest10', subtotal: p.price });
  const v = await r.json();
  check('validate returns coupon terms for live recompute', r.status === 200 && v.discountType === 'percentage' && v.value === 10, JSON.stringify(v));
  r = await post('/api/payment/create-order', { ...body, couponCode: 'E2ETEST10' }, { ...auth, 'Idempotency-Key': crypto.randomUUID() });
  const withCoupon = await r.json();
  if (withCoupon.orderId) extraOrders.push(withCoupon.orderId);
  const disc = Math.round(sub * 0.1), expC = (sub - disc + ship + Math.round((sub - disc) * 0.18)) * 100;
  check('order with 10% coupon charges discounted amount', withCoupon.amount === expC, `(${withCoupon.amount} vs ${expC})`);
  check('coupon use NOT counted before payment', (await couponRef.get()).data().usedCount === 0);
  r = await post('/api/payment/create-order', { ...body, couponCode: 'NOSUCHCODE' }, { ...auth, 'Idempotency-Key': crypto.randomUUID() });
  check('unknown coupon → 400 with message (not silent full charge)', r.status === 400, `(got ${r.status})`);

  // ── Verify endpoint signature handling ──
  r = await post('/api/payment/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_fake123', razorpay_signature: 'deadbeef' }, auth);
  check('verify with forged signature → 400', r.status === 400, `(got ${r.status})`);

  const goodSig = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET).update(`${orderId}|pay_fake123`).digest('hex');
  r = await post('/api/payment/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_fake123', razorpay_signature: goodSig }, auth);
  check('verify with valid sig but non-existent payment is rejected', r.status >= 400, `(got ${r.status})`);
} catch (e) {
  fail++; console.error('ERROR', e);
} finally {
  for (const id of [orderId, ...extraOrders].filter(Boolean)) await db.collection('pending_orders').doc(id).delete().catch(() => {});
  for (const id of couponIds) await db.collection('coupons').doc(id).delete().catch(() => {});
  await admin.auth().deleteUser(UID).catch(() => {});
  console.log(`\n${pass} passed, ${fail} failed (test user, pending orders and test coupon cleaned up)`);
  process.exit(fail ? 1 : 0);
}
