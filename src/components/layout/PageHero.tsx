import React from 'react';

interface PageHeroProps {
  /** Optional in-content heading; omit when TopBar already shows the page title */
  title?: React.ReactNode;
  /** Optional subtitle or description below the title */
  description?: React.ReactNode;
  /** Optional actions (e.g. Refresh, primary button) on the right */
  actions?: React.ReactNode;
}

/**
 * Optional intro row for page content: description and/or actions.
 * The TopBar owns the page title; use PageHero only for subtitles and action rows.
 */
export const PageHero: React.FC<PageHeroProps> = ({ title, description, actions }) => {
  if (title == null && description == null && actions == null) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        {title != null && (
          <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
        )}
        {description != null && (
          <p className={`text-sm text-neutral-600${title != null ? ' mt-1' : ''}`}>{description}</p>
        )}
      </div>
      {actions != null && <div className="flex shrink-0">{actions}</div>}
    </div>
  );
};
