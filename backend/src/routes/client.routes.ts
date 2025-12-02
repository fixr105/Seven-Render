/**
 * Client Routes
 */

import { Router } from 'express';
import { clientController } from '../controllers/client.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireClient } from '../middleware/rbac.middleware.js';

const router = Router();

// All client routes require authentication and CLIENT role
router.use(authenticate);
router.use(requireClient);

router.get('/dashboard', clientController.getDashboard.bind(clientController));
router.get('/form-config', clientController.getFormConfig.bind(clientController));
router.post('/loan-applications/:id/queries/:queryId/reply', clientController.respondToQuery.bind(clientController));

export default router;

