import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  /** Optional back button label; if provided, onBack is required */
  onBack?: () => void;
  /** Right-side actions (e.g. Update Status, Raise Query) */
  actions?: React.ReactNode;
  /** Optional in-content subheading; omit when TopBar already shows the page title. */
  title?: React.ReactNode;
}

/**
 * Consistent action row for detail/list pages: optional back button (left), actions (right).
 * Use inside MainLayout children. TopBar owns the page title — pass only onBack and actions here.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ onBack, actions, title }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {onBack != null && (
          <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>
            {t('common.back')}
          </Button>
        )}
        {title != null && <div className="text-lg font-semibold text-neutral-900">{title}</div>}
      </div>
      {actions != null && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
};
