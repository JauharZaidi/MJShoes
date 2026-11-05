// Attack-style authorization tests against the LOCAL emulators + local API.
// Prereqs: npm run emulators, npm run server:emulators, node server/seed-emulator.mjs
// Usage:   node server/security-test-emulator.mjs [apiBase]   (default http://localhost:5002)
import admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
const PROJECT = 'mjshoes-657b7';
const API = process.argv[2] || 'http://localhost:5002';
const FS = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };

const signIn = async (email, password) => {
  const r = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return (await r.json()).idToken;
};
const signUp = async (email, password) => {
  const r = await fetch(`${AUTH}/accounts:signUp?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return r.json();
};
const fv = (v) => typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) };
const fields = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fv(v)])) });
const fsReq = (method, path, token, body, mask) => fetch(`${FS}/${path}${mask ? '?' + mask.map(m => `updateMask.fieldPaths=${m}`).join('&') : ''}`, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(r => r.status);
const api = (method, path, token, body) => fetch(`${API}${path}`, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
}).then(r => r.status);

const cust = await signIn('customer@mjshoes.test', 'emulator-customer-pass');
const cust2 = await signIn('customer2@mjshoes.test', 'emulator-customer2-pass');
const adm = await signIn('admin@mjshoes.test', 'emulator-admin-pass');
check('test accounts can sign in', !!(cust && cust2 && adm));

const product = (await db.collection('products').limit(1).get()).docs[0];
const order = (await db.collection('orders').where('userId', '==', 'test-customer').limit(1).get()).docs[0];
const coupon = (await db.collection('coupons').limit(1).get()).docs[0];
if (!product || !order || !coupon) { console.error('Need at least one product, one order by test-customer and one coupon.'); process.exit(1); }

console.log('\n── Privilege escalation');
check('customer sets own role=admin', await fsReq('PATCH', 'users/test-customer', cust, fields({ name: 'x', email: 'customer@mjshoes.test', role: 'admin' })) === 403);
check('customer sets role via masked update', await fsReq('PATCH', 'users/test-customer', cust, fields({ role: 'admin' }), ['role']) === 403);
const fresh = await signUp(`attacker${Date.now()}@mjshoes.test`, 'attacker-pass-123');
check('new signup creating own doc as admin', await fsReq('PATCH', `users/${fresh.localId}`, fresh.idToken, fields({ name: 'a', role: 'admin' })) === 403);
check('new signup creating own doc as user (legit)', await fsReq('PATCH', `users/${fresh.localId}`, fresh.idToken, fields({ name: 'a', email: 'a@x', role: 'user' })) === 200);
check('customer edits own name (legit)', await fsReq('PATCH', 'users/test-customer', cust, fields({ name: 'Test Customer' }), ['name']) === 200);
check('customer overwrites another user doc', await fsReq('PATCH', 'users/test-customer-2', cust, fields({ name: 'pwned', role: 'user' })) === 403);
check('customer reads another user doc', await fsReq('GET', 'users/test-customer-2', cust) === 403);
check('admin reads any user doc (legit)', await fsReq('GET', 'users/test-customer', adm) === 200);

console.log('\n── Products & prices');
check('anon reads products (legit)', await fsReq('GET', `products/${product.id}`, null) === 200);
check('customer sets price to ₹1', await fsReq('PATCH', `products/${product.id}`, cust, fields({ price: 1 }), ['price']) === 403);
check('customer unhides/hides product', await fsReq('PATCH', `products/${product.id}`, cust, fields({ available: false }), ['available']) === 403);
check('customer creates product', await fsReq('POST', 'products', cust, fields({ name: 'fake', price: 1 })) === 403);
check('customer deletes product', await fsReq('DELETE', `products/${product.id}`, cust) === 403);
check('anon sets price', await fsReq('PATCH', `products/${product.id}`, null, fields({ price: 1 }), ['price']) === 403);

console.log('\n── Orders');
check('owner reads own order (legit)', await fsReq('GET', `orders/${order.id}`, cust) === 200);
check('other customer reads that order', await fsReq('GET', `orders/${order.id}`, cust2) === 403);
check('anon reads order', await fsReq('GET', `orders/${order.id}`, null) === 403);
check('owner marks own order delivered', await fsReq('PATCH', `orders/${order.id}`, cust, fields({ status: 'delivered' }), ['status']) === 403);
check('customer creates fake paid order', await fsReq('POST', 'orders', cust, fields({ userId: 'test-customer', status: 'paid', totalAmount: 1 })) === 403);
check('customer deletes own order', await fsReq('DELETE', `orders/${order.id}`, cust) === 403);
check('admin updates order status (legit)', await fsReq('PATCH', `orders/${order.id}`, adm, fields({ status: 'paid' }), ['status']) === 200);
check('customer lists all orders', await fetch(`${FS}/orders`, { headers: { Authorization: `Bearer ${cust}` } }).then(r => r.status) === 403);
check('customer reads pending_orders', await fsReq('GET', 'pending_orders/x', cust) === 403);
check('customer reads product_images doc directly', await fsReq('GET', 'product_images/x', cust) === 403);

console.log('\n── Coupons');
check('anon reads coupon', await fsReq('GET', `coupons/${coupon.id}`, null) === 403);
check('customer reads coupon', await fsReq('GET', `coupons/${coupon.id}`, cust) === 403);
check('customer resets usedCount', await fsReq('PATCH', `coupons/${coupon.id}`, cust, fields({ usedCount: 0 }), ['usedCount']) === 403);
check('customer creates 100% coupon', await fsReq('POST', 'coupons', cust, fields({ code: 'FREE', discountType: 'percentage', value: 100 })) === 403);
check('admin reads coupon (legit)', await fsReq('GET', `coupons/${coupon.id}`, adm) === 200);

console.log('\n── Reviews');
const rv = { product: product.id, user: 'test-customer', name: 'T', rating: 5, comment: 'great', createdAt: new Date().toISOString() };
const myId = `${product.id}_test-customer`;
await db.collection('reviews').doc(myId).delete().catch(() => {});
check('customer posts valid review (legit)', await fsReq('PATCH', `reviews/${myId}`, cust, fields(rv)) === 200);
check('same customer posts a 2nd review under a random id', await fsReq('PATCH', 'reviews/sec-test-spam', cust, fields(rv)) === 403);
check('customer posts review under someone else\'s id slot', await fsReq('PATCH', `reviews/${product.id}_test-customer-2`, cust, fields(rv)) === 403);
check('customer posts review as someone else', await fsReq('PATCH', `reviews/${product.id}_test-customer-2`, cust, fields({ ...rv, user: 'test-customer-2' })) === 403);
check('customer posts rating 500', await fsReq('PATCH', `reviews/${product.id}_test-customer-2`, cust2, fields({ ...rv, user: 'test-customer-2', rating: 500 })) === 403);
check('customer posts 2001-char comment', await fsReq('PATCH', `reviews/${product.id}_test-customer-2`, cust2, fields({ ...rv, user: 'test-customer-2', comment: 'x'.repeat(2001) })) === 403);
check('other customer edits that review', await fsReq('PATCH', `reviews/${myId}`, cust2, fields({ rating: 1 }), ['rating']) === 403);
check('owner edits own rating (legit)', await fsReq('PATCH', `reviews/${myId}`, cust, fields({ rating: 4 }), ['rating']) === 200);
check('owner rewrites review user field', await fsReq('PATCH', `reviews/${myId}`, cust, fields({ user: 'test-customer-2' }), ['user']) === 403);
const syncRes = await fetch(`${API}/api/reviews/sync-stats`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cust}` }, body: JSON.stringify({ productId: product.id }) }).then(r => r.json());
check('rating recomputed server-side from reviews', syncRes.reviews === 1 && syncRes.rating === 4, JSON.stringify(syncRes));
const prodAfter = (await db.collection('products').doc(product.id).get()).data();
check('product doc rating/review count updated', prodAfter.rating === 4 && prodAfter.reviews === 1);
check('anon cannot trigger rating sync', await api('POST', '/api/reviews/sync-stats', null, { productId: product.id }) === 401);
check('other customer deletes that review', await fsReq('DELETE', `reviews/${myId}`, cust2) === 403);
check('admin deletes review (legit)', await fsReq('DELETE', `reviews/${myId}`, adm) === 200);
await api('POST', '/api/reviews/sync-stats', cust, { productId: product.id });

