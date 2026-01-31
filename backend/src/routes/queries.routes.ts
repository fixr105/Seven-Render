/**
 * Queries Routes
 * Threaded query discussions endpoints
 */

import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware.js';
import { queriesController } from '../controllers/queries.controller.js';

const router = Router();

router.use(authenticate);

// POST /queries/:parentId/replies - Post reply to a query
router.post('/:parentId/replies', queriesController.postReply.bind(queriesController));

// GET /queries/thread/:id - Get thread (root + all replies)
router.get('/thread/:id', queriesController.getThread.bind(queriesController));

// POST /queries/:id/resolve - Mark query as resolved
router.post('/:id/resolve', queriesController.resolveQuery.bind(queriesController));

// POST /queries/:id/reopen - Reopen a resolved query
router.post('/:id/reopen', queriesController.reopenQuery.bind(queriesController));

export default router;

