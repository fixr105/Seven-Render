import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { MessageSquare, Download, Edit, Sparkles, RefreshCw, File, FileText, Image, Eye, ExternalLink, Grid3x3, List, CheckCircle, XCircle, Send, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService, type ApiResponse, type LoanApplication } from '../services/api';
import { formatDateSafe } from '../utils/dateFormatter';
import { getBusinessStatusOptions, getAllowedNextStatusesForKam, getStatusDisplayNameForViewer, isClientEditableApplication, normalizeStatus, resolveApplicationStatus, type LoanStatus } from '../lib/statusUtils';
import { buildWizardResumePath } from '../lib/b2cEvWizardResume';
import {
  applyApplicationStatusChange,
  statusRequiresDisbursementFields,
} from '../lib/applicationStatusMutations';
import { mergeFormDataPatch } from '../lib/mergeFormDataPatch';
import { isB2cEvFormTemplate } from '../lib/b2cEvFormTemplate';
import { B2cEvApplicationReview } from '../components/applications/review/B2cEvApplicationReview';
import { B2cEvKamEditModal } from '../components/applications/review/B2cEvKamEditModal';
import {
  B2cClientQueryThreadActions,
  getB2cThreadTitle,
} from '../components/applications/queries/B2cClientQueryThreadActions';
import { isUnresolvedB2cClientQuery, isResolvableB2cClientQuery } from '../lib/b2cEvQueryActions';
import { resolveApplicationClientId } from '../utils/resolveApplicationClientId';
import type { ComplianceItemId } from '../lib/b2cEvCompliance';

const WITHDRAWABLE_CLIENT_STATUSES = new Set(['draft', 'under_kam_review', 'query_with_client']);

