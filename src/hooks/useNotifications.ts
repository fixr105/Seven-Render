import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuthSafe } from './useAuthSafe';
import { isPageReload } from '../utils/isPageReload';

export const useNotifications = () => {
  const { userRoleId } = useAuthSafe();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch only on page refresh (F5) or via explicit refetch. No auto-fetch on SPA navigation.
  useEffect(() => {
    if (isPageReload() && userRoleId) {
      fetchNotifications();
    } else {
      setUnreadCount(0);
    }
  }, []);

  const fetchNotifications = async () => {
    if (!userRoleId) return;
    // Use API service to fetch notifications
    try {
      const response = await apiService.getNotifications();
      if (response.success && response.data) {
        const unread = response.data.filter((n: any) => !n.isRead || n.isRead === false || n['Is Read'] === 'False');
        setUnreadCount(unread.length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setUnreadCount(0);
    }
  };

  return { unreadCount, notifications: [], loading: false, refetch: fetchNotifications, markAsRead: async () => {}, markAllAsRead: async () => {} };
};
