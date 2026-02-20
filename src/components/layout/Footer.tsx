import React from 'react';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`bg-white border-t border-neutral-200 py-4 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-neutral-500">
            © {currentYear} Seven Fincorp. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-sm text-neutral-500">
            <a
              href="mailto:support@sevenfincorp.com"
              className="hover:text-brand-primary transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 rounded"
            >
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

