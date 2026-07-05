/**
 * Single source of truth for sidebar navigation by role.
 * All pages use this so the menu order and items are identical everywhere.
 */

import { LucideIcon, Home, FileText, Users, IndianRupee, BarChart3, ClipboardList, UserCog, Building2, Link2, Wrench, Calculator } from 'lucide-react';

export interface SidebarNavItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
}

const baseItems: SidebarNavItem[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard', icon: Home, path: '/dashboard' },
  { id: 'applications', labelKey: 'nav.applications', icon: FileText, path: '/applications' },
  { id: 'calculator', labelKey: 'nav.calculator', icon: Calculator, path: '/calculator' },
];

/**
 * Returns sidebar items for the given role. Same order and set everywhere.
 */
export function getSidebarItemsForRole(role: string | null, enabledModules?: string[] | null): SidebarNavItem[] {
  switch (role) {
    case 'client': {
      const clientItems: SidebarNavItem[] = [
        ...baseItems,
        { id: 'ledger', labelKey: 'nav.commissionLedger', icon: IndianRupee, path: '/ledger' },
      ];
      if (enabledModules && enabledModules.length > 0 && !enabledModules.includes('M1')) {
        return clientItems.filter((item) => item.id !== 'ledger');
      }
      return clientItems;
    }
    case 'kam':
      return [
        ...baseItems,
        { id: 'clients', labelKey: 'nav.clients', icon: Users, path: '/clients' },
        { id: 'ledger', labelKey: 'nav.commissionLedger', icon: IndianRupee, path: '/ledger' },
        { id: 'reports', labelKey: 'nav.reports', icon: BarChart3, path: '/reports' },
      ];
    case 'credit_team':
    case 'admin':
      return [
        ...baseItems,
        { id: 'clients', labelKey: 'nav.clients', icon: Users, path: '/clients' },
        { id: 'form-configuration', labelKey: 'nav.formConfiguration', icon: Link2, path: '/form-configuration' },
        { id: 'ledger', labelKey: 'nav.commissionLedger', icon: IndianRupee, path: '/ledger' },
        { id: 'reports', labelKey: 'nav.reports', icon: BarChart3, path: '/reports' },
        { id: 'activity-log', labelKey: 'nav.activityLog', icon: ClipboardList, path: '/admin/activity-log' },
        { id: 'user-accounts', labelKey: 'nav.userAccounts', icon: UserCog, path: '/admin/user-accounts' },
        { id: 'nbfc-partners', labelKey: 'nav.nbfcPartners', icon: Building2, path: '/admin/nbfc-partners' },
      ];
    case 'nbfc':
      return [
        ...baseItems,
        { id: 'tools', labelKey: 'nav.tools', icon: Wrench, path: '/nbfc/tools' },
      ];
    default:
      return [
        ...baseItems,
        { id: 'reports', labelKey: 'nav.reports', icon: BarChart3, path: '/reports' },
        { id: 'activity-log', labelKey: 'nav.activityLog', icon: ClipboardList, path: '/admin/activity-log' },
        { id: 'user-accounts', labelKey: 'nav.userAccounts', icon: UserCog, path: '/admin/user-accounts' },
        { id: 'nbfc-partners', labelKey: 'nav.nbfcPartners', icon: Building2, path: '/admin/nbfc-partners' },
      ];
  }
}
