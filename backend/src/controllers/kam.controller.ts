/**
 * KAM (Key Account Manager) Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { LoanStatus, Module } from '../config/constants.js';
import { logAdminActivity, AdminActionType, logClientAction } from '../utils/adminLogger.js';
import { matchIds } from '../utils/idMatcher.js';
import { buildKAMNameMap, resolveKAMName } from '../utils/kamNameResolver.js';

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

      res.json({
        success: true,
        data: {
          clients: managedClients.map((c: any) => ({
            id: c.id,
            name: c['Client Name'] || c['Primary Contact Name'] || 'Unknown',
            email: c['Contact Email / Phone'] || '',
            activeApplications: clientApplications.filter(
              (app) => matchIds(app.Client, c.id) && app.Status !== LoanStatus.CLOSED
            ).length,
          })),
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
   * POST /kam/clients/:id/configure-modules
   * Configure client modules and form fields (KAM only)
   * 
   * Allows a KAM to configure which modules and form fields are enabled for a client.
   * Creates ClientFormMapping entries for the specified configuration.
   */
  async configureClientModules(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'kam') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id: clientId } = req.params;
      const { enabledModules, categories, productId } = req.body;

      if (!enabledModules || !Array.isArray(enabledModules)) {
        res.status(400).json({
          success: false,
          error: 'enabledModules is required and must be an array',
        });
        return;
      }

      // Use centralized form config service
      const { formConfigService } = await import('../services/formConfig/formConfig.service.js');

      const kamUserId = req.user!.kamId || req.user!.id;
      const mappings = await formConfigService.configureClientModules(kamUserId, {
        clientId,
        enabledModules,
        categories,
        productId,
      });

      // Log admin activity
      await logClientAction(
        req.user!,
        AdminActionType.CONFIGURE_FORM,
        clientId,
        `Configured modules for client: ${enabledModules.join(', ')}`,
        { enabledModules, categories, productId }
      );

      res.json({
        success: true,
        data: {
          clientId,
          enabledModules,
          mappings,
        },
      });
    } catch (error: any) {
      console.error('[configureClientModules] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to configure client modules',
      });
    }
  }

  /**
   * GET /kam/clients/:id/form-mappings
   * Get form mappings for a client (KAM only)
   */
  async getFormMappings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only Client Form Mapping table
      const mappings = await n8nClient.fetchTable('Client Form Mapping');

      const clientMappings = mappings.filter((m) => m.Client === id);

      res.json({
        success: true,
        data: clientMappings,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch form mappings',
      });
    }
  }

  /**
   * GET /public/clients/:id/form-mappings
   * Get form mappings for a client (Public - for form link access)
   */
  async getPublicFormMappings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only Client Form Mapping table
      const mappings = await n8nClient.fetchTable('Client Form Mapping');

      const clientMappings = mappings.filter((m) => m.Client === id);

      res.json({
        success: true,
        data: clientMappings,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch form mappings',
      });
    }
  }

  /**
   * POST /kam/clients/:id/form-mappings
   * Create/update form mappings for a client
   * Supports single mapping or bulk creation via modules array
   * 
   * Webhook Mapping:
   * - POST → n8nClient.postFormCategory() → /webhook/FormCategory → Airtable: Form Categories
   * - POST → n8nClient.postFormField() → /webhook/FormFields → Airtable: Form Fields
   * - POST → n8nClient.postClientFormMapping() → /webhook/POSTCLIENTFORMMAPPING → Airtable: Client Form Mapping
   * 
   * Frontend: src/pages/FormConfiguration.tsx (line 269)
   * See WEBHOOK_MAPPING_TABLE.md for complete mapping
   */
  async createFormMapping(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'kam') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { id } = req.params;
      const { category, isRequired, displayOrder, modules, productId } = req.body;

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

      // When creating mappings in bulk (FormConfiguration), a loan product is required
      // so each Client Form Mapping row is tied to a specific Product ID.
      if (modules && Array.isArray(modules) && modules.length > 0 && !productId) {
        res.status(400).json({
          success: false,
          error: 'productId is required when creating form mappings for modules.',
        });
        return;
      }

      // Support bulk creation via modules array
      if (modules && Array.isArray(modules)) {
        // Module 1: Versioning - store version timestamp for form config
        const versionTimestamp = new Date().toISOString();

        // Normalize modules: support legacy string[] or new { moduleId, includedFieldIds }[]
        type ModuleEntry = { moduleId: string; includedFieldIds: string[] };
        const extractModuleId = (m: string | ModuleEntry): string => {
          if (typeof m === 'string') return m;
          const mod = m as any;
          const raw = mod.moduleId ?? mod.id;
          if (typeof raw === 'string') return raw;
          if (raw && typeof raw === 'object' && typeof raw.id === 'string') return raw.id;
          return String(raw ?? '');
        };
        const normalizedModules: ModuleEntry[] = modules.map((m: string | ModuleEntry) => {
          if (typeof m === 'string') {
            return { moduleId: m, includedFieldIds: [] }; // Legacy: empty = all fields
          }
          const mod = m as ModuleEntry;
          const moduleId = extractModuleId(m);
          return {
            moduleId,
            includedFieldIds: Array.isArray(mod.includedFieldIds) ? mod.includedFieldIds : [],
          };
        });

        const formStructure: any = {
          clientId: id,
          productId: productId || null, // Optional: link to specific loan product
          modules: [],
          createdAt: versionTimestamp,
          version: versionTimestamp, // Version timestamp for form config
        };

        const mappingPromises = normalizedModules.map(async (entry: ModuleEntry, index: number) => {
          const moduleId = entry.moduleId;
          const includedFieldIds = entry.includedFieldIds;
          // Module definitions (matching frontend FORM_MODULES)
          const moduleDefinitions: Record<string, any> = {
            universal_checklist: {
              name: 'Universal Checklist',
              description: 'Housing Loan/LAP, Credit Line, Business Loan',
              fields: [
                { id: 'checklist_complete', label: 'Checklist Complete', type: 'checkbox', required: false },
              ],
            },
            personal_kyc: {
              name: 'Personal KYC (All Applicants/Co-Applicants)',
              description: 'Personal identification and address documents',
              fields: [
                { id: 'pan_card', label: 'PAN Card – Applicant/Co-applicant', type: 'file', required: true },
                { id: 'aadhaar_passport_voter', label: 'Aadhaar Card / Passport / Voter ID', type: 'file', required: true },
                { id: 'passport_photo', label: 'Passport Size Photograph – 2 Copies', type: 'file', required: true },
                { id: 'residence_proof', label: 'Residence Address Proof (Utility Bill / Rent Agreement)', type: 'file', required: true },
                { id: 'bank_statement_personal', label: 'Latest 6 Months Bank Statement – Personal', type: 'file', required: true },
                { id: 'itr_personal', label: 'ITR – Last 2 Years (if applicable)', type: 'file', required: false },
              ],
            },
            company_kyc: {
              name: 'Company/Business KYC (Proprietor / Partnership / Pvt Ltd / LLP)',
              description: 'Business registration and company documents',
              fields: [
                { id: 'business_registration', label: 'Business Registration Proof (GST / Udyam / Trade License / Partnership Deed / MOA & AOA)', type: 'file', required: true },
                { id: 'company_pan', label: 'Company PAN Card', type: 'file', required: true },
                { id: 'gst_certificate', label: 'GST Certificate', type: 'file', required: true },
                { id: 'business_address_proof', label: 'Business Address Proof', type: 'file', required: true },
                { id: 'partners_directors', label: 'List of Partners/Directors with Shareholding (if applicable)', type: 'file', required: false },
                { id: 'bank_statement_business', label: 'Latest 12 Months Bank Statement – Business', type: 'file', required: true },
                { id: 'company_itr', label: 'Latest 2 Years Company ITR', type: 'file', required: true },
                { id: 'audited_financials', label: 'Latest Audited Financials (if available)', type: 'file', required: false },
                { id: 'gst_3b', label: 'GST 3B – Last 12 Months', type: 'file', required: true },
              ],
            },
            income_banking: {
              name: 'Income & Banking Documents',
              description: 'Financial statements and banking documents',
              fields: [
                { id: 'itr_computation', label: 'Latest 2 Years ITR with Computation', type: 'file', required: true },
                { id: 'balance_sheet', label: 'Balance Sheet & Profit/Loss Statement (if applicable)', type: 'file', required: false },
                { id: 'bank_statement_main', label: '12 Months Bank Statement of Main Business Account', type: 'file', required: true },
                { id: 'loan_sanction_letters', label: 'Existing Loan Sanction Letters (if any)', type: 'file', required: false },
                { id: 'repayment_schedule', label: 'Repayment Schedule (for takeover cases)', type: 'file', required: false },
              ],
            },
            asset_details: {
              name: 'Asset Details (HL/LAP Specific)',
              description: 'Property and asset documentation',
              fields: [
                { id: 'property_title', label: 'Property Title Deed / Sale Deed', type: 'file', required: true },
                { id: 'mother_deed', label: 'Mother Deed / Chain of Documents', type: 'file', required: true },
                { id: 'encumbrance_certificate', label: 'Encumbrance Certificate (EC)', type: 'file', required: true },
                { id: 'property_tax', label: 'Property Tax Receipt', type: 'file', required: true },
                { id: 'building_plan', label: 'Approved Building Plan (if applicable)', type: 'file', required: false },
                { id: 'occupation_certificate', label: 'Occupation/Completion Certificate (if applicable)', type: 'file', required: false },
                { id: 'utility_bill_property', label: 'Latest Electricity/Water Bill (Property Proof)', type: 'file', required: true },
              ],
            },
            invoice_financial: {
              name: 'Invoice / Financial Requirement Details (Credit Line / Business Loan Specific)',
              description: 'Purchase orders and financial requirements',
              fields: [
                { id: 'purchase_order', label: 'Purchase Order (PO)', type: 'file', required: false },
                { id: 'grn', label: 'Goods Received Note (GRN)', type: 'file', required: false },
                { id: 'tax_invoice', label: 'Tax Invoice / Revised Proforma Invoice', type: 'file', required: false },
                { id: 'quotation', label: 'Quotation (if applicable)', type: 'file', required: false },
                { id: 'business_projections', label: 'Business Projections (if required)', type: 'file', required: false },
              ],
            },
            security_documents: {
              name: 'Security Documents',
              description: 'Security and guarantee documents',
              fields: [
                { id: 'pdc', label: 'Post-dated Cheques (if applicable)', type: 'file', required: false },
                { id: 'nach_mandate', label: 'NACH Mandate Form', type: 'file', required: false },
                { id: 'hypothecation_agreement', label: 'Hypothecation Agreement (if applicable)', type: 'file', required: false },
                { id: 'insurance_copy', label: 'Insurance Copy (if applicable)', type: 'file', required: false },
              ],
            },
            additional_requirements: {
              name: 'Additional Requirements (Common Across All Products)',
              description: 'Credit checks and additional documentation',
              fields: [
                { id: 'cibil_report', label: 'CIBIL Report (Minimum score as per program)', type: 'file', required: true },
                { id: 'no_dpd', label: 'No DPD in last 3 months / No 60+ in last 6 months', type: 'checkbox', required: true },
                { id: 'financial_owners', label: 'All financial owners must be part of the loan structure', type: 'checkbox', required: true },
              ],
            },
          };

          if (!moduleId || typeof moduleId !== 'string') {
            throw new Error(`Invalid module entry: expected moduleId string, got ${JSON.stringify(entry)}`);
          }
          const moduleDef = moduleDefinitions[moduleId];
          if (!moduleDef) {
            throw new Error(`Unknown module: ${moduleId}. Valid modules: ${Object.keys(moduleDefinitions).join(', ')}`);
          }

          // Filter fields: legacy (empty includedFieldIds) = all fields; new format = only included
          const fieldsToCreate =
            includedFieldIds.length === 0
              ? moduleDef.fields
              : moduleDef.fields.filter((f: { id: string }) => includedFieldIds.includes(f.id));

          // Skip module if no fields to include (new format with all unchecked)
          if (fieldsToCreate.length === 0) {
            return null;
          }

          const effectiveFieldIds = fieldsToCreate.map((f: { id: string }) => f.id);

          // Create Form Category for this module
          const categoryId = `CAT-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
          const categoryData = {
            id: categoryId,
            'Category ID': categoryId,
            'Category Name': moduleDef.name,
            'Description': moduleDef.description,
            'Display Order': (index + 1).toString(),
            'Active': 'True',
          };
          await n8nClient.postFormCategory(categoryData);

          // Create Form Fields for each included field
          const fieldPromises = fieldsToCreate.map(async (field: any, fieldIndex: number) => {
            const fieldId = `FLD-${Date.now()}-${index}-${fieldIndex}-${Math.random().toString(36).substr(2, 9)}`;
            const fieldData = {
              id: fieldId,
              'Field ID': fieldId,
              'Category': categoryId,
              'Field Label': field.label,
              'Field Type': field.type,
              'Field Placeholder': field.placeholder || '',
              'Field Options': field.options ? JSON.stringify(field.options) : '',
              'Is Mandatory': field.required ? 'True' : 'False',
              'Display Order': (fieldIndex + 1).toString(),
              'Active': 'True',
            };
            await n8nClient.postFormField(fieldData);
            return fieldData;
          });

          await Promise.all(fieldPromises);

          // Add to form structure JSON
          formStructure.modules.push({
            moduleId,
            categoryId,
            name: moduleDef.name,
            fields: fieldsToCreate,
          });

          // Create Client Form Mapping with versioning and included field IDs
          const mappingData: Record<string, any> = {
            id: `MAP-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            'Mapping ID': `MAP-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            Client: id,
            Category: categoryId,
            'Is Required': 'True',
            'Display Order': (index + 1).toString(),
            'Version': versionTimestamp, // Module 1: Store version timestamp
            'Product ID': productId || '', // Optional: link to loan product
          };
          // Store included field IDs for ClientForm to render only these fields
          mappingData['Included Field IDs'] = JSON.stringify(effectiveFieldIds);
          
          console.log(`[createFormMapping] Creating mapping ${index + 1}/${modules.length}:`, mappingData);
          try {
            const webhookResult = await n8nClient.postClientFormMapping(mappingData);
            console.log(`[createFormMapping] Mapping ${index + 1} created successfully:`, webhookResult);
          } catch (webhookError: any) {
            console.error(`[createFormMapping] Failed to create mapping ${index + 1}:`, webhookError.message);
            // Continue with other mappings even if one fails
            // But log the error for debugging
          }
          
          return mappingData;
        });

        const createdMappings = (await Promise.all(mappingPromises)).filter((m): m is NonNullable<typeof m> => m !== null);

        // Store form structure as JSON (can be stored in a field or logged)
        const formJson = JSON.stringify(formStructure, null, 2);

        // Module 0: Use admin logger helper
        const moduleIdsForLog = normalizedModules.map((m) => m.moduleId).join(', ');
        await logClientAction(req.user!, AdminActionType.CONFIGURE_FORM, id, 
          `Created ${createdMappings.length} form mapping(s) for client: ${moduleIdsForLog}${productId ? ` (Product: ${productId})` : ''}`, 
          { modules: normalizedModules, productId, version: versionTimestamp }
        );

        res.json({
          success: true,
          data: {
            mappings: createdMappings,
            count: createdMappings.length,
            formStructure: formStructure,
            formJson: formJson,
          },
        });
        return;
      }

      // Single mapping creation (backward compatibility)
      const mappingData = {
        id: `MAP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        'Mapping ID': `MAP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        Client: id,
        Category: category,
        'Is Required': isRequired !== false ? 'True' : 'False',
        'Display Order': displayOrder?.toString() || '0',
      };

      await n8nClient.postClientFormMapping(mappingData);

      // Module 0: Use admin logger helper
      await logClientAction(req.user!, AdminActionType.CONFIGURE_FORM, id, 
        `Created form mapping for client: ${category}`, 
        { category, isRequired, displayOrder }
      );

      res.json({
        success: true,
        data: mappingData,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create form mapping',
      });
    }
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

      // Update application
      const updatedData = {
        ...application,
        'Form Data': formData ? JSON.stringify(formData) : application['Form Data'],
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

