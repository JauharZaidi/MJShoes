import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import ProductCard from '../components/ui/ProductCard';
import Reviews from '../components/ui/Reviews';
import Seo from '../components/Seo';
import { HiArrowLeft, HiOutlineHeart, HiHeart, HiOutlineTruck, HiOutlineRefresh, HiOutlineShieldCheck } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { isAvailable, shippingChargeOf, FREE_SHIPPING_THRESHOLD } from '../utils/pricing';

export default function ProductDetail() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const product = state.products.find(p => String(p.id) === String(id) || String(p._id) === String(id));
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [zooming, setZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  if (state.loading) {
    return (
      <main className="pt-16">
        <Seo title="Loading…" path={`/product/${id}`} noindex />
        <div className="container-main py-20 text-center">
          <p className="text-neutral-400 mb-4">Loading product...</p>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="pt-16">
        <Seo title="Product Not Found" path={`/product/${id}`} noindex />
        <div className="container-main py-20 text-center">
          <p className="text-neutral-400 mb-4">Product not found</p>
          <Link to="/shop" className="btn-outline text-xs">Back to Shop</Link>
        </div>
      </main>
    );
  }

  const isWishlisted = state.wishlist.includes(product.id || product._id);
  const related = state.products.filter(p => isAvailable(p) && p.category === product.category && (p.id || p._id) !== (product.id || product._id)).slice(0, 4);

  const unavailable = !isAvailable(product);
  const outOfStock = product.stock === 0 || unavailable;

  const sizeType = product.sizeType || 'UK';

  // Per-size stock is the source of truth once a product has been edited to use it;
  // legacy products without sizeStock fall back to "available if the product isn't out of stock".
  const stockForSize = (size) => {
    if (product.sizeStock && Object.prototype.hasOwnProperty.call(product.sizeStock, String(size))) {
      return product.sizeStock[String(size)];
    }
    return outOfStock ? 0 : Infinity;
  };

  const handleAddToCart = () => {
    if (outOfStock) {
      toast.error('Product is out of stock', { style: { fontSize: '13px' } });
      return;
    }
    if (!selectedSize) {
      toast.error('Please select a size', { style: { fontSize: '13px' } });
      return;
    }
    if (stockForSize(selectedSize) <= 0) {
      toast.error('That size is out of stock', { style: { fontSize: '13px' } });
      return;
    }
    dispatch({
      type: 'ADD_TO_CART',
      payload: {
        id: product.id || product._id,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || '/images/shoe-white.png',
        size: selectedSize,
        sizeType: sizeType,
        quantity: 1,
      },
    });
    toast.success('Added to bag', { style: { fontSize: '13px' } });
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  };
  
  const images = product.images?.length > 0 ? product.images : ['/images/shoe-white.png'];
  const absoluteImage = images[0]?.startsWith('http') ? images[0] : `https://mjshoes.xyz${images[0]}`;
  const productId = product.id || product._id;

  return (
    <main className="pt-16">
      <Seo
        title={product.name}
        path={`/product/${productId}`}
        description={product.description ? product.description.slice(0, 155) : `Shop ${product.name} at MJ Shoes — premium handcrafted footwear.`}
        image={absoluteImage}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description || undefined,
          image: images.map(img => (img.startsWith('http') ? img : `https://mjshoes.xyz${img}`)),
          sku: productId,
          offers: {
            '@type': 'Offer',
            url: `https://mjshoes.xyz/product/${productId}`,
            priceCurrency: 'INR',
            price: product.price,
            availability: outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          },
        }}
      />
      <div className="container-main py-8">
        <Link to="/shop" className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-neutral-900 transition-base mb-8" id="back-to-shop">
          <HiArrowLeft className="w-3 h-3" /> Back to Shop
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Images */}
          <div>
            <div
              className="bg-neutral-50 aspect-square overflow-hidden cursor-zoom-in mb-4"
              onMouseEnter={() => setZooming(true)}
              onMouseLeave={() => setZooming(false)}
              onMouseMove={handleMouseMove}
            >
              <img
                src={images[selectedImage] || images[0]}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-300"
                style={zooming ? {
                  transform: 'scale(2)',
                  transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                } : {}}
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 flex-shrink-0 bg-neutral-50 overflow-hidden transition-base ${
                      selectedImage === i ? 'ring-1 ring-neutral-900' : 'ring-1 ring-transparent hover:ring-neutral-200'
                    }`}
                  >
                    <img src={img} alt={`${product.name} view ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="lg:py-4">
            {product.tag && (
              <p className="section-label mb-3">{product.tag}</p>
            )}
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight mb-2">{product.name}</h1>
            <p className="text-sm text-neutral-400 mb-6">{product.brand || 'MJ Shoes'}</p>

            <p className="text-xl font-medium mb-1">₹{Number(product.price).toLocaleString('en-IN')}</p>
            <p className="text-xs text-neutral-400 mb-8">
              {shippingChargeOf(product) === 0 ? 'Free delivery' : `+ ₹${shippingChargeOf(product)} delivery · free on orders over ₹${FREE_SHIPPING_THRESHOLD.toLocaleString('en-IN')}`}
            </p>

            <p className="text-sm text-neutral-500 leading-relaxed mb-8">
              {product.description}
            </p>

            {/* Size */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase tracking-widest font-medium">Select Size ({sizeType})</span>
                <Link to="/size-guide" className="text-xs text-neutral-400 hover:text-neutral-900 underline underline-offset-4 transition-base">Size Guide</Link>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {(product.sizes || [7, 8, 9, 10, 11]).map(size => {
                  const sizeOutOfStock = outOfStock || stockForSize(size) <= 0;
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      disabled={sizeOutOfStock}
                      title={sizeOutOfStock ? 'Out of stock' : undefined}
                      className={`py-3 text-xs font-medium transition-base ${
                        selectedSize === size
                          ? 'bg-neutral-900 text-white'
                          : sizeOutOfStock ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed border border-neutral-100 line-through' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                      }`}
                      id={`size-${size}`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-10">
              <button
                onClick={handleAddToCart}
                disabled={outOfStock}
                className={`flex-1 ${outOfStock ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed py-4 uppercase tracking-widest text-[11px] font-medium' : 'btn-primary'}`}
                id="add-to-cart"
              >
                {unavailable ? 'Currently Unavailable' : outOfStock ? 'Out of Stock' : 'Add to Bag'}
              </button>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_WISHLIST', payload: product.id || product._id })}
                className="w-12 h-12 flex items-center justify-center border border-neutral-200 hover:border-neutral-900 transition-base"
                id="wishlist-btn"
                aria-label="Toggle wishlist"
              >
                {isWishlisted ? (
                  <HiHeart className="w-4 h-4 text-neutral-900" />
                ) : (
                  <HiOutlineHeart className="w-4 h-4 text-neutral-400" />
                )}
              </button>
            </div>

            {/* Trust */}
            <div className="space-y-4 pt-8 border-t border-neutral-100">
              {[
                { icon: HiOutlineTruck, text: 'Free shipping on orders over ₹15,000' },
                { icon: HiOutlineRefresh, text: '30-day hassle-free returns' },
                { icon: HiOutlineShieldCheck, text: 'Secure checkout' },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                  <span className="text-xs text-neutral-400">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Details */}
            {(product.material || product.sole || outOfStock) && (
              <div className="mt-8 pt-8 border-t border-neutral-100">
                <h3 className="text-xs uppercase tracking-widest font-medium mb-4">Details</h3>
                <div className="space-y-2 text-sm text-neutral-500">
                  {outOfStock && <p className="text-red-600 font-medium">Currently unavailable</p>}
                  {product.material && <p>Material: {product.material}</p>}
                  {product.sole && <p>Sole: {product.sole}</p>}
                </div>
              </div>
            )}
            
            <Reviews productId={product.id || product._id} user={state.user} />
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-20 mb-8">
            <div className="divider mb-12" />
            <h2 className="text-2xl font-light tracking-tight mb-10">You May Also Like</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
