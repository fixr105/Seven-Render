/**
 * Authentication Routes
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', authController.login.bind(authController));
router.get('/me', authenticate, authController.getMe.bind(authController));

export default router;

