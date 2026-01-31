/**
 * Commission & Payout Service
 * 
 * Handles commission calculation and payout workflow:
 * 1. Calculate commissions when loan status is updated to 'Approved/Disbursed'
 * 2. Handle payout requests from clients
 * 3. Manage dispute flags for ledger entries
 * 
 * Based on Commission Ledger and Payout Requests nodes in n8n flow
 */

import { n8nClient } from '../airtable/n8nClient.js';
import { DisputeStatus, LoanStatus } from '../../config/constants.js';
import { centralizedLogger } from '../logging/centralizedLogger.service.js';
import { AuthUser } from '../../types/auth.js';

/**
 * Options for calculating commission
 */
export interface CalculateCommissionOptions {
  loanFileId: string;
  clientId: string;
  disbursedAmount: number;
  disbursedDate?: string;
  commissionRate?: number; // Optional, will fetch from client if not provided
}

/**
 * Options for creating payout request
 */
export interface CreatePayoutRequestOptions {
  clientId: string;
  amount?: number; // Optional, if not provided, uses full balance
  full?: boolean; // If true, requests full balance
}

/**
 * Options for flagging dispute
 */
export interface FlagDisputeOptions {
  ledgerEntryId: string;
  reason: string;
  raisedBy: AuthUser;
}

/**
 * Commission calculation result
 */
export interface CommissionCalculationResult {
  ledgerEntryId: string;
  disbursedAmount: number;
  commissionRate: number;
  commissionAmount: number;
  payoutAmount: number; // Positive for payout, negative for payin
  entryType: 'Payout' | 'Payin';
  description: string;
}

/**
 * Commission & Payout Service
 */
export class CommissionService {
  /**
   * Calculate and create commission ledger entry
   * 
   * Called when loan status is updated to 'Approved' or 'Disbursed'
   * 
   * @param options - Commission calculation options
   * @returns Commission calculation result
   */
  async calculateCommission(
    options: CalculateCommissionOptions
  ): Promise<CommissionCalculationResult> {
    const { loanFileId, clientId, disbursedAmount, disbursedDate, commissionRate } = options;

    // Fetch client to get commission rate if not provided
    let finalCommissionRate = commissionRate;
    if (!finalCommissionRate) {
      const clients = await n8nClient.fetchTable('Clients');
      const client = clients.find((c: any) => 
        c.id === clientId || 
        c['Client ID'] === clientId
      );

      if (client && client['Commission Rate']) {
        const rateStr = client['Commission Rate'].toString().trim();
        finalCommissionRate = parseFloat(rateStr) || 1.5; // Default 1.5%
      } else {
        finalCommissionRate = 1.5; // Default fallback
      }
    }

    // Calculate commission
    const commissionAmount = (disbursedAmount * finalCommissionRate) / 100;

    // Determine if it's a Payout (positive) or Payin (negative)
    // Payout: commission is positive (client earns money)
    // Payin: commission is negative (client owes money) - store as negative amount
    const payoutAmount = commissionAmount >= 0 ? commissionAmount : -Math.abs(commissionAmount);
    const entryType = commissionAmount >= 0 ? 'Payout' : 'Payin';

    // Create ledger entry ID
    const ledgerEntryId = `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entryDate = disbursedDate || new Date().toISOString().split('T')[0];

    // Create commission ledger entry
    const ledgerEntry = {
      id: ledgerEntryId,
      'Ledger Entry ID': ledgerEntryId,
      Client: clientId,
      'Loan File': loanFileId,
      Date: entryDate,
      'Disbursed Amount': disbursedAmount.toString(),
      'Commission Rate': finalCommissionRate.toString(),
      'Payout Amount': payoutAmount.toString(), // Positive for Payout, negative for Payin
      Description: `${entryType} for loan disbursement - ${loanFileId} (Commission: ${finalCommissionRate}% of ${disbursedAmount})`,
      'Dispute Status': DisputeStatus.NONE,
      'Payout Request': 'False',
    };

    // Post to Commission Ledger via n8n webhook
    await n8nClient.postCommissionLedger(ledgerEntry);

    return {
      ledgerEntryId,
      disbursedAmount,
      commissionRate: finalCommissionRate,
      commissionAmount,
      payoutAmount,
      entryType,
      description: ledgerEntry.Description,
    };
  }

  /**
   * Create payout request
   * 
   * Allows clients to request payout of their commission balance
   * 
   * @param user - Client user requesting payout
   * @param options - Payout request options
   * @returns Payout request details
   */
  async createPayoutRequest(
    user: AuthUser,
    options: CreatePayoutRequestOptions
  ): Promise<{
    requestId: string;
    requestedAmount: number;
    currentBalance: number;
  }> {
    if (user.role !== 'client') {
      throw new Error('Only clients can create payout requests');
    }

    const { clientId, amount, full } = options;

    // Verify client ID matches user
    if (clientId !== user.clientId) {
      throw new Error('Client ID mismatch');
    }

    // Fetch client's ledger entries
    const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
    const clientEntries = ledgerEntries.filter(
      (entry) => entry.Client === clientId
    );

    // Calculate current balance
    const currentBalance = clientEntries.reduce(
      (sum, entry) => sum + parseFloat(entry['Payout Amount'] || '0'),
      0
    );

    if (currentBalance <= 0) {
      throw new Error('No balance available for payout');
    }

    // Determine requested amount
    const requestedAmount = full ? currentBalance : (amount || currentBalance);

    if (requestedAmount > currentBalance) {
      throw new Error('Requested amount exceeds available balance');
    }

    if (requestedAmount <= 0) {
      throw new Error('Requested amount must be greater than zero');
    }

    // Create payout request entry
    const payoutEntryId = `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const payoutEntry = {
      id: payoutEntryId,
      'Ledger Entry ID': payoutEntryId,
      Client: clientId,
      'Loan File': '',
      Date: new Date().toISOString().split('T')[0],
      'Disbursed Amount': '',
      'Commission Rate': '',
      'Payout Amount': '0', // Request entry, not actual payout
      Description: `Payout request: ${requestedAmount}`,
      'Dispute Status': DisputeStatus.NONE,
      'Payout Request': 'Requested',
    };

    await n8nClient.postCommissionLedger(payoutEntry);

    // Log payout request
    await centralizedLogger.logAdminActivity(user, {
      actionType: 'create_payout_request',
      description: `Payout request created: ${requestedAmount} (Balance: ${currentBalance})`,
      targetEntity: 'commission_ledger',
      relatedClientId: clientId,
      metadata: { requestedAmount, currentBalance },
    });

    // Log to file audit (if linked to a loan file)
    // Note: Payout requests may not be linked to a specific file
    await n8nClient.postFileAuditLog({
      id: `AUDIT-${Date.now()}`,
      'Log Entry ID': `AUDIT-${Date.now()}`,
      File: '',
      Timestamp: new Date().toISOString(),
      Actor: user.email,
      'Action/Event Type': 'payout_request',
      'Details/Message': `Payout request created: ${requestedAmount} (Available balance: ${currentBalance})`,
      'Target User/Role': 'credit_team',
      Resolved: 'False',
    }).catch((err) => {
      console.warn('[CommissionService] Failed to log payout request to file audit:', err);
    });

    return {
      requestId: payoutEntryId,
      requestedAmount,
      currentBalance,
    };
  }

