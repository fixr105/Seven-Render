import React from 'react';
import { LucideIcon, X } from 'lucide-react';

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
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-brand-primary text-white z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
          w-64 flex flex-col shadow-level-2
        `}
      >
        {/* Spacer for logo in corner - logo is positioned absolutely in MainLayout */}
        <div className="h-16 flex-shrink-0 lg:hidden">
          {/* Mobile: Show close button */}
          <div className="flex items-center justify-end p-4">
            <button
              onClick={onToggle}
              className="p-2 min-h-[44px] min-w-[44px] rounded hover:bg-brand-primary/20 transition-colors cursor-none-hover touch-manipulation"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="h-16 flex-shrink-0 hidden lg:block">
          {/* Desktop: Empty space for logo */}
        </div>

        {/* Navigation */}
        <nav data-testid="sidebar-nav" className="flex-1 overflow-y-auto py-4">
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
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 cursor-pointer border-l-4
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary
                  ${isActive
                    ? 'bg-white/10 text-white border-brand-secondary'
                    : 'border-transparent text-white/85 hover:bg-white/10 hover:text-white hover:border-white/40'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
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

        {/* User info */}
        <div className="p-4 border-t border-brand-primary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border border-white/30">
              <span className="text-sm font-medium text-white">
                {(userName || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName || ''}</p>
              <p className="text-xs text-white/70 truncate">{userRole}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
