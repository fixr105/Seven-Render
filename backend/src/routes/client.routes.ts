/**
 * Client Routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { clientController } from '../controllers/client.controller.js';
import { documentsFolderController } from '../controllers/documentsFolder.controller.js';
import { requireClient } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireClient);

router.post(
  '/documents-folder-link',
  documentsFolderController.generateLink.bind(documentsFolderController)
);

router.get('/dashboard', clientController.getDashboard.bind(clientController));
router.get('/form-config', clientController.getFormConfig.bind(clientController));
router.get('/form-config-debug', clientController.getFormConfigDebug.bind(clientController));
router.get('/configured-products', clientController.getConfiguredProducts.bind(clientController));

export default router;

