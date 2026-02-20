import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';
import { MessageSquare, Download, Edit, Sparkles, RefreshCw, File, FileText, Image, Eye, ExternalLink, Grid3x3, List, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService, type ApiResponse, type LoanApplication } from '../services/api';
import { formatDateSafe } from '../utils/dateFormatter';
import { getStatusDisplayNameForViewer, normalizeStatus } from '../lib/statusUtils';

const getStatusVariant = (status: string | undefined | null): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
  if (!status) return 'neutral';
  const statusLower = status.toLowerCase();
  if (['approved', 'disbursed'].includes(statusLower)) return 'success';
  if (['action required', 'kam_query_raised', 'pending_kam_review', 'credit_query_raised'].includes(statusLower)) return 'warning';
  if (statusLower === 'rejected') return 'error';
  if (['forwarded_to_credit', 'in_negotiation', 'sent_to_nbfc'].includes(statusLower)) return 'info';
  return 'neutral';
};

const formatAmount = (amount: unknown): string => {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount ?? ''));
  if (Number.isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
};

interface Query {
  id: string;
  raised_by: string;
  raised_to_role: string;
  query_text: string;
  response_text: string | null;
  responded_by: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
  raised_by_user?: { role: string };
}

interface StatusHistoryItem {
  id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export const ApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role || null;
  
  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return '';
  };
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<import('../services/api').LoanApplication | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [, _setAuditLogs] = useState<unknown[]>([]);
  const [, _setKamEdits] = useState<unknown[]>([]);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [queryMessage, setQueryMessage] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionStatus, setDecisionStatus] = useState<string>('');
  const [decisionRemarks, setDecisionRemarks] = useState<string>('');
  const [approvedAmount, setApprovedAmount] = useState<string>('');
  const [rejectionReasonOption, setRejectionReasonOption] = useState<string>('');
  const [rejectionReasonsList, setRejectionReasonsList] = useState<Array<{ value: string; label: string }>>([]);
  const [documentsViewMode, setDocumentsViewMode] = useState<'grid' | 'list'>('grid');
  const [editingQueryId, setEditingQueryId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingReplyForId, setSubmittingReplyForId] = useState<string | null>(null);
  const [fieldIdToLabel, setFieldIdToLabel] = useState<Record<string, string>>({});

  const QUERY_EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  /** Map old file values to human-readable for display */
  const toDisplayValue = (v: unknown): string => {
    if (v == null) return '';
    const s = String(v);
    if (s === 'added_to_link' || s === 'yes_added_to_folder') return 'Yes, Added to Folder';
    if (s === 'to_be_shared' || s === 'awaiting_will_update') return 'Awaiting, Will Update Folder';
    if (s === 'not_available') return 'Not Available';
    return s;
  };
  const sidebarItems = useSidebarItems();

  // Load application data ONLY on initial mount or when navigating to a different application
  // No automatic refetch - user must manually refresh
  const lastFetchedIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (id && id !== lastFetchedIdRef.current) {
      lastFetchedIdRef.current = id;
      fetchApplicationDetails();
      fetchQueries();
      fetchStatusHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally only depend on id; fetch functions are stable per mount.
  }, [id]);

  useEffect(() => {
    if (userRole === 'nbfc') {
      apiService.getNbfcRejectionReasons().then((res) => {
        if (res.success && res.data) setRejectionReasonsList(res.data);
      }).catch(() => {});
    }
  }, [userRole]);

  // Fetch form config for old key mapping (field-* → human-readable label)
  useEffect(() => {
    if (!application) return;
    const productId = (application as any).loan_product_id ?? (application as any).productId ?? (application as any)['Product ID'] ?? (application.loan_product as any)?.code ?? (application as any)['Loan Product'];
    const clientId = (application as any).Client ?? (application as any).clientId ?? (typeof (application as any).client === 'string' ? (application as any).client : null);
    if (!productId || typeof productId !== 'string') return;

    const buildMap = (config: any[]) => {
      const map: Record<string, string> = {};
      (config || []).forEach((cat: any) => {
        const categoryName = cat.categoryName || cat['Category Name'] || '';
        (cat.fields || []).forEach((f: any) => {
          const fid = f.fieldId || f['Field ID'] || f.id;
          const label = f.label || f['Field Label'] || '';
          if (fid && label) map[fid] = `${label} - ${categoryName}`;
        });
      });
      setFieldIdToLabel(map);
    };

    const fetchConfig = () => {
      if (typeof apiService.getFormConfig === 'function') {
        return apiService.getFormConfig(productId);
      }
      if (clientId && typeof clientId === 'string' && typeof apiService.getPublicFormConfig === 'function') {
        return apiService.getPublicFormConfig(clientId, productId);
      }
      return Promise.resolve({ success: false });
    };
    fetchConfig().then((res: ApiResponse<unknown>) => {
      if (res.success && res.data) {
        const raw = res.data;
        const config = Array.isArray(raw) ? raw : Array.isArray((raw as Record<string, unknown>)?.categories) ? (raw as Record<string, unknown>).categories : [];
        buildMap(Array.isArray(config) ? config : []);
      }
    }).catch(() => {
      if (clientId && typeof clientId === 'string' && typeof apiService.getPublicFormConfig === 'function') {
        apiService.getPublicFormConfig(clientId, productId).then((r: ApiResponse<unknown>) => {
          if (r.success && r.data) {
            const raw = r.data;
            const config = Array.isArray(raw) ? raw : Array.isArray((raw as Record<string, unknown>)?.categories) ? (raw as Record<string, unknown>).categories : [];
            buildMap(Array.isArray(config) ? config : []);
          }
        }).catch(() => {});
      }
    });
  }, [application?.id, application?.loan_product, (application as any)?.loan_product_id, (application as any)?.productId, (application as any)?.Client]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      console.log(`[ApplicationDetail] Fetching application with ID: ${id}`);
      
      const response = await apiService.getApplication(id!) as ApiResponse<LoanApplication>;
      const appData = response.data;
      console.log(`[ApplicationDetail] Response:`, { success: response.success, hasData: !!appData, error: response.error });
      
      if (response.success && appData) {
        console.log(`[ApplicationDetail] Application found:`, { id: appData.id, fileId: appData.fileId });
        const d = appData as unknown as Record<string, unknown>;
        const rawForm = d.form_data ?? d.formData ?? d['Form Data'];
        let form_data: Record<string, unknown> = {};
        if (rawForm != null) {
          if (typeof rawForm === 'string') {
            try {
              const parsed = JSON.parse(rawForm);
              form_data = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
            } catch {
              form_data = {};
            }
          } else if (typeof rawForm === 'object' && !Array.isArray(rawForm)) {
            form_data = rawForm as Record<string, unknown>;
          }
        }
        const requestedAmount = d.requested_loan_amount ?? d.requestedAmount ?? d['Requested Loan Amount'];
        const requested_loan_amount =
          typeof requestedAmount === 'number' ? requestedAmount
            : requestedAmount != null ? (typeof requestedAmount === 'string' ? parseFloat(String(requestedAmount)) : Number(requestedAmount)) : undefined;
        const normalized = {
          ...d,
          status: normalizeStatus(String(d.status ?? d.Status ?? 'draft')),
          file_number: d.file_number ?? d.fileId ?? d['File ID'],
          applicant_name: d.applicant_name ?? d.applicantName ?? d['Applicant Name'],
          form_data,
          requested_loan_amount: Number.isNaN(requested_loan_amount) ? undefined : requested_loan_amount,
          created_at: d.created_at ?? d.creationDate ?? d['Creation Date'],
          updated_at: d.updated_at ?? d.lastUpdated ?? d['Last Updated'],
          assignedKAMName: d.assignedKAMName ?? (d as any).assigned_kam_name,
          client:
            d.client != null && typeof d.client === 'object' && !Array.isArray(d.client) && 'company_name' in (d.client as object)
              ? d.client
              : { company_name: d.client ?? d['Client Name'] ?? d.clientId ?? '' },
          loan_product:
            d.loan_product != null && typeof d.loan_product === 'object' && !Array.isArray(d.loan_product) && 'name' in (d.loan_product as object)
              ? d.loan_product
              : { name: d.product ?? d['Loan Product'] ?? d.loanProduct ?? '', code: d.productId ?? d['Loan Product'] ?? '' },
        };
        setApplication(normalized as unknown as import('../services/api').LoanApplication);
        // Set AI summary if available
        setAiSummary(String(appData.aiFileSummary ?? (appData as unknown as Record<string, unknown>)['AI File Summary'] ?? '').trim() || null);
      } else {
        console.error(`[ApplicationDetail] Error fetching application ${id}:`, response.error);
        // Check if it's an authentication error
        if (response.error?.includes('401') || response.error?.includes('Authentication')) {
          console.error('[ApplicationDetail] Authentication failed.');
        }
        // Check if it's an access denied error
        if (response.error?.includes('Access denied') || response.error?.includes('403')) {
          console.error('[ApplicationDetail] Access denied - you may not have permission to view this application');
        }
        // Set application to null to show "not found" message
        setApplication(null);
      }
    } catch (error: any) {
      console.error(`[ApplicationDetail] Exception fetching application ${id}:`, error);
      // Check if it's an authentication error
      if (error.message?.includes('401')) {
        // Auth removed; show not found
      }
      // Set application to null to show "not found" message
      setApplication(null);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAISummary = async () => {
    if (!id) return;

    setGeneratingSummary(true);
    try {
      console.log('[ApplicationDetail] Generating AI summary for application:', id);
      const response = await apiService.generateAISummary(id);
      
      if (response.success && response.data) {
        // Handle both structured and plain summary formats
        const summary = response.data.summary || response.data.structured?.fullSummary || '';
        
        if (summary) {
          setAiSummary(summary);
          console.log('[ApplicationDetail] AI summary generated successfully, length:', summary.length);
          
          // Refresh the application to get the updated AI File Summary from the server
          // This ensures the summary persists if the user refreshes the page
          try {
            const appResponse = await apiService.getApplication(id);
            if (appResponse.success && appResponse.data) {
              const updatedSummary = appResponse.data.aiFileSummary || (appResponse.data as any)['AI File Summary'] || null;
              if (updatedSummary) {
                setAiSummary(updatedSummary);
              }
            }
          } catch (refreshError) {
            console.warn('[ApplicationDetail] Could not refresh application after summary generation:', refreshError);
            // Non-critical, continue with the summary we have
          }
        } else {
          console.warn('[ApplicationDetail] AI summary generation completed but no summary returned');
          alert('AI summary generation completed, but no summary was returned.');
        }
      } else {
        throw new Error(response.error || 'Failed to generate AI summary');
      }
    } catch (error: any) {
      console.error('[ApplicationDetail] Error generating AI summary:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to generate AI summary';
      
      if (error.response?.status === 403) {
        alert('You do not have permission to generate an AI summary for this application.');
      } else if (error.response?.status === 404) {
        alert('Application not found. Please refresh the page and try again.');
      } else if (error.response?.status >= 500) {
        alert('Server error while generating summary. Please try again in a moment.');
      } else {
        alert(`Failed to generate AI summary: ${errorMessage}`);
      }
    } finally {
      setGeneratingSummary(false);
    }
  };

  const fetchQueries = async () => {
    try {
      const response = await apiService.getQueries(id!);
      if (response.success && response.data) {
        // response.data is an array of query threads
        setQueries(response.data);
      } else {
        setQueries([]);
      }
    } catch (error) {
      console.error('Error fetching queries:', error);
      setQueries([]);
    }
  };

  const fetchStatusHistory = async () => {
    try {
      const response = await apiService.getFileAuditLog(id!);
      if (response.success && response.data) {
        // Filter audit log entries that are status changes and transform to StatusHistoryItem
        const statusEntries = response.data
          .filter((entry: any) => entry.actionEventType?.toLowerCase().includes('status'))
          .map((entry: any) => ({
            id: entry.id,
            from_status: null, // Audit log doesn't provide from_status
            to_status: entry.detailsMessage || entry.actionEventType || '',
            changed_by: entry.actor || null,
            notes: entry.detailsMessage || null,
            created_at: entry.timestamp || new Date().toISOString(),
          })) as StatusHistoryItem[];
        setStatusHistory(statusEntries);
      }
    } catch (error) {
      console.error('Error fetching status history:', error);
    }
  };

  const handleRaiseQuery = async () => {
    if (!queryMessage.trim() || !id) return;

    setSubmitting(true);
    try {
      // Use API service to raise query
      let response;
      if (userRole === 'kam') {
        response = await apiService.raiseQueryToClient(id, queryMessage);
      } else if (userRole === 'credit_team') {
        response = await apiService.raiseQueryToKAM(id, queryMessage);
      } else {
        // Client raising query - use dedicated create endpoint
        response = await apiService.createClientQuery(id, queryMessage);
      }

      if (response.success) {
        setShowQueryModal(false);
        setQueryMessage('');
        fetchQueries();
        fetchApplicationDetails();
      } else {
        throw new Error(response.error || 'Failed to raise query');
      }
    } catch (error: any) {
      console.error('Error raising query:', error);
      alert(error.message || 'Failed to raise query');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondToQuery = async () => {
    if (!selectedQuery || !responseMessage.trim() || !id) return;

    setSubmitting(true);
    try {
      // Use API service to reply to query
      const response = await apiService.replyToQuery(id, selectedQuery.id, responseMessage);
      
      if (response.success) {
        setSelectedQuery(null);
        setResponseMessage('');
        fetchQueries();
        fetchApplicationDetails();
      } else {
        throw new Error(response.error || 'Failed to respond to query');
      }
    } catch (error: any) {
      console.error('Error responding to query:', error);
      alert(error.message || 'Failed to respond to query');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveQuery = async (queryId: string) => {
    if (!id) return;

    setSubmitting(true);
    try {
      const response = await apiService.resolveQuery(id, queryId);
      if (response.success) {
        fetchQueries();
        fetchApplicationDetails();
        setReplyDrafts((prev) => {
          const next = { ...prev };
          delete next[queryId];
          return next;
        });
        alert('Query resolved successfully!');
      } else {
        throw new Error(response.error || 'Failed to resolve query');
      }
    } catch (error: any) {
      console.error('Error resolving query:', error);
      alert(error.message || 'Failed to resolve query');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondToQueryForThread = async (rootId: string, message: string) => {
    if (!id || !message.trim()) return;

    setSubmittingReplyForId(rootId);
    try {
      const response = await apiService.replyToQuery(id, rootId, message.trim());
      if (response.success) {
        setReplyDrafts((prev) => {
          const next = { ...prev };
          delete next[rootId];
          return next;
        });
        fetchQueries();
        fetchApplicationDetails();
      } else {
        throw new Error(response.error || 'Failed to send reply');
      }
    } catch (error: any) {
      console.error('Error sending reply:', error);
      alert((error as Error).message || 'Failed to send reply');
    } finally {
      setSubmittingReplyForId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!id || !editingQueryId || !editMessage.trim()) return;
    setSubmittingEdit(true);
    try {
      const response = await apiService.updateQuery(id, editingQueryId, editMessage.trim());
      if (response.success) {
        await fetchQueries();
        fetchApplicationDetails();
        setEditingQueryId(null);
        setEditMessage('');
      } else {
        throw new Error(response.error || 'Failed to update query');
      }
    } catch (error: any) {
      alert(error.message || 'Failed to update query');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus || !id) return;

    setSubmitting(true);
    try {
      // Use API service based on role and status
      let response;
      const currentStatus = (application?.status || '').toLowerCase();

      // Client with DRAFT: use submitApplication for Submit, withdrawApplication for Withdraw
      if (userRole === 'client' && currentStatus === 'draft') {
        if (newStatus === 'under_kam_review') {
          response = await apiService.submitApplication(id);
        } else if (newStatus === 'withdrawn') {
          response = await apiService.withdrawApplication(id);
        } else {
          response = await apiService.editApplication(id, { status: newStatus });
        }
      } else if (userRole === 'client' && newStatus === 'withdrawn') {
        response = await apiService.withdrawApplication(id);
      } else if (userRole === 'kam' && (newStatus === 'forwarded_to_credit' || newStatus === 'pending_credit_review')) {
        response = await apiService.forwardToCredit(id);
      } else if (userRole === 'credit_team') {
        if (newStatus === 'in_negotiation') {
          response = await apiService.markInNegotiation(id);
        } else if (newStatus === 'disbursed') {
          response = await apiService.markDisbursed(id, {
            disbursedAmount: application?.disbursedAmount || '0',
            disbursedDate: new Date().toISOString(),
          });
        } else {
          response = await apiService.updateCreditApplicationStatus(id, newStatus, statusNotes);
        }
      } else {
        response = await apiService.editApplication(id, { status: newStatus });
      }

      if (response.success) {
        setShowStatusModal(false);
        setNewStatus('');
        setStatusNotes('');
        fetchApplicationDetails();
        fetchStatusHistory();
      } else {
        throw new Error(response.error || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert(error.message || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  // Role and status-aware options. Clients with DRAFT only get Submit and Withdraw.
  const statusOptions = (() => {
    const allOptions = [
      { value: 'draft', label: 'Draft' },
      { value: 'under_kam_review', label: 'Submitted / Pending KAM Review' },
      { value: 'pending_kam_review', label: 'Submitted / Pending KAM Review' },
      { value: 'query_with_client', label: 'KAM Query Raised' },
      { value: 'kam_query_raised', label: 'KAM Query Raised' },
      { value: 'pending_credit_review', label: 'Approved by KAM / Forwarded to Credit' },
      { value: 'forwarded_to_credit', label: 'Approved by KAM / Forwarded to Credit' },
      { value: 'credit_query_with_kam', label: 'Credit Query Raised' },
      { value: 'credit_query_raised', label: 'Credit Query Raised' },
      { value: 'in_negotiation', label: 'In Negotiation' },
      { value: 'sent_to_nbfc', label: 'Sent to NBFC' },
      { value: 'approved', label: 'NBFC Approved' },
      { value: 'rejected', label: 'NBFC Rejected' },
      { value: 'disbursed', label: 'Disbursed' },
      { value: 'withdrawn', label: 'Withdrawn' },
      { value: 'closed', label: 'Closed/Archived' },
    ];
    const currentStatus = (application?.status || application?.Status || '').toString().toLowerCase();
    if (userRole === 'client' && currentStatus === 'draft') {
      return [
        { value: 'under_kam_review', label: 'Submit' },
        { value: 'withdrawn', label: 'Withdraw' },
      ];
    }
    if (userRole === 'client' && (currentStatus === 'under_kam_review' || currentStatus === 'query_with_client' || currentStatus === 'pending_kam_review' || currentStatus === 'kam_query_raised')) {
      return [{ value: 'withdrawn', label: 'Withdraw' }];
    }
    return allOptions;
  })();

  if (loading) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="Loading..."
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full"></div>
        </div>
      </MainLayout>
    );
  }

  if (!application && !loading) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="Application Not Found"
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <Card>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-neutral-600 mb-2">Application not found or access denied</p>
              <p className="text-sm text-neutral-500 mb-4">
                The application may not exist, or you may not have permission to view it.
              </p>
              <Button variant="secondary" onClick={() => navigate('/applications')}>
                Back to Applications
              </Button>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="Loading Application..."
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full"></div>
        </div>
      </MainLayout>
    );
  }

  // Show not found state
  if (!application) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle="Application Not Found"
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-neutral-500 mb-4">Application not found or access denied.</p>
            <Button variant="secondary" onClick={() => navigate('/applications')}>
              Back to Applications
            </Button>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle={`Application ${application.file_number || application.fileId || id}`}
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      <PageHeader
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1);
          } else {
            navigate('/applications');
          }
        }}
        actions={
          <>
            {((userRole === 'kam' || userRole === 'credit_team') ||
              (userRole === 'client' && ['draft', 'under_kam_review', 'query_with_client', 'pending_kam_review', 'kam_query_raised'].includes((application?.status || application?.Status || '').toString().toLowerCase()))) && (
              <Button variant="primary" icon={Edit} onClick={() => setShowStatusModal(true)}>
                {userRole === 'client' && (application?.status || application?.Status || '').toString().toLowerCase() === 'draft' ? 'Submit / Withdraw' : 'Update Status'}
              </Button>
            )}
            {(userRole === 'kam' || userRole === 'credit_team' || userRole === 'client') && (
              <Button variant="secondary" icon={MessageSquare} onClick={() => setShowQueryModal(true)}>
                Raise Query
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Summary */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Application Details</CardTitle>
                <Badge variant={getStatusVariant(application?.status)} data-testid="status-badge">
                  {getStatusDisplayNameForViewer(application?.status || '', userRole || '')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500">File Number</p>
                  <p className="font-semibold text-neutral-900">{application.file_number}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Client</p>
                  <p className="font-semibold text-neutral-900">
                    {typeof application.client === 'object' && application.client
                      ? (application.client as import('../services/api').LoanApplicationClient).company_name
                      : typeof application.client === 'string'
                        ? application.client
                        : ''}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Applicant Name</p>
                  <p className="font-semibold text-neutral-900">{application.applicant_name || ''}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Loan Product</p>
                  <p className="font-semibold text-neutral-900">
                    {typeof application.loan_product === 'object' && application.loan_product
                      ? application.loan_product.name ?? ''
                      : typeof application.loan_product === 'string'
                        ? application.loan_product
                        : ''}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Requested Amount</p>
                  <p className="font-semibold text-neutral-900">
                    {formatAmount(application.requested_loan_amount || 0)}
                  </p>
                </div>
                {application.approved_loan_amount && (
                  <div>
                    <p className="text-sm text-neutral-500">Approved Amount</p>
                    <p className="font-semibold text-success">
                      {formatAmount(application.approved_loan_amount)}
                    </p>
                  </div>
                )}
                {(application.assignedKAMName || (application as any).assigned_kam) && (
                  <div>
                    <p className="text-sm text-neutral-500">Assigned KAM</p>
                    <p className="font-semibold text-neutral-900">
                      {(application as any).assignedKAMName || (application as any).assigned_kam || ''}
                    </p>
                  </div>
                )}
                {application.assigned_credit_analyst && (
                  <div>
                    <p className="text-sm text-neutral-500">Assigned Credit Analyst</p>
                    <p className="font-semibold text-neutral-900">Assigned</p>
                  </div>
                )}
                {application.assigned_nbfc_id && application.assigned_nbfc && (
                  <div>
                    <p className="text-sm text-neutral-500">Assigned NBFC</p>
                    <p className="font-semibold text-neutral-900">{application.assigned_nbfc.name}</p>
                  </div>
                )}
                {(application.lender_decision_status || application.lenderDecisionStatus) && (
                  <div>
                    <p className="text-sm text-neutral-500">Lender Decision</p>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          (application.lender_decision_status || application.lenderDecisionStatus) === 'Approved' ? 'success' :
                          (application.lender_decision_status || application.lenderDecisionStatus) === 'Rejected' ? 'error' :
                          'warning'
                        }
                      >
                        {application.lender_decision_status || application.lenderDecisionStatus}
                      </Badge>
                    </div>
                    {(application.lender_decision_date || application.lenderDecisionDate) && (
                      <p className="text-xs text-neutral-500 mt-1">
                        {formatDateSafe(application.lender_decision_date || application.lenderDecisionDate)}
                      </p>
                    )}
                    {(application.lender_decision_remarks || application.lenderDecisionRemarks) && (
                      <p className="text-xs text-neutral-600 mt-1 italic">
                        {application.lender_decision_remarks || application.lenderDecisionRemarks}
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-sm text-neutral-500">Created</p>
                  <p className="font-semibold text-neutral-900">{formatDateSafe(application.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Last Updated</p>
                  <p className="font-semibold text-neutral-900">{formatDateSafe(application.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Section - Enhanced for Credit Team */}
          {Array.isArray(application.documents) && application.documents.length > 0 && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>Uploaded Documents ({application.documents.length})</CardTitle>
                  {userRole === 'credit_team' && (
                    <Badge variant="info">Files from Backend</Badge>
                  )}
                </div>
                {userRole === 'credit_team' && (
                  <div className="flex gap-2">
                    <Button
                      variant={documentsViewMode === 'grid' ? 'primary' : 'secondary'}
                      size="sm"
                      icon={Grid3x3}
                      onClick={() => setDocumentsViewMode('grid')}
                    >
                      Grid
                    </Button>
                    <Button
                      variant={documentsViewMode === 'list' ? 'primary' : 'secondary'}
                      size="sm"
                      icon={List}
                      onClick={() => setDocumentsViewMode('list')}
                    >
                      List
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {documentsViewMode === 'grid' && userRole === 'credit_team' ? (
                  // Grid view for credit team
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {application.documents.map((doc: any, index: number) => {
                      const fileExtension = doc.fileName?.split('.').pop()?.toLowerCase() || '';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
                      const isPdf = fileExtension === 'pdf';
                      
                      return (
                        <div
                          key={index}
                          className="group relative border-2 border-neutral-200 rounded-lg p-4 hover:border-brand-primary hover:shadow-md transition-all duration-200 bg-white"
                        >
                          {/* File Icon/Preview */}
                          <div className="flex items-center justify-center h-32 mb-3 bg-neutral-50 rounded-lg">
                            {isImage ? (
                              <Image className="w-12 h-12 text-brand-primary" />
                            ) : isPdf ? (
                              <FileText className="w-12 h-12 text-red-500" />
                            ) : (
                              <File className="w-12 h-12 text-neutral-400" />
                            )}
                          </div>
                          
                          {/* File Info */}
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-neutral-900 line-clamp-2" title={doc.fileName}>
                              {doc.fileName || 'Document'}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="neutral" className="text-xs">
                                {doc.fieldId || 'Field'}
                              </Badge>
                              {fileExtension && (
                                <Badge variant="info" className="text-xs uppercase">
                                  {fileExtension}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-200">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Eye}
                              className="flex-1"
                              onClick={() => window.open(doc.url, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Download}
                              className="flex-1"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = doc.url;
                                link.download = doc.fileName || 'document';
                                link.click();
                              }}
                            >
                              Download
                            </Button>
                          </div>
                          
                          {/* Hover overlay for quick preview */}
                          <div className="absolute inset-0 bg-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // List view (default or for non-credit roles)
                  <div className="space-y-3">
                    {application.documents.map((doc: any, index: number) => {
                      const fileExtension = doc.fileName?.split('.').pop()?.toLowerCase() || '';
                      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
                      const isPdf = fileExtension === 'pdf';
                      
                      return (
                        <div
                          key={index}
                          className="flex flex-wrap items-center justify-between gap-3 p-4 border-2 border-neutral-200 rounded-lg hover:border-brand-primary hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            {/* File Icon */}
                            <div className="flex-shrink-0">
                              {isImage ? (
                                <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                                  <Image className="w-6 h-6 text-info" />
                                </div>
                              ) : isPdf ? (
                                <div className="w-12 h-12 bg-error/10 rounded-lg flex items-center justify-center">
                                  <FileText className="w-6 h-6 text-error" />
                                </div>
                              ) : (
                                <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                                  <File className="w-6 h-6 text-neutral-600" />
                                </div>
                              )}
                            </div>
                            
                            {/* File Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold text-neutral-900 truncate" title={doc.fileName}>
                                  {doc.fileName || 'Document'}
                                </p>
                                {fileExtension && (
                                  <Badge variant="info" className="text-xs uppercase flex-shrink-0">
                                    {fileExtension}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="neutral" className="text-xs">
                                  {doc.fieldId || 'Field ID'}
                                </Badge>
                                {userRole === 'credit_team' && (
                                  <span className="text-xs text-neutral-500">• Backend Upload</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Eye}
                              onClick={() => window.open(doc.url, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Download}
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = doc.url;
                                link.download = doc.fileName || 'document';
                                link.click();
                              }}
                            >
                              Download
                            </Button>
                            {userRole === 'credit_team' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={ExternalLink}
                                onClick={() => window.open(doc.url, '_blank')}
                              >
                                Open
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {userRole === 'credit_team' && application.documents.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-neutral-200">
                    <p className="text-xs text-neutral-500 text-center">
                      💡 Tip: Use Grid view to visually match and compare documents. Click View to open files in a new tab.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Application Form Data */}
          <Card>
            <CardHeader>
              <CardTitle>Application Information</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const rawForm = (application as unknown as Record<string, unknown>).form_data ?? (application as unknown as Record<string, unknown>).formData ?? (application as unknown as Record<string, unknown>)['Form Data'];
                let formDataToShow: Record<string, unknown> = {};
                if (rawForm != null) {
                  if (typeof rawForm === 'string') {
                    try {
                      const parsed = JSON.parse(rawForm);
                      formDataToShow = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
                    } catch {
                      formDataToShow = {};
                    }
                  } else if (typeof rawForm === 'object' && !Array.isArray(rawForm)) {
                    formDataToShow = rawForm as Record<string, unknown>;
                  }
                }
                const getDisplayKey = (k: string) => {
                  if (k === '_documentsFolderLink') return 'Documents Folder Link';
                  if (/^field-/.test(k) && fieldIdToLabel[k]) return fieldIdToLabel[k];
                  return k.replace(/_/g, ' ');
                };
                const entries = Object.entries(formDataToShow).filter(([k]) => k !== '_documentsFolderLink');
                const folderLink = formDataToShow._documentsFolderLink;
                return !formDataToShow || Object.keys(formDataToShow).length === 0 ? (
                  <p className="text-center text-neutral-500 py-6">No form data recorded</p>
                ) : (
                  <div className="space-y-3">
                    {folderLink != null && String(folderLink).trim() !== '' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-3 border-b border-neutral-200">
                        <p className="text-sm text-neutral-500">Documents Folder Link</p>
                        <p className="sm:col-span-2 text-sm text-neutral-900 break-all">
                          <a
                            href={String(folderLink).startsWith('http') ? String(folderLink) : `https://${String(folderLink)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-primary hover:underline"
                          >
                            {String(folderLink)}
                          </a>
                        </p>
                      </div>
                    )}
                    {entries.map(([key, value]) => (
                      <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <p className="text-sm text-neutral-500">{getDisplayKey(key)}</p>
                        <p className="sm:col-span-2 text-sm text-neutral-900">{toDisplayValue(value)}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Queries Section */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>
                  Queries & Communication ({queries.length} {queries.length === 1 ? 'thread' : 'threads'})
                </CardTitle>
                {queries.filter((q: any) => !q.isResolved).length > 0 && (
                  <Badge variant="warning">
                    {queries.filter((q: any) => !q.isResolved).length} Unresolved
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {queries.length === 0 ? (
                <p className="text-center text-neutral-500 py-8">No queries yet</p>
              ) : (
                <div className="space-y-6">
                  {/* Alert for unresolved queries (credit team only) */}
                  {userRole === 'credit_team' && (() => {
                    const awaitingQueries = queries.filter((q: any) => {
                      const isCreditQuery = q.rootQuery?.targetUserRole === 'kam' && 
                                           (q.rootQuery?.actionEventType === 'credit_query' ||
                                            q.rootQuery?.actor?.toLowerCase().includes('credit'));
                      const hasKAMReply = (q.replies || []).some((r: any) => 
                        r.targetUserRole === 'credit_team' || r.actor?.toLowerCase().includes('kam')
                      );
                      return !q.isResolved && isCreditQuery && !hasKAMReply;
                    });
                    return awaitingQueries.length > 0 ? (
                      <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="warning">Awaiting KAM Response</Badge>
                          <span className="text-sm font-medium text-neutral-900">
                            {awaitingQueries.length} 
                            {' '}
                            {awaitingQueries.length === 1 ? 'query' : 'queries'} 
                            {' '}awaiting response
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600">
                          You have raised queries that are waiting for KAM to respond.
                        </p>
                      </div>
                    ) : null;
                  })()}
                  
                  {queries.map((thread: any) => {
                    const rootQuery = thread.rootQuery || {};
                    const isOwnRoot = user?.email && (rootQuery.actor || '').toLowerCase() === (user.email || '').toLowerCase();
                    const created = rootQuery.timestamp ? new Date(rootQuery.timestamp).getTime() : 0;
                    const withinEditWindow = created > 0 && (Date.now() - created <= QUERY_EDIT_WINDOW_MS);
                    const canEdit = isOwnRoot && withinEditWindow && !thread.isResolved;
                    const isEditing = editingQueryId === rootQuery.id;

                    const isCreditQuery = rootQuery.targetUserRole === 'kam' && (
                                      rootQuery.actionEventType === 'credit_query' ||
                                      (rootQuery.actor || '').toLowerCase().includes('credit')
                                    );
                    const hasKAMReply = (thread.replies || []).some((r: any) =>
                                      r.targetUserRole === 'credit_team' || (r.actor || '').toLowerCase().includes('kam'));
                    const awaitingKAMResponse = isCreditQuery && !hasKAMReply && !thread.isResolved;

                    const getActorLabel = (actorEmail: string, isRootMsg?: boolean) => {
                                      if (!actorEmail) return 'Unknown';
                                      if (user?.email && (actorEmail || '').toLowerCase() === (user.email || '').toLowerCase())
                                        return 'You';
                                      const a = (actorEmail || '').toLowerCase();
                                      if (a.includes('credit')) return 'Credit Team';
                                      if (a.includes('kam')) return 'KAM';
                                      if (isRootMsg && rootQuery.actionEventType === 'credit_query') return 'Credit Team';
                                      if (isRootMsg && (rootQuery.actionEventType === 'query_raised' || rootQuery.targetUserRole === 'client')) return 'KAM';
                                      const beforeAt = (actorEmail || '').split('@')[0];
                                      return beforeAt || 'Client';
                                    };

                    const messages: Array<{ id: string; actor: string; actorLabel: string; message: string; timestamp: string; isRoot: boolean }> = [
                      {
                                        id: rootQuery.id,
                                        actor: rootQuery.actor || '',
                                        actorLabel: getActorLabel(rootQuery.actor || '', true),
                                        message: rootQuery.message || 'No message',
                                        timestamp: rootQuery.timestamp || '',
                                        isRoot: true,
                      },
                      ...(thread.replies || []).map((r: any) => ({
                                        id: r.id,
                                        actor: r.actor || '',
                                        actorLabel: getActorLabel(r.actor || '', false),
                                        message: r.message || '',
                                        timestamp: r.timestamp || '',
                                        isRoot: false,
                      })),
                    ].sort((a, b) => (a.timestamp && b.timestamp ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() : 0));

                    return (
                    <div
                      key={thread.rootQuery.id}
                      className={`border rounded-lg p-4 ${
                        awaitingKAMResponse && userRole === 'credit_team'
                          ? 'border-warning bg-warning/5'
                          : 'border-neutral-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <span className="text-xs text-neutral-500">
                          To: {rootQuery.targetUserRole === 'client' ? 'Client' : rootQuery.targetUserRole === 'kam' ? 'KAM' : (rootQuery.targetUserRole || '—')}
                        </span>
                        {rootQuery.resolved || thread.isResolved ? (
                          <Badge variant="success" className="text-xs">Resolved</Badge>
                        ) : (
                          <Badge variant="warning" className="text-xs">Open</Badge>
                        )}
                        {awaitingKAMResponse && userRole === 'credit_team' && (
                          <Badge variant="warning" className="text-xs">Awaiting KAM Response</Badge>
                        )}
                        {!thread.isResolved && rootQuery.id && (() => {
                          const actor = (rootQuery.actor || '').trim();
                          const userEmail = (user?.email || '').trim().toLowerCase();
                          const actorLower = actor.toLowerCase();
                          const isAuthor =
                            userEmail &&
                            actor &&
                            actor.includes('@') &&
                            actorLower === userEmail;
                          const canResolve = isAuthor;
                          return canResolve ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleResolveQuery(rootQuery.id)}
                              disabled={submitting}
                              loading={submitting}
                            >
                              Mark Resolved
                            </Button>
                          ) : null;
                        })()}
                      </div>

                      {/* Chat thread: sequential messages */}
                      <div className="space-y-3 mb-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-lg p-3 ${
                              msg.actorLabel === 'You'
                                ? 'bg-brand-primary/10 ml-6 border border-brand-primary/20'
                                : 'bg-neutral-50 mr-6 border border-neutral-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-medium text-neutral-900">{msg.actorLabel}</span>
                              {msg.timestamp && (
                                <span className="text-xs text-neutral-500">{formatDateSafe(msg.timestamp)}</span>
                              )}
                            </div>
                            {msg.isRoot && isEditing ? (
                              <div className="mt-2">
                                <TextArea
                                  value={editMessage}
                                  onChange={(e) => setEditMessage(e.target.value)}
                                  rows={3}
                                  className="w-full"
                                />
                                <div className="flex gap-2 mt-2">
                                  <Button size="sm" onClick={handleSaveEdit} disabled={submittingEdit} loading={submittingEdit}>
                                    Save
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => { setEditingQueryId(null); setEditMessage(''); }} disabled={submittingEdit}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{msg.message}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {canEdit && !isEditing && (
                        <div className="mb-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Edit}
                            onClick={() => { setEditingQueryId(rootQuery.id); setEditMessage(rootQuery.message || ''); }}
                          >
                            Edit query
                          </Button>
                        </div>
                      )}

                      {/* Inline reply: text input + Send (chat-style) */}
                      {!thread.isResolved && (
                        <div className="mt-4 flex gap-2 items-end">
                          <TextArea
                            placeholder="Type your response..."
                            value={replyDrafts[thread.rootQuery.id] ?? ''}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [thread.rootQuery.id]: e.target.value }))
                            }
                            rows={2}
                            className="flex-1 min-w-0"
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            icon={MessageSquare}
                            onClick={() =>
                              handleRespondToQueryForThread(
                                thread.rootQuery.id,
                                replyDrafts[thread.rootQuery.id] ?? ''
                              )
                            }
                            disabled={!(replyDrafts[thread.rootQuery.id] ?? '').trim() || submittingReplyForId === thread.rootQuery.id}
                            loading={submittingReplyForId === thread.rootQuery.id}
                          >
                            Send
                          </Button>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Status History</CardTitle>
            </CardHeader>
            <CardContent>
              {statusHistory.length === 0 ? (
                <p className="text-center text-neutral-500 py-6">No status changes yet</p>
              ) : (
                <div className="space-y-3">
                  {statusHistory.map((item, index) => (
                    <div key={item.id} className="relative pl-6">
                      {index !== statusHistory.length - 1 && (
                        <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-neutral-200" />
                      )}
                      <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-brand-primary" />
                      <div>
                        <Badge variant={getStatusVariant(item.to_status)}>
                          {getStatusDisplayNameForViewer(item.to_status || '', userRole || '')}
                        </Badge>
                        <p className="text-xs text-neutral-500 mt-1">{formatDateSafe(item.created_at)}</p>
                        {item.notes && (
                          <p className="text-xs text-neutral-600 mt-1">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Status - document checklist from form_data */}
          {(() => {
            const rawForm = (application as unknown as Record<string, unknown>).form_data ?? (application as unknown as Record<string, unknown>).formData ?? (application as unknown as Record<string, unknown>)['Form Data'];
            let formData: Record<string, unknown> = {};
            if (rawForm != null) {
              if (typeof rawForm === 'string') {
                try {
                  const parsed = JSON.parse(rawForm);
                  formData = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
                } catch {
                  formData = {};
                }
              } else if (typeof rawForm === 'object' && !Array.isArray(rawForm)) {
                formData = rawForm as Record<string, unknown>;
              }
            }
            const YES_VALUES = ['Yes, Added to Folder', 'added_to_link', 'yes_added_to_folder'];
            const AWAITING_VALUES = ['Awaiting, Will Update Folder', 'to_be_shared', 'awaiting_will_update'];
            const NOT_AVAILABLE_VALUES = ['Not Available', 'not_available'];
            const getDisplayName = (key: string) => {
              if (key === '_documentsFolderLink') return null;
              const label = fieldIdToLabel[key] || key;
              const beforeDash = label.split(' - ')[0];
              return beforeDash || label;
            };
            const toStatus = (v: unknown): 'yes' | 'awaiting' | 'not_available' | null => {
              const s = String(v ?? '').trim();
              if (YES_VALUES.includes(s)) return 'yes';
              if (AWAITING_VALUES.includes(s)) return 'awaiting';
              if (NOT_AVAILABLE_VALUES.includes(s)) return 'not_available';
              return null;
            };
            const yesItems: string[] = [];
            const awaitingItems: string[] = [];
            const notAvailableItems: string[] = [];
            Object.entries(formData).forEach(([key, value]) => {
              const status = toStatus(value);
              const name = getDisplayName(key);
              if (!name || status === null) return;
              if (status === 'yes') yesItems.push(name);
              else if (status === 'awaiting') awaitingItems.push(name);
              else notAvailableItems.push(name);
            });
            const hasAny = yesItems.length > 0 || awaitingItems.length > 0 || notAvailableItems.length > 0;
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Upload Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {yesItems.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Added to folder</p>
                        <ul className="space-y-1.5">
                          {yesItems.map((name) => (
                            <li key={name} className="flex items-center gap-2 text-sm text-success">
                              <CheckCircle className="w-4 h-4 flex-shrink-0" />
                              <span>{name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {awaitingItems.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Awaiting</p>
                        <ul className="space-y-1.5">
                          {awaitingItems.map((name) => (
                            <li key={name} className="flex items-center gap-2 text-sm text-neutral-600">
                              <span className="w-4 h-4 flex-shrink-0 rounded-full border-2 border-neutral-400" />
                              <span>{name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {notAvailableItems.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Not available</p>
                        <ul className="space-y-1.5">
                          {notAvailableItems.map((name) => (
                            <li key={name} className="flex items-center gap-2 text-sm text-error">
                              <XCircle className="w-4 h-4 flex-shrink-0" />
                              <span>{name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!hasAny && (
                      <p className="text-center text-neutral-500 py-4 text-sm">No document upload status recorded</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* AI File Summary */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-primary" />
                AI File Summary
              </CardTitle>
              <Button
                variant="secondary"
                size="sm"
                icon={generatingSummary ? undefined : aiSummary ? RefreshCw : Sparkles}
                onClick={handleGenerateAISummary}
                loading={generatingSummary}
                disabled={generatingSummary}
              >
                {aiSummary ? 'Refresh Summary' : 'Generate Summary'}
              </Button>
            </CardHeader>
            <CardContent>
              {generatingSummary ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-neutral-600">Generating AI summary...</p>
                  <p className="text-xs text-neutral-500 mt-1">This may take a few moments</p>
                </div>
              ) : aiSummary ? (
                <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200 max-h-[600px] overflow-y-auto">
                  <pre className="text-sm text-neutral-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {aiSummary}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-600 mb-4">
                    No AI summary available yet. Generate one to get insights about this application.
                  </p>
                  <Button
                    variant="primary"
                    icon={Sparkles}
                    onClick={handleGenerateAISummary}
                  >
                    Generate AI Summary
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* NBFC Decision Section */}
          {userRole === 'nbfc' && (application?.status === 'sent_to_nbfc' || application?.status === 'Sent to NBFC') && (
            <Card>
              <CardHeader>
                <CardTitle>Record Decision</CardTitle>
              </CardHeader>
              <CardContent>
                {(application.lenderDecisionStatus || application.lender_decision_status) ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          (application.lenderDecisionStatus || application.lender_decision_status) === 'Approved' ? 'success' :
                          (application.lenderDecisionStatus || application.lender_decision_status) === 'Rejected' ? 'error' :
                          'warning'
                        }
                      >
                        {application.lenderDecisionStatus || application.lender_decision_status}
                      </Badge>
                      {(application.lenderDecisionDate || application.lender_decision_date) && (
                        <span className="text-sm text-neutral-500">
                          on {formatDateSafe(application.lenderDecisionDate || application.lender_decision_date)}
                        </span>
                      )}
                    </div>
                    {(application.lenderDecisionRemarks || application.lender_decision_remarks) && (
                      <div className="bg-neutral-50 p-3 rounded">
                        <p className="text-sm font-medium text-neutral-700 mb-1">Remarks:</p>
                        <p className="text-sm text-neutral-900">{application.lenderDecisionRemarks || application.lender_decision_remarks}</p>
                </div>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => setShowDecisionModal(true)}
                    >
                      Update Decision
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-neutral-600">
                      Review the application and record your decision below.
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => setShowDecisionModal(true)}
                    >
                      Record Decision
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* NBFC Decision Modal */}
      {userRole === 'nbfc' && (
        <Modal
          testId="decision-modal"
          isOpen={showDecisionModal}
          onClose={() => {
            setShowDecisionModal(false);
            setDecisionStatus('');
            setDecisionRemarks('');
            setApprovedAmount('');
            setRejectionReasonOption('');
          }}
          size="md"
        >
          <ModalHeader onClose={() => setShowDecisionModal(false)}>
            Record NBFC Decision
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select
                label="Decision Status"
                value={decisionStatus}
                onChange={(e) => {
                  const v = e.target.value;
                  setDecisionStatus(v);
                  if (v !== 'Rejected') setRejectionReasonOption('');
                }}
                required
                options={[
                  { value: '', label: 'Select decision...' },
                  { value: 'Approved', label: 'Approve' },
                  { value: 'Rejected', label: 'Reject' },
                  { value: 'Needs Clarification', label: 'Needs Clarification' },
                ]}
              />

              {decisionStatus === 'Approved' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Approved Amount (Optional)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    placeholder="Enter approved amount"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                  />
                </div>
              )}

              {decisionStatus === 'Rejected' && (
                <>
                  <Select
                    label="Rejection reason"
                    value={rejectionReasonOption}
                    onChange={(e) => setRejectionReasonOption(e.target.value)}
                    required
                    options={[
                      { value: '', label: 'Select reason...' },
                      ...rejectionReasonsList.map((r) => ({ value: r.value, label: r.label })),
                    ]}
                  />
                  {rejectionReasonOption === 'other' && (
                    <TextArea
                      label="Other (required)"
                      placeholder="Enter rejection reason..."
                      value={decisionRemarks}
                      onChange={(e) => setDecisionRemarks(e.target.value)}
                      required
                      rows={3}
                    />
                  )}
                </>
              )}

              {decisionStatus !== 'Rejected' && (
                <TextArea
                  label={decisionStatus === 'Approved' ? 'Decision Remarks (Optional)' : 'Decision Remarks'}
                  placeholder={
                    decisionStatus === 'Approved'
                      ? 'Enter approval terms and conditions...'
                      : 'Enter clarification request...'
                  }
                  value={decisionRemarks}
                  onChange={(e) => setDecisionRemarks(e.target.value)}
                  rows={6}
                />
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button 
              variant="secondary" 
              onClick={() => {
                setShowDecisionModal(false);
                setDecisionStatus('');
                setDecisionRemarks('');
                setApprovedAmount('');
                setRejectionReasonOption('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!decisionStatus) {
                  alert('Please select a decision status');
                  return;
                }
                if (decisionStatus === 'Rejected') {
                  if (!rejectionReasonOption) {
                    alert('Please select a rejection reason');
                    return;
                  }
                  if (rejectionReasonOption === 'other' && !decisionRemarks.trim()) {
                    alert('Please enter the rejection reason for "Other"');
                    return;
                  }
                }
                if (!id) return;

                const remarksForReject =
                  decisionStatus === 'Rejected'
                    ? rejectionReasonOption === 'other'
                      ? `Other: ${decisionRemarks.trim()}`
                      : rejectionReasonsList.find((r) => r.value === rejectionReasonOption)?.label || rejectionReasonOption
                    : decisionRemarks.trim();

                setSubmitting(true);
                try {
                  const response = await apiService.recordNBFCDecision(id, {
                    lenderDecisionStatus: decisionStatus,
                    lenderDecisionRemarks: remarksForReject,
                    approvedAmount: approvedAmount ? parseFloat(approvedAmount) : undefined,
                  });

                  if (response.success) {
                    setShowDecisionModal(false);
                    setDecisionStatus('');
                    setDecisionRemarks('');
                    setApprovedAmount('');
                    setRejectionReasonOption('');
                    fetchApplicationDetails();
                    fetchStatusHistory();
                    alert('Decision recorded successfully!');
                  } else {
                    throw new Error(response.error || 'Failed to record decision');
                  }
                } catch (error: any) {
                  console.error('Error recording decision:', error);
                  alert(error.message || 'Failed to record decision');
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={
                !decisionStatus ||
                (decisionStatus === 'Rejected' && (!rejectionReasonOption || (rejectionReasonOption === 'other' && !decisionRemarks.trim()))) ||
                submitting
              }
              loading={submitting}
            >
              Record Decision
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Raise Query Modal */}
      <Modal
        testId="query-modal"
        isOpen={showQueryModal}
        onClose={() => {
          setShowQueryModal(false);
          setQueryMessage('');
        }}
        size="md"
      >
        <ModalHeader onClose={() => setShowQueryModal(false)}>
          Raise Query
        </ModalHeader>
        <ModalBody>
          <TextArea
            label="Query Message"
            placeholder="Enter your query or request for additional information..."
            value={queryMessage}
            onChange={(e) => setQueryMessage(e.target.value)}
            required
            rows={6}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowQueryModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleRaiseQuery}
            disabled={!queryMessage.trim() || submitting}
            loading={submitting}
          >
            Send Query
          </Button>
        </ModalFooter>
      </Modal>

      {/* Respond to Query Modal */}
      {selectedQuery && (
        <Modal
          isOpen={!!selectedQuery}
          onClose={() => {
            setSelectedQuery(null);
            setResponseMessage('');
          }}
          size="md"
        >
          <ModalHeader onClose={() => setSelectedQuery(null)}>
            Respond to Query
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="bg-neutral-50 p-3 rounded">
                <p className="text-sm font-medium text-neutral-700 mb-1">Original Query:</p>
                <p className="text-sm text-neutral-900">{(selectedQuery as any).message ?? (selectedQuery as any).query_text ?? 'No message'}</p>
              </div>
              <TextArea
                label="Your Response"
                placeholder="Enter your response..."
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                required
                rows={6}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setSelectedQuery(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRespondToQuery}
              disabled={!responseMessage.trim() || submitting}
              loading={submitting}
            >
              Send Response
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Update Status Modal */}
      <Modal
        testId="status-modal"
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setNewStatus('');
          setStatusNotes('');
        }}
        size="md"
      >
        <ModalHeader onClose={() => setShowStatusModal(false)}>
          Update Application Status
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-neutral-50 p-3 rounded">
              <p className="text-sm text-neutral-700">
                <span className="font-medium">Current Status:</span>{' '}
                <Badge variant={getStatusVariant(application?.status)}>
                  {getStatusDisplayNameForViewer(application?.status || '', userRole || '')}
                </Badge>
              </p>
            </div>
            <Select
              label="New Status"
              options={statusOptions}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              required
            />
            <TextArea
              label="Notes (Optional)"
              placeholder="Add notes about this status change..."
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              rows={3}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdateStatus}
            disabled={!newStatus || submitting}
            loading={submitting}
          >
            Update Status
          </Button>
        </ModalFooter>
      </Modal>
    </MainLayout>
  );
};
