/**
 * Products Routes
 * Loan products and NBFC partners
 */

import { Router } from 'express';
import { productsController } from '../controllers/products.controller.js';
import { nbfcPartnersController } from '../controllers/nbfc.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireCredit } from '../middleware/rbac.middleware.js';

const router = Router();

// Log when products router is accessed
router.use((req, res, next) => {
  console.log(`[PRODUCTS ROUTER] ${req.method} ${req.path} - req.url: ${req.url}`);
  next();
});

// All routes require authentication
router.use(authenticate);

// Loan Products
router.get('/loan-products', (req, res, next) => {
  console.log(`[PRODUCTS ROUTE] /loan-products route handler called`);
  productsController.listLoanProducts(req, res).catch(next);
});
router.get('/loan-products/:id', productsController.getLoanProduct.bind(productsController));

// NBFC Partners
router.get('/nbfc-partners', productsController.listNBFCPartners.bind(productsController));
router.get('/nbfc-partners/:id', productsController.getNBFCPartner.bind(productsController));
router.post('/nbfc-partners', requireCredit, nbfcPartnersController.createPartner.bind(nbfcPartnersController));
router.patch('/nbfc-partners/:id', requireCredit, nbfcPartnersController.updatePartner.bind(nbfcPartnersController));

export default router;

