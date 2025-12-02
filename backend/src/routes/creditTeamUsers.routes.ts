/**
 * Credit Team Users Routes
 * All operations POST to CREDITTEAMUSERS webhook
 */

import { Router } from 'express';
import { creditTeamUsersController } from '../controllers/creditTeamUsers.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireCredit } from '../middleware/rbac.middleware.js';

const router = Router();

// All routes require CREDIT role
router.use(authenticate);
router.use(requireCredit);

router.get('/', creditTeamUsersController.listUsers.bind(creditTeamUsersController));
router.get('/:id', creditTeamUsersController.getUser.bind(creditTeamUsersController));
router.post('/', creditTeamUsersController.createUser.bind(creditTeamUsersController));
router.patch('/:id', creditTeamUsersController.updateUser.bind(creditTeamUsersController));
router.delete('/:id', creditTeamUsersController.deleteUser.bind(creditTeamUsersController));

export default router;

