import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import ProductCard from '../components/ui/ProductCard';
import Seo from '../components/Seo';
import { isAvailable } from '../utils/pricing';

export default function Shop() {
  const { state } = useStore();
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialSearch = searchParams.get('search') || '';

  const [category, setCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState('featured');
  const [search, setSearch] = useState(initialSearch);

  const categories = ['all', 'sneakers', 'casual', 'sports', 'limited'];

  const filtered = useMemo(() => {
    let result = state.products.filter(isAvailable);

    if (category !== 'all') {
      result = result.filter(p => p.category === category);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case 'price-low': result.sort((a, b) => a.price - b.price); break;
      case 'price-high': result.sort((a, b) => b.price - a.price); break;
      case 'rating': result.sort((a, b) => b.rating - a.rating); break;
      case 'newest': result.sort((a, b) => b.id - a.id); break;
      default: result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    return result;
  }, [state.products, category, sortBy, search]);

  return (
    <main className="pt-16">
      <Seo
        title="Shop All Shoes"
        path="/shop"
        description="Browse our full collection of premium handcrafted sneakers, casual shoes, and sports shoes. Free shipping on orders above ₹15,000."
      />
      <div className="container-main py-12 md:py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight mb-2">Shop</h1>
          <p className="text-sm text-neutral-400">{filtered.length} product{filtered.length === 1 ? '' : 's'}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10 pb-6 border-b border-neutral-100">
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2.5 text-xs uppercase tracking-widest transition-base ${
                  category === cat
                    ? 'bg-neutral-900 text-white'
                    : 'bg-transparent text-neutral-400 hover:text-neutral-900'
                }`}
                id={`filter-${cat}`}
              >
                {cat === 'all' ? 'All' : cat === 'limited' ? 'Limited' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="input-field text-xs w-full sm:w-40 py-2.5"
              id="shop-search"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field text-xs py-2.5 w-full sm:w-36 appearance-none cursor-pointer"
              id="shop-sort"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low–High</option>
              <option value="price-high">Price: High–Low</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-400 text-sm">No products found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
