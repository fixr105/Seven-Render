import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { postCommissionLedger } from '../lib/commissionLedgerPost';

export const useLedger = () => {
  const { userRole, userRoleId } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLedger();
    fetchPayoutRequests();
  }, [userRole, userRoleId]);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      let targetClientId = null;
      if (userRole === 'client') {
        const { data: clientData } = await supabase
          .from('dsa_clients')
          .select('id')
          .eq('user_id', userRoleId)
          .maybeSingle();
        if (clientData) targetClientId = clientData.id;
      }

      if (targetClientId) {
        const { data } = await supabase
          .from('commission_ledger')
          .select('*')
          .eq('client_id', targetClientId)
          .order('created_at', { ascending: false });
        setEntries(data || []);
        const latestEntry = data?.[0];
        setBalance(latestEntry?.balance_after || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPayoutRequests = async () => {
    if (userRole === 'client') {
      const { data: clientData } = await supabase
        .from('dsa_clients')
        .select('id')
        .eq('user_id', userRoleId)
        .maybeSingle();
      if (clientData) {
        const { data } = await supabase
          .from('payout_requests')
          .select('*')
          .eq('client_id', clientData.id)
          .order('created_at', { ascending: false });
        if (data) setPayoutRequests(data);
      }
    } else if (userRole === 'credit_team') {
      const { data } = await supabase
        .from('payout_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setPayoutRequests(data);
    }
  };

  const requestPayout = async (amount: number) => {
    const { data: clientData } = await supabase
      .from('dsa_clients')
      .select('id')
      .eq('user_id', userRoleId)
      .maybeSingle();
    if (clientData) {
      await supabase.from('payout_requests').insert({
        client_id: clientData.id,
        amount,
        requested_balance: balance,
        status: 'pending',
      });
      fetchPayoutRequests();
    }
  };

  const processPayoutRequest = async (requestId: string, approve: boolean) => {
    await supabase
      .from('payout_requests')
      .update({ status: approve ? 'approved' : 'rejected', processed_at: new Date().toISOString() })
      .eq('id', requestId);
    fetchPayoutRequests();
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
    try {
      // Insert into database
      const { data: insertedEntry, error: dbError } = await supabase
        .from('commission_ledger')
        .insert({
          client_id: entryData.client_id,
          application_id: entryData.application_id,
          transaction_type: entryData.transaction_type || 'pay_in',
          amount: entryData.amount || 0,
          balance_after: entryData.balance_after || entryData.amount || 0,
          description: entryData.description || '',
          status: entryData.status || 'completed',
          date: entryData.date || new Date().toISOString().split('T')[0],
          disbursed_amount: entryData.disbursed_amount,
          commission_rate: entryData.commission_rate,
          dispute_status: entryData.dispute_status || 'None',
          payout_request_flag: entryData.payout_request_flag || false,
        })
        .select()
        .single();

      if (dbError) {
        console.error('Error creating ledger entry:', dbError);
        throw dbError;
      }

      // POST to n8n webhook
      if (insertedEntry) {
        await postCommissionLedger({
          id: insertedEntry.id,
          'Ledger Entry ID': insertedEntry.id,
          'Client': entryData.client_name || '',
          'Loan File': entryData.file_number || '',
          'Date': insertedEntry.date || new Date().toISOString().split('T')[0],
          'Disbursed Amount': insertedEntry.disbursed_amount?.toString() || '',
          'Commission Rate': insertedEntry.commission_rate?.toString() || '',
          'Payout Amount': insertedEntry.amount?.toString() || '',
          'Description': insertedEntry.description || '',
          'Dispute Status': insertedEntry.dispute_status || 'None',
          'Payout Request': insertedEntry.payout_request_flag ? 'True' : 'False',
        });
      }

      // Refresh ledger
      await fetchLedger();
      return insertedEntry;
    } catch (error) {
      console.error('Error adding ledger entry:', error);
      throw error;
    }
  };

  return { entries, balance, payoutRequests, loading, requestPayout, processPayoutRequest, refetch: fetchLedger, addLedgerEntry };
};
