/**
 * Module 2: Document Upload Routes
 * 
 * Handles OneDrive document uploads
 * Returns OneDrive share links for storage in Airtable
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireClient } from '../middleware/rbac.middleware.js';
import { uploadRateLimiter } from '../middleware/rateLimit.middleware.js';
import multer from 'multer';
import { uploadToOneDrive } from '../services/onedrive/onedriveUpload.service.js';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// All document routes require authentication and CLIENT role
router.use(authenticate);
router.use(requireClient);
// Apply upload rate limiting
router.use(uploadRateLimiter);

/**
 * POST /documents/upload
 * Upload a single file to OneDrive
 * Returns: { shareLink, fileId, webUrl }
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No file provided',
      });
      return;
    }

    const fileName = req.body.fileName || req.file.originalname;
    const fieldId = req.body.fieldId || '';
    const folderPath = req.body.folderPath || 'LoanDocuments';

    // Upload to OneDrive
    const result = await uploadToOneDrive(
      req.file.buffer,
      fileName,
      folderPath
    );

    res.json({
      success: true,
      data: {
        fieldId,
        fileName,
        ...result,
      },
    });
  } catch (error: any) {
    console.error('[DocumentsController] Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file',
    });
  }
});

/**
 * POST /documents/upload-multiple
 * Upload multiple files to OneDrive
 * Returns: Array of { fieldId, fileName, shareLink, fileId, webUrl }
 */
router.post('/upload-multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      res.status(400).json({
        success: false,
        error: 'No files provided',
      });
      return;
    }

    const files = Array.isArray(req.files) ? req.files : [req.files];
    const fieldIds = req.body.fieldIds ? JSON.parse(req.body.fieldIds) : [];
    const folderPath = req.body.folderPath || 'LoanDocuments';

    const uploadResults = await Promise.all(
      files.map(async (file, index) => {
        const fieldId = fieldIds[index] || '';
        const fileName = file.originalname;

        const result = await uploadToOneDrive(
          file.buffer,
          fileName,
          folderPath
        );

        return {
          fieldId,
          fileName,
          ...result,
        };
      })
    );

    res.json({
      success: true,
      data: uploadResults,
    });
  } catch (error: any) {
    console.error('[DocumentsController] Multiple upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload files',
    });
  }
});

export default router;










