/**
 * Notifications Routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { notificationsController } from '../controllers/notifications.controller.js';

const router = Router();

router.use(authenticate);

// GET /notifications - Get user notifications
router.get('/', notificationsController.getNotifications.bind(notificationsController));

// GET /notifications/unread-count - Get unread count
router.get('/unread-count', notificationsController.getUnreadCount.bind(notificationsController));

// POST /notifications/:id/read - Mark notification as read
router.post('/:id/read', notificationsController.markAsRead.bind(notificationsController));

// POST /notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', notificationsController.markAllAsRead.bind(notificationsController));

export default router;

