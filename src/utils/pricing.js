// Display-side pricing. The server recomputes all of this from Firestore at
// checkout (server/app.js → computeShipping / computeDiscount) and that is what
// Razorpay charges — keep the two in sync if you change a rule here.

export const FREE_SHIPPING_THRESHOLD = 15000;
export const DEFAULT_SHIPPING_CHARGE = 499;
export const GST_RATE = 0.18;

// Products saved before per-product delivery charges existed fall back to the
// old flat ₹499.
export const shippingChargeOf = (product) => {
  const n = Number(product?.shippingCharge);
  return product && product.shippingCharge !== undefined && product.shippingCharge !== '' && !isNaN(n) && n >= 0
    ? n
    : DEFAULT_SHIPPING_CHARGE;
};

// Everything ships together in one parcel, so the order pays the highest
// delivery charge among its products, not the sum. Free above the threshold.
export const calcShipping = (products, subtotal) => {
  if (products.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return Math.max(...products.map(shippingChargeOf));
};

// Coupon = { discountType, value, minOrderValue } as returned by
// /api/coupons/validate. Recomputed on every render so the discount follows
// the cart as it changes.
export const calcDiscount = (coupon, subtotal) => {
  if (!coupon || subtotal < (coupon.minOrderValue || 0)) return 0;
  const d = coupon.discountType === 'percentage'
    ? Math.round(subtotal * (coupon.value / 100))
    : coupon.value;
  return Math.min(d, subtotal);
};

// The cart remembers the price from when an item was added; once products are
// loaded, the current catalogue price wins (it's what the server will charge).
export const livePrice = (item, products) => {
  const product = products.find(p => p.id === item.id);
  return product && Number(product.price) > 0 ? Number(product.price) : item.price;
};

export const calcTotals = (cart, products, coupon) => {
  const subtotal = cart.reduce((sum, item) => sum + livePrice(item, products) * item.quantity, 0);
  const cartProducts = cart.map(item => products.find(p => p.id === item.id) || item);
  const discount = calcDiscount(coupon, subtotal);
  const discountedSubtotal = subtotal - discount;
  const shipping = calcShipping(cartProducts, subtotal);
  const tax = Math.round(discountedSubtotal * GST_RATE);
  return {
    subtotal, discount, shipping, tax,
    total: discountedSubtotal + shipping + tax,
    couponBelowMinimum: !!coupon && subtotal < (coupon.minOrderValue || 0),
  };
};

export const isAvailable = (product) => product?.available !== false;

// Once the catalogue has loaded, a cart line whose product was deleted or
// hidden can't be bought — it's flagged in the bag and left out of totals.
export const isCartLineUnavailable = (item, products, loading) => {
  if (loading) return false;
  const product = products.find(p => p.id === item.id);
  return !product || !isAvailable(product);
};
