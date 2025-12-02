/**
 * KAM Routes
 */

import { Router } from 'express';
import { kamController } from '../controllers/kam.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireKAM, requireCreditOrKAM } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireKAM);

router.get('/dashboard', kamController.getDashboard.bind(kamController));
router.post('/clients', kamController.createClient.bind(kamController));
router.patch('/clients/:id/modules', kamController.updateClientModules.bind(kamController));
router.get('/clients/:id/form-mappings', kamController.getFormMappings.bind(kamController));
router.post('/clients/:id/form-mappings', kamController.createFormMapping.bind(kamController));
router.get('/loan-applications', kamController.listApplications.bind(kamController));
router.post('/loan-applications/:id/edit', kamController.editApplication.bind(kamController));
router.post('/loan-applications/:id/queries', kamController.raiseQuery.bind(kamController));
router.post('/loan-applications/:id/forward-to-credit', kamController.forwardToCredit.bind(kamController));

export default router;

