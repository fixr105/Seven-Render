/**
 * Main Router - Aggregates all routes
 */

import { Router } from 'express';
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
import documentsRoutes from './documents.routes.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  console.log('[HEALTH] Health check endpoint called');
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
});

// Debug endpoints - MUST be before other routes to avoid conflicts
// Add explicit logging middleware to track route matching
router.use('/debug', (req, res, next) => {
  console.log(`[DEBUG ROUTE] Matched /debug path: ${req.path}, method: ${req.method}`);
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

// Debug endpoint to check environment and webhook configuration (with async import)
router.get('/debug/webhook-config', async (req, res) => {
  console.log('[DEBUG] /debug/webhook-config endpoint called');
  try {
    const n8nBaseUrl = process.env.N8N_BASE_URL || 'NOT SET - using default';
    const { getWebhookUrl } = await import('../config/webhookConfig.js');
    
    const webhookUrls = {
      'Loan Products': getWebhookUrl('Loan Products'),
      'Loan Application': getWebhookUrl('Loan Application'),
      'Clients': getWebhookUrl('Clients'),
      'Commission Ledger': getWebhookUrl('Commission Ledger'),
      'Notifications': getWebhookUrl('Notifications'),
      'Client Form Mapping': getWebhookUrl('Client Form Mapping'),
    };
    
    console.log('[DEBUG] Webhook URLs:', webhookUrls);
    console.log('[DEBUG] N8N_BASE_URL:', n8nBaseUrl);
    
    res.json({
      success: true,
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'not set',
        VERCEL: process.env.VERCEL || 'not set',
        N8N_BASE_URL: n8nBaseUrl,
      },
      webhookUrls,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[DEBUG] Error in webhook-config:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/client', clientRoutes);
router.use('/loan-applications', loanRoutes);
router.use('/kam', kamRoutes);
router.use('/credit', creditRoutes);
router.use('/nbfc', nbfcRoutes);
router.use('/clients', ledgerRoutes); // Client ledger routes
router.use('/reports', reportsRoutes);
router.use('/credit-team-users', creditTeamUsersRoutes);
router.use('/form-categories', formCategoryRoutes);
router.use('/queries', queriesRoutes); // Threaded queries routes
router.use('/notifications', notificationsRoutes); // Notifications routes
router.use('/', productsRoutes); // Products routes (loan-products, nbfc-partners)
router.use('/', usersRoutes); // Users routes (kam-users, user-accounts)
router.use('/', auditRoutes); // Audit routes (mounted at root for /loan-applications/:id/audit-log)
router.use('/', aiRoutes); // AI routes (mounted at root for /loan-applications/:id/summary)
router.use('/public', publicRoutes); // Public routes (form links, etc.)
router.use('/documents', documentsRoutes); // Module 2: Document upload routes (OneDrive)

export default router;

