/**
 * Commission Ledger Controller
 */

import { Request, Response } from 'express';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { dataFilterService } from '../services/airtable/dataFilter.service.js';
import { DisputeStatus } from '../config/constants.js';

export class LedgerController {
  /**
   * GET /clients/me/ledger
   * Get client's commission ledger (CLIENT only)
   */
  async getClientLedger(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      // Fetch only Commission Ledger table
      // Handle timeout gracefully - return empty array if webhook fails
      let allLedgerEntries: any[] = [];
      try {
        allLedgerEntries = await n8nClient.fetchTable('Commission Ledger');
      } catch (error: any) {
        console.error('[getClientLedger] Failed to fetch Commission Ledger:', error.message);
        // Return empty array instead of failing the entire request
        allLedgerEntries = [];
      }

      // Apply RBAC filtering using centralized service
      const { rbacFilterService } = await import('../services/rbac/rbacFilter.service.js');
      const ledgerEntries = await rbacFilterService.filterCommissionLedger(allLedgerEntries, req.user!);

      // Sort by date (oldest first for running balance calculation)
      ledgerEntries.sort((a, b) => (a.Date || '').localeCompare(b.Date || ''));

      // Calculate running balance (oldest to newest)
      let runningBalance = 0;
      const entriesWithBalance = ledgerEntries.map((entry) => {
        const amount = parseFloat(entry['Payout Amount'] || '0');
        runningBalance += amount;
        return {
          ...entry,
          balance: runningBalance,
          runningBalance, // Alias for frontend compatibility
        };
      });

      // Reverse to show newest first in response
      entriesWithBalance.reverse();

      res.json({
        success: true,
        data: {
          entries: entriesWithBalance,
          currentBalance: runningBalance,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch ledger',
      });
    }
  }

