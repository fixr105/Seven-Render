import React from 'react';
import { Link } from 'react-router-dom';

export const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">Terms of Service</h1>
        <div className="prose prose-neutral text-neutral-600 space-y-4">
          <p>
            By using Seven Fincorp services, you agree to these terms. Please read them carefully.
          </p>
          <p>
            For questions about these terms, please contact us at{' '}
            <a href="mailto:support@sevenfincorp.com" className="text-brand-primary hover:underline">
              support@sevenfincorp.com
            </a>
            .
          </p>
        </div>
        <Link
          to="/"
          className="inline-block mt-8 text-brand-primary hover:underline"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
};
