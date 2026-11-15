import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LucideIcon, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/AuthContext';
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
  const navigate = useNavigate();

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
          fixed top-0 left-0 z-50 flex h-full w-64 flex-col border-r border-sf-border bg-sf-surface text-sf-text
          transition-transform duration-300 ease-in-out motion-reduce:transition-none
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:z-auto lg:translate-x-0
        `}
      >
        <div className="border-b border-sf-border px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <Link
              to="/dashboard"
              className="flex min-h-11 items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-sf-navy"
            >
              <img src={logo} alt="SEVEN FINCORP Logo" className="h-10 w-auto max-w-full object-contain" />
            </Link>
            <button
              onClick={onToggle}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sf-text hover:bg-sf-soft lg:hidden"
              aria-label={t('nav.closeMenu')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {userRole ? (
            <p className="mt-2 text-[11px] uppercase tracking-[0.1em] text-sf-quiet">{userRole}</p>
          ) : null}
        </div>

        <nav data-testid="sidebar-nav" className="flex-1 overflow-y-auto px-2 py-3">
          {(items || []).map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onItemClick(item.id);
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={`
                  flex min-h-11 w-full items-center gap-3 rounded-lg border-l-2 px-3 text-left text-sm leading-5 touch-manipulation
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-sf-navy
                  ${isActive
                    ? 'border-sf-navy bg-sf-navy-50 font-semibold text-sf-navy'
                    : 'border-transparent font-normal text-sf-text hover:bg-sf-soft'
                  }
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="bg-error text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sf-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sf-navy-light">
              <span className="text-sm font-medium text-sf-navy">
                {(userName || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sf-text">{userName || ''}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-11 items-center text-sm text-sf-quiet"
              >
                {t('topbar.logout')}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
