/**
 * Single source of truth for sidebar navigation by role.
 * All pages use this so the menu order and items are identical everywhere.
 */

import { LucideIcon, Home, FileText, Users, DollarSign, BarChart3, Settings, ClipboardList, UserCog, Building2 } from 'lucide-react';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
}

const baseItems: SidebarNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
  { id: 'applications', label: 'Applications', icon: FileText, path: '/applications' },
];

/**
 * Returns sidebar items for the given role. Same order and set everywhere.
 * - client: Dashboard, Applications, Ledger (if M1 enabled), Reports, Settings
 * - kam: Dashboard, Applications, Clients, Reports, Settings
 * - credit_team / admin: Dashboard, Applications, Clients, Ledger, Reports, Activity Log, User Accounts, NBFC Partners, Settings
 * - nbfc: Dashboard, Applications, Reports, Settings
 * @param role - User role
 * @param enabledModules - For client role only: if provided and does not include 'M1', Ledger is hidden
 */
export function getSidebarItemsForRole(role: string | null, enabledModules?: string[] | null): SidebarNavItem[] {
  switch (role) {
    case 'client': {
      const clientItems: SidebarNavItem[] = [
        ...baseItems,
        { id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' },
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
      ];
      if (enabledModules && enabledModules.length > 0 && !enabledModules.includes('M1')) {
        return clientItems.filter((item) => item.id !== 'ledger');
      }
      return clientItems;
    }
    case 'kam':
      return [
        ...baseItems,
        { id: 'clients', label: 'Clients', icon: Users, path: '/clients' },
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
      ];
    case 'credit_team':
    case 'admin':
      return [
        ...baseItems,
        { id: 'clients', label: 'Clients', icon: Users, path: '/clients' },
        { id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' },
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
        { id: 'activity-log', label: 'Activity Log', icon: ClipboardList, path: '/admin/activity-log' },
        { id: 'user-accounts', label: 'User Accounts', icon: UserCog, path: '/admin/user-accounts' },
        { id: 'nbfc-partners', label: 'NBFC Partners', icon: Building2, path: '/admin/nbfc-partners' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
      ];
    case 'nbfc':
      return [
        ...baseItems,
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
      ];
    default:
      return [
        ...baseItems,
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
        { id: 'activity-log', label: 'Activity Log', icon: ClipboardList, path: '/admin/activity-log' },
        { id: 'user-accounts', label: 'User Accounts', icon: UserCog, path: '/admin/user-accounts' },
        { id: 'nbfc-partners', label: 'NBFC Partners', icon: Building2, path: '/admin/nbfc-partners' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
      ];
  }
}
