import { useState } from 'react';
import { HiOutlineChevronDown } from 'react-icons/hi';
import Seo from '../components/Seo';

const faqs = [
  {
    question: "Do you ship internationally?",
    answer: "Currently, we only ship within India. We are working on expanding our logistics to support international shipping in the near future."
  },
  {
    question: "How can I track my order?",
    answer: "Once your order is dispatched, you will receive an email containing a tracking link and awb number. You can also view shipping updates in your Account section."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We use Razorpay for secure transactions. We accept all major Credit/Debit Cards, UPI, Netbanking, and popular wallets."
  },
  {
    question: "Are your shoes true to size?",
    answer: "Yes, our sizes follow standard UK/US sizing metrics. We suggest reviewing our Size Guide before purchasing. If you are between sizes, we recommend selecting the larger size."
  },
  {
    question: "Can I cancel my order?",
    answer: "Orders can be strictly cancelled within 2 hours of placement. Since we dispatch orders same-day when possible, cancellations are limited beyond that window."
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <main className="pt-24 pb-16 min-h-[80vh]">
      <Seo
        title="FAQs"
        path="/faq"
        description="Answers to frequently asked questions about orders, shipping, returns, and sizing at MJ Shoes."
      />
      <div className="container-main max-w-3xl">
        <h1 className="text-3xl font-light tracking-tight mb-8">Frequently Asked Questions</h1>
        
        <div className="border-t border-neutral-100">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="border-b border-neutral-100">
                <button
                  type="button"
                  className="w-full py-5 flex items-center justify-between text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                  onClick={() => toggleAccordion(idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span className="font-medium">{faq.question}</span>
                  <HiOutlineChevronDown 
                    className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                    aria-hidden="true"
                  />
                </button>
                <div 
                  id={`faq-answer-${idx}`}
                  role="region"
                  aria-labelledby={`faq-question-${idx}`}
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-40 opacity-100 mb-5' : 'max-h-0 opacity-0'}`}
                >
                  <p className="text-neutral-500">{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
