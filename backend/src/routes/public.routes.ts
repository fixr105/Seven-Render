/**
 * Public Routes
 * Routes that don't require authentication (for form links, etc.)
 */

import { Router } from 'express';
import { kamController } from '../controllers/kam.controller.js';

const router = Router();

// Public form mappings endpoint (for client form links)
router.get('/clients/:id/form-mappings', kamController.getPublicFormMappings.bind(kamController));

// Public form config endpoint (Client Form Mapping + Form Categories + Form Fields)
router.get('/clients/:id/form-config', kamController.getPublicFormConfig.bind(kamController));

export default router;

