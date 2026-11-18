/**
 * Users Controller
 * Handles user account management (admin functions)
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { authService } from '../auth/auth.service.js';
import { AIRTABLE_TABLE_NAMES } from '../services/airtable/n8nEndpoints.js';
import {
  airtableErrorMessage,
  nextSerialId,
  parseDealerOnboardingBody,
  readCreatedRecordId,
} from '../services/dealerOnboarding.js';

const VALID_ROLES = ['client', 'kam', 'credit_team', 'nbfc', 'admin'];

export class UsersController {
  /**
   * GET /kam-users
   * List all KAM users
   */
  async listKAMUsers(req: Request, res: Response): Promise<void> {
    try {
      // Credit team and admin can list KAM users
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      // Fetch only KAM Users table
      const kamUsers = await n8nClient.fetchTable('KAM Users');

      res.json({
        success: true,
        data: kamUsers.map((user: any) => ({
          id: user.id,
          kamId: user['KAM ID'],
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          managedClients: user['Managed Clients'],
          role: user.Role,
          status: user.Status,
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch KAM users',
      });
    }
  }

  /**
   * GET /kam-users/:id
   * Get single KAM user
   */
  async getKAMUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only KAM Users table
      const kamUsers = await n8nClient.fetchTable('KAM Users');
      
      const user = kamUsers.find((u: any) => u.id === id || u['KAM ID'] === id);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'KAM user not found',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          kamId: user['KAM ID'],
          name: user.Name,
          email: user.Email,
          phone: user.Phone,
          managedClients: user['Managed Clients'],
          role: user.Role,
          status: user.Status,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch KAM user',
      });
    }
  }

  /**
   * POST /user-accounts
   * Create new user account (credit_team and admin)
   */
  async createUserAccount(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { username, password, role, associatedProfile, accountStatus } = req.body;

      if (!username || typeof username !== 'string' || !username.trim()) {
        res.status(400).json({ success: false, error: 'Username (email) is required' });
        return;
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        res.status(400).json({ success: false, error: 'Password is required and must be at least 6 characters' });
        return;
      }
      const normalizedRole = (role && typeof role === 'string' && VALID_ROLES.includes(role)) ? role : 'client';
      const status = accountStatus === 'Inactive' ? 'Inactive' : 'Active';

      const hashedPassword = await authService.hashPassword(password);
      const newId = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const userAccountData = {
        id: newId,
        Username: username.trim().toLowerCase(),
        Password: hashedPassword,
        Role: normalizedRole,
        'Associated Profile': associatedProfile != null ? String(associatedProfile).trim() : '',
        'Last Login': '',
        'Account Status': status,
      };

      await n8nClient.postUserAccount(userAccountData);

      // When creating a KAM user, also create the KAM Users record so login works (required for KAM ID at login)
      if (normalizedRole === 'kam') {
        const kamData = {
          id: newId,
          'KAM ID': newId,
          Name: (associatedProfile != null ? String(associatedProfile).trim() : '') || userAccountData.Username,
          Email: userAccountData.Username,
          Phone: '',
          'Managed Clients': '',
          Role: 'kam',
          Status: status,
        };
        const maxAttempts = 3;
        const retryDelayMs = 1000;
        let lastError: any;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await n8nClient.postKamUser(kamData);
            lastError = undefined;
            break;
          } catch (kamErr: any) {
            lastError = kamErr;
            console.warn(`[createUserAccount] KAM Users record creation attempt ${attempt}/${maxAttempts} failed:`, kamErr?.message || kamErr);
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, retryDelayMs));
            }
          }
        }
        if (lastError) {
          const msg = lastError?.message || String(lastError);
          console.error('[createUserAccount] KAM Users record creation failed after retries (user account was already created):', msg);
          res.status(502).json({
            success: false,
            error: `User account was created but KAM profile could not be created. The new user will not be able to log in as KAM until the KAM profile exists. Details: ${msg}. Check n8n webhook (N8N_POST_KAM_USERS_URL) and Airtable KAM Users table.`,
          });
          return;
        }
      }

      // When creating an NBFC user, also create the NBFC Partners record so login works (nbfcId resolved from Contact Email/Phone)
      if (normalizedRole === 'nbfc') {
        const associatedProfileStr = associatedProfile != null ? String(associatedProfile).trim() : '';
        const nbfcPartnerData = {
          id: newId,
          'Lender ID': newId,
          'Lender Name': associatedProfileStr || userAccountData.Username,
          'Contact Person': associatedProfileStr || '',
          'Contact Email/Phone': userAccountData.Username,
          'Address/Region': '',
          Active: status === 'Active' ? 'True' : 'False',
        };
        const maxAttempts = 3;
        const retryDelayMs = 1000;
        let lastError: any;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await n8nClient.postNBFCPartner(nbfcPartnerData);
            lastError = undefined;
            break;
          } catch (nbfcErr: any) {
            lastError = nbfcErr;
            console.warn(`[createUserAccount] NBFC Partners record creation attempt ${attempt}/${maxAttempts} failed:`, nbfcErr?.message || nbfcErr);
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, retryDelayMs));
            }
          }
        }
        if (lastError) {
          const msg = lastError?.message || String(lastError);
          console.error('[createUserAccount] NBFC Partners record creation failed after retries (user account was already created):', msg);
          res.status(502).json({
            success: false,
            error: `User account was created but NBFC Partner record could not be created. The new user will not function as NBFC until the NBFC Partners record exists. Details: ${msg}. Check n8n webhook (N8N_POST_NBFC_PARTNERS_URL) and Airtable NBFC Partners table.`,
          });
          return;
        }
      }

      const activityDescription =
        normalizedRole === 'nbfc'
          ? `Created user account and NBFC Partner ${username}`
          : `Created user account ${username}`;
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'create_user_account',
        'Description/Details': activityDescription,
        'Target Entity': 'user_account',
      });

      res.status(201).json({
        success: true,
        message: 'User account created successfully',
        data: { id: newId, username: userAccountData.Username, role: normalizedRole, accountStatus: status },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create user account',
      });
    }
  }

  /**
   * GET /user-accounts
   * List all user accounts (admin only)
   */
  async listUserAccounts(req: Request, res: Response): Promise<void> {
    try {
      // Credit team and admin can list all user accounts
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      // Cache by default; bypass only on explicit Refresh (?forceRefresh=true)
      const useCache = req.query.forceRefresh !== 'true';
      const userAccounts = await n8nClient.fetchTable('User Accounts', useCache);

      res.json({
        success: true,
        data: userAccounts.map((account: any) => ({
          id: account.id,
          username: account.Username,
          role: account.Role,
          associatedProfile: account['Associated Profile'],
          lastLogin: account['Last Login'],
          accountStatus: account['Account Status'],
          // Don't return password
        })),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch user accounts',
      });
    }
  }

  /**
   * GET /user-accounts/:id
   * Get single user account
   */
  async getUserAccount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Fetch only User Accounts table
      const userAccounts = await n8nClient.fetchTable('User Accounts');
      
      const account = userAccounts.find((a: any) => a.id === id);

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'User account not found',
        });
        return;
      }

      // Users can only see their own account unless credit team or admin
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin' && account.id !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: account.id,
          username: account.Username,
          role: account.Role,
          associatedProfile: account['Associated Profile'],
          lastLogin: account['Last Login'],
          accountStatus: account['Account Status'],
          // Don't return password
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch user account',
      });
    }
  }

  /**
   * PATCH /user-accounts/:id
   * Update user account (admin only)
   */
  async updateUserAccount(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { accountStatus, role, associatedProfile } = req.body;

      // Credit team and admin can update user accounts
      if (req.user!.role !== 'credit_team' && req.user!.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Forbidden',
        });
        return;
      }

      // Fetch only User Accounts table
      const userAccounts = await n8nClient.fetchTable('User Accounts');
      const account = userAccounts.find((a: any) => a.id === id);

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'User account not found',
        });
        return;
      }

      // Update account
      const updateData: any = {
        ...account,
      };

      if (accountStatus !== undefined) {
        updateData['Account Status'] = accountStatus;
      }

      if (role !== undefined) {
        updateData['Role'] = role;
      }

      if (associatedProfile !== undefined) {
        updateData['Associated Profile'] = associatedProfile;
      }

      await n8nClient.postUserAccount(updateData);

      // Log activity
      await n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'update_user_account',
        'Description/Details': `Updated user account ${id}`,
        'Target Entity': 'user_account',
      });

      res.json({
        success: true,
        message: 'User account updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update user account',
      });
    }
  }

  /**
   * PATCH /user-accounts/:id/settings
   * Update current user's own settings (user can only update their own record)
   */
  async updateUserSettings(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { settings } = req.body;

      // User can only update their own settings
      if (req.user!.id !== id) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: you can only update your own settings',
        });
        return;
      }

      if (!settings || typeof settings !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Request body must include a settings object',
        });
        return;
      }

      const userAccounts = await n8nClient.fetchTable('User Accounts');
      const account = userAccounts.find((a: any) => a.id === id);

      if (!account) {
        res.status(404).json({
          success: false,
          error: 'User account not found',
        });
        return;
      }

      // Merge settings into record; store as JSON string in Settings or Preferences field
      const updateData: any = { ...account };
      updateData['Settings'] = JSON.stringify(settings);

      await n8nClient.postUserAccount(updateData);

      n8nClient.postAdminActivityLog({
        id: `ACT-${Date.now()}`,
        'Activity ID': `ACT-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        'Performed By': req.user!.email,
        'Action Type': 'update_user_settings',
        'Description/Details': `User ${id} updated their settings`,
        'Target Entity': 'user_account',
        'Related User ID': id,
      }).catch((err) => console.warn('[updateUserSettings] Failed to log admin activity:', err));

      res.json({
        success: true,
        message: 'Settings saved successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to save settings',
      });
    }
  }

  /**
   * POST /users/create-dealer
   * KAM or admin creates a client login from the password they entered.
   */
  async createDealer(req: Request, res: Response): Promise<void> {
    try {
      if (req.user?.role !== 'kam' && req.user?.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Insufficient permissions' });
        return;
      }

      const parsed = parseDealerOnboardingBody(req.body as Record<string, unknown>);
      if (parsed.ok === false) {
        res.status(400).json({ success: false, error: parsed.error });
        return;
      }
      const dealer = parsed.value;
      const { email, clientName: name } = dealer;

      const existingUsers = await n8nClient.fetchTable('User Accounts');
      const existingUser = existingUsers.find((user) => {
        const record = user as { Username?: string; Email?: string };
        const username = (record.Username || record.Email || '').toString().trim().toLowerCase();
        return username === email;
      });
      if (existingUser) {
        res.status(409).json({
          success: false,
          error: 'A user with this email already exists',
        });
        return;
      }

      const hashedPassword = await authService.hashPassword(dealer.password);
      const newId = `USER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const createdAt = new Date().toISOString();
      const assignedKam =
        req.user.role === 'kam' && req.user.kamId ? req.user.kamId : '';
      if (req.user.role === 'kam' && !req.user.kamId) {
        console.warn('[createDealer] KAM has no kamId; Assigned KAM left blank', { email });
      }

      const kycRows = (await n8nClient.fetchTable(
        AIRTABLE_TABLE_NAMES.CLIENT_KYC,
        false
      )) as Array<Record<string, unknown>>;
      const clientKycRecord =
        dealer.clientKycRecord || nextSerialId(kycRows, 'Client KYC Record', 'KYC');
      const dealerId = dealer.dealerId || nextSerialId(kycRows, 'Dealer ID', 'DLR');

      const clientPayload = {
        id: newId,
        'Client ID': newId,
        'Client Name': name,
        'Primary Contact Name': dealer.primaryContactName,
        'Contact Email / Phone': email,
        'Assigned KAM': assignedKam,
        'Enabled Modules': dealer.enabledModules,
        'Commission Rate': dealer.commissionRate,
        Status: dealer.status,
        Products: dealer.products,
      };

      const clientResult = await n8nClient.postClient(clientPayload);
      const clientWriteError = airtableErrorMessage(clientResult);
      if (clientWriteError) {
        throw new Error(clientWriteError);
      }
      const clientRecordId = await resolveWrittenRecordId(
        clientResult,
        AIRTABLE_TABLE_NAMES.CLIENTS,
        (row) => row['Client ID'] === newId || row.id === newId
      );

      const kycPayload = {
        id: clientKycRecord,
        'Client KYC Record': clientKycRecord,
        'Client ID': newId,
        'Login Email': email,
        Status: dealer.status,
        'KYC Verified': dealer.kycVerified,
        'KYC Verified Date': dealer.kycVerifiedDate,
        'Dealer ID': dealerId,
        'Trade Name': dealer.tradeName,
        'Dealer Name': dealer.dealerName,
        'Dealer Contact': dealer.dealerContact,
        'Dealer Email': dealer.dealerEmail,
        'GST Number': dealer.gstNumber,
        'Dealer PAN': dealer.dealerPan,
        'Dealer Address': dealer.dealerAddress,
        'Dealer City': dealer.dealerCity,
        'Dealer State': dealer.dealerState,
        'Dealer Pincode': dealer.dealerPincode,
        'Dealer Bank Name': dealer.dealerBankName,
        'Dealer Account Number': dealer.dealerAccountNumber,
        'Dealer IFSC Code': dealer.dealerIfscCode,
        'Name in Bank': dealer.nameInBank,
        'Selected Dealer Display': dealer.selectedDealerDisplay,
        Notes: dealer.notes,
        'Client Link': [clientRecordId],
      };
      const kycResult = await n8nClient.postClientKyc(kycPayload);
      const kycWriteError = airtableErrorMessage(kycResult);
      if (kycWriteError) {
        throw new Error(kycWriteError);
      }
      const kycRecordId = await resolveWrittenRecordId(
        kycResult,
        AIRTABLE_TABLE_NAMES.CLIENT_KYC,
        (row) => row['Client KYC Record'] === clientKycRecord || row['Client ID'] === newId
      );

      const linkResult = await n8nClient.postClient({
        ...clientPayload,
        'Client KYC': [kycRecordId],
      });
      const linkWriteError = airtableErrorMessage(linkResult);
      if (linkWriteError) {
        throw new Error(linkWriteError);
      }

      const userResult = await n8nClient.postUserAccount({
        id: newId,
        Username: email,
        Password: hashedPassword,
        Role: 'client',
        client_ID: newId,
        Kam_ID: '',
        NBFC_ID: '',
        CreditTeam_ID: '',
        'Associated Profile': name,
        'Account Status': dealer.status || 'Active',
      });
      const userWriteError = airtableErrorMessage(userResult);
      if (userWriteError) {
        throw new Error(userWriteError);
      }

      console.log('[createDealer] Created dealer account', { id: newId, email });

      n8nClient
        .postAdminActivityLog({
          id: `ACT-${Date.now()}`,
          'Activity ID': `ACT-${Date.now()}`,
          Timestamp: createdAt,
          'Performed By': req.user.email || req.user.id,
          'Action Type': 'create_dealer',
          'Description/Details': `Created dealer account: ${name} (${email})`,
          'Target Entity': 'user_account',
        })
        .catch((logError: unknown) => {
          console.warn('[createDealer] Failed to log admin activity (non-critical):', logError);
        });

      res.status(200).json({
        success: true,
        email,
        name,
        role: 'client',
        clientId: newId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create dealer account';
      console.error('[createDealer] Failed to create dealer account', {
        email: typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined,
        message,
      });
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  }
}

async function resolveWrittenRecordId(
  result: unknown,
  tableName: string,
  matches: (row: Record<string, unknown>) => boolean
): Promise<string> {
  const direct = readCreatedRecordId(result);
  if (direct) return direct;
  const rows = (await n8nClient.fetchTable(tableName, false)) as Array<Record<string, unknown>>;
  const row = rows.find(matches);
  const id = row && typeof row.id === 'string' ? row.id : '';
  if (!id) {
    throw new Error(`${tableName} write did not return a record id`);
  }
  return id;
}

export const usersController = new UsersController();

