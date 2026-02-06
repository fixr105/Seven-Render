import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../auth/AuthContext';

export const useLedger = () => {
  const { user } = useAuth();
  const userRole = user?.role || null;
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<unknown[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLedger = useCallback(async () => {
    if (userRole !== 'client') return;
    
    try {
      setLoading(true);
      const response = await apiService.getClientLedger();
      
      if (response.success && response.data) {
        const ledgerData = response.data as Record<string, unknown> | unknown[];
        // Handle both direct array response and nested data structure
        const entriesList = Array.isArray(ledgerData)
          ? ledgerData
          : ((ledgerData as Record<string, unknown>).entries as Record<string, unknown>[] | undefined) || [];

        // Sort by date (oldest first for running balance calculation)
        const sortedEntries = [...entriesList].sort((a, b) => {
          const entryA = a as Record<string, unknown>;
          const entryB = b as Record<string, unknown>;
          const dateA = String(entryA.Date ?? entryA.date ?? '');
          const dateB = String(entryB.Date ?? entryB.date ?? '');
          return dateA.localeCompare(dateB);
        });

        // Calculate running balance (oldest to newest)
        let runningBalance = 0;
        const entriesWithBalance = sortedEntries.map((entry) => {
          const e = entry as Record<string, unknown>;
          const payoutAmount = parseFloat(String(e['Payout Amount'] ?? e.payoutAmount ?? '0'));
          runningBalance += payoutAmount;
          return {
            ...e,
            runningBalance,
            formattedAmount: formatCurrency(payoutAmount),
            formattedBalance: formatCurrency(runningBalance),
          };
        });
        
        // Reverse to show newest first
        setEntries(entriesWithBalance.reverse());
        setBalance(runningBalance);
      } else {
        console.error('Error fetching ledger:', response.error);
        setEntries([]);
        setBalance(0);
      }
    } catch (error) {
      console.error('Exception in fetchLedger:', error);
      setEntries([]);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const fetchPayoutRequests = useCallback(async () => {
    try {
      // Credit team uses /credit/payout-requests; client uses /clients/me/payout-requests
      const response =
        userRole === 'credit_team'
          ? await apiService.getPayoutRequests()
          : await apiService.getClientPayoutRequests();

      if (response.success && response.data) {
        setPayoutRequests(response.data || []);
      } else {
        console.error('Error fetching payout requests:', response.error);
        setPayoutRequests([]);
      }
    } catch (error) {
      console.error('Exception in fetchPayoutRequests:', error);
      setPayoutRequests([]);
    }
  }, [userRole]);

  // Fetch on mount (including SPA navigation to Ledger) and when role changes. See docs/ID_AND_RBAC_CONTRACT.md.
  useEffect(() => {
    if (userRole === 'client') {
      fetchLedger();
      fetchPayoutRequests();
    } else if (userRole === 'credit_team') {
      fetchPayoutRequests().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [userRole, fetchLedger, fetchPayoutRequests]);

  const requestPayout = async (amount?: number, full?: boolean) => {
    try {
      const response = await apiService.createPayoutRequest({ 
        amount: amount || 0, 
        full: full || false 
      });
      if (response.success) {
        // No automatic refresh - user must manually refresh to see updates
        return response;
      }
      throw new Error(response.error || 'Failed to create payout request');
    } catch (error) {
      console.error('Error creating payout request:', error);
      throw error;
    }
  };

  const raiseQuery = async (ledgerEntryId: string, message: string) => {
    try {
      const response = await apiService.createLedgerQuery(ledgerEntryId, message);
      if (response.success) {
        // No automatic refresh - user must manually refresh to see updates
        return response;
      }
      throw new Error(response.error || 'Failed to raise query');
    } catch (error) {
      console.error('Error raising query:', error);
      throw error;
    }
  };

  const flagPayout = async (ledgerEntryId: string) => {
    try {
      const response = await apiService.flagLedgerPayout(ledgerEntryId);
      if (response.success) {
        // No automatic refresh - user must manually refresh to see updates
        return response;
      }
      throw new Error(response.error || 'Failed to flag payout');
    } catch (error) {
      console.error('Error flagging payout:', error);
      throw error;
    }
  };

  const processPayoutRequest = async (_requestId: string, _approve: boolean): Promise<void> => {
    // This should be handled by credit team endpoint
    // No automatic refresh - user must manually refresh to see updates
    void _requestId;
    void _approve;
  };

  const addLedgerEntry = async (entryData: {
    client_id?: string;
    application_id?: string;
    transaction_type?: 'pay_in' | 'pay_out';
    amount?: number;
    balance_after?: number;
    description?: string;
    status?: string;
    date?: string;
    disbursed_amount?: number;
    commission_rate?: number;
    dispute_status?: string;
    payout_request_flag?: boolean;
    client_name?: string;
    file_number?: string;
  }) => {
    // Ledger entries are created automatically by the backend
    // No automatic refresh - user must manually refresh to see updates
    return entryData;
  };

  return { 
    entries, 
    balance, 
    payoutRequests, 
    loading, 
    requestPayout, 
    raiseQuery,
    flagPayout,
    processPayoutRequest, 
    refetch: fetchLedger, 
    addLedgerEntry 
  };
};
