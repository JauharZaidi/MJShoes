import { Link } from 'react-router-dom';
import Seo from '../components/Seo';

export default function NotFound() {
  return (
    <main className="pt-16">
      <Seo title="Page Not Found" path="/404" noindex />
      <div className="container-main py-24 text-center">
        <p className="text-xs uppercase tracking-widest text-neutral-400 mb-4">404</p>
        <h1 className="text-2xl font-light tracking-tight mb-2">Page not found</h1>
        <p className="text-sm text-neutral-400 mb-8">The page you're looking for doesn't exist or has moved.</p>
        <Link to="/shop" className="btn-primary text-xs">Continue Shopping</Link>
      </div>
    </main>
  );
}
