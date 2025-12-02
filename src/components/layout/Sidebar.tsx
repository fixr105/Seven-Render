import React from 'react';
import { LucideIcon, Home, FileText, Users, DollarSign, BarChart3, Settings, Menu, X } from 'lucide-react';
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
}

export const Sidebar: React.FC<SidebarProps> = ({ items, activeItem, onItemClick, isOpen, onToggle, userRole }) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#332f78]">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-10 w-auto" />
          </div>
          <button
            onClick={onToggle}
            className="lg:hidden p-1 rounded hover:bg-[#332f78] transition-colors cursor-none-hover"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {items.map((item) => {
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
                  w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 cursor-none-hover
                  ${isActive
                    ? 'bg-[#332f78] text-white border-l-4 border-white'
                    : 'text-white/80 hover:bg-[#332f78] hover:text-white hover:translate-x-1 hover:shadow-md'
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
        <div className="p-4 border-t border-[#332f78]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#332f78] rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">U</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">User Name</p>
              <p className="text-xs text-white/70 truncate">{userRole}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
