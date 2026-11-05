import { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Seo from '../components/Seo';

export default function TrackOrder() {
  const { state } = useStore();
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  if (!state.user) {
    return (
      <main className="pt-16 min-h-[60vh] flex items-center justify-center">
        <Seo title="Track Your Order" path="/track-order" noindex />
        <div className="container-main py-20 text-center fade-in">
          <h1 className="text-2xl font-light mb-4">Track Order</h1>
          <p className="text-neutral-400 text-sm mb-6">Create an account or login to track your exclusive orders safely.</p>
          <Link to="/login" className="btn-primary text-xs w-48 mx-auto">Sign In To Track</Link>
        </div>
      </main>
    );
  }

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!orderId.trim()) return;

    setLoading(true);
    setOrderResult(null);

    try {
      const { auth } = await import('../firebase');
      const token = await auth.currentUser.getIdToken();
      
      const res = await fetch(`/api/order/status/${orderId.trim()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Cannot track this order.', { style: { fontSize: '13px' }});
      } else {
        setOrderResult(data);
      }
    } catch {
      toast.error('Network failure trying to track order.', { style: { fontSize: '13px' }});
    }
    setLoading(false);
  };

  return (
    <main className="pt-16 min-h-screen bg-white">
      <Seo
        title="Track Your Order"
        path="/track-order"
        description="Track the status and delivery progress of your MJ Shoes order."
        noindex
      />
      <div className="container-main py-20">
        <div className="max-w-xl mx-auto space-y-8 fade-in">
          <div>
            <h1 className="text-3xl font-light tracking-tight mb-2">Track Order</h1>
            <p className="text-sm text-neutral-400">
               Enter your Order ID precisely to securely track its live fulfillment status. Note that security rules mandate you exclusively track your own orders.
            </p>
          </div>

          <form onSubmit={handleTrack} className="flex gap-4">
            <input 
              value={orderId} 
              onChange={e => setOrderId(e.target.value)} 
              placeholder="Order ID from My Account" 
              className="input-field flex-1 bg-neutral-50 border-neutral-200" 
            />
            <button disabled={loading || !orderId.trim()} className="btn-primary" type="submit">
              {loading ? 'Tracking...' : 'Track'}
            </button>
          </form>

          {orderResult && (
            <div className="p-6 border border-neutral-200 bg-neutral-50 fade-in space-y-4">
               <div>
                  <h3 className="text-sm font-medium tracking-wide">Status Map</h3>
                  <p className="text-2xl font-light capitalize text-neutral-800 mt-1">{orderResult.status.replace('_', ' ')}</p>
               </div>
               
               <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200 text-xs text-neutral-500">
                 <div>
                    <span className="block mb-1 font-medium text-neutral-900">Total Charged</span>
                    {orderResult.totalAmt ? `₹${Number(orderResult.totalAmt).toLocaleString('en-IN')}` : 'N/A'}
                 </div>
                 <div>
                    <span className="block mb-1 font-medium text-neutral-900">Payment ID</span>
                    {orderResult.paymentId || 'Processing / None'}
                 </div>
                 <div>
                    <span className="block mb-1 font-medium text-neutral-900">Initiated At</span>
                    {orderResult.createdAt ? new Date(orderResult.createdAt).toLocaleString('en-IN') : 'N/A'}
                 </div>
                 <div>
                    <span className="block mb-1 font-medium text-neutral-900">Last Modified</span>
                    {orderResult.updatedAt ? new Date(orderResult.updatedAt).toLocaleString('en-IN') : 'N/A'}
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
