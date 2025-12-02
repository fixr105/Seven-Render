/**
 * Audit & Activity Log Routes
 */

import { Router } from 'express';
import { auditController } from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireCredit } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

// File audit log - all authenticated users (filtered by role)
router.get('/loan-applications/:id/audit-log', auditController.getFileAuditLog.bind(auditController));

// Admin activity log - CREDIT only
router.get('/admin/activity-log', requireCredit, auditController.getAdminActivityLog.bind(auditController));

export default router;