console.log('\n── Server API');
check('customer reads contact messages via API', await api('GET', '/api/admin/messages', cust) === 403);
check('anon reads contact messages via API', await api('GET', '/api/admin/messages', null) === 401);
check('customer resolves a message', await api('POST', '/api/admin/messages/abc/status', cust, { status: 'resolved' }) === 403);
check('admin reads contact messages (legit)', await api('GET', '/api/admin/messages', adm) === 200);
check('customer reads contact_queries directly', await fetch(`${FS}/contact_queries`, { headers: { Authorization: `Bearer ${cust}` } }).then(r => r.status) === 403);
check('customer uploads product image', await api('POST', '/api/admin/upload-images', cust) === 403);
check('customer clears product cache', await api('POST', '/api/admin/invalidate-product-cache', cust, { productId: product.id }) === 403);
check('other customer tracks someone else\'s order', await api('GET', `/api/order/status/${order.id}`, cust2) === 403);
check('anon tracks order', await api('GET', `/api/order/status/${order.id}`, null) === 401);
check('owner tracks own order (legit)', await api('GET', `/api/order/status/${order.id}`, cust) === 200);
check('path-traversal order id rejected', await api('GET', '/api/order/status/..%2F..%2Fusers', cust) === 404);
check('verify with forged signature', await api('POST', '/api/payment/verify', cust, { razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'deadbeef' }) === 400);
check('webhook with no signature', await fetch(`${API}/api/payment/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"event":"payment.captured"}' }).then(r => r.status >= 400));
const createOrder = (items) => fetch(`${API}/api/payment/create-order`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cust}`, 'Idempotency-Key': crypto.randomUUID() },
  body: JSON.stringify({ items, shippingAddress: { firstName: 'a', address: 'b', city: 'c' } }),
}).then(async r => ({ status: r.status, body: await r.json() }));
await db.collection('products').doc(product.id).update({ available: false });
await api('POST', '/api/admin/invalidate-product-cache', adm, { productId: product.id });
const hidden = await createOrder([{ productId: product.id, quantity: 1, size: '7' }]);
await db.collection('products').doc(product.id).update({ available: true });
await api('POST', '/api/admin/invalidate-product-cache', adm, { productId: product.id });
check('create-order for hidden product', hidden.status === 400 && /no longer available/.test(hidden.body.error), JSON.stringify(hidden.body));
const big = await createOrder([{ productId: product.id, quantity: 999, size: '7' }]);
check('create-order quantity 999', big.status === 400 && /Invalid item/.test(big.body.error), JSON.stringify(big.body));
const neg = await createOrder([{ productId: product.id, quantity: -3, size: '7' }]);
check('create-order negative quantity', neg.status === 400 && /Invalid item/.test(neg.body.error), JSON.stringify(neg.body));
const frac = await createOrder([{ productId: product.id, quantity: 1.5, size: '7' }]);
check('create-order fractional quantity', frac.status === 400, JSON.stringify(frac.body));
const str = await createOrder([{ productId: product.id, quantity: '2', size: '7' }]);
check('create-order string quantity "2"', str.status === 400 && /Invalid item/.test(str.body.error), JSON.stringify(str.body));
const badSize = await createOrder([{ productId: product.id, quantity: 1, size: '99' }]);
check('create-order size that does not exist', badSize.status === 400 && /size 99/.test(badSize.body.error), JSON.stringify(badSize.body));
const objId = await createOrder([{ productId: { $gt: '' }, quantity: 1, size: '7' }]);
check('create-order object as productId', objId.status === 400, JSON.stringify(objId.body));
const stock7 = (await db.collection('products').doc(product.id).get()).data().sizeStock['7'];
const split = await createOrder([{ productId: product.id, quantity: stock7, size: '7' }, { productId: product.id, quantity: 1, size: '7' }]);
check(`create-order split lines exceeding stock (${stock7}+1)`, split.status === 400 && /out of stock/.test(split.body.error), JSON.stringify(split.body));
const oos = await createOrder([{ productId: product.id, quantity: 2, size: '9' }]);
check('create-order out-of-stock size', oos.status === 400 && /out of stock/.test(oos.body.error), JSON.stringify(oos.body));

await admin.auth().deleteUser(fresh.localId).catch(() => {});
await db.collection('users').doc(fresh.localId).delete().catch(() => {});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
