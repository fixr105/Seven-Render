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
            <a href="#" className="hover:text-brand-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-brand-primary transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-brand-primary transition-colors">
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

