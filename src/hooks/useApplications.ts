import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface LoanApplication {
  id: string;
  file_number: string;
  client_id: string;
  applicant_name: string;
  loan_product_id: string | null;
  requested_loan_amount: number | null;
  status: string;
  assigned_credit_analyst: string | null;
  assigned_nbfc_id: string | null;
  lender_decision_status: string | null;
  lender_decision_date: string | null;
  lender_decision_remarks: string | null;
  approved_loan_amount: number | null;
  ai_file_summary: string | null;
  form_data: Record<string, any>;
  created_at: string;
  submitted_at: string | null;
  updated_at: string;
  client?: { company_name: string };
  loan_product?: { name: string; code: string };
}

// Helper function to check if a string is a valid UUID
const isValidUUID = (str: string | null | undefined): boolean => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Check if userRoleId is a test user ID
const isTestUser = (userRoleId: string | null | undefined): boolean => {
  return userRoleId ? userRoleId.startsWith('test-') : false;
};

export const useApplications = () => {
  const { userRole, userRoleId, user } = useAuth();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, [userRole, userRoleId, user?.id]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      
      // Skip database queries for test users
      if (isTestUser(userRoleId)) {
        console.warn('Test user detected - skipping database queries. Please use real authentication for full functionality.');
        setApplications([]);
        return;
      }

      let query = supabase
        .from('loan_applications')
        .select(`
          *,
          client:dsa_clients(company_name),
          loan_product:loan_products(name, code),
          assigned_credit_analyst_user:user_roles!loan_applications_assigned_credit_analyst_fkey(id),
          assigned_nbfc:nbfc_partners(name, contact_person)
        `)
        .order('created_at', { ascending: false });

      if (userRole === 'client') {
        // For client role: dsa_clients.user_id references user_roles.id
        // So we use userRoleId (which is user_roles.id) to find the client
        if (userRoleId && isValidUUID(userRoleId)) {
          const { data: clientData, error: clientError } = await supabase
            .from('dsa_clients')
            .select('id')
            .eq('user_id', userRoleId)
            .maybeSingle();
          
          if (clientError) {
            console.error('Error fetching client data:', clientError);
            setApplications([]);
            return;
          }
          
          if (clientData) {
            query = query.eq('client_id', clientData.id);
          } else {
            // No client record found - return empty array
            console.warn('No client record found for userRoleId:', userRoleId);
            setApplications([]);
            return;
          }
        } else {
          // Invalid userRoleId - return empty array
          console.warn('Invalid or missing userRoleId for client user:', userRoleId);
          setApplications([]);
          return;
        }
      } else if (userRole === 'kam') {
        if (userRoleId && isValidUUID(userRoleId)) {
          const { data: clients, error: kamError } = await supabase
            .from('dsa_clients')
            .select('id')
            .eq('kam_id', userRoleId);
          
          if (kamError) {
            console.error('Error fetching KAM clients:', kamError);
            setApplications([]);
            return;
          }
          
          if (clients && clients.length > 0) {
            query = query.in('client_id', clients.map(c => c.id));
          } else {
            // No clients assigned to this KAM - return empty array
            console.warn('No clients found for KAM userRoleId:', userRoleId);
            setApplications([]);
            return;
          }
        } else {
          console.warn('Invalid or missing userRoleId for KAM user:', userRoleId);
          setApplications([]);
          return;
        }
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching applications:', error);
        setApplications([]);
        return;
      }
      
      setApplications((data as LoanApplication[]) || []);
    } catch (error) {
      console.error('Exception in fetchApplications:', error);
      setApplications([]);
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
