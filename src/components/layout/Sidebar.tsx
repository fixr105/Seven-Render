import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LucideIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
import { useRoleAccess } from '../../hooks/useRoleAccess';
import { AddDealerModal } from '../kam/AddDealerModal';
import { Button } from '../ui/Button';
import logo from '../ui/logo.png';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
}

interface SidebarProps {
  items: NavItem[];
  activeItem: string;
  onItemClick: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  userRole: string;
  userName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ items, activeItem, onItemClick, isOpen, onToggle, userRole, userName }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { canAccess } = useRoleAccess();
  const navigate = useNavigate();
  const [addDealerOpen, setAddDealerOpen] = useState(false);
  const canAddDealer = canAccess(['kam', 'admin']);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-sf-overlay lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-black/10 bg-sf-soft text-sf-text
          transition-transform duration-300 ease-in-out motion-reduce:transition-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:z-auto lg:translate-x-0
        `}
      >
        <div
          data-testid="sidebar-logo-bar"
          className="flex h-14 shrink-0 items-center justify-between border-b border-sf-border bg-sf-surface px-4"
        >
          <Link
            to="/dashboard"
            className="flex h-full min-w-0 items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sf-navy"
          >
            <img src={logo} alt="SEVEN FINCORP Logo" className="h-10 w-auto max-w-full object-contain" />
          </Link>
          <button
            onClick={onToggle}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-sf-quiet hover:bg-black/[0.04] lg:hidden"
            aria-label={t('nav.closeMenu')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 pb-2 pt-3">
          {userRole ? (
            <p className="text-[11px] uppercase tracking-[0.14em] text-sf-quiet">{userRole}</p>
          ) : null}
          {canAddDealer ? (
            <Button className="mt-3 w-full" onClick={() => setAddDealerOpen(true)}>
              Add Dealer
            </Button>
          ) : null}
        </div>

        <nav data-testid="sidebar-nav" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          {(items || []).map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onItemClick(item.id);
                  if (window.innerWidth < 1024) onToggle();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  flex min-h-11 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] leading-5 touch-manipulation
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-sf-navy lg:min-h-8
                  ${isActive
                    ? 'bg-sf-surface font-medium text-sf-navy'
                    : 'font-normal text-sf-quiet hover:bg-black/[0.04]'
                  }
                `}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="rounded-full bg-error px-2 py-0.5 text-xs font-medium text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-black/10 px-4 py-4">
          {userName ? (
            <p className="truncate text-sm font-medium text-sf-text">{userName}</p>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex min-h-11 items-center text-[13px] text-sf-quiet lg:min-h-8"
          >
            {t('topbar.logout')}
          </button>
        </div>
        {canAddDealer ? (
          <AddDealerModal isOpen={addDealerOpen} onClose={() => setAddDealerOpen(false)} />
        ) : null}
      </aside>
    </>
  );
};
