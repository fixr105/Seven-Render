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

// Debug endpoint to check user accounts (development only)
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/users', async (req, res) => {
    try {
      const { authService } = await import('../services/auth/auth.service.js');
      // We need to access the login method's internal logic, so we'll create a debug method
      const { n8nClient } = await import('../services/airtable/n8nClient.js');
      const { n8nEndpoints } = await import('../services/airtable/n8nEndpoints.js');
      
      const webhookUrl = n8nEndpoints.get.userAccount;
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const text = await response.text();
      const rawData = JSON.parse(text);
      
      res.json({
        success: true,
        webhookUrl,
        responseStatus: response.status,
        rawData: rawData,
        parsedCount: Array.isArray(rawData) ? rawData.length : 'not an array',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack,
      });
    }
  });
}

export default router;

