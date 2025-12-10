/**
 * Main Router - Aggregates all routes
 */

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import clientRoutes from './client.routes.js';
import loanRoutes from './loan.routes.js';
import kamRoutes from './kam.routes.js';
import creditRoutes from './credit.routes.js';
import nbfcRoutes from './nbfc.routes.js';
import ledgerRoutes from './ledger.routes.js';
import reportsRoutes from './reports.routes.js';
import auditRoutes from './audit.routes.js';
import aiRoutes from './ai.routes.js';
import creditTeamUsersRoutes from './creditTeamUsers.routes.js';
import formCategoryRoutes from './formCategory.routes.js';
import queriesRoutes from './queries.routes.js';
import notificationsRoutes from './notifications.routes.js';
import productsRoutes from './products.routes.js';
import usersRoutes from './users.routes.js';
import publicRoutes from './public.routes.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/client', clientRoutes);
router.use('/loan-applications', loanRoutes);
router.use('/kam', kamRoutes);
router.use('/credit', creditRoutes);
router.use('/nbfc', nbfcRoutes);
router.use('/clients', ledgerRoutes); // Client ledger routes
router.use('/reports', reportsRoutes);
router.use('/credit-team-users', creditTeamUsersRoutes);
router.use('/form-categories', formCategoryRoutes);
router.use('/queries', queriesRoutes); // Threaded queries routes
router.use('/notifications', notificationsRoutes); // Notifications routes
router.use('/', productsRoutes); // Products routes (loan-products, nbfc-partners)
router.use('/', usersRoutes); // Users routes (kam-users, user-accounts)
router.use('/', auditRoutes); // Audit routes (mounted at root for /loan-applications/:id/audit-log)
router.use('/', aiRoutes); // AI routes (mounted at root for /loan-applications/:id/summary)
router.use('/public', publicRoutes); // Public routes (form links, etc.)

export default router;

