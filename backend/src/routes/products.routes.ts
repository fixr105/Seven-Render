/**
 * Products Routes
 * Loan products and NBFC partners
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { productsController } from '../controllers/products.controller.js';
import { nbfcPartnersController } from '../controllers/nbfc.controller.js';
import { requireCreditOrAdmin, requireCreditOrNBFCOrAdmin } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

router.use((req, res, next) => {
  console.log(`[PRODUCTS ROUTER] ${req.method} ${req.path} - req.url: ${req.url}`);
  next();
});

// Loan Products - Temporarily bypass auth for testing
router.get('/loan-products', async (req, res, next) => {
  console.log(`[PRODUCTS ROUTE] /loan-products route handler called`);
  try {
    await productsController.listLoanProducts(req, res);
  } catch (error) {
    console.error(`[PRODUCTS ROUTE] Error in listLoanProducts:`, error);
    next(error);
  }
});
router.get('/loan-products/:id', productsController.getLoanProduct.bind(productsController));

// NBFC Partners - Credit, NBFC, and Admin
router.get('/nbfc-partners', requireCreditOrNBFCOrAdmin, productsController.listNBFCPartners.bind(productsController));
router.get('/nbfc-partners/:id', requireCreditOrNBFCOrAdmin, productsController.getNBFCPartner.bind(productsController));
router.post('/nbfc-partners', requireCreditOrAdmin, nbfcPartnersController.createPartner.bind(nbfcPartnersController));
router.patch('/nbfc-partners/:id', requireCreditOrAdmin, nbfcPartnersController.updatePartner.bind(nbfcPartnersController));

export default router;

