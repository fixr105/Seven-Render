import React from 'react';
import { Link } from 'react-router-dom';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-neutral-900 mb-6">Privacy Policy</h1>
        <div className="prose prose-neutral text-neutral-600 space-y-4">
          <p>
            Seven Fincorp is committed to protecting your privacy. This policy describes how we collect,
            use, and safeguard your information when you use our services.
          </p>
          <p>
            For questions about this policy, please contact us at{' '}
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
