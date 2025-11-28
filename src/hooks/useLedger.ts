import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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

  return { entries, balance, payoutRequests, loading, requestPayout, processPayoutRequest, refetch: fetchLedger, addLedgerEntry: async () => {} };
};
