import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Home, FileText, Users, DollarSign, BarChart3, Settings } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { useLedger } from '../hooks/useLedger';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';

export const Ledger: React.FC = () => {
  const navigate = useNavigate();
  const { userRole } = useAuthSafe();
  const { balance, loading } = useLedger();
  const { unreadCount } = useNotifications();

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications' },
    ...(userRole === 'client' || userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    ...(userRole === 'kam' || userRole === 'credit_team' ? [{ id: 'clients', label: 'Clients', icon: Users, path: '/clients' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Commission Ledger"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName="User"
      notificationCount={unreadCount}
    >
      <Card>
        <CardHeader>
          <CardTitle>Commission Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-neutral-600">Commission ledger will be displayed here</p>
            <p className="text-2xl font-bold mt-4">{loading ? 'Loading...' : `Balance: ₹${balance}`}</p>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
};
