/**
 * Form Category Routes
 * All operations POST to FormCategory webhook
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { formCategoryController } from '../controllers/formCategory.controller.js';
import { requireCreditOrKAM } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', formCategoryController.listCategories.bind(formCategoryController));
router.get('/:id', formCategoryController.getCategory.bind(formCategoryController));

router.use(requireCreditOrKAM);

router.post('/', formCategoryController.createCategory.bind(formCategoryController));
router.patch('/:id', formCategoryController.updateCategory.bind(formCategoryController));
router.delete('/:id', formCategoryController.deleteCategory.bind(formCategoryController));

export default router;

