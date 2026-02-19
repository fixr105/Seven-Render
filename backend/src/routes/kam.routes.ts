/**
 * KAM Routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { kamController } from '../controllers/kam.controller.js';
import { ledgerController } from '../controllers/ledger.controller.js';
import { requireKAM, requireCreditOrKAM } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireKAM);

router.get('/dashboard', kamController.getDashboard.bind(kamController));
router.get('/clients', kamController.listClients.bind(kamController));
router.post('/clients', kamController.createClient.bind(kamController));
router.get('/clients/:id', kamController.getClient.bind(kamController));
router.patch('/clients/:id/modules', kamController.updateClientModules.bind(kamController));
router.get('/clients/:id/assigned-products', kamController.getAssignedProducts.bind(kamController));
router.put('/clients/:id/assigned-products', kamController.assignProductsToClient.bind(kamController));
router.get('/clients/:id/form-mappings', kamController.getFormMappings.bind(kamController));
router.post('/clients/:id/form-mappings', kamController.createFormMapping.bind(kamController));
router.get('/loan-applications', kamController.listApplications.bind(kamController));
router.post('/loan-applications/:id/edit', kamController.editApplication.bind(kamController));
router.post('/loan-applications/:id/queries', kamController.raiseQuery.bind(kamController));
router.post('/loan-applications/:id/forward-to-credit', kamController.forwardToCredit.bind(kamController));
router.get('/ledger', ledgerController.getKAMLedger.bind(ledgerController));

export default router;

