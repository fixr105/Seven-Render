/**
 * Credit Team Users Routes
 * All operations POST to CREDITTEAMUSERS webhook
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { creditTeamUsersController } from '../controllers/creditTeamUsers.controller.js';
import { requireCredit } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireCredit);

router.get('/', creditTeamUsersController.listUsers.bind(creditTeamUsersController));
router.get('/:id', creditTeamUsersController.getUser.bind(creditTeamUsersController));
router.post('/', creditTeamUsersController.createUser.bind(creditTeamUsersController));
router.patch('/:id', creditTeamUsersController.updateUser.bind(creditTeamUsersController));
router.delete('/:id', creditTeamUsersController.deleteUser.bind(creditTeamUsersController));

export default router;

