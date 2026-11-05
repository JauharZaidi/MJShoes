import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { HiOutlineTrash, HiPlus, HiMinus, HiArrowRight, HiOutlineShoppingBag, HiCheck, HiX } from 'react-icons/hi';
import toast from 'react-hot-toast';
import Seo from '../components/Seo';
import { calcTotals, isCartLineUnavailable, livePrice, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';

const formatINR = (n) => '₹' + Number(n).toLocaleString('en-IN');

export default function Cart() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState('');
  const [validingCoupon, setValidatingCoupon] = useState(false);

  const isUnavailable = (item) => isCartLineUnavailable(item, state.products, state.loading);
  const unavailableItems = state.cart.filter(isUnavailable);
  const { subtotal, discount, shipping, tax, total, couponBelowMinimum } = calcTotals(
    state.cart.filter(item => !isUnavailable(item)), state.products, state.coupon);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim(), subtotal })
      });
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(data.error || 'Invalid Coupon', { style: { fontSize: '13px' } });
        dispatch({ type: 'SET_COUPON', payload: null });
      } else {
        toast.success(data.message, { style: { fontSize: '13px' } });
        dispatch({ type: 'SET_COUPON', payload: {
          code: couponInput.trim().toUpperCase(),
          discountType: data.discountType,
          value: data.value,
          minOrderValue: data.minOrderValue,
        } });
      }
    } catch {
      toast.error('Failed to validate coupon');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const clearCoupon = () => {
     dispatch({ type: 'SET_COUPON', payload: null });
     setCouponInput('');
  };

  if (state.cart.length === 0) {
    return (
      <main className="pt-16">
        <Seo title="Your Bag" path="/cart" noindex />
        <div className="container-main py-20 text-center">
          <HiOutlineShoppingBag className="w-10 h-10 text-neutral-200 mx-auto mb-6" />
          <h2 className="text-2xl font-light tracking-tight mb-2">Your bag is empty</h2>
          <p className="text-sm text-neutral-400 mb-8">Discover something you will love.</p>
          <Link to="/shop" className="btn-primary inline-flex items-center gap-2" id="continue-shopping">
            Continue Shopping <HiArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16">
      <Seo title="Your Bag" path="/cart" noindex />
      <div className="container-main py-12 md:py-16">
        <h1 className="text-3xl font-light tracking-tight mb-2">Your Bag</h1>
        <p className="text-sm text-neutral-400 mb-10">{state.cart.length} item{state.cart.length !== 1 ? 's' : ''}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Items */}
          <div className="lg:col-span-2">
            <div className="divide-y divide-neutral-100">
              {state.cart.map(item => {
                const product = state.products.find(p => p.id === item.id);
                const availableStock = product
                  ? (product.sizeStock && Object.prototype.hasOwnProperty.call(product.sizeStock, String(item.size))
                      ? product.sizeStock[String(item.size)]
                      : product.stock)
                  : Infinity;
                const atMaxStock = item.quantity >= availableStock;
                const unavailable = isUnavailable(item);
                return (
                <div key={`${item.id}-${item.size}`} className="flex gap-5 py-6 first:pt-0">
                  <Link to={`/product/${item.id}`} className="w-24 h-24 sm:w-28 sm:h-28 bg-neutral-50 flex-shrink-0">
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to={`/product/${item.id}`} className="text-sm font-medium text-neutral-900 hover:underline underline-offset-4 block truncate">
                            {item.name}
                          </Link>
                          <p className="text-xs text-neutral-400 mt-1">{item.sizeType || 'UK'} {item.size}</p>
                          {unavailable && <p className="text-xs text-red-500 mt-1">No longer available — please remove</p>}
                        </div>
                        <p className="text-sm font-medium flex-shrink-0">{formatINR(livePrice(item, state.products) * item.quantity)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-neutral-200">
                        <button
                          onClick={() => dispatch({ type: 'UPDATE_CART_QUANTITY', payload: { id: item.id, size: item.size, quantity: Math.max(1, item.quantity - 1) } })}
                          className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-base"
                          aria-label="Decrease quantity"
                        >
                          <HiMinus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                        <button
                          onClick={() => {
                            if (atMaxStock) {
                              toast.error('No more stock available for this size', { style: { fontSize: '13px' } });
                              return;
                            }
                            dispatch({ type: 'UPDATE_CART_QUANTITY', payload: { id: item.id, size: item.size, quantity: item.quantity + 1 } });
                          }}
                          disabled={atMaxStock}
                          className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-neutral-900 disabled:opacity-30 disabled:hover:text-neutral-400 transition-base"
                          aria-label="Increase quantity"
                        >
                          <HiPlus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => dispatch({ type: 'REMOVE_FROM_CART', payload: { id: item.id, size: item.size } })}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center text-neutral-300 hover:text-neutral-900 transition-base"
                        aria-label="Remove item"
                      >
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-neutral-50 p-8">
              <h2 className="text-xs uppercase tracking-widest font-medium mb-6">Order Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Subtotal</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Shipping</span>
                  <span>{shipping === 0 ? 'Free' : formatINR(shipping)}</span>
                </div>
                {state.coupon && discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="font-medium">Discount ({state.coupon.code})</span>
                    <span>- {formatINR(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">GST (18%)</span>
                  <span>{formatINR(tax)}</span>
                </div>
                <div className="divider" />
                <div className="flex justify-between text-sm font-medium pt-1">
                  <span>Total</span>
                  <span>{formatINR(total)}</span>
                </div>
              </div>

              {/* Coupon Field */}
              <div className="mb-6">
                 {state.coupon ? (
                   <div className="flex items-center justify-between p-3 border border-green-200 bg-green-50">
                      <div className="flex items-center gap-2 text-sm text-green-700">
                         <HiCheck className="w-4 h-4" />
                         <span className="font-medium">{state.coupon.code}</span> {couponBelowMinimum ? 'needs a bigger order' : 'Applied'}
                      </div>
                      <button onClick={clearCoupon} className="min-w-[40px] min-h-[40px] -m-2 flex items-center justify-center text-neutral-500 hover:text-neutral-900" aria-label="Remove Coupon">
                         <HiX className="w-4 h-4" />
                      </button>
                   </div>
                 ) : (
                   <div className="flex items-center gap-2">
                     <input 
                        type="text" 
                        placeholder="Coupon Code" 
                        className="input-field py-2.5 text-sm uppercase" 
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        aria-label="Enter Coupon Code"
                     />
                     <button 
                        onClick={handleApplyCoupon} 
                        disabled={validingCoupon}
                        className="btn-outline py-2.5 px-4 text-xs disabled:opacity-50"
                     >
                        Apply
                     </button>
                   </div>
                 )}
                 {couponBelowMinimum && (
                   <p className="text-[11px] text-amber-600 mt-2">
                     Add {formatINR(state.coupon.minOrderValue - subtotal)} more to use {state.coupon.code}.
                   </p>
                 )}
              </div>
              {shipping > 0 && (
                <p className="text-[11px] text-neutral-400 mb-6">
                  Add {formatINR(FREE_SHIPPING_THRESHOLD - subtotal)} more for free shipping.
                </p>
              )}
              <button
                onClick={() => {
                  if (unavailableItems.length > 0) {
                    toast.error('Remove items that are no longer available', { style: { fontSize: '13px' } });
                    return;
                  }
                  if (!state.user) {
                    toast.error('Please login to continue checkout', { style: { fontSize: '13px' } });
                    navigate('/login');
                    return;
                  }
                  navigate('/checkout');
                }}
                className="btn-primary w-full text-center"
                id="checkout-btn"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
