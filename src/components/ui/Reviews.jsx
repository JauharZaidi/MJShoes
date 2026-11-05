import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function Reviews({ productId, user }) {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      const q = query(collection(db, 'reviews'), where('product', '==', productId));
      const querySnapshot = await getDocs(q);
      const fetchedReviews = querySnapshot.docs.map(doc => ({ ...doc.data(), _id: doc.id }));
      fetchedReviews.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReviews(fetchedReviews);
    } catch (error) {
      console.error('Failed to fetch reviews', error);
    }
  };

  // Only admins may write products, so the server recomputes the product's
  // rating and review count from the reviews collection itself.
  const syncProductStats = async () => {
    try {
      const { auth } = await import('../../firebase');
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      await fetch('/api/reviews/sync-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ productId }),
      });
    } catch (e) {
      console.error('Failed to sync product stats', e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast.error('Review cannot be empty', { style: { fontSize: '13px' } });
      return;
    }

    setLoading(true);
    try {
      const { doc, setDoc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      let newReviewsArray = [...reviews];
      if (editingId) {
        await updateDoc(doc(db, 'reviews', editingId), { rating, comment });
        newReviewsArray = newReviewsArray.map(r => r._id === editingId ? { ...r, rating, comment } : r);
        toast.success('Review updated', { style: { fontSize: '13px' } });
      } else {
        const reviewData = { 
          product: productId, 
          user: user.id || user._id, 
          name: user.name, 
          rating, 
          comment, 
          createdAt: new Date().toISOString() 
        };
        // One review per customer per product: the ID is fixed, and
        // firestore.rules only allows creating it under your own uid.
        const reviewId = `${productId}_${reviewData.user}`;
        await setDoc(doc(db, 'reviews', reviewId), reviewData);
        newReviewsArray.push({ ...reviewData, _id: reviewId });
        toast.success('Review added', { style: { fontSize: '13px' } });
      }
      
      await syncProductStats();

      setEditingId(null);
      setComment('');
      setRating(5);
      fetchReviews();
    } catch (error) {
      console.error(error);
      toast.error('Error submitting review', { style: { fontSize: '13px' } });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reviewId) => {
    if (confirm('Delete your review?')) {
      try {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../../firebase');
        await deleteDoc(doc(db, 'reviews', reviewId));
        
        await syncProductStats();

        toast.success('Review removed', { style: { fontSize: '13px' } });
        fetchReviews();
      } catch (error) {
        console.error(error);
        toast.error('Error deleting review', { style: { fontSize: '13px' } });
      }
    }
  };

  const handleEditInit = (review) => {
    setEditingId(review._id);
    setRating(review.rating);
    setComment(review.comment);
  };

  const averageRating = reviews.length
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)
    : 0;

  const hasReviewed = user ? reviews.some(r => r.user === user._id || r.user === user.id) : false;

  return (
    <div className="mt-16 pt-12 border-t border-neutral-100">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-medium tracking-tight">Customer Reviews</h2>
          <div className="flex items-center gap-3 mt-2 text-sm text-neutral-500">
            {reviews.length > 0 ? (
              <>
                <span className="text-neutral-900 font-medium">★ {averageRating} / 5</span>
                <span>•</span>
                <span>{reviews.length} Review{reviews.length !== 1 ? 's' : ''}</span>
              </>
            ) : (
              <span>No reviews yet</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          {!user ? (
            <div className="bg-neutral-50 p-6 text-center">
              <p className="text-sm text-neutral-500 mb-4">Please log in to write a review.</p>
              <a href="/login" className="btn-outline text-xs">Sign In</a>
            </div>
          ) : (hasReviewed && !editingId) ? (
            <div className="bg-neutral-50 p-6 text-center">
              <p className="text-sm text-neutral-500">You have already reviewed this product.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-neutral-50 p-6 space-y-4">
              <h3 className="text-xs uppercase tracking-widest font-medium mb-4">
                {editingId ? 'Edit Review' : 'Write a Review'}
              </h3>
              
              <div>
                <label className="text-xs text-neutral-400 mb-2 block">Rating</label>
                <div className="flex gap-1 -ml-2">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRating(num)}
                      className={`min-w-[40px] min-h-[40px] text-lg ${num <= rating ? 'text-neutral-900' : 'text-neutral-300'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-neutral-400 mb-1.5 block">Comment *</label>
                <textarea
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="input-field h-24 resize-none"
                  placeholder="Share your thoughts..."
                  disabled={loading}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading} className="btn-primary text-xs flex-1">
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
                {editingId && (
                  <button type="button" onClick={() => { setEditingId(null); setComment(''); setRating(5); }} className="btn-outline text-xs flex-1">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {reviews.length === 0 ? (
            <p className="text-sm text-neutral-500">Be the first to review this product.</p>
          ) : (
            reviews.map((review) => (
              <div key={review._id} className="pb-6 border-b border-neutral-100 last:border-0 last:pb-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium">{review.name}</p>
                    <div className="flex text-xs tracking-widest mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={i < review.rating ? 'text-neutral-900' : 'text-neutral-200'}>★</span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 leading-relaxed mb-3">
                  {review.comment}
                </p>
                {user && (user._id === review.user || user.id === review.user || user.role === 'admin') && (
                  <div className="flex gap-4 text-xs uppercase tracking-widest font-medium -ml-1">
                    {(user._id === review.user || user.id === review.user) && (
                      <button onClick={() => handleEditInit(review)} className="py-2 px-1 text-neutral-400 hover:text-neutral-900 transition-base">Edit</button>
                    )}
                    <button onClick={() => handleDelete(review._id)} className="py-2 px-1 text-red-400 hover:text-red-500 transition-base">Delete</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
