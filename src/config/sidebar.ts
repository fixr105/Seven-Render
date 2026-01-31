/**
 * Single source of truth for sidebar navigation by role.
 * All pages use this so the menu order and items are identical everywhere.
 */

import { LucideIcon, Home, FileText, Users, DollarSign, BarChart3, Settings } from 'lucide-react';

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
 * - client: Dashboard, Applications, Ledger, Reports, Settings
 * - kam: Dashboard, Applications, Clients, Reports, Settings
 * - credit_team: Dashboard, Applications, Clients, Ledger, Reports, Settings
 * - nbfc: Dashboard, Applications, Reports, Settings
 */
export function getSidebarItemsForRole(role: string | null): SidebarNavItem[] {
  switch (role) {
    case 'client':
      return [
        ...baseItems,
        { id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' },
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
      ];
    case 'kam':
      return [
        ...baseItems,
        { id: 'clients', label: 'Clients', icon: Users, path: '/clients' },
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
      ];
    case 'credit_team':
      return [
        ...baseItems,
        { id: 'clients', label: 'Clients', icon: Users, path: '/clients' },
        { id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' },
        { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
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
        { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
      ];
  }
}
