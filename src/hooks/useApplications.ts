import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import { mapClientFromApi } from '../utils/applicationTransform';

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
  form_data: Record<string, unknown>;
  created_at: string;
  submitted_at: string | null;
  updated_at: string;
  client?: { company_name: string };
  loan_product?: { name: string; code: string };
}

/**
 * Transform API application shape to UI LoanApplication.
 * Handles client as string, { name }, { 'Client Name' }, or null/undefined. See docs/ID_AND_RBAC_CONTRACT.md.
 */
export function transformApplicationFromApi(app: Record<string, unknown>): LoanApplication {
  const id = app.id != null ? String(app.id) : '';
  return {
    id,
    file_number: String(app.fileId ?? app['File ID'] ?? (id ? `SF${id.slice(0, 8)}` : '')),
    client_id: String(app.clientId ?? app.Client ?? ''),
    applicant_name: String(app.applicantName ?? app['Applicant Name'] ?? ''),
    loan_product_id: (app.productId ?? app['Loan Product']) != null ? String(app.productId ?? app['Loan Product']) : null,
    requested_loan_amount: (() => {
      const v = app.requestedAmount ?? app['Requested Loan Amount'];
      const n = v != null ? (typeof v === 'number' ? v : parseFloat(String(v))) : NaN;
      return isNaN(n) ? null : n;
    })(),
    status: String(app.status ?? app.Status ?? 'draft'),
    assigned_credit_analyst: (app.assignedCreditAnalyst ?? app['Assigned Credit Analyst']) != null ? String(app.assignedCreditAnalyst ?? app['Assigned Credit Analyst']) : null,
    assigned_nbfc_id: (app.assignedNBFC ?? app['Assigned NBFC']) != null ? String(app.assignedNBFC ?? app['Assigned NBFC']) : null,
    lender_decision_status: (app.lenderDecisionStatus ?? app['Lender Decision Status']) != null ? String(app.lenderDecisionStatus ?? app['Lender Decision Status']) : null,
    lender_decision_date: (app.lenderDecisionDate ?? app['Lender Decision Date']) != null ? String(app.lenderDecisionDate ?? app['Lender Decision Date']) : null,
    lender_decision_remarks: (app.lenderDecisionRemarks ?? app['Lender Decision Remarks']) != null ? String(app.lenderDecisionRemarks ?? app['Lender Decision Remarks']) : null,
    approved_loan_amount: (() => {
      const v = app.approvedAmount ?? app['Approved Loan Amount'];
      const n = v != null ? (typeof v === 'number' ? v : parseFloat(String(v))) : NaN;
      return isNaN(n) ? null : n;
    })(),
    ai_file_summary: (app.aiFileSummary ?? app['AI File Summary']) != null ? String(app.aiFileSummary ?? app['AI File Summary']) : null,
    form_data: (() => {
      const fd = app.formData ?? (typeof app['Form Data'] === 'string' ? JSON.parse(String(app['Form Data'] || '{}')) : app['Form Data']);
      return (fd && typeof fd === 'object' && !Array.isArray(fd) ? fd : {}) as Record<string, unknown>;
    })(),
    created_at: String(app.creationDate ?? app['Creation Date'] ?? app.createdAt ?? new Date().toISOString()),
    submitted_at: (app.submittedDate ?? app['Submitted Date']) != null ? String(app.submittedDate ?? app['Submitted Date']) : null,
    updated_at: String(app.lastUpdated ?? app['Last Updated'] ?? app.updatedAt ?? new Date().toISOString()),
    client: mapClientFromApi(app.client),
    loan_product: (() => {
      const lp = app.loanProduct;
      if (lp != null && typeof lp === 'object' && !Array.isArray(lp)) {
        const o = lp as Record<string, unknown>;
        return { name: String(o.name ?? o['Product Name'] ?? ''), code: String(o.id ?? o['Product ID'] ?? '') };
      }
      if (typeof lp === 'string') {
        return { name: lp, code: String(app.productId ?? '') };
      }
      if (app.product != null || app.productId != null) {
        const name = typeof app.product === 'string' ? app.product : String((app.product as Record<string, unknown>)?.['Product Name'] ?? '');
        const code = typeof app.productId === 'string' ? app.productId : String(app.productId ?? '');
        return { name: name ?? '', code: code ?? '' };
      }
      return undefined;
    })(),
  };
}

export const useApplications = () => {
  useAuth();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch on mount (including SPA navigation to Applications or Dashboard) and via explicit refetch.
  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      
      // Use API service to fetch applications
      const response = await apiService.listApplications();
      
      if (response.success && response.data) {
        // Transform API response to match expected format
        const appsArray = Array.isArray(response.data) ? response.data : [];
        const transformed = appsArray.map((app) => transformApplicationFromApi(app as unknown as Record<string, unknown>));
        
        setApplications(transformed);
      } else {
        console.error('Error fetching applications:', response.error);
        setApplications([]);
        // If 401/403, token was cleared by API service, auth context will handle redirect
        if (response.error?.includes('401') || response.error?.includes('403')) {
          // Don't show error to user, auth context will redirect to login
          return;
        }
      }
    } catch (error) {
      console.error('Exception in fetchApplications:', error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (_applicationId: string, _newStatus: string) => {
    // Status updates should go through specific endpoints (e.g., submit, forward, etc.)
    // For now, just refetch
    await fetchApplications();
  };

  return { applications, loading, updateStatus, refetch: fetchApplications };
};
