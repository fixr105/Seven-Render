/**
 * Loan Application Routes
 */

import { Router } from 'express';
import { loanController } from '../controllers/loan.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireClient } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

// Create and submit - CLIENT only
router.post('/', requireClient, loanController.createApplication.bind(loanController));
router.post('/:id/form', requireClient, loanController.updateApplicationForm.bind(loanController));
router.post('/:id/submit', requireClient, loanController.submitApplication.bind(loanController));

// List and get - all authenticated users (filtered by role)
router.get('/', loanController.listApplications.bind(loanController));
router.get('/:id', loanController.getApplication.bind(loanController));

export default router;

