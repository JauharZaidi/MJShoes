import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineEye, HiArrowLeft, HiX, HiOutlineTag } from 'react-icons/hi';
import toast from 'react-hot-toast';
import Seo from '../components/Seo';
import { shippingChargeOf, isAvailable, DEFAULT_SHIPPING_CHARGE } from '../utils/pricing';

export default function Admin() {
  const { state, dispatch } = useStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [editingProduct, setEditingProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  // Product form
  const [form, setForm] = useState({
    name: '', brand: 'MJ Shoes', price: '', category: 'sneakers', description: '',
    tag: '', material: '', sole: '', sizes: '7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12', sizeType: 'UK',
    colors: '', sizeStock: {}, shippingCharge: String(DEFAULT_SHIPPING_CHARGE), available: true, featured: false,
  });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  // Parses the comma-separated sizes field into a clean numeric list — shared
  // by the per-size stock rows (so they always match what's in the field) and
  // the final save (so sizeStock keys line up with what ProductDetail/checkout look up).
  const parseSizes = (sizesStr) => {
    const parsed = (sizesStr || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '')
      .map(Number)
      .filter(n => !isNaN(n));
    return parsed.length > 0 ? parsed : [7, 8, 9, 10, 11];
  };

  const formSizes = parseSizes(form.sizes);

  const updateSizeStock = (size, value) => {
    setForm(prev => ({ ...prev, sizeStock: { ...prev.sizeStock, [String(size)]: value } }));
  };

  const totalStockFromSizes = formSizes.reduce((sum, size) => sum + (Number(form.sizeStock[String(size)]) || 0), 0);

  // Coupon state
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  // Contact-form messages (read through the admin API; customers' emails
  // aren't readable from the browser directly)
  const [messages, setMessages] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [couponForm, setCouponForm] = useState({
    code: '', discountType: 'percentage', value: '', minOrderValue: '', usageLimit: '', expiryDate: '',
  });

  if (!state.user || state.user.role !== 'admin') {
    return (
      <main className="pt-16">
        <div className="container-main py-20 text-center">
          <h2 className="text-2xl font-light tracking-tight mb-4">Admin Access Required</h2>
          <p className="text-sm text-neutral-400 mb-6">Sign in with admin credentials.</p>
          <Link to="/login" className="btn-primary text-xs">Sign In</Link>
        </div>
      </main>
    );
  }

  const countedOrders = state.orders?.filter(o => o.status !== 'cancelled') || [];
  const totalRevenue = countedOrders.reduce((sum, o) => sum + (Number(o.total || o.totalAmount) || 0), 0);

  // Real revenue for the last 12 months, oldest first, ending with this month.
  const now = new Date();
  const monthlySales = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const total = countedOrders
      .filter(o => { const od = new Date(o.date); return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth(); })
      .reduce((sum, o) => sum + (Number(o.total || o.totalAmount) || 0), 0);
    return { label: d.toLocaleDateString('en-IN', { month: 'short' }), key: `${d.getFullYear()}-${d.getMonth()}`, total };
  });
  const maxMonthly = Math.max(...monthlySales.map(m => m.total), 1);
  const lowStock = state.products?.filter(p => p.stock <= 5) || [];
  const tabs = ['overview', 'products', 'orders', 'coupons', 'messages'];

  // ─── Product Handlers ───

  const openNew = () => {
    setEditingProduct(null);
    setForm({
      name: '', brand: 'MJ Shoes', price: '', category: 'sneakers', description: '',
      tag: '', material: '', sole: '', sizes: '7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12', sizeType: 'UK',
      colors: '', sizeStock: {}, shippingCharge: String(DEFAULT_SHIPPING_CHARGE), available: true, featured: false,
    });
    setImages([]);
    setImagePreviews([]);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    // Legacy products (saved before per-size stock existed) won't have sizeStock yet —
    // leave those rows blank rather than guessing a split, so the owner sets real numbers.
    const sizeStock = {};
    (p.sizes || [7, 8, 9, 10, 11]).forEach(size => {
      const key = String(size);
      if (p.sizeStock && Object.prototype.hasOwnProperty.call(p.sizeStock, key)) {
        sizeStock[key] = String(p.sizeStock[key]);
      }
    });
    setForm({
      name: p.name, brand: p.brand || 'MJ Shoes', price: p.price.toString(), category: p.category,
      description: p.description,
      tag: p.tag || '', material: p.material || '', sole: p.sole || '',
      sizes: (p.sizes || [7, 8, 9, 10, 11]).join(', '),
      sizeType: p.sizeType || 'UK',
      colors: (p.colors || ['Default']).join(', '),
      sizeStock,
      shippingCharge: String(shippingChargeOf(p)),
      available: isAvailable(p),
      featured: !!p.featured,
    });
    setImages([]);
    setImagePreviews([]);
    setShowModal(true);
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setImages(files);
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setImagePreviews(files.map(f => URL.createObjectURL(f)));
    }
  };

  const uploadImages = async (files) => {
    const { auth } = await import('../firebase');
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const idToken = await user.getIdToken();

    const formData = new FormData();
    files.forEach(file => formData.append('images', file));

    const res = await fetch('/api/admin/upload-images', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }

    const data = await res.json();
    return data.urls;
  };

  // The checkout server (server/index.js) caches each product doc in Redis for an hour.
  // Without telling it to drop that cache, a price/stock edit made here could silently
  // not take effect at checkout for up to an hour. Best-effort: a failure here shouldn't
  // block the save itself, since the cache still expires on its own eventually.
  const invalidateProductCache = async (productId) => {
    try {
      const { auth } = await import('../firebase');
      const user = auth.currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();
      await fetch('/api/admin/invalidate-product-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ productId }),
      });
    } catch (err) {
      console.error('Cache invalidation failed:', err);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error('Fill required fields', { style: { fontSize: '13px' } });
      return;
    }
    if (!(Number(form.price) > 0)) {
      toast.error('Price must be greater than 0', { style: { fontSize: '13px' } });
      return;
    }
    if (form.shippingCharge === '' || !(Number(form.shippingCharge) >= 0)) {
      toast.error('Delivery charge must be 0 or more', { style: { fontSize: '13px' } });
      return;
    }

    setLoadingAction(true);
    try {
      const { collection, addDoc, doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');

      const productData = { ...form };
      productData.price = Number(productData.price);
      productData.shippingCharge = Number(form.shippingCharge);
      productData.available = !!form.available;
      productData.featured = !!form.featured;
      productData.rating = editingProduct ? editingProduct.rating : 5;
      productData.reviews = editingProduct ? editingProduct.reviews : 0;

      // Parse sizes from comma-separated string
      productData.sizes = parseSizes(form.sizes);
      productData.sizeType = form.sizeType || 'UK';

      // Per-size stock, keyed to match how ProductDetail/checkout look it up
      // (String(size)) — anything left blank counts as 0, not "unlimited".
      const sizeStock = {};
      productData.sizes.forEach(size => {
        sizeStock[String(size)] = Number(form.sizeStock[String(size)]) || 0;
      });
      productData.sizeStock = sizeStock;
      productData.stock = Object.values(sizeStock).reduce((sum, n) => sum + n, 0);

      productData.colors = form.colors
        .split(',')
        .map(c => c.trim())
        .filter(c => c !== '');
      if (productData.colors.length === 0) {
        productData.colors = ['Default'];
      }

      // Handle image upload
      let imageUrls = editingProduct?.images || ['/images/shoe-white.png'];
      if (images.length > 0) {
        try {
          toast.loading('Uploading images...', { id: 'img-upload' });
          imageUrls = await uploadImages(images);
          toast.success('Images uploaded', { id: 'img-upload', style: { fontSize: '13px' } });
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
          toast.error(`Image upload failed: ${uploadErr.message}`, { id: 'img-upload', style: { fontSize: '13px' } });
          setLoadingAction(false);
          return;
        }
      }
      productData.images = imageUrls;

      // Remove the raw 'sizes' string (we already parsed it)
      delete productData.description;
      const finalData = { ...productData, description: form.description };

      if (editingProduct) {
        const productId = editingProduct.id || editingProduct._id;
        await updateDoc(doc(db, 'products', productId), finalData);
        const mappedData = { ...finalData, id: productId };
        dispatch({ type: 'EDIT_PRODUCT', payload: mappedData });
        invalidateProductCache(productId);
        toast.success('Product updated', { style: { fontSize: '13px' } });
      } else {
        finalData.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, 'products'), finalData);
        const mappedData = { ...finalData, id: docRef.id };
        dispatch({ type: 'ADD_PRODUCT', payload: mappedData });
        toast.success('Product added', { style: { fontSize: '13px' } });
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
      toast.error('Error saving product', { style: { fontSize: '13px' } });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this product?')) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await deleteDoc(doc(db, 'products', id));
        dispatch({ type: 'DELETE_PRODUCT', payload: id });
        invalidateProductCache(id);
        toast.success('Product deleted', { style: { fontSize: '13px' } });
      } catch (error) {
        console.error(error);
        toast.error('Error deleting product', { style: { fontSize: '13px' } });
      }
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus, statusUpdatedAt: new Date().toISOString() });
      dispatch({ type: 'SET_ORDERS', payload: state.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o) });
      toast.success('Order status updated', { style: { fontSize: '13px' } });
    } catch (error) {
      console.error(error);
      toast.error('Failed to update status', { style: { fontSize: '13px' } });
    }
  };

  // CSV opens directly in Excel / Google Sheets. One row per order; the BOM
  // makes Excel read ₹ and non-English names as UTF-8. Cells starting with
  // = + - @ are prefixed with ' so a customer-typed name can't run as a formula.
  const exportOrdersToExcel = () => {
    const cell = (v) => {
      let s = v === undefined || v === null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const headers = ['Order ID', 'Date', 'Status', 'Customer', 'Email', 'Phone', 'Address', 'City', 'State', 'PIN', 'Country',
      'Items', 'Total Qty', 'Subtotal (₹)', 'Discount (₹)', 'Coupon', 'Shipping (₹)', 'GST (₹)', 'Total (₹)', 'Razorpay Payment ID', 'Paid At'];
    const rows = state.orders.map(o => {
      const a = o.shippingAddress || {};
      const items = o.items || [];
      return [
        o.id, new Date(o.date).toLocaleString('en-IN'), o.status,
        `${a.firstName || ''} ${a.lastName || ''}`.trim(), a.email, a.phone, a.address, a.city, a.state, a.zip, a.country,
        items.map(i => `${i.name} (${i.sizeType || 'UK'} ${i.size}) x${i.quantity}`).join('; '),
        items.reduce((n, i) => n + (i.quantity || 0), 0),
        o.subtotal, o.discountApplied || 0, o.couponCode, o.shippingCost, o.tax, o.total,
        o.paymentId, o.paidAt ? new Date(o.paidAt).toLocaleString('en-IN') : '',
      ].map(cell).join(',');
    });
    const csv = '﻿' + [headers.map(cell).join(','), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `mjshoes-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ─── Message Handlers ───

  const adminApi = async (path, options = {}) => {
    const { auth } = await import('../firebase');
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not signed in');
    const res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}`, ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const fetchMessages = async () => {
    setMessagesLoading(true);
    try {
      const data = await adminApi('/api/admin/messages');
      setMessages(data.messages);
    } catch (err) {
      console.error('Failed to load messages:', err);
      toast.error('Failed to load messages', { style: { fontSize: '13px' } });
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const setMessageStatus = async (id, status) => {
    try {
      await adminApi(`/api/admin/messages/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    } catch (err) {
      console.error(err);
      toast.error('Failed to update message', { style: { fontSize: '13px' } });
    }
  };

  // ─── Coupon Handlers ───

  const fetchCoupons = async () => {
    setCouponsLoading(true);
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const snap = await getDocs(collection(db, 'coupons'));
      const list = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
      list.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      setCoupons(list);
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
      toast.error('Failed to load coupons', { style: { fontSize: '13px' } });
    } finally {
      setCouponsLoading(false);
    }
  };

  const openNewCoupon = () => {
    setEditingCoupon(null);
    setCouponForm({ code: '', discountType: 'percentage', value: '', minOrderValue: '', usageLimit: '', expiryDate: '' });
    setShowCouponModal(true);
  };

  const openEditCoupon = (c) => {
    setEditingCoupon(c);
    setCouponForm({
      code: c.code || '',
      discountType: c.discountType || 'percentage',
      value: (c.value || '').toString(),
      minOrderValue: (c.minOrderValue || '').toString(),
      usageLimit: (c.usageLimit || '').toString(),
      // Local calendar date (not UTC), so re-saving never shifts expiry by a day.
      expiryDate: c.expiryDate ? new Date(c.expiryDate).toLocaleDateString('en-CA') : '',
    });
    setShowCouponModal(true);
  };

  const handleSaveCoupon = async () => {
    if (!couponForm.code || !couponForm.value || !couponForm.usageLimit || !couponForm.expiryDate) {
      toast.error('Fill all required coupon fields', { style: { fontSize: '13px' } });
      return;
    }

    const value = Number(couponForm.value);
    if (couponForm.discountType === 'percentage' && (value <= 0 || value > 100)) {
      toast.error('Percentage must be between 1 and 100', { style: { fontSize: '13px' } });
      return;
    }
    if (value <= 0) {
      toast.error('Value must be greater than 0', { style: { fontSize: '13px' } });
      return;
    }

    // The date picker gives "YYYY-MM-DD"; make the coupon last through the end
    // of that day locally instead of expiring at midnight UTC on the morning of it.
    const expiryDate = new Date(`${couponForm.expiryDate}T23:59:59`);
    if (expiryDate <= new Date()) {
      toast.error('Expiry date must be in the future', { style: { fontSize: '13px' } });
      return;
    }

    const code = couponForm.code.toUpperCase().trim();
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) {
      toast.error('Code must be 3–20 letters/numbers (no spaces)', { style: { fontSize: '13px' } });
      return;
    }
    if (coupons.some(c => c.code === code && c._id !== editingCoupon?._id)) {
      toast.error(`A coupon called ${code} already exists`, { style: { fontSize: '13px' } });
      return;
    }

    setLoadingAction(true);
    try {
      const { collection, addDoc, doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');

      const data = {
        code,
        discountType: couponForm.discountType,
        value: value,
        minOrderValue: Number(couponForm.minOrderValue) || 0,
        usageLimit: Number(couponForm.usageLimit),
        expiryDate: expiryDate.toISOString(),
      };

      if (editingCoupon) {
        await updateDoc(doc(db, 'coupons', editingCoupon._id), data);
        toast.success('Coupon updated', { style: { fontSize: '13px' } });
      } else {
        data.usedCount = 0;
        await addDoc(collection(db, 'coupons'), data);
        toast.success('Coupon created', { style: { fontSize: '13px' } });
      }

      setShowCouponModal(false);
      fetchCoupons();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save coupon', { style: { fontSize: '13px' } });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (confirm('Delete this coupon?')) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        await deleteDoc(doc(db, 'coupons', id));
        toast.success('Coupon deleted', { style: { fontSize: '13px' } });
        fetchCoupons();
      } catch (err) {
        console.error(err);
        toast.error('Failed to delete coupon', { style: { fontSize: '13px' } });
      }
    }
  };

  const getCouponStatus = (c) => {
    if (new Date() > new Date(c.expiryDate)) return { label: 'Expired', color: 'text-red-500 bg-red-50' };
    if ((c.usedCount || 0) >= c.usageLimit) return { label: 'Exhausted', color: 'text-amber-600 bg-amber-50' };
    return { label: 'Active', color: 'text-green-600 bg-green-50' };
  };

  return (
    <main className="pt-16 bg-neutral-50 min-h-screen">
      <Seo title="Admin Dashboard" path="/admin" noindex />
      <div className="container-main py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-neutral-400 hover:text-neutral-900 transition-base">
              <HiArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-medium tracking-tight">Admin Dashboard</h1>
              <p className="text-xs text-neutral-400">{state.user.email}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-neutral-200 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'coupons' && coupons.length === 0) fetchCoupons();
                if (tab === 'messages' && messages === null) fetchMessages();
              }}
              className={`px-5 py-3 text-xs uppercase tracking-widest transition-base border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6 fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Revenue', value: `₹${Math.round(totalRevenue).toLocaleString('en-IN')}` },
                { label: 'Products', value: state.products?.length || 0 },
                { label: 'Orders', value: state.orders?.length || 0 },
                { label: 'Low Stock', value: lowStock.length },
              ].map(stat => (
                <div key={stat.label} className="bg-white border border-neutral-100 p-6">
                  <p className="text-xs text-neutral-400 uppercase tracking-widest mb-2">{stat.label}</p>
                  <p className="text-2xl font-medium">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Sales Chart */}
            <div className="bg-white border border-neutral-100 p-6">
              <h3 className="text-xs uppercase tracking-widest font-medium mb-6">Monthly Sales</h3>
              <div className="flex items-end gap-2 h-40">
                {monthlySales.map(m => (
                  <div key={m.key} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5" title={`${m.label}: ₹${m.total.toLocaleString('en-IN')}`}>
                    <div
                      className="w-full bg-neutral-900 transition-all duration-300 hover:bg-neutral-700"
                      style={{ height: m.total > 0 ? `${Math.max(4, (m.total / maxMonthly) * 100)}%` : '1px' }}
                    />
                    <span className="text-[9px] text-neutral-400">{m.label.charAt(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Stock */}
            {lowStock.length > 0 && (
              <div className="bg-white border border-neutral-100 p-6">
                <h3 className="text-xs uppercase tracking-widest font-medium mb-4">Low Stock Alerts</h3>
                <div className="space-y-3">
                  {lowStock.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neutral-50">
                          <img src={p.images?.[0] || '/images/shoe-white.png'} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm">{p.name}</p>
                          <p className="text-xs text-red-500">{p.stock} remaining</p>
                        </div>
                      </div>
                      <button onClick={() => openEdit(p)} className="text-xs text-neutral-400 hover:text-neutral-900 transition-base">
                        Update
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Products */}
        {activeTab === 'products' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium">All Products ({state.products?.length || 0})</h2>
              <button onClick={openNew} className="btn-primary text-xs flex items-center gap-2">
                <HiOutlinePlus className="w-3 h-3" /> Add Product
              </button>
            </div>

            {/* Mobile: stacked cards (this is the tab the owner lives in on a phone) */}
            <div className="sm:hidden space-y-3">
              {state.products?.map(p => (
                <div key={p.id} className="bg-white border border-neutral-100 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-14 h-14 bg-neutral-50 flex-shrink-0">
                      <img src={p.images?.[0] || '/images/shoe-white.png'} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-neutral-400 capitalize">{p.category}{!isAvailable(p) && <span className="ml-2 text-red-500 normal-case">· Hidden</span>}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">₹{Number(p.price).toLocaleString('en-IN')} <span className="text-xs text-neutral-400 font-normal">+ ₹{shippingChargeOf(p)} delivery</span></span>
                    <span className={`text-sm ${p.stock === 0 ? 'text-red-600 font-bold' : p.stock <= 5 ? 'text-red-500' : 'text-neutral-900'}`}>
                      {p.stock === 0 ? 'Out of Stock' : `${p.stock} in stock`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-neutral-50">
                    <Link to={`/product/${p.id}`} className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 text-xs text-neutral-500 border border-neutral-200">
                      <HiOutlineEye className="w-4 h-4" /> View
                    </Link>
                    <button onClick={() => openEdit(p)} className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 text-xs text-neutral-700 border border-neutral-200">
                      <HiOutlinePencil className="w-4 h-4" /> Edit
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 text-xs text-red-500 border border-red-100">
                      <HiOutlineTrash className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop/tablet: table */}
            <div className="hidden sm:block bg-white border border-neutral-100 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Product</th>
                    <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Category</th>
                    <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Price</th>
                    <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Delivery</th>
                    <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Stock</th>
                    <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Status</th>
                    <th className="text-right text-[10px] text-neutral-400 uppercase tracking-widest p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.products?.map(p => (
                    <tr key={p.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-base">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-neutral-50 flex-shrink-0">
                            <img src={p.images?.[0] || '/images/shoe-white.png'} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-sm">{p.name}</p>
                            {p.tag && <p className="text-[10px] text-neutral-400">{p.tag}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-neutral-500 capitalize">{p.category}</td>
                      <td className="p-4 text-sm">₹{Number(p.price).toLocaleString('en-IN')}</td>
                      <td className="p-4 text-sm">{shippingChargeOf(p) === 0 ? 'Free' : `₹${shippingChargeOf(p)}`}</td>
                      <td className="p-4">
                        <span className={`text-sm ${p.stock === 0 ? 'text-red-600 font-bold' : p.stock <= 5 ? 'text-red-500' : 'text-neutral-900'}`}>
                          {p.stock === 0 ? 'Out of Stock' : p.stock}
                        </span>
                      </td>
                      <td className="p-4 text-xs">
                        {isAvailable(p) ? <span className="text-green-600">Live</span> : <span className="text-red-500">Hidden</span>}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/product/${p.id}`} className="p-2 text-neutral-300 hover:text-neutral-900 transition-base">
                            <HiOutlineEye className="w-4 h-4" />
                          </Link>
                          <button onClick={() => openEdit(p)} className="p-2 text-neutral-300 hover:text-neutral-900 transition-base">
                            <HiOutlinePencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-2 text-neutral-300 hover:text-red-500 transition-base">
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Orders */}
        {activeTab === 'orders' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium">All Orders ({state.orders?.length || 0})</h2>
              {state.orders?.length > 0 && (
                <button onClick={exportOrdersToExcel} className="btn-outline text-xs">
                  Export to Excel
                </button>
              )}
            </div>
            {(!state.orders || state.orders.length === 0) ? (
              <div className="bg-white border border-neutral-100 p-12 text-center">
                <p className="text-sm text-neutral-400">No orders yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {state.orders.map(order => (
                  <div key={order.id} className="bg-white border border-neutral-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs font-mono font-medium">{order.id}</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">{new Date(order.date).toLocaleString()}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <p className="text-sm font-medium">₹{Number(order.total).toLocaleString('en-IN')}</p>
                        <select 
                          className="text-[11px] font-medium uppercase tracking-widest bg-transparent border-b border-neutral-300 py-1"
                          value={order.status || 'pending'}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {order.items.map(item => (
                        <div key={`${item.product || item.id}-${item.size}`} className="flex items-center gap-2 bg-neutral-50 p-2 pr-4">
                          <div className="w-8 h-8 bg-white">
                            <img src={item.image || '/images/shoe-white.png'} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-xs">{item.name}</p>
                            <p className="text-[10px] text-neutral-400">{item.sizeType || 'UK'} {item.size} × {item.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {order.shippingAddress && (
                      <p className="text-xs text-neutral-400 mt-4 pt-4 border-t border-neutral-50">
                        Ships to: {order.shippingAddress.firstName} {order.shippingAddress.lastName}, {order.shippingAddress.city}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {activeTab === 'messages' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium">
                Messages ({messages?.filter(m => m.status !== 'resolved').length || 0} open)
              </h2>
              <button onClick={fetchMessages} disabled={messagesLoading} className="btn-outline text-xs disabled:opacity-50">
                {messagesLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            {messagesLoading && messages === null ? (
              <p className="text-sm text-neutral-400">Loading…</p>
            ) : !messages || messages.length === 0 ? (
              <div className="bg-white border border-neutral-100 p-12 text-center">
                <p className="text-sm text-neutral-400">No messages yet. Contact-form submissions will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(m => (
                  <div key={m.id} className={`bg-white border p-5 ${m.status === 'resolved' ? 'border-neutral-100 opacity-60' : 'border-neutral-200'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m.name}</p>
                        <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to MJ Shoes')}`} className="text-xs text-neutral-500 underline underline-offset-2 break-all">{m.email}</a>
                      </div>
                      <p className="text-[11px] text-neutral-400 flex-shrink-0">{m.createdAt ? new Date(m.createdAt).toLocaleString('en-IN') : ''}</p>
                    </div>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap break-words mb-4">{m.message}</p>
                    <button
                      onClick={() => setMessageStatus(m.id, m.status === 'resolved' ? 'pending' : 'resolved')}
                      className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900"
                    >
                      {m.status === 'resolved' ? 'Reopen' : 'Mark resolved'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Coupons */}
        {activeTab === 'coupons' && (
          <div className="fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium">Coupons ({coupons.length})</h2>
              <button onClick={openNewCoupon} className="btn-primary text-xs flex items-center gap-2">
                <HiOutlinePlus className="w-3 h-3" /> Add Coupon
              </button>
            </div>

            {couponsLoading ? (
              <div className="bg-white border border-neutral-100 p-12 text-center">
                <p className="text-sm text-neutral-400">Loading coupons...</p>
              </div>
            ) : coupons.length === 0 ? (
              <div className="bg-white border border-neutral-100 p-12 text-center">
                <HiOutlineTag className="w-8 h-8 text-neutral-200 mx-auto mb-4" />
                <p className="text-sm text-neutral-400 mb-4">No coupons yet.</p>
                <button onClick={openNewCoupon} className="btn-outline text-xs">Create your first coupon</button>
              </div>
            ) : (
              <div className="bg-white border border-neutral-100 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-100 bg-neutral-50">
                      <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Code</th>
                      <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4 hidden sm:table-cell">Type</th>
                      <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Value</th>
                      <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4 hidden sm:table-cell">Min Order</th>
                      <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Usage</th>
                      <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4 hidden sm:table-cell">Expiry</th>
                      <th className="text-left text-[10px] text-neutral-400 uppercase tracking-widest p-4">Status</th>
                      <th className="text-right text-[10px] text-neutral-400 uppercase tracking-widest p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map(c => {
                      const status = getCouponStatus(c);
                      return (
                        <tr key={c._id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-base">
                          <td className="p-4 text-sm font-mono font-medium">{c.code}</td>
                          <td className="p-4 text-xs text-neutral-500 capitalize hidden sm:table-cell">{c.discountType}</td>
                          <td className="p-4 text-sm">{c.discountType === 'percentage' ? `${c.value}%` : `₹${c.value}`}</td>
                          <td className="p-4 text-xs text-neutral-500 hidden sm:table-cell">₹{(c.minOrderValue || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-xs">{c.usedCount || 0} / {c.usageLimit}</td>
                          <td className="p-4 text-xs text-neutral-500 hidden sm:table-cell">{new Date(c.expiryDate).toLocaleDateString()}</td>
                          <td className="p-4">
                            <span className={`text-[10px] font-medium uppercase tracking-widest px-2 py-1 ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditCoupon(c)} className="p-2 text-neutral-300 hover:text-neutral-900 transition-base">
                                <HiOutlinePencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteCoupon(c._id)} className="p-2 text-neutral-300 hover:text-red-500 transition-base">
                                <HiOutlineTrash className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowModal(false)} />
          <div className="relative bg-white p-6 sm:p-8 w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[80vh] overflow-y-auto fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 -m-2 text-neutral-400 hover:text-neutral-900">
                <HiX className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input-field" disabled={loadingAction} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Price *</label>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className="input-field" disabled={loadingAction} />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input-field" disabled={loadingAction}>
                    <option value="sneakers">Sneakers</option>
                    <option value="sports">Sports</option>
                    <option value="casual">Casual</option>
                    <option value="limited">Limited Edition</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Delivery charge (₹) *</label>
                  <input type="number" min="0" value={form.shippingCharge} onChange={e => setForm(p => ({ ...p, shippingCharge: e.target.value }))} className="input-field" disabled={loadingAction} />
                  <p className="text-[10px] text-neutral-400 mt-1">0 = free. Order pays the highest in the cart; free from ₹15,000.</p>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Availability</label>
                  <label className="flex items-center gap-2 min-h-[42px] text-sm cursor-pointer">
                    <input type="checkbox" checked={form.available} onChange={e => setForm(p => ({ ...p, available: e.target.checked }))} disabled={loadingAction} />
                    Available for sale
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.featured} onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))} disabled={loadingAction} />
                    Show on home page
                  </label>
                  <p className="text-[10px] text-neutral-400 mt-1">Unticked = hidden from the shop and can't be ordered.</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input-field h-20 resize-none" disabled={loadingAction} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-neutral-400 mb-1.5 block">Sizes (comma-separated)</label>
                  <input value={form.sizes} onChange={e => setForm(p => ({ ...p, sizes: e.target.value }))} className="input-field" placeholder="7, 7.5, 8, 9, 10" disabled={loadingAction} />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Size Type</label>
                  <select value={form.sizeType} onChange={e => setForm(p => ({ ...p, sizeType: e.target.value }))} className="input-field" disabled={loadingAction}>
                    <option value="UK">UK</option>
                    <option value="US">US</option>
                    <option value="EU">EU</option>
                  </select>
                </div>
              </div>

              {/* Per-size stock */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-neutral-400 block">Stock per size *</label>
                  <span className="text-xs text-neutral-400">Total: {totalStockFromSizes}</span>
                </div>
                {editingProduct && !editingProduct.sizeStock && (
                  <p className="text-[11px] text-amber-600 mb-2">
                    This listing was saved before per-size stock existed (total was {editingProduct.stock}). Set the real count for each size below.
                  </p>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {formSizes.map(size => (
                    <div key={size} className="flex items-center gap-1.5 border border-neutral-200 px-2">
                      <span className="text-xs text-neutral-500 flex-shrink-0">{size}</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={form.sizeStock[String(size)] ?? ''}
                        onChange={e => updateSizeStock(size, e.target.value)}
                        placeholder="0"
                        className="w-full min-w-0 py-2.5 text-sm outline-none"
                        disabled={loadingAction}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Colors (comma-separated)</label>
                <input value={form.colors} onChange={e => setForm(p => ({ ...p, colors: e.target.value }))} className="input-field" placeholder="Black, White" disabled={loadingAction} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Material</label>
                  <input value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))} className="input-field" disabled={loadingAction} />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Sole</label>
                  <input value={form.sole} onChange={e => setForm(p => ({ ...p, sole: e.target.value }))} className="input-field" disabled={loadingAction} />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Photos</label>
                {editingProduct?.images && editingProduct.images.length > 0 && images.length === 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {editingProduct.images.map((img, i) => (
                      <div key={i} className="w-14 h-14 bg-neutral-50 border border-neutral-100">
                        <img src={img} alt={`Current ${i+1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    <span className="text-[10px] text-neutral-400 self-center">Current photos</span>
                  </div>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="input-field"
                  disabled={loadingAction}
                  style={{ display: 'block', padding: '10px' }}
                />
                {imagePreviews.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="w-16 h-16 bg-neutral-50 border border-neutral-200">
                        <img src={src} alt={`Selected ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                {images.length > 0 && (
                  <p className="text-[10px] text-neutral-400 mt-1">{images.length} photo(s) selected — will replace existing photos</p>
                )}
              </div>
              <div className="flex gap-3 pt-2 pb-2">
                <button onClick={handleSave} className="btn-primary flex-1 text-xs disabled:opacity-50" disabled={loadingAction}>
                  {loadingAction ? 'Saving...' : (editingProduct ? 'Update' : 'Add Product')}
                </button>
                <button onClick={() => setShowModal(false)} className="btn-outline flex-1 text-xs" disabled={loadingAction}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coupon Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowCouponModal(false)} />
          <div className="relative bg-white p-8 w-full max-w-md max-h-[80vh] overflow-y-auto fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-medium">{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</h2>
              <button onClick={() => setShowCouponModal(false)} className="text-neutral-400 hover:text-neutral-900">
                <HiX className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Coupon Code *</label>
                <input
                  value={couponForm.code}
                  onChange={e => setCouponForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="input-field uppercase font-mono"
                  placeholder="e.g. SUMMER25"
                  disabled={loadingAction}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Discount Type *</label>
                  <select
                    value={couponForm.discountType}
                    onChange={e => setCouponForm(p => ({ ...p, discountType: e.target.value }))}
                    className="input-field"
                    disabled={loadingAction}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">
                    Value * {couponForm.discountType === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    value={couponForm.value}
                    onChange={e => setCouponForm(p => ({ ...p, value: e.target.value }))}
                    className="input-field"
                    placeholder={couponForm.discountType === 'percentage' ? '20' : '500'}
                    disabled={loadingAction}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Min Order (₹)</label>
                  <input
                    type="number"
                    value={couponForm.minOrderValue}
                    onChange={e => setCouponForm(p => ({ ...p, minOrderValue: e.target.value }))}
                    className="input-field"
                    placeholder="2000"
                    disabled={loadingAction}
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 mb-1.5 block">Usage Limit *</label>
                  <input
                    type="number"
                    value={couponForm.usageLimit}
                    onChange={e => setCouponForm(p => ({ ...p, usageLimit: e.target.value }))}
                    className="input-field"
                    placeholder="100"
                    disabled={loadingAction}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Expiry Date *</label>
                <input
                  type="date"
                  value={couponForm.expiryDate}
                  onChange={e => setCouponForm(p => ({ ...p, expiryDate: e.target.value }))}
                  className="input-field"
                  disabled={loadingAction}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveCoupon} className="btn-primary flex-1 text-xs disabled:opacity-50" disabled={loadingAction}>
                  {loadingAction ? 'Saving...' : (editingCoupon ? 'Update Coupon' : 'Create Coupon')}
                </button>
                <button onClick={() => setShowCouponModal(false)} className="btn-outline flex-1 text-xs" disabled={loadingAction}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
