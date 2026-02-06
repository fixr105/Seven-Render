import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../auth/AuthContext';

export interface Notification {
  id: string;
  notificationId: string;
  recipientUser?: string;
  recipientRole?: string;
  relatedFile?: string;
  relatedClient?: string;
  relatedLedgerEntry?: string;
  notificationType: string;
  title: string;
  message: string;
  channel: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  actionLink?: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const userRoleId = user?.clientId || user?.kamId || user?.nbfcId || user?.creditTeamId || user?.id || null;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userRoleId) return;
    setLoading(true);
    try {
      const response = await apiService.getNotifications();
      if (response.success && response.data) {
        const notifs = Array.isArray(response.data) ? response.data : [];
        setNotifications(notifs);
        const unread = notifs.filter((n: Notification) => !n.isRead);
        setUnreadCount(unread.length);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userRoleId]);

  // Fetch on mount (including SPA navigation) when userRoleId is available.
  useEffect(() => {
    if (userRoleId) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [userRoleId, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await apiService.markNotificationAsRead(notificationId);
      if (response.success) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await apiService.markAllNotificationsAsRead();
      if (response.success) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
};
