import { useState } from 'react';
import toast from 'react-hot-toast';
import Seo from '../components/Seo';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      toast.success('Message sent perfectly. We will securely be in touch soon!');
      setFormData({ name: '', email: '', message: '' });
    } catch (err) {
      toast.error(err.message || 'Failed to send message. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pt-24 pb-16 min-h-[80vh]">
      <Seo
        title="Contact Us"
        path="/contact"
        description="Get in touch with MJ Shoes support for order help or general inquiries."
      />
      <div className="container-main max-w-xl">
        <h1 className="text-3xl font-light tracking-tight mb-4">Contact Us</h1>
        <p className="text-neutral-500 mb-10 leading-relaxed">
          Need assistance with an order, or have a general inquiry? Reach out securely below and our support team will respond within 24 hours.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              required
              className="input-field"
              placeholder="e.g. Michael Jordan"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              required
              className="input-field"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
              Message
            </label>
            <textarea
              id="message"
              required
              rows={5}
              className="input-field resize-y"
              placeholder="How can we help?"
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
            aria-live="polite"
          >
            {loading ? 'Sending Request...' : 'Send Message'}
          </button>
        </form>
      </div>
    </main>
  );
}
