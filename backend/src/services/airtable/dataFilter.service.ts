/**
 * Data Filtering Service
 * Filters Airtable data based on user role and permissions
 */

import { AuthUser } from '../../types/auth.js';
import { UserRole } from '../../config/constants.js';
import {
  LoanApplication,
  CommissionLedgerEntry,
  FileAuditLogEntry,
  N8nGetResponse,
} from '../../types/entities.js';

export class DataFilterService {
  /**
   * Filter loan applications based on user role
   */
  filterLoanApplications(
    applications: LoanApplication[],
    user: AuthUser
  ): LoanApplication[] {
    switch (user.role) {
      case UserRole.CLIENT:
        // Clients only see their own applications
        // Match by Client ID (from Clients table, not User Account ID)
        if (!user.clientId) {
          console.warn(`[DataFilter] Client ${user.email} has no clientId set. Cannot filter applications.`);
          return [];
        }
        const filtered = applications.filter((app: any) => {
          const appClient = app.Client || app['Client'] || app['Client ID'];
          const clientIdStr = String(user.clientId);
          const matches = appClient && (
            String(appClient) === clientIdStr || 
            appClient === user.clientId ||
            String(appClient) === String(user.clientId)
          );
          if (!matches && user.clientId) {
            console.log(`[DataFilter] Application ${app['File ID'] || app.id} Client="${appClient}" does not match user clientId="${user.clientId}"`);
          }
          return matches;
        });
        console.log(`[DataFilter] Client ${user.email} (clientId: ${user.clientId}): Filtered ${filtered.length} of ${applications.length} applications`);
        return filtered;

      case UserRole.KAM:
        // KAMs see applications for their managed clients
        // Need to get managed clients list (would require additional lookup)
        // For now, return all - will be filtered in controller with client lookup
        return applications;

      case UserRole.CREDIT:
        // Credit team sees all
        return applications;

      case UserRole.NBFC:
        // NBFCs see only assigned applications
        return applications.filter(
          (app) => app['Assigned NBFC'] === user.nbfcId
        );

      default:
        return [];
    }
  }

  /**
   * Filter commission ledger entries
   */
  filterCommissionLedger(
    entries: CommissionLedgerEntry[],
    user: AuthUser
  ): CommissionLedgerEntry[] {
    switch (user.role) {
      case UserRole.CLIENT:
        return entries.filter((entry) => entry.Client === user.clientId);

      case UserRole.KAM:
        // KAMs see entries for their managed clients
        return entries;

      case UserRole.CREDIT:
        return entries;

      default:
        return [];
    }
  }

  /**
   * Filter file audit log entries
   */
  filterFileAuditLog(
    entries: FileAuditLogEntry[],
    user: AuthUser
  ): FileAuditLogEntry[] {
    switch (user.role) {
      case UserRole.CLIENT:
        // Clients see entries for their own files
        return entries;

      case UserRole.KAM:
        // KAMs see entries for their managed clients' files
        return entries;

      case UserRole.CREDIT:
        return entries;

      case UserRole.NBFC:
        // NBFCs see entries relevant to their assigned files
        return entries;

      default:
        return [];
    }
  }

  /**
   * Get client IDs managed by a KAM
   * Checks the Clients table for 'Assigned KAM' field
   */
  async getKAMManagedClients(
    kamId: string,
    userAccounts: any[]
  ): Promise<string[]> {
    // First, we need to fetch the Clients table to check 'Assigned KAM' field
    // Import n8nClient here to avoid circular dependency
    const { n8nClient } = await import('./n8nClient.js');
    
    try {
      // Fetch Clients table
      const clients = await n8nClient.fetchTable('Clients');
      
      // Filter clients where 'Assigned KAM' matches the KAM ID
      // Also check variations: 'Assigned KAM', 'KAM ID', 'KAM', etc.
      const managedClients = clients
        .filter((client: any) => {
          const assignedKAM = client['Assigned KAM'] || client['KAM ID'] || client['KAM'] || client['Assigned KAM ID'] || '';
          // Match by exact ID or by KAM ID field
          return assignedKAM === kamId || 
                 assignedKAM === client['KAM ID'] ||
                 (typeof assignedKAM === 'string' && assignedKAM.includes(kamId));
        })
        .map((client: any) => client.id || client['Client ID'] || client['ID']);
      
      return managedClients;
    } catch (error) {
      console.error('Error fetching managed clients:', error);
      // Fallback: return all clients from user accounts (old behavior)
      return userAccounts
        .filter((u) => u.Role === UserRole.CLIENT)
        .map((u) => u.id);
    }
  }
}

export const dataFilterService = new DataFilterService();

