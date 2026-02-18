/**
 * Credit Team Routes
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { creditController } from '../controllers/credit.controller.js';
import { ledgerController } from '../controllers/ledger.controller.js';
import { requireCredit } from '../middleware/rbac.middleware.js';
import { enforceRolePermissions } from '../middleware/roleEnforcement.middleware.js';

const router = Router();

router.use(authenticate);
router.use(requireCredit);
router.use(enforceRolePermissions); // Role enforcement with admin override

router.get('/dashboard', creditController.getDashboard.bind(creditController));
router.get('/sla-past-due', creditController.getSlaPastDue.bind(creditController));
router.get('/loan-applications', creditController.listApplications.bind(creditController));
router.get('/loan-applications/:id', creditController.getApplication.bind(creditController));
router.post('/loan-applications/:id/queries', creditController.raiseQuery.bind(creditController));
router.post('/loan-applications/:id/status', creditController.updateStatus.bind(creditController));
router.post('/loan-applications/:id/mark-in-negotiation', creditController.markInNegotiation.bind(creditController));
router.post('/loan-applications/:id/assign-nbfcs', creditController.assignNBFCs.bind(creditController));
router.post('/loan-applications/:id/nbfc-decision', creditController.captureNBFCDecision.bind(creditController));
router.post('/loan-applications/:id/mark-disbursed', creditController.markDisbursed.bind(creditController));
router.post('/loan-applications/:id/close', creditController.closeApplication.bind(creditController));
router.get('/payout-requests', creditController.getPayoutRequests.bind(creditController));
router.post('/payout-requests/:id/approve', creditController.approvePayout.bind(creditController));
router.post('/payout-requests/:id/reject', creditController.rejectPayout.bind(creditController));
router.get('/ledger', ledgerController.getCreditLedger.bind(ledgerController));
router.post('/ledger/entries', creditController.createLedgerEntry.bind(creditController));
router.post('/ledger/:ledgerEntryId/flag-dispute', creditController.flagLedgerDispute.bind(creditController));
router.post('/ledger/:ledgerEntryId/resolve-dispute', creditController.resolveLedgerDispute.bind(creditController));
router.get('/clients', creditController.listClients.bind(creditController));
router.get('/clients/:id/form-mappings', creditController.getFormMappings.bind(creditController));
router.post('/clients/:id/form-links', creditController.createFormLink.bind(creditController));
router.patch('/form-links/:id', creditController.patchFormLink.bind(creditController));
router.delete('/form-links/:id', creditController.deleteFormLink.bind(creditController));
router.get('/clients/:id', creditController.getClient.bind(creditController));
router.post('/clients/:id/assign-kam', creditController.assignKAMToClient.bind(creditController));
router.get('/record-titles', creditController.getRecordTitles.bind(creditController));
router.post('/record-titles', creditController.createRecordTitle.bind(creditController));
router.patch('/record-titles/:id', creditController.patchRecordTitle.bind(creditController));
router.delete('/record-titles/:id', creditController.deleteRecordTitle.bind(creditController));
router.get('/products/:productId/product-documents', creditController.getProductDocuments.bind(creditController));
router.get('/products/:productId/form-config-edit', creditController.getProductFormConfigEdit.bind(creditController));
router.patch('/products/:productId/form-config', creditController.patchProductFormConfig.bind(creditController));
router.post('/product-documents', creditController.createProductDocument.bind(creditController));
router.patch('/product-documents/:id', creditController.patchProductDocument.bind(creditController));
router.delete('/product-documents/:id', creditController.deleteProductDocument.bind(creditController));
router.get('/kam-users', creditController.listKAMUsers.bind(creditController));

export default router;

