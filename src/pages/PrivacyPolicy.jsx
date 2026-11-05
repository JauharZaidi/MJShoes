import Seo from '../components/Seo';

export default function PrivacyPolicy() {
  return (
    <main className="pt-24 pb-16 min-h-[80vh]">
      <Seo
        title="Privacy Policy"
        path="/privacy-policy"
        description="Read MJ Shoes' privacy policy to understand how we collect and protect your data."
      />
      <div className="container-main max-w-3xl">
        <h1 className="text-3xl font-light tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-neutral-400 mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-sm text-neutral-600 leading-relaxed">
          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">1. Information We Collect</h2>
            <p>
              When you visit MJ Shoes, we collect certain information about your device, your interaction with our website,
              and information necessary to process your purchases. We may also collect additional information if you contact
              us for customer support. The types of personal information we collect include:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1.5">
              <li><strong>Account Information:</strong> Name, email address, phone number, and password when you create an account.</li>
              <li><strong>Order Information:</strong> Billing and shipping address, payment details (processed securely via Razorpay — we never store your card details), order history, and communications related to orders.</li>
              <li><strong>Device Information:</strong> IP address, browser type, operating system, and referring URLs collected through cookies and similar technologies.</li>
              <li><strong>Usage Data:</strong> Pages viewed, products browsed, time spent on pages, and other analytical data.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To process and fulfil your orders, including shipping and returns.</li>
              <li>To communicate with you about orders, promotions, and customer service inquiries.</li>
              <li>To personalise your shopping experience and recommend products.</li>
              <li>To improve our website, products, and services through analytics.</li>
              <li>To prevent fraud and ensure the security of our platform.</li>
              <li>To comply with legal obligations and enforce our terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">3. Information Sharing</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We may share your data only with:
            </p>
            <ul className="list-disc pl-5 mt-3 space-y-1.5">
              <li><strong>Service Providers:</strong> Payment processors (Razorpay), shipping carriers, and cloud hosting providers (Firebase/Google Cloud) who assist in operating our business.</li>
              <li><strong>Legal Requirements:</strong> When required by law, subpoena, or other legal process.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">4. Payment Security</h2>
            <p>
              All payment transactions are processed through Razorpay, a PCI-DSS compliant payment gateway. We never
              store your credit/debit card information on our servers. Payment data is encrypted using industry-standard
              SSL/TLS protocols. All order amounts are verified server-side to prevent tampering.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">5. Cookies</h2>
            <p>
              We use cookies and local storage to maintain your session, remember your cart contents, and improve your
              browsing experience. You can disable cookies in your browser settings, but some features of our website
              may not function properly without them.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">6. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide you
              services. Order records are retained for accounting and legal compliance purposes. You may request
              deletion of your account by contacting our support team.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-3 space-y-1.5">
              <li>Access and receive a copy of your personal data.</li>
              <li>Rectify inaccurate or incomplete personal information.</li>
              <li>Request deletion of your personal data (subject to legal obligations).</li>
              <li>Object to or restrict the processing of your data.</li>
              <li>Withdraw consent at any time where processing is based on consent.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">8. Children's Privacy</h2>
            <p>
              Our services are not directed to individuals under the age of 18. We do not knowingly collect personal
              information from children. If we become aware that we have collected data from a child without parental
              consent, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an
              updated revision date. We encourage you to review this policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-neutral-900 mb-3">10. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
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
