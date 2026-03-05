import React from 'react';

interface PageHeroProps {
  /** Main page heading (single h1 per page) */
  title: React.ReactNode;
  /** Optional subtitle or description below the title */
  description?: React.ReactNode;
  /** Optional actions (e.g. Refresh, primary button) on the right */
  actions?: React.ReactNode;
}

/**
 * Hero section for app pages: one h1 plus optional description and actions.
 * Use at the top of main content so the page has a single in-content heading.
 */
export const PageHero: React.FC<PageHeroProps> = ({ title, description, actions }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
        {description != null && (
          <p className="text-sm text-neutral-600 mt-1">{description}</p>
        )}
      </div>
      {actions != null && <div className="flex shrink-0">{actions}</div>}
    </div>
  );
};
