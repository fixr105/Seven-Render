import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useNotifications = () => {
  const { userRoleId } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (userRoleId) {
      fetchNotifications();
    }
  }, [userRoleId]);

  const fetchNotifications = async () => {
    if (!userRoleId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userRoleId)
      .eq('is_read', false);
    setUnreadCount(0);
  };

  return { unreadCount, notifications: [], loading: false, markAsRead: async () => {}, markAllAsRead: async () => {} };
};
