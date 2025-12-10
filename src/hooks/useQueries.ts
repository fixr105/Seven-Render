import { useState, useEffect } from 'react';
import { useAuthSafe } from './useAuthSafe';
import { supabase } from '../lib/supabase';

export const useQueries = (applicationId?: string) => {
  const { userRoleId } = useAuthSafe();
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (applicationId) fetchQueries();
  }, [applicationId]);

  const fetchQueries = async () => {
    if (!applicationId) return;
    try {
      setLoading(true);
      const { data } = await supabase
        .from('queries')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });
      setQueries(data || []);
    } finally {
      setLoading(false);
    }
  };

  const raiseQuery = async (queryText: string, raisedToRole: string) => {
    await supabase.from('queries').insert({
      application_id: applicationId,
      raised_by: userRoleId,
      raised_to_role: raisedToRole,
      query_text: queryText,
      status: 'open',
    });
    fetchQueries();
  };

  return { queries, loading, raiseQuery, respondToQuery: async () => {}, resolveQuery: async () => {}, refetch: fetchQueries, error: null };
};
