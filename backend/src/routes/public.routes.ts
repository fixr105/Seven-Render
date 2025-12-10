/**
 * Public Routes
 * Routes that don't require authentication (for form links, etc.)
 */

import { Router } from 'express';
import { kamController } from '../controllers/kam.controller.js';

const router = Router();

// Public form mappings endpoint (for client form links)
router.get('/clients/:id/form-mappings', kamController.getPublicFormMappings.bind(kamController));

export default router;

