/**
 * Users Routes
 * User account and KAM user management
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { UserRole } from '../config/constants.js';
import { requireCreditOrAdmin, requireRole } from '../middleware/rbac.middleware.js';
import { usersController } from '../controllers/users.controller.js';

const router = Router();

router.use(authenticate);

// KAM Users
router.get('/kam-users', usersController.listKAMUsers.bind(usersController));
router.get('/kam-users/:id', usersController.getKAMUser.bind(usersController));

router.post(
  '/users/create-dealer',
  requireRole(UserRole.KAM, UserRole.ADMIN),
  usersController.createDealer.bind(usersController)
);

// User Accounts - Credit and Admin only
router.post('/user-accounts', requireCreditOrAdmin, usersController.createUserAccount.bind(usersController));
router.get('/user-accounts', requireCreditOrAdmin, usersController.listUserAccounts.bind(usersController));
router.get('/user-accounts/:id', requireCreditOrAdmin, usersController.getUserAccount.bind(usersController));
router.patch('/user-accounts/:id/settings', requireCreditOrAdmin, usersController.updateUserSettings.bind(usersController));
router.patch('/user-accounts/:id', requireCreditOrAdmin, usersController.updateUserAccount.bind(usersController));

export default router;

