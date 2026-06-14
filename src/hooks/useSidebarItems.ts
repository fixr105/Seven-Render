import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { getSidebarItemsForRole, SidebarNavItem } from '../config/sidebar';

export interface TranslatedSidebarNavItem extends Omit<SidebarNavItem, 'labelKey'> {
  label: string;
}

/**
 * Returns sidebar items for the current user role with translated labels.
 */
export function useSidebarItems(): TranslatedSidebarNavItem[] {
  const { user } = useAuth();
  const { t } = useTranslation();
  const role = user?.role ?? null;
  const enabledModules = user?.role === 'client' ? (user?.enabledModules ?? null) : undefined;

  return useMemo(() => {
    return getSidebarItemsForRole(role, enabledModules).map((item) => ({
      ...item,
      label: t(item.labelKey),
    }));
  }, [role, enabledModules, t]);
}
