import { Request, Response } from 'express';
import { isB2cEvGeoPhotoSlotId } from '../constants/b2cEvGeoPhotoUpload.js';
import { uploadGeoPhotoToWebhook } from '../services/onedrive/geoPhotoUpload.service.js';
import { uploadToOneDrive } from '../services/onedrive/onedriveUpload.service.js';

export class DocumentsController {
  async uploadDocument(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: 'file is required' });
        return;
      }

      const fieldId = String(req.body?.fieldId || '').trim();
      if (!fieldId) {
        res.status(400).json({ success: false, error: 'fieldId is required' });
        return;
      }

      const fileName =
        String(req.body?.fileName || file.originalname || 'document').trim() || 'document';
      const folderPath = String(req.body?.folderPath || '').trim() || undefined;
      const loanApplicationId =
        String(req.body?.loanApplicationId || '').trim() || undefined;

      const uploadInput = {
        buffer: file.buffer,
        fileName,
        mimeType: file.mimetype || 'application/octet-stream',
        fieldId,
        folderPath,
        clientId: req.user?.clientId || undefined,
        loanApplicationId,
      };

      const isGeoPhoto = isB2cEvGeoPhotoSlotId(fieldId);
      if (isGeoPhoto) {
        console.info('[documents/upload] Routing geo photo to n8n webhook', { fieldId, fileName });
      }

      const result = isGeoPhoto
        ? await uploadGeoPhotoToWebhook(uploadInput)
        : await uploadToOneDrive(uploadInput);

      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Document upload failed';
      const status = message.includes('not configured') ? 503 : 500;
      res.status(status).json({ success: false, error: message });
    }
  }
}

export const documentsController = new DocumentsController();
