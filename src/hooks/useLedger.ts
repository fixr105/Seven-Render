import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuthSafe } from './useAuthSafe';

export const useLedger = () => {
  const { userRole } = useAuthSafe();
  const [entries, setEntries] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole === 'client') {
      fetchLedger();
      fetchPayoutRequests();
    } else if (userRole === 'credit_team') {
      fetchPayoutRequests();
    }
  }, [userRole]);

  const fetchLedger = async () => {
    if (userRole !== 'client') return;
    
    try {
      setLoading(true);
      const response = await apiService.getClientLedger();
      
      if (response.success && response.data) {
        const ledgerData = response.data as any;
        setEntries(ledgerData.entries || []);
        setBalance(ledgerData.currentBalance || 0);
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
  };

  const fetchPayoutRequests = async () => {
    try {
      const response = await apiService.getClientPayoutRequests();
      
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
  };

  const requestPayout = async (amount: number) => {
    try {
      const response = await apiService.createPayoutRequest({ amount });
      if (response.success) {
        await fetchPayoutRequests();
        await fetchLedger();
      }
    } catch (error) {
      console.error('Error creating payout request:', error);
      throw error;
    }
  };

  const processPayoutRequest = async (requestId: string, approve: boolean) => {
    // This should be handled by credit team endpoint
    // For now, just refetch
    await fetchPayoutRequests();
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
    // This function is kept for backward compatibility
    await fetchLedger();
    return entryData;
  };

  return { entries, balance, payoutRequests, loading, requestPayout, processPayoutRequest, refetch: fetchLedger, addLedgerEntry };
};
