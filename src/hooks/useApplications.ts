import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuthSafe } from './useAuthSafe';

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

// Removed helper functions - no longer needed with API service

export const useApplications = () => {
  const { userRole, user } = useAuthSafe();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, [userRole, user?.id]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      
      // Use API service to fetch applications
      const response = await apiService.listApplications();
      
      if (response.success && response.data) {
        // Transform API response to match expected format
        const transformed = response.data.map((app: any) => ({
          id: app.id,
          file_number: app.fileId || app['File ID'] || `SF${app.id.slice(0, 8)}`,
          client_id: app.clientId || app.Client || '',
          applicant_name: app.applicantName || app['Applicant Name'] || '',
          loan_product_id: app.productId || app['Loan Product'] || null,
          requested_loan_amount: app.requestedAmount || parseFloat(app['Requested Loan Amount'] || '0') || null,
          status: app.status || app.Status || 'draft',
          assigned_credit_analyst: app.assignedCreditAnalyst || app['Assigned Credit Analyst'] || null,
          assigned_nbfc_id: app.assignedNBFC || app['Assigned NBFC'] || null,
          lender_decision_status: app.lenderDecisionStatus || app['Lender Decision Status'] || null,
          lender_decision_date: app.lenderDecisionDate || app['Lender Decision Date'] || null,
          lender_decision_remarks: app.lenderDecisionRemarks || app['Lender Decision Remarks'] || null,
          approved_loan_amount: app.approvedAmount || parseFloat(app['Approved Loan Amount'] || '0') || null,
          ai_file_summary: app.aiFileSummary || app['AI File Summary'] || null,
          form_data: app.formData || (typeof app['Form Data'] === 'string' ? JSON.parse(app['Form Data'] || '{}') : app['Form Data']) || {},
          created_at: app.creationDate || app['Creation Date'] || app.createdAt || new Date().toISOString(),
          submitted_at: app.submittedDate || app['Submitted Date'] || null,
          updated_at: app.lastUpdated || app['Last Updated'] || app.updatedAt || new Date().toISOString(),
          client: app.client ? { company_name: app.client.name || app.client['Client Name'] } : undefined,
          loan_product: app.loanProduct ? { name: app.loanProduct.name || app.loanProduct['Product Name'], code: app.loanProduct.id || app.loanProduct['Product ID'] } : undefined,
        }));
        
        setApplications(transformed);
      } else {
        console.error('Error fetching applications:', response.error);
        setApplications([]);
      }
    } catch (error) {
      console.error('Exception in fetchApplications:', error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    // Status updates should go through specific endpoints (e.g., submit, forward, etc.)
    // For now, just refetch
    await fetchApplications();
  };

  return { applications, loading, updateStatus, refetch: fetchApplications };
};
