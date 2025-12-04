/**
 * Commission Ledger Routes
 */

import { Router } from 'express';
import { ledgerController } from '../controllers/ledger.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireClient } from '../middleware/rbac.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireClient);

router.get('/me/ledger', ledgerController.getClientLedger.bind(ledgerController));
router.get('/me/ledger/:ledgerEntryId', ledgerController.getLedgerEntry.bind(ledgerController));
router.post('/me/ledger/:ledgerEntryId/query', ledgerController.createLedgerQuery.bind(ledgerController));
router.post('/me/payout-requests', ledgerController.createPayoutRequest.bind(ledgerController));
router.get('/me/payout-requests', ledgerController.getPayoutRequests.bind(ledgerController));

export default router;

