import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { HiOutlineLogout, HiOutlineHeart, HiOutlineClipboardList, HiOutlineCog } from 'react-icons/hi';
import Seo from '../components/Seo';

export default function Account() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();

  if (!state.user) {
    return (
      <main className="pt-16">
        <Seo title="My Account" path="/account" noindex />
        <div className="container-main py-20 text-center">
          <h2 className="text-2xl font-light tracking-tight mb-4">Please sign in</h2>
          <Link to="/login" className="btn-primary text-xs">Sign In</Link>
        </div>
      </main>
    );
  }

  const handleLogout = async () => {
    try {
      const { signOut } = await import('firebase/auth');
      const { auth } = await import('../firebase');
      await signOut(auth);
      
      dispatch({ type: 'LOGOUT' });
      navigate('/');
    } catch (e) {
      console.error('Error logging out:', e);
    }
  };

  return (
    <main className="pt-16">
      <Seo title="My Account" path="/account" noindex />
      <div className="container-main py-12 md:py-16 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-light tracking-tight mb-1">My Account</h1>
            <p className="text-sm text-neutral-400">Welcome, {state.user.name}</p>
          </div>
          <button onClick={handleLogout} className="btn-outline text-xs flex items-center gap-2" id="logout-btn">
            <HiOutlineLogout className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <Link to="/wishlist" className="border border-neutral-100 p-6 hover:border-neutral-300 transition-base">
            <HiOutlineHeart className="w-5 h-5 text-neutral-400 mb-3" />
            <h3 className="text-sm font-medium mb-1">Wishlist</h3>
            <p className="text-xs text-neutral-400">{state.wishlist.length} items</p>
          </Link>
          <div className="border border-neutral-100 p-6">
            <HiOutlineClipboardList className="w-5 h-5 text-neutral-400 mb-3" />
            <h3 className="text-sm font-medium mb-1">Orders</h3>
            <p className="text-xs text-neutral-400">{state.orders.length} order{state.orders.length === 1 ? '' : 's'}</p>
          </div>
          {state.user.role === 'admin' && (
            <Link to="/admin" className="border border-neutral-900 p-6 hover:bg-neutral-50 transition-base">
              <HiOutlineCog className="w-5 h-5 text-neutral-900 mb-3" />
              <h3 className="text-sm font-medium mb-1">Admin Dashboard</h3>
              <p className="text-xs text-neutral-400">Manage store</p>
            </Link>
          )}
        </div>

        {/* Profile */}
        <div className="border border-neutral-100 p-8 mb-8">
          <h2 className="text-xs uppercase tracking-widest font-medium mb-6">Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-neutral-400 mb-1">Name</p>
              <p className="text-sm">{state.user.name}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">Email</p>
              <p className="text-sm">{state.user.email}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">Member Since</p>
              <p className="text-sm">{new Date(state.user.joinDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">Role</p>
              <p className="text-sm capitalize">{state.user.role}</p>
            </div>
          </div>
        </div>

        {/* Orders */}
        <div className="border border-neutral-100 p-8">
          <h2 className="text-xs uppercase tracking-widest font-medium mb-6">Order History</h2>
          {state.orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-neutral-400 mb-4">No orders yet</p>
              <Link to="/shop" className="text-xs uppercase tracking-widest text-neutral-900 hover:text-neutral-500 transition-base">
                Start Shopping →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {state.orders.map(order => (
                <div key={order.id} className="py-5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-medium font-mono">{order.id}</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{new Date(order.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">₹{Number(order.total).toLocaleString('en-IN')}</p>
                      <p className={`text-[11px] capitalize ${order.status === 'cancelled' ? 'text-red-500' : 'text-green-600'}`}>{order.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {order.items.map(item => (
                      <div key={`${item.product || item.id}-${item.size}`} className="w-10 h-10 flex-shrink-0 bg-neutral-50">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
