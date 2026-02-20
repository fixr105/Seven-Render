/**
 * Main Router - Aggregates all routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { apiRateLimiter } from '../middleware/rateLimit.middleware.js';
import { requireClient } from '../middleware/rbac.middleware.js';
import { loanController } from '../controllers/loan.controller.js';
import healthRoutes, { trackMetrics } from './health.routes.js';
import authRoutes from './auth.routes.js';
import clientRoutes from './client.routes.js';
import loanRoutes from './loan.routes.js';
import kamRoutes from './kam.routes.js';
import creditRoutes from './credit.routes.js';
import nbfcRoutes from './nbfc.routes.js';
import ledgerRoutes from './ledger.routes.js';
import reportsRoutes from './reports.routes.js';
import auditRoutes from './audit.routes.js';
import aiRoutes from './ai.routes.js';
import creditTeamUsersRoutes from './creditTeamUsers.routes.js';
import formCategoryRoutes from './formCategory.routes.js';
import queriesRoutes from './queries.routes.js';
import notificationsRoutes from './notifications.routes.js';
import productsRoutes from './products.routes.js';
import usersRoutes from './users.routes.js';
import publicRoutes from './public.routes.js';

const router = Router();

// Request logging and metrics tracking middleware
router.use(trackMetrics);

// Health and metrics routes (no rate limiting)
router.use('/health', healthRoutes);
router.use('/metrics', healthRoutes);

// Simple test endpoint to verify Express routing works (no webhooks, no auth)
router.get('/test-express', (req, res) => {
  console.log('[TEST-EXPRESS] Express route matched!');
  console.log('[TEST-EXPRESS] Request details:', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: (req as any).originalUrl,
  });
  res.json({ 
    success: true, 
    message: 'Express routing works!', 
    timestamp: new Date().toISOString(),
    path: req.path,
    url: req.url,
  });
});

// Test endpoint with authentication
router.get('/test-express-auth', authenticate, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Express routing with auth works', 
    timestamp: new Date().toISOString(),
    user: req.user,
  });
});

// Debug endpoints - development only (exposed in production would leak env vars and webhook URLs)
router.use('/debug', (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  next();
});

// Test endpoint to verify routes are working (simple, no async)
router.get('/debug/test', (req, res) => {
  console.log('[DEBUG] /debug/test handler called!');
  try {
    res.json({ 
      success: true, 
      message: 'Routes are working', 
      timestamp: new Date().toISOString(),
      path: req.path,
      url: req.url,
      method: req.method,
    });
  } catch (error: any) {
    console.error('[DEBUG] Error in /debug/test:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check environment (simple version first)
router.get('/debug/env', (req, res) => {
  try {
    console.log('[DEBUG] /debug/env endpoint called');
    res.json({
      success: true,
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'not set',
        VERCEL: process.env.VERCEL || 'not set',
        N8N_BASE_URL: process.env.N8N_BASE_URL || 'NOT SET - using default',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[DEBUG] Error in /debug/env:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check environment and webhook configuration (ultra-simple, no imports)
router.get('/debug/webhook-config', (req, res) => {
  console.log('[DEBUG] /debug/webhook-config endpoint called at', new Date().toISOString());
  try {
    if (!process.env.N8N_BASE_URL) {
      res.status(500).json({
        success: false,
        error: 'N8N_BASE_URL environment variable is required. Please set it in your environment configuration.',
      });
      return;
    }
    const n8nBaseUrl = process.env.N8N_BASE_URL;
    
    // Manually construct webhook URLs without importing modules (to avoid timeout)
    const webhookUrls = {
      'Loan Products': `${n8nBaseUrl}/webhook/loanproducts`,
      'Loan Application': `${n8nBaseUrl}/webhook/loanapplication`,
      'Clients': `${n8nBaseUrl}/webhook/client`,
      'Commission Ledger': `${n8nBaseUrl}/webhook/commisionledger`,
      'Notifications': `${n8nBaseUrl}/webhook/notifications`,
      'Client Form Mapping': `${n8nBaseUrl}/webhook/clientformmapping`,
    };
    
    console.log('[DEBUG] N8N_BASE_URL:', n8nBaseUrl);
    console.log('[DEBUG] Webhook URLs constructed');
    
    const response = {
      success: true,
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'not set',
        VERCEL: process.env.VERCEL || 'not set',
        N8N_BASE_URL: n8nBaseUrl,
      },
      webhookUrls,
      timestamp: new Date().toISOString(),
    };
    
    console.log('[DEBUG] Sending response...');
    res.json(response);
    console.log('[DEBUG] Response sent successfully');
  } catch (error: any) {
    console.error('[DEBUG] Error in webhook-config:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
});

// Auth routes (login, validate use authRateLimiter; /me, logout, refresh use authenticate)
router.use('/auth', authRoutes);

// Explicit route for client query creation - must be before /loan-applications mount
// to ensure POST /loan-applications/:id/queries is matched (fixes routing to catch-all)
router.post(
  '/loan-applications/:id/queries',
  apiRateLimiter,
  authenticate,
  requireClient,
  loanController.createClientQuery.bind(loanController)
);

// Public routes FIRST (no auth) - must be before catch-all '/' routes
router.use('/public', publicRoutes);

// Mount route modules with rate limiting
router.use('/client', apiRateLimiter, clientRoutes);
router.use('/loan-applications', apiRateLimiter, loanRoutes);
router.use('/kam', apiRateLimiter, kamRoutes);
router.use('/credit', apiRateLimiter, creditRoutes);
router.use('/nbfc', apiRateLimiter, nbfcRoutes);
router.use('/clients', apiRateLimiter, ledgerRoutes); // Client ledger routes
router.use('/reports', apiRateLimiter, reportsRoutes);
router.use('/credit-team-users', apiRateLimiter, creditTeamUsersRoutes);
router.use('/form-categories', apiRateLimiter, formCategoryRoutes);
router.use('/queries', apiRateLimiter, queriesRoutes); // Threaded queries routes
router.use('/notifications', apiRateLimiter, notificationsRoutes); // Notifications routes
router.use('/', apiRateLimiter, productsRoutes); // Products routes (loan-products, nbfc-partners)
router.use('/', apiRateLimiter, usersRoutes); // Users routes (kam-users, user-accounts)
router.use('/', apiRateLimiter, auditRoutes); // Audit routes (mounted at root for /loan-applications/:id/audit-log)
router.use('/', apiRateLimiter, aiRoutes); // AI routes (mounted at root for /loan-applications/:id/summary)

// Catch-all route for debugging - MUST be last
router.use('*', (req, res, next) => {
  console.log(`[CATCH-ALL] Unmatched route: ${req.method} ${req.path} - req.url: ${req.url}`);
  // Don't send response here, let it fall through to 404
  next();
});

export default router;

