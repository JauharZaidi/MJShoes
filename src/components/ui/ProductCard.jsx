import { Link } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { HiOutlineHeart, HiHeart } from 'react-icons/hi';

export default function ProductCard({ product }) {
  const { state, dispatch } = useStore();
  const isWishlisted = state.wishlist.includes(product.id);

  const toggleWishlist = () => {
    dispatch({ type: 'TOGGLE_WISHLIST', payload: product.id });
  };

  return (
    <div className="group" id={`product-card-${product.id}`}>
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative bg-neutral-50 aspect-square overflow-hidden mb-4">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
          {product.tag && product.stock > 0 && (
            <span className="absolute top-4 left-4 text-[10px] font-medium tracking-widest uppercase text-neutral-500">
              {product.tag}
            </span>
          )}
          {product.stock <= 5 && product.stock > 0 && (
            <span className="absolute top-4 right-4 text-[10px] font-medium tracking-wide text-neutral-500">
              Only {product.stock} left
            </span>
          )}
          {product.stock === 0 && (
            <span className="absolute inset-0 bg-white/60 flex items-center justify-center text-xs font-medium uppercase tracking-widest text-neutral-900 border border-neutral-200 m-8">
              Out of Stock
            </span>
          )}
        </div>
      </Link>

      <div className="flex items-start justify-between gap-2">
        <div>
          <Link to={`/product/${product.id}`}>
            <h3 className="text-sm font-medium text-neutral-900 mb-1 group-hover:underline underline-offset-4">
              {product.name}
            </h3>
          </Link>
          <p className="text-sm text-neutral-500">₹{Number(product.price).toLocaleString('en-IN')}</p>
        </div>

        <button
          onClick={toggleWishlist}
          className="min-w-[40px] min-h-[40px] -m-2 flex items-center justify-center text-neutral-300 hover:text-neutral-900 transition-base"
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          id={`wishlist-toggle-${product.id}`}
        >
          {isWishlisted ? (
            <HiHeart className="w-4 h-4 text-neutral-900" />
          ) : (
            <HiOutlineHeart className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
