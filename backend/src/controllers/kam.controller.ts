/**
 * KAM (Key Account Manager) Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { LoanStatus, LenderDecisionStatus } from '../config/constants.js';
import { logAdminActivity, AdminActionType, logClientAction } from '../utils/adminLogger.js';
import { matchIds } from '../utils/idMatcher.js';
import { buildKAMNameMap, resolveKAMName } from '../utils/kamNameResolver.js';

/** Statuses that count as "forwarded to credit" (KAM has passed the file on). */
const FORWARDED_STATUSES: string[] = [
  LoanStatus.PENDING_CREDIT_REVIEW,
  LoanStatus.CREDIT_QUERY_WITH_KAM,
  LoanStatus.IN_NEGOTIATION,
  LoanStatus.SENT_TO_NBFC,
  LoanStatus.APPROVED,
  LoanStatus.REJECTED,
  LoanStatus.DISBURSED,
  LoanStatus.CLOSED,
];

export class KAMController {
  /**
   * GET /kam/dashboard
   * Uses getKAMManagedClientIds + matchIds for all "managed" logic. No User Account ids.
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'kam') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const managedClientIds = await rbacFilterService.getKAMManagedClientIds(req.user.kamId!);

      // Fetch only the tables we need (no User Accounts; managed clients from Clients + getKAMManagedClientIds)
      const [clients, allApplications, allLedgerEntries, allAuditLogs] = await Promise.all([
        n8nClient.fetchTable('Clients'),
        n8nClient.fetchTable('Loan Application'),
        n8nClient.fetchTable('Commission Ledger'),
        n8nClient.fetchTable('File Auditing Log'),
      ]);

      const applications = await rbacFilterService.filterLoanApplications(allApplications, req.user!);
      const ledgerEntries = await rbacFilterService.filterCommissionLedger(allLedgerEntries, req.user!);
      const auditLogs = await rbacFilterService.filterFileAuditLog(allAuditLogs, req.user!);

      console.log('[getKAMDashboard] Audit logs: before RBAC', allAuditLogs.length, 'after RBAC', auditLogs.length);
      console.log('[getKAMDashboard] managedClientIds (first 5):', managedClientIds.slice(0, 5));

      // Managed clients from Clients table; filter by getKAMManagedClientIds (Client IDs only)
      const managedClients = clients.filter((c: any) => {
        const cid = c.id || c['Client ID'] || c['ID'];
        return managedClientIds.some((id) => matchIds(cid, id));
      });

      // applications already KAM-scoped by rbacFilterService
      const clientApplications = applications;
      const appFileIds = clientApplications.map((a: any) => a['File ID'] || a.fileId);
      console.log('[getKAMDashboard] clientApplications File IDs (first 5):', appFileIds.slice(0, 5));

      // Files by stage
      const filesByStage = {
        underReview: clientApplications.filter(
          (app) => app.Status === LoanStatus.UNDER_KAM_REVIEW
        ).length,
        queryPending: clientApplications.filter(
          (app) => app.Status === LoanStatus.QUERY_WITH_CLIENT
        ).length,
        readyForCredit: clientApplications.filter(
          (app) => app.Status === LoanStatus.PENDING_CREDIT_REVIEW
        ).length,
      };

      const normFileId = (v: any) => String(v ?? '').trim().toLowerCase();
      const isUnresolved = (log: any) => {
        const r = String(log.Resolved ?? '').trim().toLowerCase();
        return r === 'false' || r === 'no' || r === '0' || r === '';
      };
      // Build set of resolved query IDs from query_resolved entries
      const resolvedQueryIds = new Set<string>();
      auditLogs.forEach((log: any) => {
        const actionType = (log['Action/Event Type'] || '').toString();
        const details = (log['Details/Message'] || '').toString();
        if (actionType === 'query_resolved' && details) {
          // Match [[parent:queryId]] format first (centralizedLogger)
          const parentMatch = details.match(/\[\[parent:([^\]]+)\]\]/);
          if (parentMatch) {
            resolvedQueryIds.add(parentMatch[1]);
          } else {
            // Fallback to legacy "Query X resolved" format (queryService)
            const match = details.match(/Query ([^\s]+) resolved/i);
            if (match) resolvedQueryIds.add(match[1]);
          }
        }
      });
      const getActionType = (log: any) => (log['Action/Event Type'] || '').toString().toLowerCase();
      const getDetails = (log: any) => (log['Details/Message'] || '').toString();
      const isActionableQuery = (log: any) =>
        getActionType(log).includes('query') &&
        !getActionType(log).includes('query_resolved') &&
        !getActionType(log).includes('query_edited') &&
        !getDetails(log).includes('Reply to query') &&
        !getDetails(log).includes('Status changed from') &&
        !getDetails(log).includes('Edit of query');
      const queryLogsToKam = auditLogs.filter(
        (l: any) => l['Target User/Role'] === 'kam' && isUnresolved(l)
      );
      console.log('[getKAMDashboard] Query logs to KAM (unresolved):', queryLogsToKam.length);
      if (queryLogsToKam.length > 0) {
        console.log('[getKAMDashboard] Sample query log:', {
          File: queryLogsToKam[0].File,
          FileAlt: queryLogsToKam[0]['File ID'],
          TargetUserRole: queryLogsToKam[0]['Target User/Role'],
          Resolved: queryLogsToKam[0].Resolved,
        });
      }
      const pendingQuestions = auditLogs
        .filter(
          (log) =>
            log['Target User/Role'] === 'kam' &&
            isUnresolved(log) &&
            isActionableQuery(log) &&
            !resolvedQueryIds.has(log.id) &&
            clientApplications.some((app) =>
              normFileId(app['File ID'] || app.fileId) === normFileId(log.File || log['File ID'])
            )
        )
        .map((log) => {
          const logFileId = normFileId(log.File || log['File ID']);
          const app = clientApplications.find(
            (a: any) => normFileId(a['File ID'] || a.fileId) === logFileId
          );
          return {
            id: log.id,
            fileId: log.File,
            applicationId: app?.id || app?.['Record ID'] || log.File,
            message: log['Details/Message'] || '',
          };
        });
      console.log('[getKAMDashboard] pendingQuestions count:', pendingQuestions.length);

      // Ledger disputes for managed clients (use matchIds; entry.Client is Client ID)
      const ledgerDisputes = ledgerEntries
        .filter(
          (entry) =>
            managedClientIds.some((id) => matchIds(entry.Client, id)) &&
            entry['Dispute Status'] !== 'None'
        )
        .map((entry) => ({
          id: entry.id,
          client: entry.Client,
          amount: parseFloat(entry['Payout Amount'] || '0'),
          status: entry['Dispute Status'],
        }));

      // Helpers for per-client performance metrics (no extra fetches)
      const getAppDate = (app: any): Date | null => {
        const raw =
          app['Creation Date'] ?? app['Created At'] ?? app.creationDate ?? app.createdTime ?? '';
        if (!raw) return null;
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
      };
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      const isWithinLast30Days = (d: Date | null) => d !== null && d.getTime() >= thirtyDaysAgo;
      const lenderStatus = (app: any) =>
        String(app['Lender Decision Status'] ?? app.lenderDecisionStatus ?? '').trim();
      const status = (app: any) => String(app.Status ?? app.status ?? '').trim();
      const isApproved = (app: any) =>
        lenderStatus(app) === LenderDecisionStatus.APPROVED ||
        status(app) === LoanStatus.APPROVED ||
        status(app) === LoanStatus.DISBURSED;
      const isRejected = (app: any) =>
        lenderStatus(app) === LenderDecisionStatus.REJECTED ||
        status(app) === LoanStatus.REJECTED;

      // Normalize app.Client (Airtable linked-record array or multiple field names) so client metrics match RBAC visibility.
      // clientIdSet must use the same fields as getKAMManagedClientIds (id, Client ID, ID) so app↔client mapping is consistent.
      const clientIdSet = (c: any) => [c.id, c['Client ID'], c['ID']].filter(Boolean).map(String);
      const appsForClientFilter = (c: any, app: any) => {
        const appClient = Array.isArray(app.Client) ? app.Client[0] : (app.Client ?? app['Client'] ?? app['Client ID'] ?? app.clientId);
        const ids = clientIdSet(c);
        return ids.some((id) => matchIds(appClient, id));
      };
      if (clientApplications.length > 0 && managedClients.length > 0) {
        const sampleApp = clientApplications[0];
        const appClientRaw = sampleApp.Client ?? sampleApp['Client'] ?? sampleApp['Client ID'] ?? sampleApp.clientId;
        const firstClientIds = clientIdSet(managedClients[0]);
        console.log('[getKAMDashboard] Client↔App match check: sample app Client=', appClientRaw, 'first client ids=', firstClientIds);
      }
      const clientsWithMetrics = managedClients.map((c: any) => {
        const appsForClient = clientApplications.filter((app: any) => appsForClientFilter(c, app));
        const totalFiles = appsForClient.length;
        const filesLast30Days = appsForClient.filter((app: any) =>
          isWithinLast30Days(getAppDate(app))
        ).length;
        const pendingReview = appsForClient.filter(
          (app: any) => status(app) === LoanStatus.UNDER_KAM_REVIEW
        ).length;
        const awaitingResponse = appsForClient.filter(
          (app: any) => status(app) === LoanStatus.QUERY_WITH_CLIENT
        ).length;
        const forwarded = appsForClient.filter((app: any) =>
          FORWARDED_STATUSES.includes(status(app))
        ).length;
        const approved = appsForClient.filter((app: any) => isApproved(app)).length;
        const rejected = appsForClient.filter((app: any) => isRejected(app)).length;
        const decided = approved + rejected;
        const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : null;

        return {
          id: c.id,
          name: c['Client Name'] || c['Primary Contact Name'] || 'Unknown',
          email: c['Contact Email / Phone'] || '',
          activeApplications: appsForClient.filter(
            (app: any) => status(app) !== LoanStatus.CLOSED
          ).length,
          totalFiles,
          filesLast30Days,
          pendingReview,
          awaitingResponse: awaitingResponse,
          forwarded,
          approved,
          rejected,
          approvalRate: approvalRate,
        };
      });

      // Log applications that pass RBAC but do not match any managed client (orphan apps)
      const orphanApps = clientApplications.filter(
        (app: any) => !managedClients.some((c: any) => appsForClientFilter(c, app))
      );
      if (orphanApps.length > 0) {
        const sample = orphanApps.slice(0, 3).map((a: any) => ({
          fileId: a['File ID'] ?? a.fileId,
          appClient: a.Client ?? a['Client'] ?? a['Client ID'] ?? a.clientId,
        }));
        console.log(
          '[getKAMDashboard] Orphan apps (pass RBAC but match no client card):',
          orphanApps.length,
          'sample:',
          sample
        );
      }

      const approvedTotal = clientsWithMetrics.reduce((s, c) => s + c.approved, 0);
      const rejectedTotal = clientsWithMetrics.reduce((s, c) => s + c.rejected, 0);
      const decidedTotal = approvedTotal + rejectedTotal;
      const summary = {
        totalClients: clientsWithMetrics.length,
        totalFiles: clientsWithMetrics.reduce((s, c) => s + c.totalFiles, 0),
        filesLast30Days: clientsWithMetrics.reduce((s, c) => s + c.filesLast30Days, 0),
        pendingReview: filesByStage.underReview,
        awaitingResponse: filesByStage.queryPending,
        forwarded: clientsWithMetrics.reduce((s, c) => s + c.forwarded, 0),
        approved: approvedTotal,
        rejected: rejectedTotal,
        approvalRate:
          decidedTotal > 0 ? Math.round((approvedTotal / decidedTotal) * 100) : null,
      };

      res.json({
        success: true,
        data: {
          clients: clientsWithMetrics,
          summary,
          filesByStage,
          pendingQuestionsFromCredit: pendingQuestions,
          ledgerDisputes,
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
   * GET /kam/clients
   * List all clients managed by this KAM
   */
  async listClients(req: Request, res: Response): Promise<void> {
    console.log('[listClients] ========== ENDPOINT CALLED ==========');
    console.log('[listClients] Method:', req.method);
    console.log('[listClients] URL:', req.url);
    console.log('[listClients] Headers:', JSON.stringify(req.headers, null, 2));
    
    try {
      if (!req.user || req.user.role !== 'kam') {
        console.log('[listClients] ❌ Auth check failed - user:', req.user);
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      console.log('[listClients] ✅ Auth check passed');
      console.log('[listClients] User details:', {
        email: req.user.email,
        role: req.user.role,
        kamId: req.user.kamId,
        userId: req.user.id,
        name: req.user.name,
      });

      // Fetch Clients table (cache will be used if available)
      // Allow bypassing cache via query parameter for debugging
      const bypassCache = req.query.forceRefresh === 'true';
      const clients = await n8nClient.fetchTable('Clients', !bypassCache);
      console.log('[listClients] Total clients in database:', clients.length);
      
      // Log sample client Assigned KAM values for debugging
      if (clients.length > 0) {
        const sampleClients = clients.slice(0, 3).map((c: any) => ({
          clientId: c.id || c['Client ID'],
          clientName: c['Client Name'] || c['Primary Contact Name'] || 'Unknown',
          assignedKAM: c['Assigned KAM'] || c.assignedKAM || c['KAM ID'] || 'Empty',
          assignedKAMType: typeof (c['Assigned KAM'] || c.assignedKAM || c['KAM ID']),
        }));
        console.log('[listClients] Sample client Assigned KAM values:', JSON.stringify(sampleClients, null, 2));
      }
      
      let kamId = req.user.kamId || '';
      let kamIdSource: 'jwt' | 'KAM Users fallback' = req.user.kamId ? 'jwt' : 'KAM Users fallback';

      // If KAM ID is not set, try to get it from KAM Users table by email
      if (!kamId && req.user.email) {
        try {
          const kamUsers = await n8nClient.fetchTable('KAM Users', false);
          console.log('[listClients] Fetched KAM Users:', kamUsers.length, 'records');
          const kamUser = kamUsers.find((k: any) => {
            const kEmail = (k['Email'] || k['Username'] || '').toLowerCase();
            const userEmail = (req.user!.email || '').toLowerCase();
            return kEmail === userEmail;
          });
          if (kamUser) {
            // Use KAM ID field (not record id) for consistency
            kamId = kamUser['KAM ID'] || kamUser.id || '';
            req.user.kamId = kamId;
            kamIdSource = 'KAM Users fallback';
            console.log('[listClients] Found KAM ID from KAM Users table:', {
              email: req.user.email,
              kamId: kamId,
              kamIdFromField: kamUser['KAM ID'] || 'N/A',
              kamRecordId: kamUser.id,
              kamName: kamUser.Name || kamUser['Name'] || 'N/A',
            });
          } else {
            console.warn('[listClients] KAM user not found in KAM Users table for email:', req.user.email);
            console.log('[listClients] Available KAM user emails:', kamUsers.map((k: any) => (k['Email'] || k['Username'] || 'N/A')).join(', '));
          }
        } catch (error) {
          console.warn('[listClients] Could not fetch KAM Users table:', error);
        }
      }
      
      if (!kamId) {
        console.warn('[listClients] Missing KAM ID for user, returning 400');
        console.warn('[listClients] User object:', JSON.stringify(req.user, null, 2));
        res.status(400).json({
          success: false,
          error: 'KAM ID not found. Please contact support.',
        });
        return;
      }

      console.log('[listClients] Filtering with KAM ID:', {
        kamId: kamId,
        kamIdSource: kamIdSource,
        kamIdType: typeof kamId,
        kamIdLength: kamId.length,
      });

      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const managedClients = await rbacFilterService.filterClients(clients, { ...req.user, kamId });

      // Fetch KAM Users to resolve Assigned KAM IDs to names (show "Sagar" instead of "USER-1767430957573-81645wu26")
      let kamNameMap = new Map<string, string>();
      try {
        const kamUsers = await n8nClient.fetchTable('KAM Users', !bypassCache);
        kamNameMap = buildKAMNameMap(kamUsers as any[]);
      } catch (err) {
        console.warn('[listClients] Could not fetch KAM Users for name resolution:', err);
      }

      console.log(`[listClients] Managed clients found: ${managedClients.length} out of ${clients.length} total`);
      if (managedClients.length === 0) {
        console.warn('[listClients] ⚠️  No managed clients found', { 
          kamId, 
          kamIdSource,
          totalClients: clients.length,
          userEmail: req.user.email,
        });
        // Log all client Assigned KAM values for debugging
        const allAssignedKAMs = clients.map((c: any) => ({
          clientId: c.id || c['Client ID'],
          clientName: c['Client Name'] || c['Primary Contact Name'] || 'Unknown',
          assignedKAM: c['Assigned KAM'] || c.assignedKAM || c['KAM ID'] || 'Empty',
        }));
        console.warn('[listClients] All client Assigned KAM values:', JSON.stringify(allAssignedKAMs, null, 2));
      } else {
        console.log('[listClients] ✅ Successfully found managed clients');
        managedClients.slice(0, 3).forEach((client: any) => {
          console.log(`[listClients]   - ${client['Client Name'] || client['Primary Contact Name'] || 'Unknown'} (ID: ${client.id || client['Client ID']})`);
        });
      }

      // Transform to API response format (resolve Assigned KAM ID to name for display)
      const clientList = managedClients.map((client: any) => {
        const assignedKAM = client['Assigned KAM'] || client.assignedKAM;
        let assignedKAMName = resolveKAMName(assignedKAM, kamNameMap);
        if (assignedKAMName === assignedKAM && (client['Assigned KAM Name'] || client.assignedKAMName)) {
          assignedKAMName = client['Assigned KAM Name'] || client.assignedKAMName || assignedKAMName;
        }
        return {
          id: client.id,
          clientId: client['Client ID'] || client.id,
          clientName: client['Client Name'] || client['Primary Contact Name'] || 'Unknown',
          primaryContactName: client['Primary Contact Name'],
          contactEmailPhone: client['Contact Email / Phone'],
          assignedKAM,
          assignedKAMName,
          enabledModules: client['Enabled Modules'] ? client['Enabled Modules'].split(',').map((m: string) => m.trim()) : [],
          commissionRate: client['Commission Rate'] ? parseFloat(client['Commission Rate']) : null,
          status: client.Status,
        };
      });

      // Add debug info if there are filtered clients
      const responseData: any = {
        success: true,
        data: clientList,
      };

      console.log('[listClients] ✅ Sending response with', clientList.length, 'clients');
      console.log('[listClients] Response data:', JSON.stringify(responseData, null, 2).substring(0, 500));
      res.json(responseData);
      console.log('[listClients] ✅ Response sent successfully');
    } catch (error: any) {
      console.error('[listClients] ❌ Error:', error);
      console.error('[listClients] Error stack:', error.stack);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch clients',
      });
    }
  }

  /**
   * POST /kam/clients
   * Create new client
   */
  async createClient(req: Request, res: Response): Promise<void> {
    try {
      const { name, contactPerson, email, phone, kamId, enabledModules, commissionRate } = req.body;

      // Validate required fields
      if (!name || !email) {
        res.status(400).json({
          success: false,
          error: 'Name and email are required',
        });
        return;
      }

      // Check if email already exists in User Accounts
      const existingUsers = await n8nClient.fetchTable('User Accounts');
      const existingUser = existingUsers.find((u: any) => 
        (u.Username || u.Email || '').toLowerCase() === email.toLowerCase()
      );

      let userAccountId: string;
      let clientId: string;
      let isNewUser = false;

      if (existingUser) {
        console.log('[createClient] User account already exists:', existingUser.id);
        userAccountId = existingUser.id;
        clientId = existingUser.id; // Use same ID for client record
        
        // Check if client record exists
        const existingClients = await n8nClient.fetchTable('Clients');
        const existingClient = existingClients.find((c: any) => 
          c.id === userAccountId || c['Client ID'] === userAccountId
        );

        if (existingClient) {
          console.log('[createClient] Client record already exists:', existingClient.id);
          console.log('[createClient] EARLY RETURN - postClient will NOT be called');
          // Client already exists, return success with existing client info
          res.json({
            success: true,
            data: {
              id: existingClient.id,
              clientId: existingClient.id,
              userId: userAccountId,
              message: 'Client already exists',
              existing: true,
            },
          });
          return;
        } else {
          console.log('[createClient] User exists but client record missing, creating client record');
          console.log('[createClient] Will proceed to call postClient');
          // User exists but client record doesn't - create client record only
        }
      } else {
        isNewUser = true;
        // Create new user account
        userAccountId = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        clientId = userAccountId;
      }

      console.log('[createClient] Creating client:', { name, email, contactPerson, phone, isNewUser });

      // Create user account only if it doesn't exist (non-blocking for existing users)
      let userAccountPromise: Promise<any> | null = null;
      if (isNewUser) {
        const { authService } = await import('../auth/auth.service.js');
        const hashedPassword = await authService.hashPassword('TempPassword123!');
        
        const userAccountData = {
          id: userAccountId,
          Username: email,
          Password: hashedPassword, // Hashed password
          Role: 'client',
          'Associated Profile': name,
          'Account Status': 'Active',
        };

        console.log('[createClient] Creating user account:', userAccountId);
        // Create user account - this must succeed before creating client record
        try {
          const userAccountResult = await n8nClient.postUserAccount(userAccountData);
          console.log('[createClient] User account created successfully:', userAccountResult);
        } catch (userError: any) {
          console.error('[createClient] Failed to create user account:', userError);
          throw new Error(`Failed to create user account: ${userError.message || 'Unknown error'}`);
        }
      } else {
        console.log('[createClient] Skipping user account creation (already exists)');
      }

      // Create client record with commission rate
      // Use the User Account ID as the Client ID to maintain consistency
      // Get KAM ID - try multiple sources to ensure we have it
      let assignedKAM = kamId || req.user!.kamId || '';
      
      // If KAM ID is not set, try to get it from KAM Users table by email
      if (!assignedKAM && req.user!.email) {
        try {
          const kamUsers = await n8nClient.fetchTable('KAM Users');
          const kamUser = kamUsers.find((k: any) => k.Email?.toLowerCase() === req.user!.email?.toLowerCase());
          if (kamUser) {
            assignedKAM = kamUser.id || kamUser['KAM ID'] || '';
            console.log('[createClient] Found KAM ID from KAM Users table:', assignedKAM);
          }
        } catch (error) {
          console.warn('[createClient] Could not fetch KAM Users table:', error);
        }
      }
      
      // Assigned KAM is required - throw error if not found
      if (!assignedKAM) {
        res.status(400).json({
          success: false,
          error: 'Assigned KAM is required. Please ensure the KAM user exists and has a valid KAM ID.',
        });
        return;
      }
      
      // Commission rate is required
      if (!commissionRate) {
        res.status(400).json({
          success: false,
          error: 'Commission rate is required.',
        });
        return;
      }
      
      const clientData = {
        id: clientId,
        'Client ID': clientId,
        'Client Name': name,
        'Primary Contact Name': contactPerson || name,
        'Contact Email / Phone': `${email} / ${phone || ''}`,
        'Assigned KAM': assignedKAM,
        'Enabled Modules': Array.isArray(enabledModules) ? enabledModules.join(', ') : (enabledModules || ''),
        'Commission Rate': commissionRate.toString(),
        'Status': 'Active',
        'Form Categories': '',
      };

      console.log('[createClient] Creating client record:', clientId);
      console.log('[createClient] Client data:', JSON.stringify(clientData, null, 2));
      console.log('[createClient] Assigned KAM:', assignedKAM, 'KAM ID from user:', req.user!.kamId, 'User ID:', req.user!.id);
      console.log('[createClient] Full user object:', JSON.stringify(req.user, null, 2));
      
      try {
        const clientResult = await n8nClient.postClient(clientData);
        console.log('[createClient] Client record created successfully:', clientResult);
        
        // Invalidate cache after successful creation (next GET will fetch fresh data)
        // NO immediate GET webhook call - cache will be used until next actual request
        n8nClient.invalidateCache('Clients');
        n8nClient.invalidateCache('User Accounts');
        
        // Don't verify immediately - POST operation succeeded, cache invalidated
        // Next GET request will fetch fresh data automatically
        // This avoids 3 unnecessary webhook calls
      } catch (clientError: any) {
        console.error('[createClient] Failed to create client record:', clientError);
        // Try to clean up user account if client creation fails
        console.warn('[createClient] Client creation failed, but user account may have been created');
        throw new Error(`Failed to create client record: ${clientError.message || 'Unknown error'}`);
      }

      console.log('[createClient] Client created successfully:', clientId);
      
      // Cache is already invalidated in postClient method, no need to invalidate again

      // Return success response immediately
      res.json({
        success: true,
        data: {
          id: clientId,
          clientId: clientId,
          userId: userAccountId,
          message: 'Client created successfully',
        },
      });

      // Log admin activity asynchronously (non-blocking - don't fail if this fails)
      n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'create_client',
        'Description/Details': `Created new client: ${name} (${email})`,
        'Target Entity': 'client',
      }).then(() => {
        console.log('[createClient] Admin activity logged successfully');
      }).catch((logError: any) => {
        console.warn('[createClient] Failed to log admin activity (non-critical):', logError);
      });
    } catch (error: any) {
      console.error('[createClient] Error creating client:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create client',
      });
    }
  }

  /**
   * PATCH /kam/clients/:id/modules
   * Update client enabled modules
   */
  async updateClientModules(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { enabledModules, commissionRate } = req.body;
      // Fetch only Clients table
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => c.id === id || c['Client ID'] === id);

      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }

      // Update client record
      const updateData: any = {
        ...client,
      };

      if (enabledModules !== undefined) {
        updateData['Enabled Modules'] = Array.isArray(enabledModules) 
          ? enabledModules.join(', ') 
          : enabledModules;
      }

      if (commissionRate !== undefined) {
        updateData['Commission Rate'] = commissionRate.toString();
      }

      await n8nClient.postClient(updateData);

      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'update_client',
        'Description/Details': `Updated client ${id}${enabledModules ? `: modules: ${Array.isArray(enabledModules) ? enabledModules.join(', ') : enabledModules}` : ''}${commissionRate ? `, commission rate: ${commissionRate}%` : ''}`,
        'Target Entity': 'client',
      });

      res.json({
        success: true,
        message: 'Client updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update client',
      });
    }
  }

  /**
   * GET /kam/clients/:id/assigned-products
   * Get product IDs assigned to a client (KAM only, for their managed clients)
   */
  async getAssignedProducts(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => c.id === id || c['Client ID'] === id);
      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }
      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const managedIds = await rbacFilterService.getKAMManagedClientIds(req.user!.kamId!);
      const isManaged = managedIds.some((mid) => matchIds(mid, id));
      if (!isManaged) {
        res.status(403).json({ success: false, error: 'Client not managed by you' });
        return;
      }
      const raw = (client['Assigned Products'] || client.assignedProducts || '').toString().trim();
      const productIds = raw ? raw.split(/[,\s]+/).map((p: string) => p.trim()).filter(Boolean) : [];
      res.json({ success: true, data: productIds });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch assigned products',
      });
    }
  }

  /**
   * PUT /kam/clients/:id/assigned-products
   * Assign products to a client. KAM only, for their managed clients.
   * Body: { productIds: string[] }
   */
  async assignProductsToClient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { productIds } = req.body;
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => c.id === id || c['Client ID'] === id);
      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }
      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const managedIds = await rbacFilterService.getKAMManagedClientIds(req.user!.kamId!);
      const isManaged = managedIds.some((mid) => matchIds(mid, id));
      if (!isManaged) {
        res.status(403).json({ success: false, error: 'Client not managed by you' });
        return;
      }
      const ids = Array.isArray(productIds)
        ? productIds.map((p: any) => String(p).trim()).filter(Boolean)
        : [];
      const assignedProducts = ids.join(', ');
      const updateData = { ...client, 'Assigned Products': assignedProducts };
      await n8nClient.postClient(updateData);
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'assign_products_to_client',
        'Description/Details': `Assigned ${ids.length} product(s) to client ${client['Client ID'] || id}: ${assignedProducts || '(none)'}`,
        'Target Entity': 'client',
      });
      res.json({
        success: true,
        message: 'Products assigned successfully',
        data: ids,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to assign products',
      });
    }
  }

  /**
   * GET /kam/clients/:id
   * Get client details including modules and settings (KAM only)
   */
  async getClient(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'kam') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;

      // Verify this client is managed by this KAM
      // Fetch Clients table to check 'Assigned KAM' field
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => (c.id === id || c['Client ID'] === id));
      
      if (!client) {
        res.status(404).json({ success: false, error: 'Client not found' });
        return;
      }
      
      // Check if this client is assigned to the current KAM (with flexible matching)
      const assignedKAM = client['Assigned KAM'] || '';
      const kamId = req.user!.kamId || '';
      const assignedKAMStr = String(assignedKAM || '').trim();
      const kamIdStr = String(kamId || '').trim();
      
      // Use shared matchIds utility for consistent ID matching
      // Check if assigned KAM matches KAM ID directly
      if (!matchIds(assignedKAMStr, kamIdStr)) {
        // Try to match by KAM Users table
        const kamUsers = await n8nClient.fetchTable('KAM Users');
        const kamUser = kamUsers.find((k: any) => 
          matchIds(k.id, kamId) || 
          matchIds(k['KAM ID'], kamId)
        );
        const kamUserEmail = kamUser?.Email || kamUser?.['Email'] || '';
        const kamUserKamId = kamUser?.['KAM ID'] || kamUser?.id || '';
        
        // Check if assigned KAM matches KAM ID, email, or any variation
        const matches = 
          matchIds(assignedKAMStr, kamUserKamId) ||
          matchIds(assignedKAMStr, kamUserEmail) ||
          matchIds(assignedKAMStr, kamUser?.id) ||
          assignedKAMStr.includes(kamUserKamId) ||
          kamUserKamId.includes(assignedKAMStr) ||
          assignedKAMStr.toLowerCase().includes(kamUserKamId.toLowerCase()) ||
          kamUserKamId.toLowerCase().includes(assignedKAMStr.toLowerCase()) ||
          kamIdStr.includes(assignedKAMStr) ||
          assignedKAMStr.includes(kamIdStr);
        
        if (!matches) {
          res.status(403).json({ 
            success: false, 
            error: `Access denied: Client not managed by this KAM. Client assigned to: ${assignedKAM || 'No KAM'}, Your KAM ID: ${kamId}` 
          });
          return;
        }
      }

      // Client is already fetched above, no need to fetch again

      // Parse enabled modules
      const enabledModules = client['Enabled Modules']
        ? client['Enabled Modules'].split(',').map((m: string) => m.trim()).filter(Boolean)
        : [];

      res.json({
        success: true,
        data: {
          id: client.id,
          clientId: client['Client ID'],
          clientName: client['Client Name'],
          primaryContactName: client['Primary Contact Name'],
          contactEmailPhone: client['Contact Email / Phone'],
          assignedKAM: client['Assigned KAM'],
          enabledModules,
          commissionRate: client['Commission Rate'] ? parseFloat(client['Commission Rate']) : null,
          status: client.Status,
          formCategories: client['Form Categories'] ? client['Form Categories'].split(',').map((c: string) => c.trim()) : [],
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch client',
      });
    }
  }

  /**
   * GET /kam/clients/:id/form-mappings
   * @deprecated Form config now uses Product Documents (product-centric). Returns empty array.
   */
  async getFormMappings(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: [] });
  }

  /**
   * GET /public/clients/:id/form-mappings
   * @deprecated Form config now uses Product Documents (product-centric). Returns empty array.
   */
  async getPublicFormMappings(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: [] });
  }

  /**
   * GET /public/clients/:id/form-config
   * Get full form configuration for a client (Public - for form link access).
   * Uses product-embedded config (Section N, Field N) when available; else Product Documents.
   * No auth required.
   */
  async getPublicFormConfig(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { productId } = req.query;
      let categoriesArray: any[] = [];

      if (productId && typeof productId === 'string') {
        const { getFormConfigForProduct } = await import('../services/formConfig/productFormConfig.service.js');
        const config = await getFormConfigForProduct(productId);
        categoriesArray = config.categories;
      }

      if (categoriesArray.length === 0) {
        const { getSimpleFormConfig } = await import('../services/formConfig/simpleFormConfig.service.js');
        let config = await getSimpleFormConfig(id, productId as string | undefined);
        if (config.categories.length === 0 && productId) {
          config = await getSimpleFormConfig(id, undefined);
        }
        categoriesArray = config.categories;
      }

      res.json({
        success: true,
        data: categoriesArray,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch form config',
      });
    }
  }

  /**
   * POST /kam/clients/:id/form-mappings
   * DEPRECATED: Form configuration is now managed in Airtable (Form Link + Record Titles).
   */
  async createFormMapping(req: Request, res: Response): Promise<void> {
    res.status(410).json({
      success: false,
      error: 'Form configuration is now managed in Airtable (Form Link + Record Titles tables). Please add or update records there.',
      code: 'DEPRECATED',
    });
  }

  /**
   * POST /kam/clients/:id/form-links
   * Create a Form Link row for a client. Validates client is KAM-managed.
   */
  async createFormLink(req: Request, res: Response): Promise<void> {
    try {
      const { id: clientId } = req.params;
      const { formLink, productId, mappingId } = req.body;

      if (!clientId || !mappingId) {
        res.status(400).json({
          success: false,
          error: 'Client ID and Mapping ID are required',
        });
        return;
      }

      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const managedIds = await rbacFilterService.getKAMManagedClientIds(req.user!.kamId!);
      const isManaged = managedIds.some((mid) => matchIds(mid, clientId));
      if (!isManaged) {
        res.status(403).json({
          success: false,
          error: 'Client is not managed by you',
        });
        return;
      }

      const result = await n8nClient.postFormLink({
        clientId,
        formLink: formLink || '',
        productId: productId || '',
        mappingId: String(mappingId).trim(),
      });

      n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'create_form_link',
        'Description/Details': `Created form link for client ${clientId}, mapping ${mappingId}`,
        'Target Entity': 'form_link',
        'Related Client ID': clientId,
      }).catch((err) => console.warn('[createFormLink] Failed to log admin activity:', err));

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create form link',
      });
    }
  }

  /**
   * POST /kam/record-titles
   * Create a Record Title row for a Mapping ID.
   */
  async createRecordTitle(req: Request, res: Response): Promise<void> {
    try {
      const { mappingId, recordTitle, displayOrder, isRequired } = req.body;

      if (!mappingId || !recordTitle) {
        res.status(400).json({
          success: false,
          error: 'Mapping ID and Record Title are required',
        });
        return;
      }

      const result = await n8nClient.postRecordTitle({
        mappingId: String(mappingId).trim(),
        recordTitle: String(recordTitle).trim(),
        displayOrder: displayOrder ?? 0,
        isRequired: isRequired ?? false,
      });

      n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'create_record_title',
        'Description/Details': `Created record title "${recordTitle}" for mapping ${mappingId}`,
        'Target Entity': 'record_title',
      }).catch((err) => console.warn('[createRecordTitle] Failed to log admin activity:', err));

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create record title',
      });
    }
  }

  /**
   * GET /kam/record-titles?mappingId=X
   * @deprecated Use GET /credit/products/:productId/product-documents instead.
   */
  async getRecordTitles(req: Request, res: Response): Promise<void> {
    res.json({ success: true, data: [] });
  }

  /**
   * GET /kam/loan-applications
   * List loan applications for KAM's managed clients
   *
   * Uses rbacFilterService.filterLoanApplications (same as GET /loan-applications):
   * - KAM: getKAMManagedClientIds(kamId) from Clients where Assigned KAM matches; filter app.Client.
   * Uses same RBAC as GET /loan-applications; do not reintroduce User-Account–based filtering.
   *
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Loan Application') → /webhook/loanapplication → Airtable: Loan Applications
   *
   * Frontend: listKAMApplications, ApplicationsApiExample (KAM), test suites.
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async listApplications(req: Request, res: Response): Promise<void> {
    try {
      const { status, clientId } = req.query;
      const allApplications = await n8nClient.fetchTable('Loan Application');

      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      let applications = await rbacFilterService.filterLoanApplications(allApplications, req.user!);

      if (status) {
        applications = applications.filter((app: any) => app.Status === status || app.status === status);
      }

      if (clientId) {
        applications = applications.filter((app: any) =>
          String(app.Client || app['Client'] || '') === String(clientId)
        );
      }

      res.json({
        success: true,
        data: applications.map((app: any) => ({
          id: app.id,
          fileId: app['File ID'],
          client: app.Client,
          applicantName: app['Applicant Name'],
          status: app.Status || app.status,
          creationDate: app['Creation Date'],
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch applications',
      });
    }
  }

  /**
   * POST /kam/loan-applications/:id/edit
   * Edit application (KAM review stage)
   */
  async editApplication(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { formData, notes } = req.body;
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Check if in KAM review stage
      if (
        application.Status !== LoanStatus.UNDER_KAM_REVIEW &&
        application.Status !== LoanStatus.QUERY_WITH_CLIENT
      ) {
        res.status(400).json({
          success: false,
          error: 'Application not in KAM review stage',
        });
        return;
      }

      // Transform form data to checklist format when provided
      let formDataToStore: string | undefined = application['Form Data'];
      if (formData && Object.keys(formData).length > 0) {
        const productId = application['Loan Product'] || application.loanProduct || '';
        const { transformFormDataToChecklistFormat } = await import('../services/formConfig/formDataToChecklistTransformer.js');
        const transformed = productId
          ? await transformFormDataToChecklistFormat(productId, formData as Record<string, unknown>)
          : formData;
        formDataToStore = JSON.stringify(transformed);
      }

      // Update application
      const updatedData = {
        ...application,
        'Form Data': formDataToStore,
        'Last Updated': new Date().toISOString(),
      };

      await n8nClient.postLoanApplication(updatedData);

      // Log to file audit
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: application['File ID'],
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'edit_application',
        'Details/Message': notes || 'Application edited by KAM',
        'Target User/Role': 'client',
        Resolved: 'False',
      });

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'edit_application',
        'Description/Details': notes || `Application ${application['File ID']} edited by KAM`,
        'Target Entity': 'loan_application',
      });

      res.json({
        success: true,
        message: 'Application updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update application',
      });
    }
  }

  /**
   * POST /kam/loan-applications/:id/queries
   * Raise query to client
   */
  async raiseQuery(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const message = req.body.message ?? req.body.query ?? '';
      const { fieldsRequested, documentsRequested, allowsClientToEdit } = req.body;
      if (!message || !String(message).trim()) {
        res.status(400).json({ success: false, error: 'Message is required' });
        return;
      }
      // Fetch only Loan Application table
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => app.id === id);

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      // Update status
      await n8nClient.postLoanApplication({
        ...application,
        Status: LoanStatus.QUERY_WITH_CLIENT,
        'Last Updated': new Date().toISOString(),
      });

      // Build query message
      const queryMessage = [
        String(message).trim(),
        fieldsRequested?.length ? `Fields requested: ${fieldsRequested.join(', ')}` : '',
        documentsRequested?.length ? `Documents requested: ${documentsRequested.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('. ');

      // Use query service to create query with proper File Auditing Log and Notification
      const { queryService } = await import('../services/queries/query.service.js');
      const queryId = await queryService.createQuery(
        application['File ID'],
        application.Client,
        req.user!.email,
        'kam',
        queryMessage,
        'client',
        'query_raised'
      );

      // Log admin activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'raise_query',
        'Description/Details': `Query raised for application ${application['File ID']}`,
        'Target Entity': 'loan_application',
      });

      res.json({
        success: true,
        message: 'Query raised successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to raise query',
      });
    }
  }

  /**
   * POST /kam/loan-applications/:id/forward-to-credit
   * Forward application to credit team
   * 
   * Updates status from 'Under KAM Review' to 'Pending Credit Review'
   * Notifies all active Credit Team members
   * Mirrors workflow logic from PRD Section 3.2
   */
  async forwardToCredit(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { notes, assignedCreditAnalystId } = req.body;

      // Use loan workflow service for forwarding
      const { loanWorkflowService } = await import('../services/workflow/loanWorkflow.service.js');

      // Find application by ID or File ID
      const applications = await n8nClient.fetchTable('Loan Application');
      const application = applications.find((app) => 
        app.id === id || 
        app['File ID'] === id
      );

      if (!application) {
        res.status(404).json({ success: false, error: 'Application not found' });
        return;
      }

      const fileId = application['File ID'] || application.id;

      // Forward to credit team using workflow service
      await loanWorkflowService.forwardToCreditTeam(req.user!, {
        fileId,
        notes,
        assignedCreditAnalystId,
      });

      res.json({
        success: true,
        message: 'Application forwarded to credit team',
        data: {
          fileId,
          status: 'pending_credit_review',
        },
      });
    } catch (error: any) {
      console.error('[forwardToCredit] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to forward application',
      });
    }
  }
}

export const kamController = new KAMController();

