/**
 * NBFC Routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { creditController } from '../controllers/credit.controller.js';
import { nbfcController } from '../controllers/nbfc.controller.js';
import { nbfcToolsController } from '../controllers/nbfcTools.controller.js';
import { requireNBFC } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireNBFC);

router.get('/rejection-reasons', nbfcController.getRejectionReasons.bind(nbfcController));
router.get('/dashboard', nbfcController.getDashboard.bind(nbfcController));
router.get('/loan-applications', nbfcController.listApplications.bind(nbfcController));
router.get('/loan-applications/:id', nbfcController.getApplication.bind(nbfcController));
router.post('/loan-applications/:id/decision', nbfcController.recordDecision.bind(nbfcController));
router.post('/loan-applications/:id/mark-disbursed', creditController.markDisbursed.bind(creditController));
router.post('/loan-applications/:id/queries', nbfcToolsController.raiseQuery.bind(nbfcToolsController));

export default router;

