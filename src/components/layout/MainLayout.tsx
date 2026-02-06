import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Footer } from './Footer';
import logo from '../ui/logo.png';
import { Notification } from '../../hooks/useNotifications';
import type { SidebarNavItem } from '../../config/sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
  sidebarItems: SidebarNavItem[];
  activeItem: string;
  onItemClick: (id: string) => void;
  pageTitle: string;
  userRole?: string;
  userName?: string;
  notificationCount?: number;
  notifications?: Notification[];
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  sidebarItems,
  activeItem,
  onItemClick,
  pageTitle,
  userRole = '',
  userName,
  notificationCount,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-100 relative">
      {/* Logo in corner intersection - fills the area where sidebar and topbar meet */}
      <div className="absolute top-0 left-0 z-50 w-64 h-16 bg-brand-primary flex items-center justify-center">
        <img src={logo} alt="SEVEN FINCORP Logo" className="h-full w-full object-contain p-3" />
      </div>

      <Sidebar
        items={sidebarItems}
        activeItem={activeItem}
        onItemClick={onItemClick}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        userRole={userRole}
        userName={userName}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TopBar extends from left edge to right edge */}
        <div className="w-full relative">
          <TopBar
            title={pageTitle}
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            notificationCount={notificationCount}
            userName={userName}
            notifications={notifications}
            onMarkAsRead={onMarkAsRead}
            onMarkAllAsRead={onMarkAllAsRead}
          />
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto min-h-[calc(100vh-8rem)] animate-fade-in">
            {children}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
};
