/**
 * Products Routes
 * Loan products and NBFC partners
 */

import { Router } from 'express';
import { productsController } from '../controllers/products.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Loan Products
router.get('/loan-products', productsController.listLoanProducts.bind(productsController));
router.get('/loan-products/:id', productsController.getLoanProduct.bind(productsController));

// NBFC Partners
router.get('/nbfc-partners', productsController.listNBFCPartners.bind(productsController));
router.get('/nbfc-partners/:id', productsController.getNBFCPartner.bind(productsController));

export default router;

