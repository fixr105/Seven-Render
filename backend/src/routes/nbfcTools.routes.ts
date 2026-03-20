/**
 * NBFC AI Tools Routes
 * Mounted at /api/nbfc/tools
 * Protected by authenticate + requireNBFC (applied in main index)
 */

import { Router } from 'express';
import multer from 'multer';
import { nbfcToolsController } from '../controllers/nbfcTools.controller.js';

const router = Router();

// Multer: in-memory storage for file buffers
const upload = multer({ storage: multer.memoryStorage() });

// RAAD: gstFile, bankFile, auditedFile, itrFile (all required), loanApplicationId (required)
const raadUpload = upload.fields([
  { name: 'gstFile', maxCount: 1 },
  { name: 'bankFile', maxCount: 1 },
  { name: 'auditedFile', maxCount: 1 },
  { name: 'itrFile', maxCount: 1 },
]);

// PAGER: borrowerFile (required), letterheadFile (optional), loanApplicationId (optional)
const pagerUpload = upload.fields([
  { name: 'borrowerFile', maxCount: 1 },
  { name: 'letterheadFile', maxCount: 1 },
]);

// Query Drafter: optional loanDocument PDF; JSON fields (documentText, roughQuery, tone, loanApplicationId) from req.body
const queryDrafterUpload = upload.fields([{ name: 'loanDocument', maxCount: 1 }]);

router.post('/raad', raadUpload, nbfcToolsController.startRaad.bind(nbfcToolsController));
router.post('/pager', pagerUpload, nbfcToolsController.startPager.bind(nbfcToolsController));
router.post('/query-drafter', queryDrafterUpload, nbfcToolsController.draftQuery.bind(nbfcToolsController));

router.get('/jobs/:jobId/status', nbfcToolsController.getJobStatus.bind(nbfcToolsController));
router.get('/jobs/:jobId/report', nbfcToolsController.getReport.bind(nbfcToolsController));
router.get('/history', nbfcToolsController.getHistory.bind(nbfcToolsController));

export default router;
