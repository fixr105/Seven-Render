/**
 * Credit Team Users Routes
 * All operations POST to CREDITTEAMUSERS webhook
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { creditTeamUsersController } from '../controllers/creditTeamUsers.controller.js';
import { requireCredit, requireCreditOrKAM } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', requireCreditOrKAM, creditTeamUsersController.listUsers.bind(creditTeamUsersController));
router.get('/:id', requireCreditOrKAM, creditTeamUsersController.getUser.bind(creditTeamUsersController));
router.use(requireCredit);
router.post('/', creditTeamUsersController.createUser.bind(creditTeamUsersController));
router.patch('/:id', creditTeamUsersController.updateUser.bind(creditTeamUsersController));
router.delete('/:id', creditTeamUsersController.deleteUser.bind(creditTeamUsersController));

export default router;