const getStatusVariant = (status: string | undefined | null): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
  if (!status) return 'neutral';
  const statusLower = status.toLowerCase().trim();
  if (statusLower.includes('reject') || statusLower.includes('error')) return 'error';
  if (statusLower.includes('approve') || statusLower.includes('success')) return 'success';
  if (statusLower.includes('query') || statusLower.includes('pending') || statusLower.includes('review')) return 'warning';
  if (statusLower.includes('sent') || statusLower.includes('progress') || statusLower.includes('negotiation')) return 'info';
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
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const complianceItemParam = searchParams.get('complianceItem') as ComplianceItemId | null;
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const userRole = user?.role || null;

  const getRoleDisplayName = () => {
    switch (userRole) {
      case 'client':
        return t('roles.client');
      case 'kam':
        return t('roles.kam');
      case 'credit_team':
      case 'admin':
        return t('roles.creditTeam');
      case 'nbfc':
        return t('roles.nbfc');
      default:
        return t('common.unknown');
    }
  };

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
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardNotes, setForwardNotes] = useState('');
  const [forwardCreditAnalystId, setForwardCreditAnalystId] = useState('');
  const [creditTeamUsers, setCreditTeamUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [queryMessage, setQueryMessage] = useState('');
  const [queryFieldsRequested, setQueryFieldsRequested] = useState('');
  const [queryDocumentsRequested, setQueryDocumentsRequested] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [disbursedAmountInput, setDisbursedAmountInput] = useState('');
  const [disbursedDateInput, setDisbursedDateInput] = useState('');
  const [forwardingToCredit, setForwardingToCredit] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showOfflineNbfcModal, setShowOfflineNbfcModal] = useState(false);
  const [offlineNbfcId, setOfflineNbfcId] = useState('');
  const [offlineNbfcDecision, setOfflineNbfcDecision] = useState('');
  const [offlineNbfcApprovedAmount, setOfflineNbfcApprovedAmount] = useState('');
  const [offlineNbfcRejectionReason, setOfflineNbfcRejectionReason] = useState('');
  const [offlineNbfcClarification, setOfflineNbfcClarification] = useState('');
  const [submittingOfflineNbfc, setSubmittingOfflineNbfc] = useState(false);
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
  const [nbfcPartners, setNbfcPartners] = useState<Array<{ id: string; lenderName: string }>>([]);
  const [priorityNbfcSelections, setPriorityNbfcSelections] = useState<{ priority: 1 | 2 | 3; nbfcId: string }[]>([
    { priority: 1, nbfcId: '' },
    { priority: 2, nbfcId: '' },
    { priority: 3, nbfcId: '' },
  ]);
  const [assignNbfcSubmitting, setAssignNbfcSubmitting] = useState(false);
  const [assignNbfcError, setAssignNbfcError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingReplyForId, setSubmittingReplyForId] = useState<string | null>(null);
  const [fieldIdToLabel, setFieldIdToLabel] = useState<Record<string, string>>({});
  const [applicationStatuses, setApplicationStatuses] = useState<Array<{ key: string; label: string }>>([]);
  const [loadingApplicationStatuses, setLoadingApplicationStatuses] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showB2cEditModal, setShowB2cEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const [editRemarks, setEditRemarks] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [submittingKamEdit, setSubmittingKamEdit] = useState(false);
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
  const lastFetchedIdRef = React.useRef<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchApplicationDetails();
      await fetchQueries();
      await fetchStatusHistory();
    } finally {
      setRefreshing(false);
    }
  };
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
    if (!application || loading) return;
    if (window.location.hash !== '#b2c-compliance') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('b2c-compliance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [application, loading, complianceItemParam]);

  useEffect(() => {
    if (userRole === 'nbfc') {
      apiService.getNbfcRejectionReasons().then((res) => {
        if (res.success && res.data) setRejectionReasonsList(res.data);
      }).catch(() => {});
    }
  }, [userRole]);

  const showAssignNbfcSection = (userRole === 'credit_team' || userRole === 'admin') && Boolean(application);

  useEffect(() => {
    if (showAssignNbfcSection) {
      apiService.listNBFCPartners().then((res) => {
        if (res.success && res.data) {
          setNbfcPartners(res.data.filter((p: { active?: boolean }) => p.active !== false).map((p: { id: string; lenderName: string }) => ({ id: p.id, lenderName: p.lenderName || p.id })));
        }
      }).catch(() => setNbfcPartners([]));
    } else {
      setNbfcPartners([]);
      setPriorityNbfcSelections([
        { priority: 1, nbfcId: '' },
        { priority: 2, nbfcId: '' },
        { priority: 3, nbfcId: '' },
      ]);
      setAssignNbfcError(null);
    }
  }, [showAssignNbfcSection]);

  // Fetch form config for old key mapping (field-* → human-readable label)
  const appRecord = application ? (application as unknown) as Record<string, unknown> : null;
  const productIdForConfig = appRecord
    ? String(appRecord.loan_product_id ?? appRecord.productId ?? appRecord['Product ID'] ?? (application?.loan_product as { code?: string } | undefined)?.code ?? appRecord['Loan Product'] ?? '')
    : '';
  const clientIdForConfig = appRecord ? resolveApplicationClientId(appRecord) || null : null;
  useEffect(() => {
    let cancelled = false;

    const normalizeLookup = (value: unknown): string => String(value ?? '').trim().toLowerCase();

    const collectProductCandidates = (): string[] => {
      const rawCandidates: unknown[] = [
        appRecord?.loan_product_id,
        appRecord?.productId,
        appRecord?.['Product ID'],
        appRecord?.['Loan Product'],
        appRecord?.product,
        (application?.loan_product as { code?: string; name?: string } | undefined)?.code,
        (application?.loan_product as { code?: string; name?: string } | undefined)?.name,
      ];

      const flattened = rawCandidates.flatMap((value) => {
        if (Array.isArray(value)) return value;
        if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          return [obj.id, obj['Product ID'], obj.productId, obj.name, obj['Product Name']];
        }
        return [value];
      });

      return flattened
        .map(normalizeLookup)
        .filter(Boolean)
        .filter((value, idx, arr) => arr.indexOf(value) === idx);
    };

    const loadStatusesForProduct = async () => {
      const productCandidates = collectProductCandidates();
      if (productCandidates.length === 0) {
        setApplicationStatuses([]);
        return;
      }
      setLoadingApplicationStatuses(true);
      try {
        let entries: Array<{ key?: string; label?: string }> = [];

        for (const candidate of productCandidates) {
          const response = await apiService.getLoanProduct(candidate);
          if (response.success && Array.isArray(response.data?.applicableStatuses)) {
            entries = response.data.applicableStatuses;
            if (entries.length > 0) break;
          }
        }

        // Fallback: if direct get-by-id misses, scan list and match by any candidate field.
        if (entries.length === 0) {
          const listResp = await apiService.listLoanProducts();
          if (listResp.success && Array.isArray(listResp.data)) {
            const matched = listResp.data.find((product) => {
              const candidates = [
                product.id,
                product.productId,
                product.productName,
                (product as Record<string, unknown>)['Product ID'] as string | undefined,
                (product as Record<string, unknown>)['Product Name'] as string | undefined,
              ]
                .map(normalizeLookup)
                .filter(Boolean);
              return candidates.some((c) => productCandidates.includes(c));
            });
            if (matched && Array.isArray(matched.applicableStatuses)) {
              entries = matched.applicableStatuses;
            }
          }
        }

        if (entries.length === 0 && (userRole === 'kam' || userRole === 'credit_team' || userRole === 'admin')) {
          entries = getBusinessStatusOptions();
        }

        if (cancelled || entries.length === 0) {
          if (!cancelled) setApplicationStatuses([]);
          return;
        }
        const byKey = new Map<string, { key: string; label: string }>();
        entries.forEach((row) => {
          const key = normalizeStatus(String(row.key ?? ''));
          if (!key || byKey.has(key)) return;
          byKey.set(key, {
            key,
            label: getStatusDisplayNameForViewer(key, userRole || '') || String(row.label ?? '').trim(),
          });
        });
        const next = Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
        setApplicationStatuses(next);
      } catch {
        if (!cancelled) setApplicationStatuses([]);
      } finally {
        if (!cancelled) setLoadingApplicationStatuses(false);
      }
    };
    loadStatusesForProduct();
    return () => {
      cancelled = true;
    };
  }, [userRole, appRecord?.loan_product_id, appRecord?.productId, appRecord?.['Product ID'], appRecord?.['Loan Product'], application?.loan_product]);

  useEffect(() => {
    if (!application || !productIdForConfig) return;

    const buildMap = (config: Array<{ categoryName?: string; 'Category Name'?: string; fields?: Array<{ fieldId?: string; 'Field ID'?: string; id?: string; label?: string; 'Field Label'?: string }> }>) => {
      const map: Record<string, string> = {};
      (config || []).forEach((cat: Record<string, unknown>) => {
        const categoryName = (cat.categoryName ?? cat['Category Name'] ?? '') as string;
        ((cat.fields ?? []) as Array<Record<string, unknown>>).forEach((f: Record<string, unknown>) => {
          const fid = (f.fieldId || f['Field ID'] || f.id) as string | undefined;
          const label = (f.label || f['Field Label'] || '') as string;
          if (fid && label) map[fid] = `${label} - ${categoryName}`;
        });
      });
      setFieldIdToLabel(map);
    };

    const fetchConfig = () => {
      if (
        userRole === 'client' &&
        typeof apiService.getFormConfig === 'function'
      ) {
        return apiService.getFormConfig(productIdForConfig);
      }
      if (
        clientIdForConfig &&
        typeof clientIdForConfig === 'string' &&
        typeof apiService.getPublicFormConfig === 'function'
      ) {
        return apiService.getPublicFormConfig(clientIdForConfig, productIdForConfig);
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
      if (clientIdForConfig && typeof clientIdForConfig === 'string' && typeof apiService.getPublicFormConfig === 'function') {
        apiService.getPublicFormConfig(clientIdForConfig, productIdForConfig).then((r: ApiResponse<unknown>) => {
          if (r.success && r.data) {
            const raw = r.data;
            const config = Array.isArray(raw) ? raw : Array.isArray((raw as Record<string, unknown>)?.categories) ? (raw as Record<string, unknown>).categories : [];
            buildMap(Array.isArray(config) ? config : []);
          }
        }).catch(() => {});
      }
    });
  }, [application?.id, application?.loan_product, productIdForConfig, clientIdForConfig, userRole]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      console.log(`[ApplicationDetail] Fetching application with ID: ${id}`);
      
      const response =
        userRole === 'nbfc'
          ? (await apiService.getNBFCApplication(id!)) as ApiResponse<LoanApplication>
          : (await apiService.getApplication(id!)) as ApiResponse<LoanApplication>;
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
          status: resolveApplicationStatus(String(d.status ?? d.Status ?? '')),
          file_number: d.file_number ?? d.fileId ?? d['File ID'],
          applicant_name: d.applicant_name ?? d.applicantName ?? d['Applicant Name'],
          remarks: d.remarks ?? d['Remarks'] ?? form_data.Remarks ?? '',
          form_data,
          clientId: resolveApplicationClientId(d),
          requested_loan_amount: Number.isNaN(requested_loan_amount) ? undefined : requested_loan_amount,
          created_at: d.created_at ?? d.creationDate ?? d['Creation Date'],
          updated_at: d.updated_at ?? d.lastUpdated ?? d['Last Updated'],
          assignedKAMName: d.assignedKAMName ?? (d as Record<string, unknown>).assigned_kam_name,
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
        // If 401/403, token was cleared; refresh user so ProtectedRoute redirects to login
        if (response.error?.includes('401') || response.error?.includes('Authentication') || response.error?.includes('403') || response.error?.includes('Access denied')) {
          void refreshUser({ silent: true });
        }
        setApplication(null);
      }
    } catch (error: any) {
      console.error(`[ApplicationDetail] Exception fetching application ${id}:`, error);
      if (error.message?.includes('401') || error.message?.includes('403')) {
        void refreshUser({ silent: true });
      }
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
        const data = response.data as { summary?: string; structured?: { fullSummary?: string } };
        const summary = data.summary || data.structured?.fullSummary || '';
        
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
        alert('Application not found. Try navigating back to the applications list.');
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

  const parseCsvList = (raw: string): string[] =>
    raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleRaiseQuery = async () => {
    if (!queryMessage.trim() || !id) return;
    if (userRole !== 'kam' && userRole !== 'credit_team' && userRole !== 'client') return;

    setSubmitting(true);
    try {
      let response;
      if (userRole === 'client') {
        response = await apiService.createClientQuery(id, { message: queryMessage.trim() });
      } else if (userRole === 'kam') {
        response = await apiService.raiseQueryToClient(id, {
          message: queryMessage.trim(),
          fieldsRequested: parseCsvList(queryFieldsRequested),
          documentsRequested: parseCsvList(queryDocumentsRequested),
        });
      } else {
        response = await apiService.raiseQueryToKAM(id, queryMessage);
      }

      if (response.success) {
        setShowQueryModal(false);
        setQueryMessage('');
        setQueryFieldsRequested('');
        setQueryDocumentsRequested('');
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
        window.dispatchEvent(new CustomEvent('dashboard:refresh'));
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

    const targetKey = normalizeStatus(newStatus);
    if (applicationStatuses.length > 0) {
      const allowedKeys = new Set(applicationStatuses.map((s) => s.key));
      if (!allowedKeys.has(targetKey)) {
        console.error('Invalid status transition attempted');
        alert(`The status "${newStatus}" is not allowed for this loan product.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await applyApplicationStatusChange({
        applicationId: id,
        userRole,
        newStatus,
        notes: statusNotes,
        disbursedAmount: disbursedAmountInput,
        disbursedDate: disbursedDateInput,
      });

      if (response.success) {
        setShowStatusModal(false);
        setNewStatus('');
        setStatusNotes('');
        setDisbursedAmountInput('');
        setDisbursedDateInput('');
        await Promise.all([fetchApplicationDetails(), fetchStatusHistory()]);
      } else {
        throw new Error(response.error || 'Failed to update status');
      }
    } catch (error: unknown) {
      console.error('Error updating status:', error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' &&
              error !== null &&
              'message' in error &&
              typeof (error as { message: unknown }).message === 'string'
            ? (error as { message: string }).message
            : '';
      const errorMessage =
        /applicable statuses/i.test(message)
          ? 'This status is not allowed for this specific loan product.'
          : message || 'Failed to update status';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const parseApplicationFormData = (): Record<string, unknown> => {
    if (!application) return {};
    const rawForm =
      (application as unknown as Record<string, unknown>).form_data ??
      (application as unknown as Record<string, unknown>).formData ??
      (application as unknown as Record<string, unknown>)['Form Data'];
    if (rawForm == null) return {};
    if (typeof rawForm === 'string') {
      try {
        const parsed = JSON.parse(rawForm);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    if (typeof rawForm === 'object' && !Array.isArray(rawForm)) {
      return rawForm as Record<string, unknown>;
    }
    return {};
  };

  const handleOpenKamEdit = () => {
    const formDataToShow = parseApplicationFormData();
    if (isB2cEvFormTemplate(formDataToShow)) {
      setShowB2cEditModal(true);
      return;
    }
    const editable: Record<string, string> = {};
    Object.entries(formDataToShow).forEach(([key, value]) => {
      if (key.startsWith('_')) return;
      editable[key] = value == null ? '' : String(value);
    });
    setEditFormData(editable);
    setEditRemarks(String(formDataToShow.Remarks ?? (application as any)?.remarks ?? ''));
    setEditNotes('');
    setShowEditModal(true);
  };

  const handleSaveKamEdit = async () => {
    if (!id) return;
    setSubmittingKamEdit(true);
    try {
      const existingFormData = parseApplicationFormData();
      const patch: Record<string, unknown> = { ...editFormData };
      if (editRemarks.trim()) {
        patch.Remarks = editRemarks.trim();
      }
      const formData = mergeFormDataPatch(existingFormData, patch);
      const response = await apiService.editApplication(id, {
        formData,
        notes: editNotes.trim() || undefined,
      });
      if (response.success) {
        setShowEditModal(false);
        await Promise.all([fetchApplicationDetails(), fetchStatusHistory()]);
        alert('Application updated successfully.');
      } else {
        throw new Error(response.error || 'Failed to update application');
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to update application');
    } finally {
      setSubmittingKamEdit(false);
    }
  };

  const handleForwardToCredit = async () => {
    if (!id) return;

    setForwardingToCredit(true);
    try {
      const response = await apiService.forwardToCredit(id, {
        notes: forwardNotes.trim() || undefined,
        assignedCreditAnalystId: forwardCreditAnalystId.trim() || undefined,
      });
      if (response.success) {
        setShowForwardModal(false);
        setForwardNotes('');
        setForwardCreditAnalystId('');
        await Promise.all([fetchApplicationDetails(), fetchStatusHistory()]);
        alert('Application forwarded to credit team.');
      } else {
        throw new Error(response.error || 'Failed to forward application');
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to forward application');
    } finally {
      setForwardingToCredit(false);
    }
  };

  const openForwardModal = () => {
    setForwardNotes('');
    setForwardCreditAnalystId('');
    setShowForwardModal(true);
  };

  const handleWithdrawApplication = async () => {
    if (!id) return;
    if (!window.confirm('Withdraw this application? This action may not be reversible.')) return;

    setWithdrawing(true);
    try {
      const response = await apiService.withdrawApplication(id);
      if (response.success) {
        await Promise.all([fetchApplicationDetails(), fetchStatusHistory()]);
        alert('Application withdrawn.');
      } else {
        throw new Error(response.error || 'Failed to withdraw application');
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to withdraw application');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleOfflineNbfcDecision = async () => {
    if (!id || !offlineNbfcId || !offlineNbfcDecision) return;

    setSubmittingOfflineNbfc(true);
    try {
      const response = await apiService.captureNBFCDecision(id, {
        nbfcId: offlineNbfcId,
        decision: offlineNbfcDecision,
        decisionDate: new Date().toISOString().split('T')[0],
        approvedAmount: offlineNbfcApprovedAmount || undefined,
        rejectionReason: offlineNbfcDecision === 'Rejected' ? offlineNbfcRejectionReason : undefined,
        clarificationMessage:
          offlineNbfcDecision === 'Needs Clarification' ? offlineNbfcClarification : undefined,
      });

      if (response.success) {
        setShowOfflineNbfcModal(false);
        setOfflineNbfcId('');
        setOfflineNbfcDecision('');
        setOfflineNbfcApprovedAmount('');
        setOfflineNbfcRejectionReason('');
        setOfflineNbfcClarification('');
        await Promise.all([fetchApplicationDetails(), fetchStatusHistory()]);
        alert('NBFC decision recorded.');
      } else {
        throw new Error(response.error || 'Failed to record NBFC decision');
      }
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to record NBFC decision');
    } finally {
      setSubmittingOfflineNbfc(false);
    }
  };

  const openStatusModal = () => {
    const amountDefault = String(
      application?.approved_loan_amount ??
        application?.requested_loan_amount ??
        application?.approvedLoanAmount ??
        ''
    ).replace(/[^\d.]/g, '');
    setDisbursedAmountInput(amountDefault);
    setDisbursedDateInput(new Date().toISOString().split('T')[0]);
    setShowStatusModal(true);
  };

  const applicationStatusKey = normalizeStatus(application?.status || application?.Status || '');
  const canForwardToCredit =
    userRole === 'kam' &&
    (applicationStatusKey === 'under_kam_review' || applicationStatusKey === 'query_with_client');
  const canEditApplication =
    userRole === 'kam' &&
    (applicationStatusKey === 'under_kam_review' || applicationStatusKey === 'query_with_client');
  const canWithdrawApplication =
    userRole === 'client' && WITHDRAWABLE_CLIENT_STATUSES.has(applicationStatusKey);
  const canContinueEditingApplication =
    userRole === 'client' &&
    isClientEditableApplication(applicationStatusKey) &&
    isB2cEvFormTemplate(parseApplicationFormData());
  const canRecordOfflineNbfcDecision =
    (userRole === 'credit_team' || userRole === 'admin') &&
    applicationStatusKey === 'sent_to_nbfc' &&
    !application?.lenderDecisionStatus &&
    !application?.lender_decision_status;

  useEffect(() => {
    if (
      userRole === 'kam' &&
      (applicationStatusKey === 'under_kam_review' || applicationStatusKey === 'query_with_client')
    ) {
      apiService.listCreditTeamUsers().then((res) => {
        if (res.success && res.data) {
          setCreditTeamUsers(
            res.data
              .filter((u: { status?: string; active?: boolean }) => {
                const s = String(u.status ?? '').toLowerCase();
                return s === 'active' || u.active !== false;
              })
              .map((u: { id: string; creditTeamId?: string; name?: string; email?: string }) => ({
                id: String(u.creditTeamId ?? u.id),
                name: String(u.name ?? u.email ?? u.id),
              }))
          );
        }
      }).catch(() => setCreditTeamUsers([]));
    }
  }, [userRole, applicationStatusKey]);

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  // Status options sourced from Loan Application table statuses; optionally constrained by backend transition permissions.
  const statusOptions = (() => {
    const allOptions = applicationStatuses.map((statusEntry) => ({
      value: statusEntry.key,
      label: statusEntry.label || getStatusDisplayNameForViewer(statusEntry.key, userRole || ''),
    }));
    if (userRole === 'kam' && application) {
      const allowed = new Set(getAllowedNextStatusesForKam(applicationStatusKey));
      return allOptions.filter((opt) => allowed.has(normalizeStatus(opt.value) as LoanStatus));
    }
    return allOptions;
  })();
  const statusDropdownDisabled = !loadingApplicationStatuses && statusOptions.length === 0;

  if (loading) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle={t('pages.applicationDetail.loading')}
        userRole={getRoleDisplayName()}
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

  if (!application) {
    return (
      <MainLayout
        sidebarItems={sidebarItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        pageTitle={t('pages.applicationDetail.notFound')}
        userRole={getRoleDisplayName()}
        userName={getUserDisplayName()}
        notificationCount={unreadCount}
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
      >
        <Card>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-neutral-600 mb-2">{t('pages.applicationDetail.notFoundDescription')}</p>
              <p className="text-sm text-neutral-500 mb-4">
                {t('pages.applicationDetail.notFoundHint')}
              </p>
              <Button variant="secondary" onClick={() => navigate('/applications')}>
                {t('pages.applicationDetail.backToApplications')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  const fileNumber = String(application.file_number || application.fileId || id);
  const pageTitle = t('pages.applicationDetail.title', { fileNumber });

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle={pageTitle}
      userRole={getRoleDisplayName()}
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
            <Button variant="tertiary" icon={RefreshCw} onClick={handleRefresh} disabled={refreshing} loading={refreshing}>
              {t('common.refresh')}
            </Button>
            {canContinueEditingApplication && id && (
              <Button
                variant="primary"
                icon={Edit}
                onClick={() => navigate(buildWizardResumePath(id, parseApplicationFormData()))}
                data-testid="client-continue-editing-application"
              >
                Continue editing
              </Button>
            )}
            {canEditApplication && (
              <Button variant="secondary" icon={Edit} onClick={handleOpenKamEdit}>
                Edit Application
              </Button>
            )}
            {(userRole === 'kam' || userRole === 'credit_team' || userRole === 'admin') && (
              <Button
                variant="primary"
                icon={Edit}
                onClick={openStatusModal}
              >
                {t('pages.applicationDetail.updateStatus')}
              </Button>
            )}
            {canForwardToCredit && (
              <Button
                variant="secondary"
                icon={Send}
                onClick={openForwardModal}
                disabled={forwardingToCredit}
                loading={forwardingToCredit}
              >
                Forward to Credit
              </Button>
            )}
            {canWithdrawApplication && (
              <Button
                variant="secondary"
                icon={LogOut}
                onClick={handleWithdrawApplication}
                disabled={withdrawing}
                loading={withdrawing}
              >
                Withdraw
              </Button>
            )}
            {(userRole === 'kam' || userRole === 'credit_team' || userRole === 'client') && (
              <Button variant="secondary" icon={MessageSquare} onClick={() => setShowQueryModal(true)}>
                {t('pages.applicationDetail.raiseQuery')}
              </Button>
            )}
            {canRecordOfflineNbfcDecision && (
              <Button variant="secondary" onClick={() => setShowOfflineNbfcModal(true)}>
                Record offline NBFC decision
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
                <CardTitle>{t('pages.applicationDetail.applicationDetails')}</CardTitle>
                <Badge variant={getStatusVariant(application?.status)} data-testid="status-badge">
                  {getStatusDisplayNameForViewer(application?.status || '', userRole || '')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500">{t('pages.applicationDetail.fileNumber')}</p>
                  <p className="font-semibold text-neutral-900">{application.file_number}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">{t('pages.applications.client')}</p>
                  <p className="font-semibold text-neutral-900">
                    {typeof application.client === 'object' && application.client
                      ? (application.client as import('../services/api').LoanApplicationClient).company_name
                      : typeof application.client === 'string'
                        ? application.client
                        : ''}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">{t('pages.applicationDetail.applicantName')}</p>
                  <p className="font-semibold text-neutral-900">{application.applicant_name || ''}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">{t('pages.applicationDetail.loanProduct')}</p>
                  <p className="font-semibold text-neutral-900">
                    {typeof application.loan_product === 'object' && application.loan_product
                      ? application.loan_product.name ?? ''
                      : typeof application.loan_product === 'string'
                        ? application.loan_product
                        : ''}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">{t('pages.applicationDetail.requestedAmount')}</p>
                  <p className="font-semibold text-neutral-900">
                    {formatAmount(application.requested_loan_amount || 0)}
                  </p>
                </div>
                {(() => {
                  const appRecord = application as unknown as Record<string, unknown>;
                  const formDataRecord =
                    appRecord.form_data && typeof appRecord.form_data === 'object' && !Array.isArray(appRecord.form_data)
                      ? (appRecord.form_data as Record<string, unknown>)
                      : {};
                  const remarks = String(
                    application.remarks ?? appRecord['Remarks'] ?? formDataRecord.Remarks ?? ''
                  ).trim();
                  if (!remarks) return null;
                  return (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-neutral-500">{t('pages.applicationDetail.remarks')}</p>
                      <p className="font-semibold text-neutral-900 whitespace-pre-wrap">{remarks}</p>
                    </div>
                  );
                })()}
                {application.approved_loan_amount && (
                  <div>
                    <p className="text-sm text-neutral-500">{t('pages.applicationDetail.approvedAmount')}</p>
                    <p className="font-semibold text-success">
                      {formatAmount(application.approved_loan_amount)}
                    </p>
                  </div>
                )}
                {(application.assignedKAMName || (application as any).assigned_kam) && (
                  <div>
                    <p className="text-sm text-neutral-500">{t('pages.applicationDetail.assignedKam')}</p>
                    <p className="font-semibold text-neutral-900">
                      {(application as any).assignedKAMName || (application as any).assigned_kam || ''}
                    </p>
                  </div>
                )}
                {application.assigned_credit_analyst && (
                  <div>
                    <p className="text-sm text-neutral-500">{t('pages.applicationDetail.assignedCreditAnalyst')}</p>
                    <p className="font-semibold text-neutral-900">{t('pages.applicationDetail.assigned')}</p>
                  </div>
                )}
                {application.assigned_nbfc_id && application.assigned_nbfc && (
                  <div>
                    <p className="text-sm text-neutral-500">{t('pages.applicationDetail.assignedNbfc')}</p>
                    <p className="font-semibold text-neutral-900">{application.assigned_nbfc.name}</p>
                  </div>
                )}
                {(application.lender_decision_status || application.lenderDecisionStatus) && (
                  <div>
                    <p className="text-sm text-neutral-500">{t('pages.applicationDetail.lenderDecision')}</p>
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
                  <p className="text-sm text-neutral-500">{t('pages.applicationDetail.created')}</p>
                  <p className="font-semibold text-neutral-900">{formatDateSafe(application.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">{t('pages.applicationDetail.lastUpdated')}</p>
                  <p className="font-semibold text-neutral-900">{formatDateSafe(application.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assign to NBFC (Credit/Admin can assign from any stage) */}
          {showAssignNbfcSection && (
            <Card className="border-brand-primary/20 bg-brand-primary/5">
              <CardHeader>
                <CardTitle>{t('pages.applicationDetail.assignToNbfc')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600 mb-3">
                  {t('pages.applicationDetail.assignToNbfcDescription')}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                    {priorityNbfcSelections.map((selection) => (
                      <Select
                        key={selection.priority}
                        label={t('pages.applicationDetail.priority', { number: selection.priority })}
                        options={[
                          { value: '', label: t('pages.applicationDetail.selectNbfc') },
                          ...nbfcPartners
                            .filter(
                              (p) =>
                                !priorityNbfcSelections.some(
                                  (s) => s.priority !== selection.priority && s.nbfcId === p.id
                                )
                            )
                            .map((p) => ({ value: p.id, label: p.lenderName })),
                        ]}
                        value={selection.nbfcId}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setPriorityNbfcSelections((current) =>
                            current.map((item) =>
                              item.priority === selection.priority ? { ...item, nbfcId: nextValue } : item
                            )
                          );
                          setAssignNbfcError(null);
                        }}
                      />
                    ))}
                  </div>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      const assignments = priorityNbfcSelections
                        .filter((entry) => entry.nbfcId)
                        .map((entry) => ({ nbfcId: entry.nbfcId, priority: entry.priority }));

                      if (!id || assignments.length === 0) {
                        setAssignNbfcError(t('pages.applicationDetail.selectAtLeastOneNbfc'));
                        return;
                      }
                      setAssignNbfcSubmitting(true);
                      setAssignNbfcError(null);
                      try {
                        const res = await apiService.assignNBFCs(application?.id ?? id, assignments);
                        if (res.success) {
                          setPriorityNbfcSelections([
                            { priority: 1, nbfcId: '' },
                            { priority: 2, nbfcId: '' },
                            { priority: 3, nbfcId: '' },
                          ]);
                          fetchApplicationDetails();
                          fetchStatusHistory();
                        } else {
                          setAssignNbfcError(res.error || t('pages.applicationDetail.failedToAssign'));
                        }
                      } catch (err: unknown) {
                        setAssignNbfcError(err instanceof Error ? err.message : t('pages.applicationDetail.failedToAssign'));
                      } finally {
                        setAssignNbfcSubmitting(false);
                      }
                    }}
                    disabled={assignNbfcSubmitting || !priorityNbfcSelections.some((entry) => entry.nbfcId)}
                    loading={assignNbfcSubmitting}
                  >
                    {t('pages.applicationDetail.assignToNbfc')}
                  </Button>
                </div>
                {assignNbfcError && (
                  <p className="mt-2 text-sm text-error">{assignNbfcError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Documents Section - Enhanced for Credit Team */}
          {Array.isArray(application.documents) && application.documents.length > 0 && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>{t('pages.applicationDetail.uploadedDocuments', { count: application.documents.length })}</CardTitle>
                  {userRole === 'credit_team' && (
                    <Badge variant="info">{t('pages.applicationDetail.filesFromBackend')}</Badge>
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
                      {t('pages.applicationDetail.grid')}
                    </Button>
                    <Button
                      variant={documentsViewMode === 'list' ? 'primary' : 'secondary'}
                      size="sm"
                      icon={List}
                      onClick={() => setDocumentsViewMode('list')}
                    >
                      {t('pages.applicationDetail.list')}
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
                              {doc.fileName || t('pages.applicationDetail.document')}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="neutral" className="text-xs">
                                {doc.fieldId || t('pages.applicationDetail.field')}
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
                              {t('common.view')}
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
                              {t('common.download')}
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
                                  {doc.fileName || t('pages.applicationDetail.document')}
                                </p>
                                {fileExtension && (
                                  <Badge variant="info" className="text-xs uppercase flex-shrink-0">
                                    {fileExtension}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="neutral" className="text-xs">
                                  {doc.fieldId || t('pages.applicationDetail.fieldId')}
                                </Badge>
                                {userRole === 'credit_team' && (
                                  <span className="text-xs text-neutral-500">• {t('pages.applicationDetail.backendUpload')}</span>
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
                              {t('common.view')}
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
                              {t('common.download')}
                            </Button>
                            {userRole === 'credit_team' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={ExternalLink}
                                onClick={() => window.open(doc.url, '_blank')}
                              >
                                {t('common.open')}
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
                      {t('pages.applicationDetail.documentsTip')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Application Form Data */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.applicationDetail.applicationInformation')}</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const formDataToShow = parseApplicationFormData();
                if (isB2cEvFormTemplate(formDataToShow) && id) {
                  const appRecord = application as unknown as Record<string, unknown>;
                  const clientId = resolveApplicationClientId(appRecord) || undefined;
                  return (
                    <B2cEvApplicationReview
                      formData={formDataToShow}
                      applicationId={id}
                      clientId={clientId}
                      userRole={userRole}
                      highlightComplianceItem={complianceItemParam ?? undefined}
                      onUpdated={() => {
                        void fetchApplicationDetails();
                        window.dispatchEvent(new Event('dashboard:refresh'));
                      }}
                    />
                  );
                }
                const rawForm = (application as unknown as Record<string, unknown>).form_data ?? (application as unknown as Record<string, unknown>).formData ?? (application as unknown as Record<string, unknown>)['Form Data'];
                let legacyFormData: Record<string, unknown> = formDataToShow;
                if (rawForm != null && Object.keys(formDataToShow).length === 0) {
                  if (typeof rawForm === 'string') {
                    try {
                      const parsed = JSON.parse(rawForm);
                      legacyFormData = (parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}) as Record<string, unknown>;
                    } catch {
                      legacyFormData = {};
                    }
                  } else if (typeof rawForm === 'object' && !Array.isArray(rawForm)) {
                    legacyFormData = rawForm as Record<string, unknown>;
                  }
                }
                const getDisplayKey = (k: string) => {
                  if (k === '_documentsFolderLink') return 'Documents Folder Link';
                  if (k === '_documentsFolderShareAcknowledged') return 'Folder sharing confirmed';
                  if (/^field-/.test(k) && fieldIdToLabel[k]) return fieldIdToLabel[k];
                  return k.replace(/_/g, ' ');
                };
                const entries = Object.entries(legacyFormData).filter(
                  ([k]) =>
                    k !== '_documentsFolderLink' &&
                    k !== '_documentsFolderShareAcknowledged' &&
                    k !== 'Remarks'
                );
                const folderLink = legacyFormData._documentsFolderLink;
                const folderShareAck = legacyFormData._documentsFolderShareAcknowledged;
                const folderShareAckYes =
                  folderShareAck === true ||
                  folderShareAck === 'true' ||
                  folderShareAck === 'yes';
                return (!legacyFormData || Object.keys(legacyFormData).length === 0) ? (
                  <p className="text-center text-neutral-500 py-6">{t('pages.applicationDetail.noFormData')}</p>
                ) : (
                  <div className="space-y-3">
                    {folderLink != null && String(folderLink).trim() !== '' && (
                      <div className="space-y-2 pb-3 border-b border-neutral-200">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                        {folderShareAck !== undefined && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <p className="text-sm text-neutral-500">Folder sharing confirmed</p>
                            <p className="sm:col-span-2 text-sm text-neutral-900">
                              {folderShareAckYes ? t('common.yes') : t('common.no')}
                            </p>
                          </div>
                        )}
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
                  {t('pages.applicationDetail.queriesAndCommunication')} ({t('pages.applicationDetail.threadCount', { count: queries.length })})
                </CardTitle>
                {queries.filter((q: any) => !q.isResolved).length > 0 && (
                  <Badge variant="warning">
                    {queries.filter((q: any) => !q.isResolved).length} {t('pages.applicationDetail.unresolved')}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {queries.length === 0 ? (
                <p className="text-center text-neutral-500 py-8">{t('pages.applicationDetail.noQueries')}</p>
              ) : (
                <div className="space-y-6">
                  {/* Alert for unresolved B2C client requests (KAM) */}
                  {userRole === 'kam' && (() => {
                    const pendingB2c = queries.filter((q: any) => isUnresolvedB2cClientQuery(q));
                    return pendingB2c.length > 0 ? (
                      <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-neutral-900">
                          {pendingB2c.length} client {pendingB2c.length === 1 ? 'request' : 'requests'} awaiting your response
                        </p>
                        <p className="mt-1 text-xs text-neutral-600">
                          Use the actions below each request thread to mark compliance or DO as processed.
                        </p>
                      </div>
                    ) : null;
                  })()}
                  {/* Alert for unresolved credit queries (KAM) */}
                  {userRole === 'kam' && (() => {
                    const awaitingKamFromCredit = queries.filter((q: any) => {
                      const isCreditQuery =
                        q.rootQuery?.targetUserRole === 'kam' &&
                        (q.rootQuery?.actionEventType === 'credit_query' ||
                          q.rootQuery?.actionEventType === 'query_raised' ||
                          q.rootQuery?.actor?.toLowerCase().includes('credit'));
                      const hasKamReply = (q.replies || []).some(
                        (r: any) =>
                          r.targetUserRole === 'credit_team' ||
                          (r.actor || '').toLowerCase().includes('kam')
                      );
                      return !q.isResolved && isCreditQuery && !hasKamReply;
                    });
                    return awaitingKamFromCredit.length > 0 ? (
                      <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium text-neutral-900">
                          {awaitingKamFromCredit.length} credit {awaitingKamFromCredit.length === 1 ? 'query' : 'queries'} awaiting your response
                        </p>
                      </div>
                    ) : null;
                  })()}
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
                          <Badge variant="warning">{t('pages.applicationDetail.awaitingKamResponse')}</Badge>
                          <span className="text-sm font-medium text-neutral-900">
                            {t('pages.applicationDetail.awaitingResponse', { count: awaitingQueries.length })}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-600">
                          {t('pages.applicationDetail.raisedQueriesWaiting')}
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
                                      if (!actorEmail) return t('common.unknown');
                                      if (user?.email && (actorEmail || '').toLowerCase() === (user.email || '').toLowerCase())
                                        return t('pages.applicationDetail.you');
                                      const a = (actorEmail || '').toLowerCase();
                                      if (a.includes('credit')) return t('roles.creditTeam');
                                      if (a.includes('kam')) return t('roles.kam');
                                      if (isRootMsg && rootQuery.actionEventType === 'credit_query') return t('roles.creditTeam');
                                      if (isRootMsg && (rootQuery.actionEventType === 'query_raised' || rootQuery.targetUserRole === 'client')) return t('roles.kam');
                                      const beforeAt = (actorEmail || '').split('@')[0];
                                      return beforeAt || t('roles.client');
                                    };

                    const messages: Array<{ id: string; actor: string; actorLabel: string; message: string; timestamp: string; isRoot: boolean }> = [
                      {
                                        id: rootQuery.id,
                                        actor: rootQuery.actor || '',
                                        actorLabel: getActorLabel(rootQuery.actor || '', true),
                                        message: rootQuery.message || t('pages.applicationDetail.noMessage'),
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

                    const b2cThreadTitle = getB2cThreadTitle(rootQuery);

                    return (
                    <div
                      key={thread.rootQuery.id}
                      className={`border rounded-lg p-4 ${
                        awaitingKAMResponse && userRole === 'credit_team'
                          ? 'border-warning bg-warning/5'
                          : isUnresolvedB2cClientQuery(thread) && userRole === 'kam'
                            ? 'border-warning bg-warning/5'
                          : 'border-neutral-200'
                      }`}
                      data-testid={`query-thread-${thread.rootQuery.id}`}
                    >
                      {b2cThreadTitle && (
                        <p className="mb-2 text-sm font-semibold text-neutral-900">{b2cThreadTitle}</p>
                      )}
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <span className="text-xs text-neutral-500">
                          {t('pages.applicationDetail.toRecipient')}: {rootQuery.targetUserRole === 'client' ? t('roles.client') : rootQuery.targetUserRole === 'kam' ? t('roles.kam') : (rootQuery.targetUserRole || '—')}
                        </span>
                        {rootQuery.resolved || thread.isResolved ? (
                          <Badge variant="success" className="text-xs">{t('status.resolved')}</Badge>
                        ) : (
                          <Badge variant="warning" className="text-xs">{t('status.open')}</Badge>
                        )}
                        {awaitingKAMResponse && userRole === 'credit_team' && (
                          <Badge variant="warning" className="text-xs">{t('pages.applicationDetail.awaitingKamResponse')}</Badge>
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
                          const canStaffResolveB2c =
                            (userRole === 'kam' || userRole === 'credit_team' || userRole === 'admin') &&
                            isResolvableB2cClientQuery(rootQuery);
                          const canResolve = isAuthor || canStaffResolveB2c;
                          return canResolve ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleResolveQuery(rootQuery.id)}
                              disabled={submitting}
                              loading={submitting}
                            >
                              {t('pages.applicationDetail.markResolved')}
                            </Button>
                          ) : null;
                        })()}
                      </div>

                      <B2cClientQueryThreadActions
                        applicationId={id!}
                        queryId={thread.rootQuery.id}
                        rootQuery={rootQuery}
                        formData={parseApplicationFormData()}
                        userRole={userRole}
                        isResolved={thread.isResolved}
                        onUpdated={() => {
                          void fetchQueries();
                          void fetchApplicationDetails();
                        }}
                      />

                      {/* Chat thread: sequential messages */}
                      <div className="space-y-3 mb-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-lg p-3 ${
                              msg.actorLabel === t('pages.applicationDetail.you')
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
                                    {t('common.save')}
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => { setEditingQueryId(null); setEditMessage(''); }} disabled={submittingEdit}>
                                    {t('common.cancel')}
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
                            {t('pages.applicationDetail.editQuery')}
                          </Button>
                        </div>
                      )}

                      {/* Inline reply: text input + Send (chat-style) */}
                      {!thread.isResolved && (
                        <div className="mt-4 flex gap-2 items-end">
                          <TextArea
                            placeholder={t('pages.applicationDetail.responsePlaceholder')}
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
                            {t('common.send')}
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
              <CardTitle>{t('pages.applicationDetail.statusHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              {statusHistory.length === 0 ? (
                <p className="text-center text-neutral-500 py-6">{t('pages.applicationDetail.noStatusChanges')}</p>
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
            const YES_VALUES = ['Yes, Added to Folder', 'added_to_link', 'yes_added_to_folder', 'yes'];
            const AWAITING_VALUES = ['Awaiting, Will Update Folder', 'to_be_shared', 'awaiting_will_update', 'to be shared soon'];
            const NOT_AVAILABLE_VALUES = ['Not Available', 'not_available', 'no'];
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
                  <CardTitle>{t('pages.applicationDetail.uploadStatus')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {yesItems.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">{t('pages.applicationDetail.addedToFolder')}</p>
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
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">{t('pages.applicationDetail.awaiting')}</p>
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
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">{t('pages.applicationDetail.notAvailable')}</p>
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
                      <p className="text-center text-neutral-500 py-4 text-sm">{t('pages.applicationDetail.noUploadStatus')}</p>
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
                {t('pages.applicationDetail.aiFileSummary')}
              </CardTitle>
              <Button
                variant="secondary"
                size="sm"
                icon={generatingSummary ? undefined : aiSummary ? RefreshCw : Sparkles}
                onClick={handleGenerateAISummary}
                loading={generatingSummary}
                disabled={generatingSummary}
              >
                {aiSummary ? t('pages.applicationDetail.refreshSummary') : t('pages.applicationDetail.generateSummary')}
              </Button>
            </CardHeader>
            <CardContent>
              {generatingSummary ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-neutral-600">{t('pages.applicationDetail.generatingSummary')}</p>
                  <p className="text-xs text-neutral-500 mt-1">{t('pages.applicationDetail.generatingSummaryHint')}</p>
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
                    {t('pages.applicationDetail.noAiSummary')}
                  </p>
                  <Button
                    variant="primary"
                    icon={Sparkles}
                    onClick={handleGenerateAISummary}
                    loading={generatingSummary}
                    disabled={generatingSummary}
                  >
                    {t('pages.applicationDetail.generateAiSummary')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* NBFC Decision Section */}
          {userRole === 'nbfc' && (application?.status === 'sent_to_nbfc' || application?.status === 'Sent to NBFC') && (
            <Card>
              <CardHeader>
                <CardTitle>{t('pages.applicationDetail.recordDecision')}</CardTitle>
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
                          {t('pages.applicationDetail.onDate', { date: formatDateSafe(application.lenderDecisionDate || application.lender_decision_date) })}
                        </span>
                      )}
                    </div>
                    {(application.lenderDecisionRemarks || application.lender_decision_remarks) && (
                      <div className="bg-neutral-50 p-3 rounded">
                        <p className="text-sm font-medium text-neutral-700 mb-1">{t('pages.applicationDetail.remarks')}:</p>
                        <p className="text-sm text-neutral-900">{application.lenderDecisionRemarks || application.lender_decision_remarks}</p>
                </div>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => setShowDecisionModal(true)}
                    >
                      {t('pages.applicationDetail.updateDecision')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-neutral-600">
                      {t('pages.applicationDetail.reviewAndRecord')}
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => setShowDecisionModal(true)}
                    >
                      {t('pages.applicationDetail.recordDecision')}
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
            {t('pages.applicationDetail.recordNbfcDecision')}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Select
                label={t('pages.applicationDetail.decisionStatus')}
                value={decisionStatus}
                onChange={(e) => {
                  const v = e.target.value;
                  setDecisionStatus(v);
                  if (v !== 'Rejected') setRejectionReasonOption('');
                }}
                required
                options={[
                  { value: '', label: t('pages.applicationDetail.selectDecision') },
                  { value: 'Approved', label: t('pages.applicationDetail.approve') },
                  { value: 'Rejected', label: t('pages.applicationDetail.reject') },
                  { value: 'Needs Clarification', label: t('pages.applicationDetail.needsClarification') },
                ]}
              />

              {decisionStatus === 'Approved' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('pages.applicationDetail.approvedAmountOptional')}
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    placeholder={t('pages.applicationDetail.enterApprovedAmount')}
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                  />
                </div>
              )}

              {decisionStatus === 'Rejected' && (
                <>
                  <Select
                    label={t('pages.applicationDetail.rejectionReason')}
                    value={rejectionReasonOption}
                    onChange={(e) => setRejectionReasonOption(e.target.value)}
                    required
                    options={[
                      { value: '', label: t('pages.applicationDetail.selectReason') },
                      ...rejectionReasonsList.map((r) => ({ value: r.value, label: r.label })),
                    ]}
                  />
                  {rejectionReasonOption === 'other' && (
                    <TextArea
                      label={t('pages.applicationDetail.otherRequired')}
                      placeholder={t('pages.applicationDetail.rejectionReasonPlaceholder')}
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
                  label={decisionStatus === 'Approved' ? t('pages.applicationDetail.decisionRemarksOptional') : t('pages.applicationDetail.decisionRemarks')}
                  placeholder={
                    decisionStatus === 'Approved'
                      ? t('pages.applicationDetail.approvalTermsPlaceholder')
                      : t('pages.applicationDetail.clarificationPlaceholder')
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
              {t('common.cancel')}
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
              {t('pages.applicationDetail.recordDecision')}
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Forward to Credit Modal (KAM) */}
      {canForwardToCredit && (
        <Modal
          isOpen={showForwardModal}
          onClose={() => setShowForwardModal(false)}
          size="md"
        >
          <ModalHeader onClose={() => setShowForwardModal(false)}>
            Forward to Credit
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <TextArea
                label="Notes for credit team (optional)"
                value={forwardNotes}
                onChange={(e) => setForwardNotes(e.target.value)}
                rows={4}
              />
              {creditTeamUsers.length > 0 && (
                <Select
                  label="Assign credit analyst (optional)"
                  value={forwardCreditAnalystId}
                  onChange={(e) => setForwardCreditAnalystId(e.target.value)}
                  options={[
                    { value: '', label: '— No specific analyst —' },
                    ...creditTeamUsers.map((u) => ({ value: u.id, label: u.name })),
                  ]}
                />
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setShowForwardModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleForwardToCredit}
              disabled={forwardingToCredit}
              loading={forwardingToCredit}
            >
              Forward to Credit
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
          setQueryFieldsRequested('');
          setQueryDocumentsRequested('');
        }}
        size="md"
      >
        <ModalHeader onClose={() => setShowQueryModal(false)}>
          {t('pages.applicationDetail.raiseQuery')}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <TextArea
              label={t('pages.applicationDetail.queryMessage')}
              placeholder={t('pages.applicationDetail.queryPlaceholder')}
              value={queryMessage}
              onChange={(e) => setQueryMessage(e.target.value)}
              required
              rows={5}
            />
            {userRole === 'kam' && (
              <>
                <Input
                  label="Fields requested (comma-separated)"
                  placeholder="e.g. PAN, Annual income"
                  value={queryFieldsRequested}
                  onChange={(e) => setQueryFieldsRequested(e.target.value)}
                />
                <Input
                  label="Documents requested (comma-separated)"
                  placeholder="e.g. Bank statement, Salary slips"
                  value={queryDocumentsRequested}
                  onChange={(e) => setQueryDocumentsRequested(e.target.value)}
                />
              </>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowQueryModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleRaiseQuery}
            disabled={!queryMessage.trim() || submitting}
            loading={submitting}
          >
            {t('common.sendQuery')}
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
            {t('pages.applicationDetail.respondToQuery')}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="bg-neutral-50 p-3 rounded">
                <p className="text-sm font-medium text-neutral-700 mb-1">{t('pages.applicationDetail.originalQuery')}</p>
                <p className="text-sm text-neutral-900">{(selectedQuery as any).message ?? (selectedQuery as any).query_text ?? t('pages.applicationDetail.noMessage')}</p>
              </div>
              <TextArea
                label={t('pages.applicationDetail.yourResponse')}
                placeholder={t('pages.applicationDetail.responsePlaceholder')}
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                required
                rows={6}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setSelectedQuery(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleRespondToQuery}
              disabled={!responseMessage.trim() || submitting}
              loading={submitting}
            >
              {t('pages.applicationDetail.sendResponse')}
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
          setDisbursedAmountInput('');
          setDisbursedDateInput('');
        }}
        size="md"
      >
        <ModalHeader onClose={() => setShowStatusModal(false)}>
          {t('pages.applicationDetail.updateApplicationStatus')}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-neutral-50 p-3 rounded">
              <p className="text-sm text-neutral-700">
                <span className="font-medium">{t('pages.applicationDetail.currentStatus')}</span>{' '}
                <Badge variant={getStatusVariant(application?.status)}>
                  {getStatusDisplayNameForViewer(application?.status || '', userRole || '')}
                </Badge>
              </p>
            </div>
            <Select
              label={t('pages.applicationDetail.newStatus')}
              options={statusOptions}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              disabled={statusDropdownDisabled}
              helperText={
                statusDropdownDisabled
                  ? t('pages.applicationDetail.noStatusesAvailable')
                  : undefined
              }
              required
            />
            {statusRequiresDisbursementFields(newStatus) && (
              <>
                <Input
                  label="Disbursed amount"
                  type="number"
                  value={disbursedAmountInput}
                  onChange={(e) => setDisbursedAmountInput(e.target.value)}
                  required
                />
                <Input
                  label="Disbursed date"
                  type="date"
                  value={disbursedDateInput}
                  onChange={(e) => setDisbursedDateInput(e.target.value)}
                  required
                />
              </>
            )}
            <TextArea
              label={t('pages.applicationDetail.notesOptional')}
              placeholder={t('pages.applicationDetail.statusNotesPlaceholder')}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              rows={3}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdateStatus}
            disabled={
              !newStatus ||
              submitting ||
              statusDropdownDisabled ||
              (statusRequiresDisbursementFields(newStatus) && !disbursedAmountInput.trim())
            }
            loading={submitting}
          >
            {t('pages.applicationDetail.updateStatus')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* KAM Edit Application Modal (legacy forms) */}
      {canEditApplication && !isB2cEvFormTemplate(parseApplicationFormData()) && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          size="lg"
        >
          <ModalHeader onClose={() => setShowEditModal(false)}>
            Edit Application
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {Object.keys(editFormData).length === 0 ? (
                <p className="text-sm text-neutral-500">No editable form fields found.</p>
              ) : (
                Object.entries(editFormData).map(([key, value]) => (
                  <Input
                    key={key}
                    label={key.replace(/_/g, ' ')}
                    value={value}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  />
                ))
              )}
              <TextArea
                label="Remarks"
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                rows={2}
              />
              <TextArea
                label="Edit notes (audit log)"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                placeholder="Reason for edit (optional)"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveKamEdit}
              disabled={submittingKamEdit}
              loading={submittingKamEdit}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {canEditApplication && id && isB2cEvFormTemplate(parseApplicationFormData()) && (
        <B2cEvKamEditModal
          isOpen={showB2cEditModal}
          applicationId={id}
          formData={parseApplicationFormData()}
          remarks={String(parseApplicationFormData().Remarks ?? (application as { remarks?: string })?.remarks ?? '')}
          onClose={() => setShowB2cEditModal(false)}
          onSaved={() => void Promise.all([fetchApplicationDetails(), fetchStatusHistory()])}
        />
      )}

      <Modal
        isOpen={showOfflineNbfcModal}
        onClose={() => setShowOfflineNbfcModal(false)}
        size="md"
      >
        <ModalHeader onClose={() => setShowOfflineNbfcModal(false)}>
          Record offline NBFC decision
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Select
              label="NBFC partner"
              options={[
                { value: '', label: 'Select NBFC' },
                ...nbfcPartners.map((p) => ({ value: p.id, label: p.lenderName })),
              ]}
              value={offlineNbfcId}
              onChange={(e) => setOfflineNbfcId(e.target.value)}
              required
            />
            <Select
              label="Decision"
              options={[
                { value: '', label: 'Select decision' },
                { value: 'Approved', label: 'Approved' },
                { value: 'Rejected', label: 'Rejected' },
                { value: 'Needs Clarification', label: 'Needs Clarification' },
              ]}
              value={offlineNbfcDecision}
              onChange={(e) => setOfflineNbfcDecision(e.target.value)}
              required
            />
            {offlineNbfcDecision === 'Approved' && (
              <Input
                label="Approved amount"
                type="number"
                value={offlineNbfcApprovedAmount}
                onChange={(e) => setOfflineNbfcApprovedAmount(e.target.value)}
              />
            )}
            {offlineNbfcDecision === 'Rejected' && (
              <TextArea
                label="Rejection reason"
                value={offlineNbfcRejectionReason}
                onChange={(e) => setOfflineNbfcRejectionReason(e.target.value)}
                rows={3}
              />
            )}
            {offlineNbfcDecision === 'Needs Clarification' && (
              <TextArea
                label="Clarification message"
                value={offlineNbfcClarification}
                onChange={(e) => setOfflineNbfcClarification(e.target.value)}
                rows={3}
              />
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowOfflineNbfcModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleOfflineNbfcDecision}
            disabled={!offlineNbfcId || !offlineNbfcDecision || submittingOfflineNbfc}
            loading={submittingOfflineNbfc}
          >
            Record decision
          </Button>
        </ModalFooter>
      </Modal>
    </MainLayout>
  );
};
