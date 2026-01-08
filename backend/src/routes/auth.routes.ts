/**
 * Authentication Routes
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Apply strict rate limiting to auth endpoints
router.post('/login', authRateLimiter, authController.login.bind(authController));
router.post('/validate', authRateLimiter, authController.validate.bind(authController));
router.post('/refresh', authRateLimiter, authController.refresh.bind(authController));
router.post('/logout', authenticate, authController.logout.bind(authController));
router.get('/me', authenticate, authController.getMe.bind(authController));

export default router;

