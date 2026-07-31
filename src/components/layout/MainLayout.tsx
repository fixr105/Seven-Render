import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Footer } from './Footer';
import logo from '../ui/logo.png';
import { useNotifications } from '../../hooks/useNotifications';
import type { TranslatedSidebarNavItem } from '../../hooks/useSidebarItems';

interface MainLayoutProps {
  children: React.ReactNode;
  sidebarItems: TranslatedSidebarNavItem[];
  activeItem: string;
  onItemClick: (id: string) => void;
  pageTitle: string;
  userRole?: string;
  userName?: string;
  /** @deprecated Notifications are loaded on demand in TopBar; prop kept for call-site compatibility. */
  notificationCount?: number;
  /** @deprecated */
  notifications?: unknown;
  /** @deprecated */
  onMarkAsRead?: (notificationId: string) => void;
  /** @deprecated */
  onMarkAllAsRead?: () => void;
  /** When true, main content has no padding and fills the space (for NBFCTools 3-column layout) */
  fullBleed?: boolean;
  /** When true, hide the main sidebar (used on Tools page where only AI Tools bar is shown) */
  hideSidebar?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  sidebarItems,
  activeItem,
  onItemClick,
  pageTitle,
  userRole = '',
  userName,
  fullBleed = false,
  hideSidebar = false,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, refetch } = useNotifications();

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100 relative">
      {/* Logo in corner intersection - only when sidebar is visible */}
      {!hideSidebar && (
        <div className="hidden lg:flex absolute top-0 left-0 z-50 w-64 h-16 bg-brand-primary items-center justify-center">
          <Link to="/dashboard" className="h-full w-full flex items-center justify-center p-3">
            <img src={logo} alt="SEVEN FINCORP Logo" className="h-full w-full object-contain" />
          </Link>
        </div>
      )}

      {!hideSidebar && (
        <Sidebar
          items={sidebarItems}
          activeItem={activeItem}
          onItemClick={onItemClick}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          userRole={userRole}
          userName={userName}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TopBar extends from left edge to right edge */}
        <div className="w-full relative">
          <TopBar
            title={pageTitle}
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            notificationCount={unreadCount}
            userName={userName}
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onLoadNotifications={refetch}
            hideSidebar={hideSidebar}
          />
        </div>

        <main className={`flex-1 overflow-y-auto ${fullBleed ? '' : 'p-4 md:p-6'}`}>
          {children}
        </main>

        {!fullBleed && <Footer />}
      </div>
    </div>
  );
};
