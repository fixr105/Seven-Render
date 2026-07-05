import { Request, Response } from 'express';
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

      const result = await uploadToOneDrive({
        buffer: file.buffer,
        fileName,
        mimeType: file.mimetype || 'application/octet-stream',
        fieldId,
        folderPath,
        clientId: req.user?.clientId || undefined,
        loanApplicationId,
      });

      res.json({ success: true, data: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Document upload failed';
      const status = message.includes('not configured') ? 503 : 500;
      res.status(status).json({ success: false, error: message });
    }
  }
}

export const documentsController = new DocumentsController();
