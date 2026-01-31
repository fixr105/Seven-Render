import React from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { ClientDashboard } from './dashboards/ClientDashboard';
import { KAMDashboard } from './dashboards/KAMDashboard';
import { CreditDashboard } from './dashboards/CreditDashboard';
import { NBFCDashboard } from './dashboards/NBFCDashboard';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const userRole = user?.role || null;
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const sidebarItems = useSidebarItems();

  // Get role display name
  const getRoleDisplayName = () => {
    switch (userRole) {
      case 'client': return 'Client';
      case 'kam': return 'Key Account Manager';
      case 'credit_team': return 'Credit Team';
      case 'nbfc': return 'NBFC Partner';
      default: return '';
    }
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (user?.name) {
      return user.name;
    }
    if (user?.email) {
      return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return '';
  };

  // Render role-specific dashboard
  const renderDashboard = () => {
    switch (userRole) {
      case 'client':
        return <ClientDashboard />;
      case 'kam':
        return <KAMDashboard />;
      case 'credit_team':
        return <CreditDashboard />;
      case 'nbfc':
        return <NBFCDashboard />;
      default:
        return (
          <div className="text-center py-12">
            <p className="text-neutral-500 mb-2">
              Unknown user role: <span className="font-mono text-neutral-700">{userRole || 'null'}</span>
            </p>
            <p className="text-sm text-neutral-400">
              Valid roles are: client, kam, credit_team, nbfc
            </p>
            <p className="text-sm text-neutral-400 mt-2">
              Please contact administrator to update your role in the system.
            </p>
          </div>
        );
    }
  };

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="DASHBOARD"
      userRole={getRoleDisplayName()}
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      {renderDashboard()}
    </MainLayout>
  );
};