  /**
   * POST /clients/me/ledger/:ledgerEntryId/query
   * Create query/dispute on ledger entry (CLIENT only)
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Commission Ledger') → /webhook/commisionledger → Airtable: Commission Ledger
   * - POST → n8nClient.postCommissionLedger() → /webhook/COMISSIONLEDGER → Airtable: Commission Ledger
   * - POST → n8nClient.postFileAuditLog() → /webhook/Fileauditinglog → Airtable: File Auditing Log
   */
  async createLedgerQuery(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { ledgerEntryId } = req.params;
      const { message } = req.body;

      if (!message || message.trim().length === 0) {
        res.status(400).json({ success: false, error: 'Query message is required' });
        return;
      }

      // Fetch only Commission Ledger table
      const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
      const entry = ledgerEntries.find((e) => e.id === ledgerEntryId);

      if (!entry || entry.Client !== req.user!.clientId) {
        res.status(404).json({ success: false, error: 'Ledger entry not found' });
        return;
      }

      // Update dispute status
      await n8nClient.postCommissionLedger({
        ...entry,
        'Dispute Status': DisputeStatus.UNDER_QUERY,
      });

      // Log to file audit
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: entry['Loan File'] || '',
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'ledger_dispute',
        'Details/Message': `Ledger dispute raised: ${message}`,
        'Target User/Role': 'credit_team',
        Resolved: 'False',
      });

      res.json({
        success: true,
        message: 'Query raised successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create query',
      });
    }
  }

  /**
   * POST /clients/me/ledger/:ledgerEntryId/flag-payout
   * Flag a ledger entry for payout request (CLIENT only)
   * 
   * Webhook Mapping:
   * - GET → n8nClient.fetchTable('Commission Ledger') → /webhook/commisionledger → Airtable: Commission Ledger
   * - POST → n8nClient.postCommissionLedger() → /webhook/COMISSIONLEDGER → Airtable: Commission Ledger
   */
  async flagLedgerPayout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { ledgerEntryId } = req.params;

      // Fetch only Commission Ledger table
      const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
      const entry = ledgerEntries.find((e) => e.id === ledgerEntryId);

      if (!entry || entry.Client !== req.user!.clientId) {
        res.status(404).json({ success: false, error: 'Ledger entry not found' });
        return;
      }

      // Check if entry has positive payout amount
      const payoutAmount = parseFloat(entry['Payout Amount'] || '0');
      if (payoutAmount <= 0) {
        res.status(400).json({ success: false, error: 'Only entries with positive payout amounts can be flagged for payout' });
        return;
      }

      // Update payout request flag
      await n8nClient.postCommissionLedger({
        ...entry,
        'Payout Request': 'Requested',
      });

      // Log to file audit
      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: entry['Loan File'] || '',
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'payout_request_flagged',
        'Details/Message': `Payout request flagged for ledger entry: ${entry['Ledger Entry ID']}`,
        'Target User/Role': 'credit_team',
        Resolved: 'False',
      });

      res.json({
        success: true,
        message: 'Ledger entry flagged for payout request',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to flag payout',
      });
    }
  }

  /**
   * POST /clients/me/payout-requests
   * Create payout request (CLIENT only)
   * 
   * Uses commission service for payout request creation
   */
  async createPayoutRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { amount, full, amountRequested } = req.body; // Support both 'amount' and 'amountRequested' for compatibility
      const requestedAmountValue = amount || amountRequested;

      // Use commission service for payout request
      const { commissionService } = await import('../services/commission/commission.service.js');

      const result = await commissionService.createPayoutRequest(req.user!, {
        clientId: req.user!.clientId!,
        amount: requestedAmountValue,
        full,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create payout request',
      });
    }
  }

  /**
   * GET /clients/me/payout-requests
   * Get client's payout requests (CLIENT only)
   */
  async getPayoutRequests(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      // Fetch only Commission Ledger table
      // Handle timeout gracefully - return empty array if webhook fails
      let ledgerEntries: any[] = [];
      try {
        ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
      } catch (error: any) {
        console.error('[getPayoutRequests] Failed to fetch Commission Ledger:', error.message);
        // Return empty array instead of failing the entire request
        ledgerEntries = [];
      }

      const payoutRequests = ledgerEntries
        .filter(
          (entry) =>
            entry.Client === req.user!.clientId &&
            entry['Payout Request'] &&
            entry['Payout Request'] !== 'False'
        )
        .map((entry) => ({
          id: entry.id,
          amount: parseFloat(entry['Payout Amount'] || '0'),
          status: entry['Payout Request'],
          requestedDate: entry.Date,
          description: entry.Description,
        }));

      res.json({
        success: true,
        data: payoutRequests,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch payout requests',
      });
    }
  }

  /**
   * GET /kam/ledger?clientId=<client_id>
   * Get ledger for specific client (KAM only)
   * Only shows clients managed by this KAM
   */
  async getKAMLedger(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'kam') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { clientId } = req.query;
      if (!clientId) {
        res.status(400).json({ success: false, error: 'clientId query parameter is required' });
        return;
      }

      // Verify this client is managed by this KAM
      const managedClients = await dataFilterService.getKAMManagedClients(req.user.kamId!);
      if (!managedClients.includes(clientId as string)) {
        res.status(403).json({ success: false, error: 'Access denied: Client not managed by this KAM' });
        return;
      }

      // Fetch only Commission Ledger table
      let ledgerEntries = await n8nClient.fetchTable('Commission Ledger');

      // Filter by client
      ledgerEntries = ledgerEntries.filter((entry) => entry.Client === clientId);

      // Sort by date (newest first)
      ledgerEntries.sort((a, b) => (b.Date || '').localeCompare(a.Date || ''));

      // Calculate running balance
      let balance = 0;
      const entriesWithBalance = ledgerEntries.map((entry) => {
        const amount = parseFloat(entry['Payout Amount'] || '0');
        balance += amount;
        return {
          ...entry,
          balance,
        };
      });

      res.json({
        success: true,
        data: {
          entries: entriesWithBalance,
          currentBalance: balance,
          clientId: clientId as string,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch ledger',
      });
    }
  }

  /**
   * GET /credit/ledger
   * Get all ledger entries with optional filters (Credit Team only)
   */
  async getCreditLedger(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'credit_team') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { clientId, dateFrom, dateTo } = req.query;

      // Fetch only Commission Ledger table
      let ledgerEntries = await n8nClient.fetchTable('Commission Ledger');

      // Apply filters
      if (clientId) {
        ledgerEntries = ledgerEntries.filter((entry) => entry.Client === clientId);
      }

      if (dateFrom || dateTo) {
        ledgerEntries = ledgerEntries.filter((entry) => {
          const entryDate = entry.Date || '';
          if (dateFrom && entryDate < dateFrom) return false;
          if (dateTo && entryDate > dateTo) return false;
          return true;
        });
      }

      // Sort by date (newest first)
      ledgerEntries.sort((a, b) => (b.Date || '').localeCompare(a.Date || ''));

      // Calculate aggregated stats
      const totalPayable = ledgerEntries
        .filter((entry) => parseFloat(entry['Payout Amount'] || '0') > 0)
        .reduce((sum, entry) => sum + parseFloat(entry['Payout Amount'] || '0'), 0);

      const totalPaid = ledgerEntries
        .filter((entry) => entry['Payout Request'] === 'Paid')
        .reduce((sum, entry) => sum + Math.abs(parseFloat(entry['Payout Amount'] || '0')), 0);

      res.json({
        success: true,
        data: {
          entries: ledgerEntries,
          stats: {
            totalPayable,
            totalPaid,
            totalEntries: ledgerEntries.length,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch ledger',
      });
    }
  }

  /**
   * GET /clients/me/ledger/:ledgerEntryId
   * Get specific ledger entry detail (CLIENT only)
   */
  async getLedgerEntry(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { ledgerEntryId } = req.params;

      // Fetch only Commission Ledger table
      const ledgerEntries = await n8nClient.fetchTable('Commission Ledger');
      const entry = ledgerEntries.find((e) => e.id === ledgerEntryId);

      if (!entry) {
        res.status(404).json({ success: false, error: 'Ledger entry not found' });
        return;
      }

      // Verify entry belongs to this client
      if (entry.Client !== req.user.clientId) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      res.json({
        success: true,
        data: {
          id: entry.id,
          ledgerEntryId: entry['Ledger Entry ID'],
          client: entry.Client,
          loanFile: entry['Loan File'],
          date: entry.Date,
          disbursedAmount: entry['Disbursed Amount'],
          commissionRate: entry['Commission Rate'],
          payoutAmount: entry['Payout Amount'],
          description: entry.Description,
          disputeStatus: entry['Dispute Status'],
          payoutRequest: entry['Payout Request'],
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch ledger entry',
      });
    }
  }
}

export const ledgerController = new LedgerController();

