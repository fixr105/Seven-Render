/**
 * Data Filtering Service
 * Filters Airtable data based on user role and permissions
 */

import { AuthUser } from '../auth/auth.service.js';
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
        return applications.filter((app) => app.Client === user.clientId);

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
   */
  async getKAMManagedClients(
    kamId: string,
    allData: N8nGetResponse
  ): Promise<string[]> {
    const userAccounts = allData['User Accounts'] || [];
    // Clients have Role='client' and Associated Profile might link to KAM
    // This is a simplified version - adjust based on actual schema
    return userAccounts
      .filter((u) => u.Role === UserRole.CLIENT)
      .map((u) => u.id);
  }
}

export const dataFilterService = new DataFilterService();

