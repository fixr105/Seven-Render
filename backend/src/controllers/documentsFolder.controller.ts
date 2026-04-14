/**
 * POST /client/documents-folder-link — proxy to n8n createfolder webhook (client only).
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { findLoanApplicationByParamId } from '../utils/findLoanApplicationByParamId.js';
import {
  generateNid,
  postCreateFolderWebhook,
} from '../services/integrations/documentsFolderLink.service.js';

export class DocumentsFolderController {
  async generateLink(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client' || !req.user.clientId) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const clientId = req.user.clientId;
      const applicationId =
        req.body && typeof req.body.applicationId === 'string' ? req.body.applicationId.trim() : undefined;

      let nid: string;

      if (applicationId) {
        const applications = await n8nClient.fetchTable('Loan Application');
        const application = findLoanApplicationByParamId(applications, applicationId);

        if (!application) {
          res.status(404).json({ success: false, error: 'Application not found' });
          return;
        }

        const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
        const filtered = await rbacFilterService.filterLoanApplications([application as any], req.user);
        if (filtered.length === 0) {
          res.status(403).json({ success: false, error: 'Access denied' });
          return;
        }

        nid = String(application.id);
      } else {
        nid = generateNid();
      }

      const { folderUrl } = await postCreateFolderWebhook({ nid, clientId });

      res.json({
        success: true,
        data: {
          folderUrl,
          nid,
        },
      });
    } catch (error: any) {
      console.error('[DocumentsFolderController] generateLink:', error);
      res.status(502).json({
        success: false,
        error: error.message || 'Failed to generate documents folder link',
      });
    }
  }
}

export const documentsFolderController = new DocumentsFolderController();
