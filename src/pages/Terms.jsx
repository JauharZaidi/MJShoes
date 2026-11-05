import Seo from '../components/Seo';

export default function Terms() {
  return (
    <main className="pt-24 pb-16 min-h-[80vh]">
      <Seo
        title="Terms of Service"
        path="/terms"
        description="Read the terms and conditions for shopping at MJ Shoes."
      />
      <div className="container-main max-w-3xl">
        <h1 className="text-3xl font-light tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-neutral-400 mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-sm text-neutral-600 leading-relaxed">
          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the MJ Shoes website and purchasing our products, you agree to be bound by
              these Terms of Service and all applicable laws and regulations. If you do not agree with any of these
              terms, you are prohibited from using or accessing this site.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">2. Products & Pricing</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All product prices are listed in Indian Rupees (₹ INR) and include applicable taxes unless stated otherwise.</li>
              <li>We reserve the right to modify prices at any time without prior notice.</li>
              <li>Product images are for illustration purposes. Actual colours may vary slightly due to screen settings.</li>
              <li>Availability of products is subject to stock and we reserve the right to limit quantities.</li>
              <li>All prices are verified server-side at the time of order placement to ensure accuracy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">3. Orders & Payments</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>By placing an order, you warrant that you are at least 18 years of age and have the legal authority to enter into a binding contract.</li>
              <li>All orders are subject to acceptance and product availability.</li>
              <li>Payments are processed securely through Razorpay. We accept UPI, credit/debit cards, and net banking.</li>
              <li>An order is confirmed only after successful payment verification. You will receive a confirmation on the website.</li>
              <li>We reserve the right to cancel orders suspected of fraud, unauthorised use, or abnormal purchasing patterns.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">4. Shipping</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Free shipping is available on orders above ₹15,000.</li>
              <li>A delivery charge, shown at checkout, applies to orders below ₹15,000. Orders of ₹15,000 and above ship free.</li>
              <li>Estimated delivery times are indicative and may vary based on your location and external factors.</li>
              <li>We are not responsible for delays caused by shipping carriers, customs, or force majeure events.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">5. Returns & Refunds</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>We offer a 30-day hassle-free return policy from the date of delivery.</li>
              <li>Items must be unused, in their original packaging, and in the same condition you received them.</li>
              <li>Refunds will be processed to the original payment method within 7–10 business days after we receive the returned item.</li>
              <li>Shipping costs for returns are borne by the customer unless the return is due to a defective product or our error.</li>
              <li>Sale items, limited edition products, and customised orders may not be eligible for returns.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">6. User Accounts</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You agree to accept responsibility for all activities that occur under your account.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
              <li>You must provide accurate and complete information during registration.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">7. Intellectual Property</h2>
            <p>
              All content on this website — including text, graphics, logos, images, product designs, and software —
              is the property of MJ Shoes and is protected by intellectual property laws. You may not reproduce,
              distribute, modify, or create derivative works without our express written consent.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">8. Limitation of Liability</h2>
            <p>
              MJ Shoes shall not be liable for any indirect, incidental, special, consequential, or punitive damages
              arising out of your use of our website or products. Our total liability shall not exceed the amount
              paid by you for the specific product giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">9. Governing Law</h2>
            <p>
              These Terms of Service are governed by and construed in accordance with the laws of India. Any disputes
              shall be subject to the exclusive jurisdiction of the courts in the applicable jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">10. Contact</h2>
            <p>
              For any questions regarding these Terms of Service, please reach out to us at:
            </p>
            <p className="mt-2 font-medium text-neutral-900">
              support@mjstore.com
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
