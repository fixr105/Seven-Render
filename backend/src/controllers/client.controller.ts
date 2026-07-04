/**
 * Client (DSA) Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { LoanStatus } from '../config/constants.js';
import {
  ClientProductEntitlementError,
  assertClientProductAssigned,
  entitlementErrorBody,
  resolveClientAssignedProducts,
  resolveClientRecord,
} from '../services/entitlements/clientProducts.service.js';
import { getClientVehicleOptions } from '../services/vehicles/vehicleCatalog.service.js';
import {
  clientKycToFormDataPatch,
  getClientKycForUser,
} from '../services/clientKyc/clientKyc.service.js';
import { lookupBorrowerByPan } from '../services/panLookup/panLookup.service.js';

const GETLINK_WEBHOOK_URL = 'https://fixrrahul.app.n8n.cloud/webhook/getlink0';
const WEBHOOK_MAX_ATTEMPTS = 3;
const WEBHOOK_INITIAL_BACKOFF_MS = 300;

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface ClientLinkPoolItem {
  link: string;
  status: string;
}

type RetryResult =
  | { response: globalThis.Response; error?: never }
  | { response?: never; error: Error };

function readFirstString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function extractLinkItemsFromPayload(payload: unknown): ClientLinkPoolItem[] {
  const items: ClientLinkPoolItem[] = [];

  const pushLink = (value: unknown, status = ''): void => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    items.push({ link: trimmed, status });
  };

  const visit = (value: unknown): void => {
    if (value == null) return;
    if (typeof value === 'string') {
      pushLink(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      // Common n8n/google sheet field names.
      const link = readFirstString(obj, ['Links', 'links', 'link', 'url', 'URL']);
      if (link) {
        items.push({
          link,
          status: readFirstString(obj, ['Status', 'status', 'Used', 'used']),
        });
        return;
      }
      // Common n8n wrappers.
      visit(obj.fields);
      visit(obj.json);
      visit(obj.data);
      visit(obj.items);
      visit(obj.results);
      visit(obj.rows);
      visit(obj.body);
    }
  };

  visit(payload);
  return items;
}

async function callWebhookWithRetry(
  factory: () => Promise<globalThis.Response>,
  options?: { retryOn4xx?: boolean }
): Promise<RetryResult> {
  let backoffMs = WEBHOOK_INITIAL_BACKOFF_MS;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await factory();
      const shouldRetryStatus =
        response.status >= 500 || ((options?.retryOn4xx ?? false) && response.status >= 400);

      if (response.ok || !shouldRetryStatus || attempt === WEBHOOK_MAX_ATTEMPTS) {
        return { response };
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === WEBHOOK_MAX_ATTEMPTS) {
        return { error: lastError };
      }
    }

    await sleep(backoffMs);
    backoffMs *= 2;
  }

  return { error: lastError ?? new Error('Webhook request failed') };
}

function getWebhookFailureMessage(responseText: string): string | null {
  const trimmed = responseText.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.success === false) {
      return String(parsed.error ?? parsed.message ?? 'Webhook reported failure');
    }
    if (parsed.error != null && String(parsed.error).trim() !== '') {
      return String(parsed.error);
    }
    return null;
  } catch {
    return null;
  }
}

export class ClientController {
  /**
   * GET /client/vehicles?productId=LPxxx
   * Returns make/model options with requested loan amount, filtered by client/product RBAC.
   */
  async getVehicles(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(401).json({ success: false, error: 'Authentication required.' });
        return;
      }
      const productId = String(req.query.productId ?? '').trim();
      if (!productId) {
        res.status(400).json({ success: false, error: 'productId is required' });
        return;
      }
      const options = await getClientVehicleOptions(req.user, productId);
      res.json({ success: true, data: options });
    } catch (error: any) {
      if (error instanceof ClientProductEntitlementError) {
        res.status(error.statusCode).json(entitlementErrorBody(error));
        return;
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch vehicles',
      });
    }
  }

  /**
   * GET /client/kyc
   * Returns dealer KYC profile for the logged-in client (auto-fill on B2C EV form).
   */
  async getClientKyc(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(401).json({ success: false, error: 'Authentication required.' });
        return;
      }

      const profile = await getClientKycForUser(req.user);
      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'No active Client KYC record found for your account. Contact your KAM to complete dealer KYC setup.',
          code: 'CLIENT_KYC_NOT_FOUND',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          ...profile,
          formDataPatch: clientKycToFormDataPatch(profile),
        },
      });
    } catch (error: any) {
      if (error instanceof ClientProductEntitlementError) {
        res.status(error.statusCode).json(entitlementErrorBody(error));
        return;
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch client KYC',
      });
    }
  }

  /**
   * POST /client/pan-lookup
   * Proxy PAN lookup to n8n postMMfrontPAN webhook; returns borrower autofill patch.
   */
  async lookupBorrowerPan(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(401).json({ success: false, error: 'Authentication required.' });
        return;
      }

      const mobileNumber = String(req.body?.mobileNumber ?? req.body?.Mobile_Number ?? '').trim();
      const panNumber = String(req.body?.panNumber ?? req.body?.PAN_Number ?? '').trim();
      const fullName = String(req.body?.fullName ?? req.body?.Full_Name ?? '').trim();
      const borrowerEmailRaw =
        req.body?.borrowerEmail ??
        req.body?.recipientEmail ??
        req.body?.recipient_email;
      const borrowerEmail =
        borrowerEmailRaw == null || borrowerEmailRaw === ''
          ? null
          : String(borrowerEmailRaw).trim();

      const result = await lookupBorrowerByPan({
        mobileNumber,
        panNumber,
        fullName,
        borrowerEmail,
      });

      if (result.success === false) {
        const status =
          result.code === 'VALIDATION_ERROR'
            ? 400
            : result.code === 'WEBHOOK_ERROR'
              ? 502
              : 422;
        res.status(status).json({
          success: false,
          error: result.error,
          code: result.code,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          formDataPatch: result.formDataPatch,
          lookupAt: result.lookupAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to lookup borrower PAN',
      });
    }
  }

  /**
   * GET /client/link-pool
   * Fetch candidate links from webhook and normalize to string[].
   */
  async getLinkPool(_req: Request, res: Response): Promise<void> {
    try {
      const attemptResult = await callWebhookWithRetry(
        () => fetch(GETLINK_WEBHOOK_URL, { method: 'GET' }),
        { retryOn4xx: false }
      );
      if (attemptResult.error) {
        throw attemptResult.error;
      }
      const response = attemptResult.response;
      if (!response.ok) {
        res.status(502).json({
          success: false,
          error: `Failed to fetch link pool (${response.status})`,
        });
        return;
      }

      const responseText = await response.text();
      const payload = responseText ? JSON.parse(responseText) : null;
      let links = extractLinkItemsFromPayload(payload);

      // Some n8n webhook responses acknowledge async execution but do not return rows.
      if (
        links.length === 0 &&
        payload &&
        typeof payload === 'object' &&
        'message' in (payload as Record<string, unknown>)
      ) {
        const message = String((payload as Record<string, unknown>).message ?? '').toLowerCase();
        if (message.includes('workflow was started')) {
          // Fallback: poll a few times in case workflow returns rows shortly after ack.
          for (let i = 0; i < 3; i += 1) {
            await sleep(350);
            const pollAttempt = await callWebhookWithRetry(
              () => fetch(GETLINK_WEBHOOK_URL, { method: 'GET' }),
              { retryOn4xx: false }
            );
            if (pollAttempt.error || !pollAttempt.response.ok) continue;
            const pollText = await pollAttempt.response.text();
            const pollPayload = pollText ? JSON.parse(pollText) : null;
            links = extractLinkItemsFromPayload(pollPayload);
            if (links.length > 0) break;
          }

          if (links.length === 0) {
            res.status(502).json({
              success: false,
              error:
                'Link webhook acknowledged execution but returned no link data. Configure n8n GET webhook response mode to return rows.',
            });
            return;
          }
        }
      }

      res.json({
        success: true,
        data: links,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch link pool',
      });
    }
  }

  /**
   * POST /client/link-pool/consume
   * Mark selected link as consumed in webhook.
   */
  async consumeLink(req: Request, res: Response): Promise<void> {
    try {
      const { link } = req.body ?? {};
      if (!link || typeof link !== 'string' || !link.trim()) {
        res.status(400).json({
          success: false,
          error: 'link is required',
        });
        return;
      }

      const webhookAttempt = await callWebhookWithRetry(
        () =>
          fetch(GETLINK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'YES',
              link: link.trim(),
            }),
          }),
        { retryOn4xx: false }
      );
      if (webhookAttempt.error) {
        throw webhookAttempt.error;
      }
      const webhookResponse = webhookAttempt.response;

      if (!webhookResponse.ok) {
        const responseText = await webhookResponse.text().catch(() => '');
        res.status(502).json({
          success: false,
          error: responseText || `Failed to mark link used (${webhookResponse.status})`,
        });
        return;
      }

      const responseText = await webhookResponse.text().catch(() => '');
      const webhookFailure = getWebhookFailureMessage(responseText);
      if (webhookFailure) {
        res.status(502).json({
          success: false,
          error: webhookFailure,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          link: link.trim(),
          marked: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to mark link used',
      });
    }
  }

  /**
   * GET /client/dashboard
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      // Fetch only the tables we need
      // Use Promise.allSettled to handle partial failures gracefully
      // DISABLE CACHE to ensure webhooks are called every time (user requested manual refresh triggers webhooks)
      const results = await Promise.allSettled([
        n8nClient.fetchTable('Loan Application', false), // Disable cache
        n8nClient.fetchTable('Commission Ledger', false), // Disable cache
        n8nClient.fetchTable('File Auditing Log', false), // Disable cache
      ]);
      
      // Extract results, using empty arrays as fallback for failed requests
      const allApplications = results[0].status === 'fulfilled' ? results[0].value : [];
      const allLedgerEntries = results[1].status === 'fulfilled' ? results[1].value : [];
      const allAuditLogs = results[2].status === 'fulfilled' ? results[2].value : [];
      
      // Log any failures
      if (results[0].status === 'rejected') {
        console.error('[getDashboard] Failed to fetch Loan Application:', results[0].reason);
      }
      if (results[1].status === 'rejected') {
        console.error('[getDashboard] Failed to fetch Commission Ledger:', results[1].reason);
      }
      if (results[2].status === 'rejected') {
        console.error('[getDashboard] Failed to fetch File Auditing Log:', results[2].reason);
      }

      // Apply RBAC filtering using centralized service
      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const clientApplications = await rbacFilterService.filterLoanApplications(allApplications, req.user!);
      const clientLedger = await rbacFilterService.filterCommissionLedger(allLedgerEntries, req.user!);
      const auditLogs = await rbacFilterService.filterFileAuditLog(allAuditLogs, req.user!);

      // Calculate ledger summary
      const totalEarned = clientLedger
        .filter((e) => parseFloat(e['Payout Amount']) > 0)
        .reduce((sum, e) => sum + parseFloat(e['Payout Amount'] || '0'), 0);

      const paid = clientLedger
        .filter((e) => e['Payout Request'] === 'Paid' || e['Payout Request'] === 'True')
        .reduce((sum, e) => sum + Math.abs(parseFloat(e['Payout Amount'] || '0')), 0);

      const pending = totalEarned - paid;
      const balance = totalEarned;

      // Get pending queries
      const pendingQueries = auditLogs
        .filter(
          (log) =>
            log.File &&
            clientApplications.some((app) => app['File ID'] === log.File) &&
            log.Resolved === 'False'
        )
        .map((log) => ({
          id: log.id,
          fileId: log.File,
          message: log['Details/Message'],
          raisedBy: log.Actor,
          timestamp: log.Timestamp,
        }));

      // Get payout requests
      const payoutRequests = clientLedger
        .filter((e) => e['Payout Request'] && e['Payout Request'] !== 'False')
        .map((e) => ({
          id: e.id,
          amount: parseFloat(e['Payout Amount'] || '0'),
          status: e['Payout Request'],
          requestedDate: e.Date,
        }));

      res.json({
        success: true,
        data: {
          activeApplications: clientApplications
            .filter((app) => app.Status !== LoanStatus.CLOSED && app.Status !== LoanStatus.REJECTED)
            .map((app) => ({
              id: app.id,
              fileId: app['File ID'],
              status: app.Status,
              applicantName: app['Applicant Name'],
              requestedAmount: app['Requested Loan Amount'],
            })),
          ledgerSummary: {
            totalEarned,
            pending,
            paid,
            balance,
          },
          pendingQueries,
          payoutRequests,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch dashboard',
      });
    }
  }

  /**
   * GET /client/form-config
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Client Form Mapping') → /webhook/clientformmapping → Airtable: Client Form Mapping
   * - GET → n8nClient.fetchTable('Form Categories') → /webhook/formcategories → Airtable: Form Categories
   * - GET → n8nClient.fetchTable('Form Fields') → /webhook/formfields → Airtable: Form Fields
   * 
   * Frontend: src/pages/NewApplication.tsx (line 100)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async getFormConfig(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(401).json({ success: false, error: 'Authentication required.' });
        return;
      }

      const { productId } = req.query;
      // Form config is only from Loan Products; no productId => no form (no default).
      if (!productId || typeof productId !== 'string') {
        res.json({ success: true, data: [] });
        return;
      }
      await assertClientProductAssigned(req.user, productId);

      const { getFormConfigForProduct } = await import('../services/formConfig/productFormConfig.service.js');
      const { getSimpleFormConfig } = await import('../services/formConfig/simpleFormConfig.service.js');
      let config = await getFormConfigForProduct(productId);
      let categoriesArray = config.categories;
      if (categoriesArray.length === 0) {
        const { clientId } = await resolveClientRecord(req.user);
        config = await getSimpleFormConfig(clientId, productId);
        categoriesArray = config.categories;
      }
      console.log(`[getFormConfig] Returning ${categoriesArray.length} categories for productId ${productId}`);

      res.json({
        success: true,
        data: categoriesArray,
      });
    } catch (error: any) {
      console.error('[getFormConfig] Unexpected error:', error);
      if (error instanceof ClientProductEntitlementError) {
        res.status(error.statusCode).json(entitlementErrorBody(error));
        return;
      }
      // Ensure error response is always valid JSON
      const errorResponse = {
        success: false,
        error: error.message || 'Failed to fetch form config',
      };
      res.status(500).json(errorResponse);
    }
  }

  /**
   * GET /client/form-config-debug?productId=X
   * Same as form-config but includes _debug with diagnostic counts. For debugging form loading.
   */
  async getFormConfigDebug(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(401).json({ success: false, error: 'Authentication required.' });
        return;
      }
      const { productId } = req.query;
      if (!productId || typeof productId !== 'string') {
        res.json({
          success: true,
          data: [],
          _debug: { clientId: null, productId: null, categoriesCount: 0, fieldsCount: 0 },
        });
        return;
      }
      await assertClientProductAssigned(req.user, productId);
      const { clientId: resolvedClientId } = await resolveClientRecord(req.user);
      const { getFormConfigForProduct } = await import('../services/formConfig/productFormConfig.service.js');
      const { getSimpleFormConfig } = await import('../services/formConfig/simpleFormConfig.service.js');
      let config = await getFormConfigForProduct(productId);
      let categoriesArray = config.categories;
      if (categoriesArray.length === 0) {
        config = await getSimpleFormConfig(resolvedClientId, productId);
        categoriesArray = config.categories;
      }
      const totalFields = categoriesArray.reduce((sum, c) => sum + (c.fields?.length || 0), 0);
      res.json({
        success: true,
        data: categoriesArray,
        _debug: {
          clientId: resolvedClientId,
          productId,
          categoriesCount: categoriesArray.length,
          fieldsCount: totalFields,
        },
      });
    } catch (error: any) {
      console.error('[getFormConfigDebug] Error:', error);
      if (error instanceof ClientProductEntitlementError) {
        res.status(error.statusCode).json(entitlementErrorBody(error));
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch form config' });
    }
  }

  /**
   * GET /client/configured-products
   * Get list of product IDs that have configured forms for the authenticated client.
   * Matches Client Form Mapping by both business Client ID and Airtable record id,
   * since KAM Form Configuration may save either depending on dropdown value.
   * If the user has no clientId in the JWT (e.g. linked after login), resolves client
   * from Clients table by matching Contact Email/Phone to the user's email.
   */
  async getConfiguredProducts(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(401).json({
          success: false,
          error: 'Authentication required.',
        });
        return;
      }

      const { clientId: authClientId, assignedProductIds: productIds } = await resolveClientAssignedProducts(req.user);
      if (productIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No loan products are assigned to your account. Please contact your KAM to allocate products.',
        });
        return;
      }
      console.log(
        `[getConfiguredProducts] Client ${authClientId} has ${productIds.length} products from Clients.products:`,
        productIds
      );

      const normalizedProductIds = [...new Set(
        productIds
          .map((productId) => productId.toString().trim())
          .filter(Boolean)
      )];

      res.json({
        success: true,
        data: normalizedProductIds,
      });
    } catch (error: any) {
      console.error('[getConfiguredProducts] Error:', error);
      if (error instanceof ClientProductEntitlementError) {
        res.status(error.statusCode).json(entitlementErrorBody(error));
        return;
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch configured products',
      });
    }
  }

  /**
   * POST /loan-applications/:id/queries/:queryId/reply
   * Respond to query (CLIENT only)
   */
  async respondToQuery(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id, queryId } = req.params;
      const { message: bodyMessage, reply, newDocs, answers } = req.body;
      const message = typeof bodyMessage === 'string' ? bodyMessage : (typeof reply === 'string' ? reply : '');
      // Fetch only the tables we need
      const [applications, auditLogs] = await Promise.all([
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('File Auditing Log'),
      ]);

      const application = applications.find((app) => app.id === id);
      if (!application || application.Client !== req.user.clientId) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const query = auditLogs.find((log) => log.id === queryId);
      if (!query || query.File !== application['File ID']) {
        res.status(404).json({ success: false, error: 'Query not found' });
        return;
      }

      // Update form data if answers provided
      if (answers) {
        const currentFormData = application['Form Data']
          ? JSON.parse(application['Form Data'])
          : {};
        const updatedFormData = { ...currentFormData, ...answers };

        await n8nClient.postLoanApplication({
          ...application,
          'Form Data': JSON.stringify(updatedFormData),
          'Last Updated': new Date().toISOString(),
        });
      }

      // Use query service to create reply
      const { queryService } = await import('../services/queries/query.service.js');
      const replyMessage = [
        message,
        answers ? `Answers provided: ${Object.keys(answers).join(', ')}` : '',
        newDocs?.length ? `New documents uploaded: ${newDocs.length}` : '',
      ]
        .filter(Boolean)
        .join('. ');

      await queryService.createQueryReply(
        queryId,
        application['File ID'],
        application.Client,
        req.user.email,
        'client',
        replyMessage,
        query['Target User/Role'] || query.Actor || 'kam'
      );

      // If status was QUERY_WITH_CLIENT, it can transition back to UNDER_KAM_REVIEW
      // (KAM will need to acknowledge)
      if (application.Status === 'query_with_client') {
        await n8nClient.postLoanApplication({
          ...application,
          Status: 'under_kam_review',
          'Last Updated': new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        message: 'Query response submitted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to respond to query',
      });
    }
  }
}

export const clientController = new ClientController();