  /**
   * Flag ledger entry for dispute
   * 
   * Allows clients or credit team to flag a ledger entry for dispute
   * Credit team can review and resolve disputes
   * 
   * @param options - Dispute flagging options
   */
  async flagDispute(options: FlagDisputeOptions): Promise<void> {
    const { ledgerEntryId, reason, raisedBy } = options;

    // Fetch ledger entry
    const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
    const entry = ledgerEntries.find((e) => 
      e.id === ledgerEntryId || 
      e['Ledger Entry ID'] === ledgerEntryId
    );

    if (!entry) {
      throw new Error(`Ledger entry not found: ${ledgerEntryId}`);
    }

    // Verify access: Clients can only flag their own entries
    if (raisedBy.role === 'client' && entry.Client !== raisedBy.clientId) {
      throw new Error('Access denied: Cannot flag dispute for other clients');
    }

    // Update dispute status
    await n8nClient.postCommissionLedger({
      ...entry,
      'Dispute Status': DisputeStatus.UNDER_QUERY,
    });

    // Log dispute flagging
    await centralizedLogger.logAdminActivity(raisedBy, {
      actionType: 'flag_dispute',
      description: `Ledger dispute flagged: ${reason}`,
      targetEntity: 'commission_ledger',
      relatedFileId: entry['Loan File'],
      relatedClientId: entry.Client,
      metadata: { ledgerEntryId, reason, disputeStatus: DisputeStatus.UNDER_QUERY },
    });

    // Log to file audit (if linked to a loan file)
    if (entry['Loan File']) {
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: entry['Loan File'],
        Timestamp: new Date().toISOString(),
        Actor: raisedBy.email,
        'Action/Event Type': 'ledger_dispute_flagged',
        'Details/Message': `Ledger dispute flagged: ${reason}`,
        'Target User/Role': raisedBy.role === 'client' ? 'credit_team' : 'credit_team',
        Resolved: 'False',
      }).catch((err) => {
        console.warn('[CommissionService] Failed to log dispute to file audit:', err);
      });
    }
  }

  /**
   * Resolve dispute
   * 
   * Credit team can resolve disputes by:
   * - Keeping the original entry (dispute rejected)
   * - Adjusting the entry (dispute accepted, amount corrected)
   * 
   * @param user - Credit team user resolving dispute
   * @param ledgerEntryId - Ledger entry ID
   * @param resolution - Resolution details
   */
  async resolveDispute(
    user: AuthUser,
    ledgerEntryId: string,
    resolution: {
      resolved: boolean; // true = dispute accepted, false = dispute rejected
      adjustedAmount?: number; // If dispute accepted, new payout amount
      notes?: string;
    }
  ): Promise<void> {
    if (user.role !== 'credit_team') {
      throw new Error('Only credit team can resolve disputes');
    }

    // Fetch ledger entry
    const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
    const entry = ledgerEntries.find((e) => 
      e.id === ledgerEntryId || 
      e['Ledger Entry ID'] === ledgerEntryId
    );

    if (!entry) {
      throw new Error(`Ledger entry not found: ${ledgerEntryId}`);
    }

    // Update dispute status
    const updateData: any = {
      ...entry,
      'Dispute Status': resolution.resolved ? DisputeStatus.RESOLVED : DisputeStatus.NONE,
    };

    // If dispute accepted and amount adjusted, update payout amount
    if (resolution.resolved && resolution.adjustedAmount !== undefined) {
      updateData['Payout Amount'] = resolution.adjustedAmount.toString();
      updateData.Description = `${entry.Description || ''} [Dispute resolved: Amount adjusted to ${resolution.adjustedAmount}. ${resolution.notes || ''}]`;
    }

    await n8nClient.postCommissionLedger(updateData);

    // Log dispute resolution
    await centralizedLogger.logAdminActivity(user, {
      actionType: 'resolve_dispute',
      description: `Ledger dispute ${resolution.resolved ? 'resolved' : 'rejected'}: ${resolution.notes || ''}`,
      targetEntity: 'commission_ledger',
      relatedFileId: entry['Loan File'],
      relatedClientId: entry.Client,
      metadata: { ledgerEntryId, resolution },
    });

    // Log to file audit (if linked to a loan file)
    if (entry['Loan File']) {
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: entry['Loan File'],
        Timestamp: new Date().toISOString(),
        Actor: user.email,
        'Action/Event Type': 'ledger_dispute_resolved',
        'Details/Message': `Ledger dispute ${resolution.resolved ? 'resolved' : 'rejected'}: ${resolution.notes || ''}`,
        'Target User/Role': 'client',
        Resolved: 'True',
      }).catch((err) => {
        console.warn('[CommissionService] Failed to log dispute resolution to file audit:', err);
      });
    }
  }

  /**
   * Get client balance
   * 
   * Calculates current commission balance for a client
   */
  async getClientBalance(clientId: string): Promise<{
    currentBalance: number;
    totalPayouts: number;
    totalPayins: number;
    pendingPayoutRequests: number;
    disputedEntries: number;
  }> {
    const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
    const clientEntries = ledgerEntries.filter(
      (entry) => entry.Client === clientId
    );

    // Calculate balance
    const currentBalance = clientEntries.reduce(
      (sum, entry) => sum + parseFloat(entry['Payout Amount'] || '0'),
      0
    );

    // Calculate totals
    const totalPayouts = clientEntries
      .filter((entry) => parseFloat(entry['Payout Amount'] || '0') > 0)
      .reduce((sum, entry) => sum + parseFloat(entry['Payout Amount'] || '0'), 0);

    const totalPayins = Math.abs(
      clientEntries
        .filter((entry) => parseFloat(entry['Payout Amount'] || '0') < 0)
        .reduce((sum, entry) => sum + parseFloat(entry['Payout Amount'] || '0'), 0)
    );

    const pendingPayoutRequests = clientEntries.filter(
      (entry) => 
        entry['Payout Request'] === 'Requested' ||
        entry['Payout Request'] === 'Approved'
    ).length;

    const disputedEntries = clientEntries.filter(
      (entry) => entry['Dispute Status'] === DisputeStatus.UNDER_QUERY
    ).length;

    return {
      currentBalance,
      totalPayouts,
      totalPayins,
      pendingPayoutRequests,
      disputedEntries,
    };
  }
}

// Export singleton instance
export const commissionService = new CommissionService();

