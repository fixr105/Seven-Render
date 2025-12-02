/**
 * Form Category Routes
 * All operations POST to FormCategory webhook
 */

import { Router } from 'express';
import { formCategoryController } from '../controllers/formCategory.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireCreditOrKAM } from '../middleware/rbac.middleware.js';

const router = Router();

// List and get - all authenticated users
router.get('/', authenticate, formCategoryController.listCategories.bind(formCategoryController));
router.get('/:id', authenticate, formCategoryController.getCategory.bind(formCategoryController));

// Create, update, delete - CREDIT or KAM only
router.use(authenticate);
router.use(requireCreditOrKAM);

router.post('/', formCategoryController.createCategory.bind(formCategoryController));
router.patch('/:id', formCategoryController.updateCategory.bind(formCategoryController));
router.delete('/:id', formCategoryController.deleteCategory.bind(formCategoryController));

export default router;

