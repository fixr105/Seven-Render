/**
 * Example Integration of Centralized Logging Service
 * 
 * This file demonstrates how to integrate the centralized logger
 * into existing controllers. Use this as a reference when updating controllers.
 */

import { Request, Response } from 'express';
import { centralizedLogger } from './centralizedLogger.service.js';
import { AdminActionType } from '../../utils/adminLogger.js';

/**
 * Example: Loan Controller Integration
 */
export class ExampleLoanController {
  /**
   * Example: Create Application with Logging
   */
  async createApplication(req: Request, res: Response): Promise<void> {
    try {
      const { productId, applicantName, requestedLoanAmount } = req.body;
      const user = req.user!;
      const clientId = user.clientId!;

      // ... create application logic ...
      const fileId = `FILE-${Date.now()}`;

      // ✅ Log application creation
      await centralizedLogger.logApplicationCreated(
        user,
        fileId,
        clientId,
        applicantName
      );

      res.json({ success: true, data: { id: fileId } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Example: Submit Application with Logging
   */
  async submitApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id: fileId } = req.params;
      const user = req.user!;

      // ... submit application logic ...

      // ✅ Log application submission
      await centralizedLogger.logApplicationSubmitted(user, fileId);

      res.json({ success: true, message: 'Application submitted' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Example: Status Change with Logging
   */
  async forwardToCredit(req: Request, res: Response): Promise<void> {
    try {
      const { id: fileId } = req.params;
      const user = req.user!;

      // ... get current status ...
      const oldStatus = 'under_kam_review';
      const newStatus = 'pending_credit_review';

      // ... update status logic ...

      // ✅ Log status change
      await centralizedLogger.logStatusChange(
        user,
        fileId,
        oldStatus,
        newStatus,
        'Forwarded to credit team for review'
      );

      res.json({ success: true, message: 'Application forwarded to credit' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Example: File Upload with Logging
   */
  async uploadDocument(req: Request, res: Response): Promise<void> {
    try {
      const { id: fileId } = req.params;
      const { documentType } = req.body;
      const file = req.file; // From multer
      const user = req.user!;

      if (!file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      // ... upload file logic ...
      const documentUrl = `https://example.com/files/${file.filename}`;

      // ✅ Log file upload
      await centralizedLogger.logFileUpload(
        user,
        fileId,
        documentType,
        documentUrl
      );

      res.json({ success: true, data: { url: documentUrl } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

/**
 * Example: Query Service Integration
 */
export class ExampleQueryService {
  /**
   * Example: Raise Query with Logging
   */
  async raiseQuery(
    user: any,
    fileId: string,
    queryMessage: string,
    targetUserRole: string
  ): Promise<void> {
    // ... create query logic ...

    // ✅ Log query raised
    await centralizedLogger.logQueryRaised(
      user,
      fileId,
      queryMessage,
      targetUserRole
    );
  }

  /**
   * Example: Reply to Query with Logging
   */
  async replyToQuery(
    user: any,
    fileId: string,
    parentQueryId: string,
    replyMessage: string
  ): Promise<void> {
    // ... create reply logic ...

    // ✅ Log query reply
    await centralizedLogger.logQueryReply(
      user,
      fileId,
      parentQueryId,
      replyMessage
    );
  }

  /**
   * Example: Resolve Query with Logging
   */
  async resolveQuery(
    user: any,
    fileId: string,
    queryId: string
  ): Promise<void> {
    // ... resolve query logic ...

    // ✅ Log query resolved
    await centralizedLogger.logQueryResolved(user, fileId, queryId);
  }
}

/**
 * Example: Client Controller Integration
 */
export class ExampleClientController {
  /**
   * Example: Create Client with Logging
   */
  async createClient(req: Request, res: Response): Promise<void> {
    try {
      const { name, email } = req.body;
      const user = req.user!;

      // ... create client logic ...
      const clientId = `CLIENT-${Date.now()}`;

      // ✅ Log client creation
      await centralizedLogger.logClientCreated(user, clientId, name);

      res.json({ success: true, data: { id: clientId } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

/**
 * Example: Custom Action Logging
 */
export async function exampleCustomLogging(user: any, fileId: string) {
  // ✅ Log custom admin activity
  await centralizedLogger.logAdminActivity(user, {
    actionType: AdminActionType.ASSIGN_NBFC,
    description: 'Assigned NBFC partner for loan application',
    targetEntity: 'loan_application',
    relatedFileId: fileId,
    metadata: {
      nbfcId: 'NBFC-001',
      nbfcName: 'Example NBFC',
    },
  });

  // ✅ Log custom file audit
  await centralizedLogger.logFileAudit(user, {
    fileId,
    actionEventType: 'nbfc_assigned',
    detailsMessage: 'NBFC partner assigned: Example NBFC',
    targetUserRole: 'nbfc',
  });
}

