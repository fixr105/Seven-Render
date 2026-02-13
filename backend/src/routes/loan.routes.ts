/**
 * Loan Application Routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { loanController } from '../controllers/loan.controller.js';
import { clientController } from '../controllers/client.controller.js';
import { requireClient } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

// Create and submit - CLIENT only
router.post('/', requireClient, loanController.createApplication.bind(loanController));
router.post('/:id/form', requireClient, loanController.updateApplicationForm.bind(loanController));
router.post('/:id/submit', requireClient, loanController.submitApplication.bind(loanController));
router.post('/:id/withdraw', requireClient, loanController.withdrawApplication.bind(loanController));

// List and get - all authenticated users (filtered by role)
router.get('/', loanController.listApplications.bind(loanController));
router.get('/:id', loanController.getApplication.bind(loanController));

// Queries - all authenticated users (filtered by role)
router.get('/:id/queries', loanController.getQueries.bind(loanController));
router.post('/:id/queries', requireClient, loanController.createClientQuery.bind(loanController));
router.patch('/:id/queries/:queryId', loanController.updateQuery.bind(loanController));
router.post('/:id/queries/:queryId/resolve', loanController.resolveQuery.bind(loanController));

// Query reply - all roles with access (client, KAM, credit_team) for chat-style threads
router.post('/:id/queries/:queryId/reply', loanController.replyToQuery.bind(loanController));

export default router;

