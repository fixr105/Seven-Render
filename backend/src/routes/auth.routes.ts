/**
 * Authentication Routes
 */

import { Router } from 'express';
import { authController } from '../auth/auth.controller.js';
import { authenticate } from '../auth/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimit.middleware.js';
const router = Router();

router.post('/login', authRateLimiter, authController.login.bind(authController));
router.post('/validate', authRateLimiter, authController.validateJwt.bind(authController));
router.post('/validate-credentials', authRateLimiter, authController.validateCredentials.bind(authController));

router.get('/me', authenticate, authController.getMe.bind(authController));
router.patch('/me/profile', authenticate, authController.updateProfile.bind(authController));
router.patch('/me/settings', authenticate, authController.updateMySettings.bind(authController));
router.post('/logout', authenticate, authController.logout.bind(authController));
router.post('/refresh', authenticate, authController.refresh.bind(authController));

export default router;
