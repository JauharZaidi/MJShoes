import { Link } from 'react-router-dom';
import { testimonials } from '../data/products';
import { useStore } from '../context/StoreContext';
import ProductCard from '../components/ui/ProductCard';
import Seo from '../components/Seo';
import { HiArrowRight, HiOutlineShieldCheck, HiOutlineTruck, HiOutlineRefresh } from 'react-icons/hi';
import { isAvailable } from '../utils/pricing';

export default function Home() {
  const { state } = useStore();
  // Products ticked "Show on home page" in Admin; until any are, show the newest.
  const live = state.products?.filter(isAvailable) || [];
  const picked = live.filter(p => p.featured);
  const featured = (picked.length > 0
    ? picked
    : [...live].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  ).slice(0, 4);

  return (
    <main className="pt-16">
      <Seo
        path="/"
        description="MJ Shoes — Premium handcrafted footwear for everyday excellence. Shop our collection of premium, stylish, and comfortable shoes."
      />
      {/* Hero */}
      <section className="bg-neutral-50" id="hero">
        <div className="container-main py-20 md:py-28 lg:py-36">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="fade-in">
              <p className="section-label mb-6">New Collection</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight text-neutral-900 mb-6 leading-[1.1]">
                Crafted for<br />Everyday Excellence
              </h1>
              <p className="text-neutral-500 text-base leading-relaxed max-w-md mb-10">
                Premium footwear designed with intention. Every pair is built to be comfortable, 
                durable, and timelessly elegant.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/shop" className="btn-primary" id="hero-cta">
                  Shop Now <HiArrowRight className="w-4 h-4 ml-2" />
                </Link>
                <Link to="/about" className="btn-outline" id="hero-about">
                  Our Story
                </Link>
              </div>
            </div>
            <div className="fade-in">
              <img
                src="/images/shoe-white.png"
                alt="MJ Shoes premium sneaker"
                className="w-full max-w-lg mx-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="border-b border-neutral-100">
        <div className="container-main py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x divide-neutral-100">
            {[
              { icon: HiOutlineTruck, text: 'Free shipping on orders over ₹15,000' },
              { icon: HiOutlineRefresh, text: '30-day easy returns, no questions' },
              { icon: HiOutlineShieldCheck, text: 'Secure checkout, trusted worldwide' },
            ].map(item => (
              <div key={item.text} className="flex items-center justify-center gap-3 py-2">
                <item.icon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <span className="text-xs text-neutral-500 tracking-wide">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="bg-white" id="featured">
        <div className="container-main py-20 md:py-28">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="section-label mb-2">Curated Selection</p>
              <h2 className="text-3xl sm:text-4xl font-light tracking-tight">Featured</h2>
            </div>
            <Link
              to="/shop"
              className="text-xs uppercase tracking-widest text-neutral-500 hover:text-neutral-900 transition-base hidden sm:flex items-center gap-2"
            >
              View All <HiArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
            {featured.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="text-center mt-12 sm:hidden">
            <Link to="/shop" className="btn-outline text-xs">View All Products</Link>
          </div>
        </div>
      </section>

      {/* Brand Story */}
      <section className="bg-neutral-50" id="brand-story">
        <div className="container-main py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <img
                src="/images/shoe-brown.png"
                alt="MJ Shoes craftsmanship"
                className="w-full max-w-md mx-auto"
              />
            </div>
            <div>
              <p className="section-label mb-4">Our Philosophy</p>
              <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-6">
                Built to Last,<br/>Designed to Endure
              </h2>
              <div className="space-y-4 text-neutral-500 text-sm leading-relaxed">
                <p>
                  At MJ Shoes, we believe great shoes do not need to shout. They speak through 
                  quality — in the feel of the leather, the precision of every stitch, and the 
                  comfort that lasts year after year.
                </p>
                <p>
                  Every pair is crafted from carefully sourced materials, designed in-house, and 
                  made to be worn daily. No trends, no gimmicks — just honest, well-made footwear 
                  you can rely on.
                </p>
              </div>
              <Link to="/about" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest mt-8 text-neutral-900 hover:text-neutral-500 transition-base">
                Learn More <HiArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white" id="testimonials">
        <div className="container-main py-20 md:py-28">
          <div className="text-center mb-14">
            <p className="section-label mb-2">What Our Customers Say</p>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight">Trusted by Thousands</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map(t => (
              <div key={t.id} className="text-center px-4">
                <div className="flex items-center justify-center gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <span key={i} className="text-neutral-900 text-xs">★</span>
                  ))}
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed mb-4 italic">
                  "{t.text}"
                </p>
                <p className="text-xs text-neutral-400 uppercase tracking-wider">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-neutral-900 text-white">
        <div className="container-main py-20 md:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight mb-4">
            Find Your Perfect Pair
          </h2>
          <p className="text-neutral-400 text-sm mb-8 max-w-md mx-auto">
            Premium craftsmanship, timeless design, and comfort you can count on. Every day.
          </p>
          <Link to="/shop" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-neutral-900 text-xs font-medium uppercase tracking-widest hover:bg-neutral-100 transition-base">
            Shop Collection <HiArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>
    </main>
  );
}
