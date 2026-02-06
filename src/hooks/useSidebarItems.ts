import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getSidebarItemsForRole } from '../config/sidebar';

/**
 * Returns sidebar items for the current user role. For client role, Ledger is hidden if M1 is not in enabled modules.
 */
export function useSidebarItems() {
  const { user } = useAuth();
  const role = user?.role ?? null;
  const enabledModules = user?.role === 'client' ? (user?.enabledModules ?? null) : undefined;
  return useMemo(() => getSidebarItemsForRole(role, enabledModules), [role, enabledModules]);
}
