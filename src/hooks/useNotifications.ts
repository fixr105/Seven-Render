import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuthSafe } from './useAuthSafe';

export const useNotifications = () => {
  const { userRoleId } = useAuthSafe();
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications on initial mount (when page is first loaded/refreshed)
  // This ensures notification count loads when user first visits the page
  // No automatic refetch on role changes - user must manually refresh
  useEffect(() => {
    if (userRoleId) {
      fetchNotifications();
    }
  }, []); // Empty dependency array - only runs once on mount (userRoleId checked inside)

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
