import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface LoanApplication {
  id: string;
  file_number: string;
  client_id: string;
  status: string;
  form_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  client?: { company_name: string };
  loan_product?: { name: string; code: string };
}

export const useApplications = () => {
  const { userRole, userRoleId } = useAuth();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, [userRole, userRoleId]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('loan_applications')
        .select('*, client:dsa_clients(company_name), loan_product:loan_products(name, code)')
        .order('created_at', { ascending: false });

      if (userRole === 'client') {
        const { data: clientData } = await supabase
          .from('dsa_clients')
          .select('id')
          .eq('user_id', userRoleId)
          .maybeSingle();
        if (clientData) query = query.eq('client_id', clientData.id);
      } else if (userRole === 'kam') {
        const { data: clients } = await supabase
          .from('dsa_clients')
          .select('id')
          .eq('kam_id', userRoleId);
        if (clients) query = query.in('client_id', clients.map(c => c.id));
      }

      const { data } = await query;
      setApplications(data as LoanApplication[] || []);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase
      .from('loan_applications')
      .update({ status: newStatus })
      .eq('id', id);
    fetchApplications();
  };

  return { applications, loading, updateStatus, refetch: fetchApplications };
};
