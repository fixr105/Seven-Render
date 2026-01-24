/**
 * Users Routes
 * User account and KAM user management
 */

import { Router } from 'express';
import { usersController } from '../controllers/users.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// KAM Users
router.get('/kam-users', usersController.listKAMUsers.bind(usersController));
router.get('/kam-users/:id', usersController.getKAMUser.bind(usersController));

// User Accounts
router.get('/user-accounts', usersController.listUserAccounts.bind(usersController));
router.get('/user-accounts/:id', usersController.getUserAccount.bind(usersController));
router.patch('/user-accounts/:id/settings', usersController.updateUserSettings.bind(usersController));
router.patch('/user-accounts/:id', usersController.updateUserAccount.bind(usersController));

export default router;

