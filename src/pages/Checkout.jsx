import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { HiOutlineShieldCheck, HiOutlineLockClosed } from 'react-icons/hi';
import toast from 'react-hot-toast';
import Seo from '../components/Seo';
import { calcTotals, livePrice, isCartLineUnavailable } from '../utils/pricing';

const formatINR = (n) => '₹' + Number(n).toLocaleString('en-IN');

export default function Checkout() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [gatewayError, setGatewayError] = useState(false);
  const [timeoutTriggered, setTimeoutTriggered] = useState(false);
  const idempotencyKeyRef = useRef(null);
  const checkoutInitiatedRef = useRef(false);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    if (!idempotencyKeyRef.current) {
      let savedKey = sessionStorage.getItem('mj_idempotency_key');
      if (!savedKey) {
        savedKey = crypto.randomUUID();
        sessionStorage.setItem('mj_idempotency_key', savedKey);
      }
      idempotencyKeyRef.current = savedKey;
      idempotencyKeyRef.current = savedKey;
    }

    return () => {
      // Cart Abandonment Metric Fire natively when module tears down organically without success flag
      if (!window.location.pathname.includes('order-success') && checkoutInitiatedRef.current) {
        // Send isolated beacon payload cleanly dodging CORS/unmount blockers
        navigator.sendBeacon('/api/metrics/abandonment', JSON.stringify({ sessionTag: idempotencyKeyRef.current }));
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zip: '', country: '',
  });

  if (!state.user) {
    return (
      <main className="pt-16">
        <Seo title="Checkout" path="/checkout" noindex />
        <div className="container-main py-20 text-center">
          <p className="text-neutral-400 text-sm mb-4">Please sign in to checkout.</p>
          <Link to="/login" className="btn-primary text-xs">Sign In</Link>
        </div>
      </main>
    );
  }

  const { subtotal, discount: discountOffset, shipping, tax, total } = calcTotals(state.cart, state.products, state.coupon);

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleContinue = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.address || !form.city || !form.zip) {
      toast.error('Please fill in all required fields', { style: { fontSize: '13px' } });
      return;
    }
    setStep(2);
  };

  const handlePlaceOrder = async () => {
    if (state.cart.some(item => isCartLineUnavailable(item, state.products, state.loading))) {
      toast.error('Some items in your bag are no longer available — remove them first', { style: { fontSize: '13px' } });
      navigate('/cart');
      return;
    }
    setGatewayError(false);
    setTimeoutTriggered(false);
    setProcessing(true);
    checkoutInitiatedRef.current = true;
    
    // Explicit 15s Gateway Timeout UX boundary
    timeoutRef.current = setTimeout(() => {
        setTimeoutTriggered(true);
    }, 15000);

    try {
      const { auth } = await import('../firebase');
      const user = auth.currentUser;
      if (!user) {
        toast.error('Please login to continue', { style: { fontSize: '13px' } });
        navigate('/login');
        return;
      }

      // Get Firebase ID token for server auth
      const idToken = await user.getIdToken();
      console.log('1. User Token Acquired:', user.uid);

      // Provide the Stable Idempotency Key
      const idempotencyKey = idempotencyKeyRef.current || crypto.randomUUID();
      console.log('2. Idempotency Key Stably Retained:', idempotencyKey);

      // Step 1: Create order on backend (server calculates real price)
      const items = state.cart.map(item => ({
        productId: item.id || item._id,
        size: item.size,
        sizeType: item.sizeType || 'UK',
        quantity: item.quantity,
      }));

      const createRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ items, shippingAddress: form, couponCode: state.coupon ? state.coupon.code : null }),
      });

      console.log('3. POST /api/payment/create-order fired');

      const createData = await createRes.json();
      console.log('4. Backend /create-order Output:', createData);
      
      if (!createRes.ok) {
        toast.error(createData.error || 'Failed to create order', { style: { fontSize: '13px' } });
        setProcessing(false);
        return;
      }

      console.log('5. Opening Razorpay Modal with Options:', Object.keys(createData));

      // Step 2: Open Razorpay checkout modal
      const options = {
        key: createData.key,
        amount: createData.amount,
        currency: createData.currency,
        name: 'MJ Shoes',
        description: 'Premium Footwear',
        order_id: createData.orderId,
        handler: async function (response) {
          // Step 3: Verify payment on backend
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();
            console.log('6. Backend /verify Output:', verifyData);

            if (verifyRes.ok && verifyData.success) {
              console.log('7. Final verification successful, mapping PLACE_ORDER dispatch.');
              // Payment verified — update local state
              idempotencyKeyRef.current = null; // Clear so new checkout gets new key
              sessionStorage.removeItem('mj_idempotency_key');
              dispatch({
                type: 'PLACE_ORDER',
                payload: {
                  id: verifyData.orderId,
                  items: state.cart.map(i => ({
                    product: i.id,
                    name: i.name,
                    image: i.image,
                    price: i.price,
                    size: i.size,
                    sizeType: i.sizeType || 'UK',
                    quantity: i.quantity,
                  })),
                  totalAmount: total,
                  total: total,
                  date: new Date().toISOString(),
                  status: 'paid',
                },
              });
              toast.success('Payment successful! Order confirmed.', { style: { fontSize: '13px' } });
              navigate(`/order-success?orderId=${verifyData.orderId}`);
            } else {
              toast.error(verifyData.error || 'Payment verification failed', { style: { fontSize: '13px' } });
            }
          } catch (verifyErr) {
            console.error('Verification error:', verifyErr);
            toast.error('Payment verification failed. Contact support.', { style: { fontSize: '13px' } });
          }
          setProcessing(false);
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
            toast.error('Payment cancelled', { style: { fontSize: '13px' } });
          },
        },
        prefill: {
          name: `${form.firstName} ${form.lastName}`,
          email: form.email,
          contact: form.phone,
        },
        theme: {
          color: '#171717',
        },
      };

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setTimeoutTriggered(false);

      if (!window.Razorpay) {
        toast.error('Gateway blocked remotely (Check AdBlocker/Connection)');
        setGatewayError(true);
        setProcessing(false);
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        console.error('Razorpay Modal Triggered Event: payment.failed:', response.error);
        toast.error('Payment failed. Please try again.', { style: { fontSize: '13px' } });
        setGatewayError(true);
        setProcessing(false);
      });
      console.log('8. rzp.open() commanded');
      rzp.open();
    } catch (error) {
      console.error('FATAL CATCH: Error processing payment pipeline!', error);
      toast.error('Something went wrong. Please check your connection and try again.', { style: { fontSize: '13px' } });
      setProcessing(false);
    }
  };

  if (state.cart.length === 0) {
    return (
      <main className="pt-16">
        <Seo title="Checkout" path="/checkout" noindex />
        <div className="container-main py-20 text-center">
          <p className="text-neutral-400 text-sm mb-4">Your bag is empty.</p>
          <Link to="/shop" className="btn-primary text-xs">Shop Now</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16">
      <Seo title="Checkout" path="/checkout" noindex />
      <div className="container-main py-12 md:py-16">
        <h1 className="text-3xl font-light tracking-tight mb-2">Checkout</h1>
        <p className="text-sm text-neutral-400 mb-10">
          Step {step} of 2 — {step === 1 ? 'Shipping' : 'Payment'}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            {step === 1 && (
              <div className="fade-in">
                <h2 className="text-xs uppercase tracking-widest font-medium mb-6">Shipping Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">First Name *</label>
                    <input value={form.firstName} onChange={e => updateField('firstName', e.target.value)} className="input-field" id="first-name" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">Last Name *</label>
                    <input value={form.lastName} onChange={e => updateField('lastName', e.target.value)} className="input-field" id="last-name" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">Email *</label>
                    <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className="input-field" id="email" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">Phone</label>
                    <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} className="input-field" id="phone" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-neutral-400 mb-1.5 block">Address *</label>
                    <input value={form.address} onChange={e => updateField('address', e.target.value)} className="input-field" id="address" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">City *</label>
                    <input value={form.city} onChange={e => updateField('city', e.target.value)} className="input-field" id="city" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">State</label>
                    <input value={form.state} onChange={e => updateField('state', e.target.value)} className="input-field" id="state" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">Zip Code *</label>
                    <input value={form.zip} onChange={e => updateField('zip', e.target.value)} className="input-field" id="zip" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-400 mb-1.5 block">Country</label>
                    <input value={form.country} onChange={e => updateField('country', e.target.value)} className="input-field" placeholder="United States" id="country" />
                  </div>
                </div>
                <div className="mt-8">
                  <button onClick={handleContinue} className="btn-primary" id="continue-to-payment">
                    Continue to Payment
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="fade-in">
                <h2 className="text-xs uppercase tracking-widest font-medium mb-6">Payment Method</h2>

                <div className="space-y-3 mb-8">
                  {[
                    { id: 'razorpay', label: 'Razorpay', sub: 'UPI, Cards, Net Banking' },
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`w-full flex items-center justify-between p-4 border transition-base ${
                        paymentMethod === method.id ? 'border-neutral-900' : 'border-neutral-200 hover:border-neutral-400'
                      }`}
                      id={`payment-${method.id}`}
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium">{method.label}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{method.sub}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === method.id ? 'border-neutral-900' : 'border-neutral-200'
                      }`}>
                        {paymentMethod === method.id && <div className="w-2 h-2 rounded-full bg-neutral-900" />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-neutral-400 mb-8">
                  <HiOutlineLockClosed className="w-3 h-3" />
                  <span>Your payment information is encrypted and secure.</span>
                </div>

                <div className="flex flex-col gap-4">
                  {gatewayError && (
                    <div className="bg-red-50 text-red-700 p-3 text-xs border border-red-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <span>Payment didn't go through — you have not been charged for it. Try again or use another method.</span>
                      <button onClick={() => window.location.reload()} className="underline font-medium hover:text-red-900 text-left sm:text-right">Reload Page</button>
                    </div>
                  )}
                  {timeoutTriggered && processing && (
                    <div className="bg-orange-50 text-orange-700 p-3 text-xs border border-orange-100">
                      Processing is taking longer than expected. Please do not close the window.
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
                    <button onClick={() => setStep(1)} className="btn-outline" id="back-to-shipping" disabled={processing}>
                      Back
                    </button>
                    <button
                      onClick={handlePlaceOrder}
                      disabled={processing}
                      className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      id="place-order"
                    >
                      {processing ? (timeoutTriggered ? 'Still Processing...' : 'Processing...') : (gatewayError ? 'Retry Payment' : `Place Order — ${formatINR(total)}`)}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div>
            <div className="bg-neutral-50 p-8">
              <h2 className="text-xs uppercase tracking-widest font-medium mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6">
                {state.cart.map(item => (
                  <div key={`${item.id}-${item.size}`} className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white flex-shrink-0">
                      <img src={item.image || '/images/shoe-white.png'} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-[11px] text-neutral-400">{item.sizeType || 'UK'} {item.size} × {item.quantity}</p>
                    </div>
                    <p className="text-xs font-medium">{formatINR(livePrice(item, state.products) * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="divider mb-4" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span>{formatINR(subtotal)}</span></div>
                {state.coupon && discountOffset > 0 && (
                  <div className="flex justify-between text-green-600"><span className="font-medium">Discount ({state.coupon.code})</span><span>- {formatINR(discountOffset)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-neutral-500">Shipping</span><span>{shipping === 0 ? 'Free' : formatINR(shipping)}</span></div>
                <div className="flex justify-between"><span className="text-neutral-500">GST (18%)</span><span>{formatINR(tax)}</span></div>
                <div className="divider !my-3" />
                <div className="flex justify-between font-medium"><span>Total</span><span>{formatINR(total)}</span></div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 justify-center">
              <HiOutlineShieldCheck className="w-3 h-3 text-neutral-300" />
              <span className="text-[11px] text-neutral-400">Secure checkout</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
