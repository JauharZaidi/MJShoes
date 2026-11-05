import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import ProductCard from '../components/ui/ProductCard';
import { HiOutlineHeart, HiArrowRight } from 'react-icons/hi';
import Seo from '../components/Seo';
import { isAvailable } from '../utils/pricing';

export default function Wishlist() {
  const { state } = useStore();
  const wishlistProducts = state.products.filter(p => state.wishlist.includes(p.id) && isAvailable(p));

  if (wishlistProducts.length === 0) {
    return (
      <main className="pt-16">
        <Seo title="Wishlist" path="/wishlist" noindex />
        <div className="container-main py-20 text-center">
          <HiOutlineHeart className="w-10 h-10 text-neutral-200 mx-auto mb-6" />
          <h2 className="text-2xl font-light tracking-tight mb-2">Your wishlist is empty</h2>
          <p className="text-sm text-neutral-400 mb-8">Save items you love for later.</p>
          <Link to="/shop" className="btn-primary inline-flex items-center gap-2 text-xs">
            Explore Collection <HiArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-16">
      <Seo title="Wishlist" path="/wishlist" noindex />
      <div className="container-main py-12 md:py-16">
        <h1 className="text-3xl font-light tracking-tight mb-2">Wishlist</h1>
        <p className="text-sm text-neutral-400 mb-10">{wishlistProducts.length} item{wishlistProducts.length !== 1 ? 's' : ''} saved</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
          {wishlistProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </main>
  );
}
