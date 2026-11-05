import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { HiOutlineCheckCircle, HiOutlineClock, HiOutlineXCircle } from 'react-icons/hi';
import { useStore } from '../context/StoreContext';
import Seo from '../components/Seo';

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [status, setStatus] = useState('loading');
  const { state } = useStore();

  useEffect(() => {
    if (!orderId) return; // nothing to confirm — rendered as a redirect below

    // Check if the order is already strictly managed locally
    const localOrder = state.orders?.find(o => o.id === orderId);
    if (localOrder && localOrder.status === 'paid') {
      setStatus('paid');
      return;
    }

    let isMounted = true;
    let attempt = 0;
    const maxAttempts = 5;
    let timeoutId;

    const checkStatus = async () => {
      try {
        const { auth } = await import('../firebase');
        const user = auth.currentUser;
        if (!user) {
          // If auth hasn't loaded yet, just retry shortly without counting as a failed attempt to the API
          if (isMounted) timeoutId = setTimeout(checkStatus, 1000);
          return;
        }
        
        const token = await user.getIdToken();
        const res = await fetch(`/api/order/status/${orderId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          
          setStatus(data.status); // 'paid', 'pending_payment', 'failed'

          // If still pending, continue polling with exponential backoff up to maxAttempts
          if (data.status === 'pending_payment') {
            attempt++;
            if (attempt <= maxAttempts) {
              const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s, 32s
              timeoutId = setTimeout(checkStatus, delay);
            } else {
              // Give up polling. It will stay on pending_payment screen or can be forced to manual refresh.
            }
          }
        } else {
           if (isMounted) setStatus('failed');
        }
      } catch {
         if (isMounted) setStatus('failed');
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [orderId, state.orders]);

  // Without an order ID there's nothing to confirm; don't show a fake success.
  if (!orderId) return <Navigate to="/account" replace />;

  if (status === 'loading') {
    return (
      <main className="pt-16">
        <Seo title="Order Confirmed" path="/order-success" noindex />
        <div className="container-main py-20 text-center">
            <p className="text-sm text-neutral-500">Verifying your order status...</p>
        </div>
      </main>
    );
  }

  if (status === 'failed') {
     return (
        <main className="pt-16">
          <Seo title="Payment Failed" path="/order-success" noindex />
          <div className="container-main py-20 md:py-28 text-center max-w-lg mx-auto">
            <HiOutlineXCircle className="w-12 h-12 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-light tracking-tight mb-3">Payment Failed</h1>
            <p className="text-sm text-neutral-500 leading-relaxed mb-8">
              We couldn't verify your payment. If money was deducted, it will be refunded.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/checkout" className="btn-primary text-xs">Try Again</Link>
            </div>
          </div>
        </main>
      );
  }

  if (status === 'pending_payment') {
      return (
        <main className="pt-16">
          <Seo title="Payment Processing" path="/order-success" noindex />
          <div className="container-main py-20 md:py-28 text-center max-w-lg mx-auto">
            <HiOutlineClock className="w-12 h-12 text-amber-500 mx-auto mb-6" />
            <h1 className="text-2xl font-light tracking-tight mb-3">Payment Processing</h1>
            <p className="text-sm text-neutral-500 leading-relaxed mb-8">
              Your payment is still being verified. We will send you an email confirmation shortly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/shop" className="btn-primary text-xs">Continue Shopping</Link>
            </div>
          </div>
        </main>
      );
  }

  return (
    <main className="pt-16">
      <Seo title="Order Confirmed" path="/order-success" noindex />
      <div className="container-main py-20 md:py-28 text-center max-w-lg mx-auto">
        <HiOutlineCheckCircle className="w-12 h-12 text-neutral-900 mx-auto mb-6" />
        <h1 className="text-2xl font-light tracking-tight mb-3">Order Confirmed</h1>
        <p className="text-sm text-neutral-500 leading-relaxed mb-8">
          Thank you for your purchase. We have received your order and will begin 
          preparing it shortly. A confirmation email has been sent to you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/shop" className="btn-primary text-xs">Continue Shopping</Link>
          <Link to="/account" className="btn-outline text-xs">View My Orders</Link>
        </div>
      </div>
    </main>
  );
}
