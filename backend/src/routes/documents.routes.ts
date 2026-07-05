import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../auth/auth.middleware.js';
import { requireClient } from '../middleware/rbac.middleware.js';
import { documentsController } from '../controllers/documents.controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.use(authenticate);
router.use(requireClient);

router.post(
  '/upload',
  upload.single('file'),
  documentsController.uploadDocument.bind(documentsController)
);

export default router;
