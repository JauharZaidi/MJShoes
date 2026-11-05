import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../../context/StoreContext';
import { HiOutlineSearch, HiOutlineShoppingBag, HiOutlineUser, HiOutlineMenu, HiOutlineX } from 'react-icons/hi';

export default function Navbar() {
  const { state } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/shop', label: 'Shop' },
    { to: '/about', label: 'About' },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${searchQuery.trim()}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-neutral-100" id="main-nav">
        <div className="container-main">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 text-lg font-medium tracking-tight" id="brand-logo">
              <img src="/logo.png" alt="MJ Shoes Logo" className="h-10 w-auto invert mix-blend-multiply" />
              MJ Shoes
            </Link>

            <nav className="hidden md:flex items-center gap-10" aria-label="Main Navigation">
              {navLinks.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `text-[13px] tracking-wide uppercase transition-base ${
                      isActive ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-900'
                    }`
                  }
                  id={`nav-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-5">
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="text-neutral-500 hover:text-neutral-900 transition-base"
                id="search-toggle"
                aria-label="Search"
              >
                <HiOutlineSearch className="w-5 h-5" />
              </button>

              <Link
                to={state.user ? '/account' : '/login'}
                className="text-neutral-500 hover:text-neutral-900 transition-base hidden sm:block"
                id="user-link"
                aria-label="Account"
              >
                <HiOutlineUser className="w-5 h-5" />
              </Link>

              <Link
                to="/cart"
                className="relative text-neutral-500 hover:text-neutral-900 transition-base"
                id="cart-link"
                aria-label="Cart"
              >
                <HiOutlineShoppingBag className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center bg-neutral-900 text-white text-[9px] font-medium rounded-full">
                    {cartCount}
                  </span>
                )}
              </Link>

              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden text-neutral-500 hover:text-neutral-900 transition-base"
                id="mobile-menu-toggle"
                aria-label="Menu"
              >
                {mobileOpen ? <HiOutlineX className="w-5 h-5" /> : <HiOutlineMenu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-neutral-100 bg-white">
            <div className="container-main py-4">
              <form onSubmit={handleSearch} className="flex items-center gap-3" role="search">
                <HiOutlineSearch className="w-4 h-4 text-neutral-400" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="flex-1 text-sm outline-none bg-transparent"
                  autoFocus
                  id="search-input"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="text-neutral-400 hover:text-neutral-900 text-xs uppercase tracking-wide"
                >
                  Close
                </button>
              </form>
            </div>
          </div>
        )}
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-white pt-16 md:hidden">
          <nav className="container-main py-8 flex flex-col gap-6" aria-label="Mobile Navigation">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="text-2xl font-light text-neutral-900 tracking-tight"
              >
                {link.label}
              </NavLink>
            ))}
            <div className="divider my-2" />
            <Link
              to={state.user ? '/account' : '/login'}
              onClick={() => setMobileOpen(false)}
              className="text-sm text-neutral-500 uppercase tracking-wide"
            >
              {state.user ? 'My Account' : 'Sign In'}
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
