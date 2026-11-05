import { Link } from 'react-router-dom';
import { HiArrowRight } from 'react-icons/hi';
import Seo from '../components/Seo';

export default function About() {
  return (
    <main className="pt-16">
      <Seo
        title="About Us"
        path="/about"
        description="Learn about MJ Shoes — honest, handcrafted footwear made with quality materials and simple, thoughtful design."
      />
      {/* Intro */}
      <section className="container-main py-20 md:py-28">
        <div className="max-w-2xl">
          <p className="section-label mb-4">About MJ Shoes</p>
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight mb-6 leading-[1.1]">
            Honest Shoes,<br />Made Simply Well
          </h1>
          <p className="text-neutral-500 leading-relaxed">
            We started MJ Shoes with a simple belief: great shoes do not need to be complicated. 
            No unnecessary embellishments, no trend-chasing — just carefully chosen materials, 
            thoughtful design, and the kind of quality that speaks for itself.
          </p>
        </div>
      </section>

      {/* Image + Text */}
      <section className="bg-neutral-50">
        <div className="container-main py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <img src="/images/shoe-brown.png" alt="MJ Shoes craftsmanship" className="w-full max-w-md" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-tight mb-6">Materials Matter</h2>
              <div className="space-y-4 text-sm text-neutral-500 leading-relaxed">
                <p>
                  Every pair begins with materials we trust. We source full-grain leathers from 
                  tanneries in Italy, sustainable suedes, and technical fabrics that perform 
                  without compromising comfort.
                </p>
                <p>
                  Our production partners are family-run workshops with decades of experience. 
                  We visit them regularly, not just to check quality, but because we believe in 
                  knowing the people behind the craft.
                </p>
                <p>
                  No shortcuts, no synthetic substitutes. If a material does not meet our 
                  standards, we do not use it — it is that simple.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="container-main py-20 md:py-28">
        <h2 className="text-3xl font-light tracking-tight mb-12">What We Stand For</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            {
              title: 'Quality Over Quantity',
              text: 'We make fewer products, but we make them well. Every pair is designed to last years, not seasons.',
            },
            {
              title: 'Transparent Pricing',
              text: 'No markups for the sake of markup. We price our shoes honestly, based on what they cost to make well.',
            },
            {
              title: 'Responsible Craft',
              text: 'We choose partners and materials with care. Sustainability is not a marketing term for us — it is how we work.',
            },
          ].map(value => (
            <div key={value.title}>
              <h3 className="text-sm font-medium mb-3">{value.title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{value.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-neutral-900 text-white">
        <div className="container-main py-20 text-center">
          <h2 className="text-3xl font-light tracking-tight mb-4">See for Yourself</h2>
          <p className="text-neutral-400 text-sm mb-8 max-w-md mx-auto">
            Browse our collection and experience the difference that honest craftsmanship makes.
          </p>
          <Link to="/shop" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-neutral-900 text-xs font-medium uppercase tracking-widest hover:bg-neutral-100 transition-base">
            Shop Collection <HiArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>
    </main>
  );
}
