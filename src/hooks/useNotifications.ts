import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuthSafe } from './useAuthSafe';

export const useNotifications = () => {
  const { userRoleId } = useAuthSafe();
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications ONLY on initial mount (when page is first loaded/refreshed)
  // No automatic refetch on role changes - user must manually refresh
  const hasMountedRef = React.useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current && userRoleId) {
      hasMountedRef.current = true;
      fetchNotifications();
    }
  }, []); // Empty dependency array - only runs once on mount

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

  return { unreadCount, notifications: [], loading: false, markAsRead: async () => {}, markAllAsRead: async () => {} };
};
