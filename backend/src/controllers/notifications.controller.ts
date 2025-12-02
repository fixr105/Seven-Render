/**
 * Notifications Controller
 * Handles notification retrieval and marking as read
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';

export class NotificationsController {
  /**
   * GET /notifications
   * Get notifications for current user
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { unreadOnly, limit } = req.query;
      const allData = await n8nClient.getAllData();
      const notifications = allData['Notifications'] || [];

      // Filter by user
      let userNotifications = notifications;
      
      if (req.user) {
        // Filter by recipient user email or role
        userNotifications = notifications.filter((notif: any) => {
          const recipientUser = notif['Recipient User'] || '';
          const recipientRole = notif['Recipient Role'] || '';
          
          // Match by email
          if (recipientUser && recipientUser === req.user.email) {
            return true;
          }
          
          // Match by role
          if (recipientRole && recipientRole === req.user.role) {
            return true;
          }
          
          return false;
        });
      }

      // Filter unread only if requested
      if (unreadOnly === 'true') {
        userNotifications = userNotifications.filter(
          (notif: any) => notif['Is Read'] === 'False'
        );
      }

      // Sort by created date (newest first)
      userNotifications.sort((a: any, b: any) => {
        const dateA = new Date(a['Created At'] || 0).getTime();
        const dateB = new Date(b['Created At'] || 0).getTime();
        return dateB - dateA;
      });

      // Apply limit if specified
      if (limit) {
        const limitNum = parseInt(limit as string, 10);
        userNotifications = userNotifications.slice(0, limitNum);
      }

      res.json({
        success: true,
        data: userNotifications.map((notif: any) => ({
          id: notif.id,
          notificationId: notif['Notification ID'],
          recipientUser: notif['Recipient User'],
          recipientRole: notif['Recipient Role'],
          relatedFile: notif['Related File'],
          relatedClient: notif['Related Client'],
          relatedLedgerEntry: notif['Related Ledger Entry'],
          notificationType: notif['Notification Type'],
          title: notif['Title'],
          message: notif['Message'],
          channel: notif['Channel'],
          isRead: notif['Is Read'] === 'True',
          createdAt: notif['Created At'],
          readAt: notif['Read At'],
          actionLink: notif['Action Link'],
        })),
        count: userNotifications.length,
        unreadCount: userNotifications.filter((n: any) => n['Is Read'] === 'False').length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch notifications',
      });
    }
  }

  /**
   * GET /notifications/unread-count
   * Get unread notification count
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const allData = await n8nClient.getAllData();
      const notifications = allData['Notifications'] || [];

      let userNotifications = notifications;
      
      if (req.user) {
        userNotifications = notifications.filter((notif: any) => {
          const recipientUser = notif['Recipient User'] || '';
          const recipientRole = notif['Recipient Role'] || '';
          
          return (
            (recipientUser && recipientUser === req.user.email) ||
            (recipientRole && recipientRole === req.user.role)
          );
        });
      }

      const unreadCount = userNotifications.filter(
        (notif: any) => notif['Is Read'] === 'False'
      ).length;

      res.json({
        success: true,
        data: { unreadCount },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch unread count',
      });
    }
  }

  /**
   * POST /notifications/:id/read
   * Mark notification as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const allData = await n8nClient.getAllData();
      const notifications = allData['Notifications'] || [];
      
      const notification = notifications.find((n: any) => n.id === id);
      
      if (!notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
        return;
      }

      // Verify user has access to this notification
      if (req.user) {
        const recipientUser = notification['Recipient User'] || '';
        const recipientRole = notification['Recipient Role'] || '';
        
        const hasAccess =
          (recipientUser && recipientUser === req.user.email) ||
          (recipientRole && recipientRole === req.user.role);
        
        if (!hasAccess) {
          res.status(403).json({
            success: false,
            error: 'Forbidden',
          });
          return;
        }
      }

      // Update notification
      await n8nClient.postNotification({
        ...notification,
        'Is Read': 'True',
        'Read At': new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark notification as read',
      });
    }
  }

  /**
   * POST /notifications/mark-all-read
   * Mark all notifications as read for current user
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const allData = await n8nClient.getAllData();
      const notifications = allData['Notifications'] || [];

      // Filter user's unread notifications
      let userNotifications = notifications;
      
      if (req.user) {
        userNotifications = notifications.filter((notif: any) => {
          const recipientUser = notif['Recipient User'] || '';
          const recipientRole = notif['Recipient Role'] || '';
          
          return (
            ((recipientUser && recipientUser === req.user.email) ||
             (recipientRole && recipientRole === req.user.role)) &&
            notif['Is Read'] === 'False'
          );
        });
      }

      // Mark all as read
      const readAt = new Date().toISOString();
      await Promise.all(
        userNotifications.map((notif: any) =>
          n8nClient.postNotification({
            ...notif,
            'Is Read': 'True',
            'Read At': readAt,
          })
        )
      );

      res.json({
        success: true,
        message: `${userNotifications.length} notifications marked as read`,
        count: userNotifications.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark all notifications as read',
      });
    }
  }
}

export const notificationsController = new NotificationsController();

