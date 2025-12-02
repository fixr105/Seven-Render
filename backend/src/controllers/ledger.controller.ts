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

      const allData = await n8nClient.getAllData();
      let ledgerEntries = allData['Commission Ledger'] || [];

      // Filter by client
      ledgerEntries = ledgerEntries.filter(
        (entry) => entry.Client === req.user!.clientId
      );

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
   */
  async createLedgerQuery(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { ledgerEntryId } = req.params;
      const { message } = req.body;
      const allData = await n8nClient.getAllData();
      const ledgerEntries = allData['Commission Ledger'] || [];
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
        'Details/Message': `Ledger dispute: ${message}`,
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
   * POST /clients/me/payout-requests
   * Create payout request (CLIENT only)
   */
  async createPayoutRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'client') {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      const { amountRequested, full } = req.body;
      const allData = await n8nClient.getAllData();
      let ledgerEntries = allData['Commission Ledger'] || [];

      // Filter by client
      ledgerEntries = ledgerEntries.filter(
        (entry) => entry.Client === req.user!.clientId
      );

      // Calculate current balance
      const currentBalance = ledgerEntries.reduce(
        (sum, entry) => sum + parseFloat(entry['Payout Amount'] || '0'),
        0
      );

      if (currentBalance <= 0) {
        res.status(400).json({
          success: false,
          error: 'No balance available for payout',
        });
        return;
      }

      const requestedAmount = full ? currentBalance : (amountRequested || currentBalance);

      if (requestedAmount > currentBalance) {
        res.status(400).json({
          success: false,
          error: 'Requested amount exceeds available balance',
        });
        return;
      }

      // Create payout request entry
      const payoutEntry = {
        id: `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        'Ledger Entry ID': `LEDGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        Client: req.user!.clientId!,
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

      await n8nClient.postFileAuditLog({
        id: `AUDIT-${Date.now()}`,
        'Log Entry ID': `AUDIT-${Date.now()}`,
        File: '',
        Timestamp: new Date().toISOString(),
        Actor: req.user!.email,
        'Action/Event Type': 'payout_request',
        'Details/Message': `Payout request created: ${requestedAmount}`,
        'Target User/Role': 'credit_team',
        Resolved: 'False',
      });

      res.json({
        success: true,
        data: {
          requestId: payoutEntry.id,
          requestedAmount,
          currentBalance,
        },
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

      const allData = await n8nClient.getAllData();
      const ledgerEntries = allData['Commission Ledger'] || [];

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
}

export const ledgerController = new LedgerController();

