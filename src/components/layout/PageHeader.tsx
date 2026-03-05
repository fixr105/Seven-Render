import React from 'react';
import { Button } from '../ui/Button';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  /** Optional back button label; if provided, onBack is required */
  onBack?: () => void;
  /** Right-side actions (e.g. Update Status, Raise Query) */
  actions?: React.ReactNode;
  /** Optional in-content subheading; when the page uses PageHero for the main h1, omit title here. */
  title?: React.ReactNode;
}

/**
 * Consistent action row for detail/list pages: optional back button (left), actions (right).
 * Use inside MainLayout children for a uniform section layout. When using PageHero for the main heading, pass only onBack and actions (no title).
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ onBack, actions, title }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {onBack != null && (
          <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>
            Back
          </Button>
        )}
        {title != null && <div className="text-lg font-semibold text-neutral-900">{title}</div>}
      </div>
      {actions != null && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
};
