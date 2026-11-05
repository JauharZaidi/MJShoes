import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-neutral-100 bg-white">
      <div className="container-main py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div>
            <h3 className="text-sm font-medium tracking-tight mb-4">MJ Shoes</h3>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Crafted for everyday excellence. Premium footwear designed to be timeless, not trendy.
            </p>
          </div>

          <div>
            <h4 className="section-label mb-4">Shop</h4>
            <nav className="flex flex-col gap-3" aria-label="Footer Shop Navigation">
              <Link to="/shop" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">All Products</Link>
              <Link to="/shop?category=sneakers" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">Sneakers</Link>
              <Link to="/shop?category=casual" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">Casual</Link>
              <Link to="/shop?category=limited" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">Limited Edition</Link>
            </nav>
          </div>

          <div>
            <h4 className="section-label mb-4">Company</h4>
            <div className="flex flex-col gap-3">
              <Link to="/about" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">About Us</Link>
              <span className="text-sm text-neutral-500">Sustainability</span>
              <span className="text-sm text-neutral-500">Careers</span>
              <span className="text-sm text-neutral-500">Press</span>
            </div>
          </div>

          <div>
            <h4 className="section-label mb-4">Support</h4>
            <nav className="flex flex-col gap-3" aria-label="Footer Support Navigation">
              <Link to="/shipping-returns" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">Shipping & Returns</Link>
              <Link to="/track-order" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">Track Order</Link>
              <Link to="/size-guide" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">Size Guide</Link>
              <Link to="/contact" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">Contact Us</Link>
              <Link to="/faq" className="text-sm text-neutral-500 hover:text-neutral-900 transition-base">FAQ</Link>
            </nav>
          </div>
        </div>

        <div className="divider mt-12 mb-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-400">
            © {new Date().getFullYear()} MJ Shoes. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="text-xs text-neutral-400 hover:text-neutral-900 transition-base">Privacy Policy</Link>
            <Link to="/terms" className="text-xs text-neutral-400 hover:text-neutral-900 transition-base">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
