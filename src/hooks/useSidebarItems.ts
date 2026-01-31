import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getSidebarItemsForRole } from '../config/sidebar';

/**
 * Returns sidebar items for the current user role. Use with useNavigation(sidebarItems) and MainLayout.
 */
export function useSidebarItems() {
  const { user } = useAuth();
  const role = user?.role ?? null;
  return useMemo(() => getSidebarItemsForRole(role), [role]);
}
