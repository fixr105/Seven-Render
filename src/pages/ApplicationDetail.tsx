import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, ArrowLeft, MessageSquare, Download, Edit, Sparkles, RefreshCw, File, Image, FileCheck, Eye, ExternalLink, Grid3x3, List } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { apiService } from '../services/api';

const getStatusVariant = (status: string | undefined | null): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
  if (!status) return 'neutral';
  const statusLower = status.toLowerCase();
  if (['approved', 'disbursed'].includes(statusLower)) return 'success';
  if (['kam_query_raised', 'pending_kam_review', 'credit_query_raised'].includes(statusLower)) return 'warning';
  if (statusLower === 'rejected') return 'error';
  if (['forwarded_to_credit', 'in_negotiation', 'sent_to_nbfc'].includes(statusLower)) return 'info';
  return 'neutral';
};

const formatStatus = (status: string | undefined | null): string => {
  if (!status) return '';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatAmount = (amount: any): string => {
  const num = parseFloat(amount);
  if (isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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
  const [application, setApplication] = useState<any>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [kamEdits, setKamEdits] = useState<any[]>([]);
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
  const [documentsViewMode, setDocumentsViewMode] = useState<'grid' | 'list'>('grid');

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications' },
    ...(userRole === 'kam' || userRole === 'credit_team' ? [{ id: 'clients', label: 'Clients', icon: Users, path: '/clients' }] : []),
    ...(userRole === 'client' || userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

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
  }, [id]); // Only fetch when id changes (route navigation)

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      console.log(`[ApplicationDetail] Fetching application with ID: ${id}`);
      
      const response = await apiService.getApplication(id!);
      console.log(`[ApplicationDetail] Response:`, { success: response.success, hasData: !!response.data, error: response.error });
      
      if (response.success && response.data) {
        console.log(`[ApplicationDetail] Application found:`, { id: response.data.id, fileId: response.data.fileId });
        setApplication(response.data);
        // Set AI summary if available
        setAiSummary(response.data.aiFileSummary || (response.data as any)['AI File Summary'] || null);
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
        alert('You do not have permission to generate AI summaries. Only KAM and Credit Team members can generate summaries.');
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
        // Client raising query - use generic query endpoint
        response = await apiService.replyToQuery(id, '', queryMessage);
      }

      if (response.success) {
        setShowQueryModal(false);
        setQueryMessage('');
        fetchQueries();
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

  const handleUpdateStatus = async () => {
    if (!newStatus || !id) return;

    setSubmitting(true);
    try {
      // Use API service based on role and status
      let response;
      
      if (userRole === 'kam' && newStatus === 'forwarded_to_credit') {
        response = await apiService.forwardToCredit(id);
      } else if (userRole === 'credit_team') {
        if (newStatus === 'in_negotiation') {
          response = await apiService.markInNegotiation(id);
        } else if (newStatus === 'disbursed') {
          response = await apiService.markDisbursed(id, {
            disbursedAmount: application.disbursedAmount || '0',
            disbursedDate: new Date().toISOString(),
          });
        } else {
          // Generic status update via edit
          response = await apiService.editApplication(id, { status: newStatus });
        }
      } else {
        // Generic edit for other cases
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

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'pending_kam_review', label: 'Submitted / Pending KAM Review' },
    { value: 'kam_query_raised', label: 'KAM Query Raised' },
    { value: 'forwarded_to_credit', label: 'Approved by KAM / Forwarded to Credit' },
    { value: 'credit_query_raised', label: 'Credit Query Raised' },
    { value: 'in_negotiation', label: 'In Negotiation' },
    { value: 'sent_to_nbfc', label: 'Sent to NBFC' },
    { value: 'approved', label: 'NBFC Approved' },
    { value: 'rejected', label: 'NBFC Rejected' },
    { value: 'disbursed', label: 'Disbursed' },
    { value: 'closed', label: 'Closed/Archived' },
  ];

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
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>
          Back
        </Button>
        <div className="flex gap-2">
          {(userRole === 'kam' || userRole === 'credit_team') && (
            <Button variant="primary" icon={Edit} onClick={() => setShowStatusModal(true)}>
              Update Status
            </Button>
          )}
          <Button variant="secondary" icon={MessageSquare} onClick={() => setShowQueryModal(true)}>
            Raise Query
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Summary */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Application Details</CardTitle>
                <Badge variant={getStatusVariant(application?.status)}>
                  {formatStatus(application?.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500">File Number</p>
                  <p className="font-semibold text-neutral-900">{application.file_number}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Client</p>
                  <p className="font-semibold text-neutral-900">{application.client?.company_name}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Applicant Name</p>
                  <p className="font-semibold text-neutral-900">{application.applicant_name || ''}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Loan Product</p>
                  <p className="font-semibold text-neutral-900">{application.loan_product?.name || ''}</p>
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
                        {formatDate(application.lender_decision_date || application.lenderDecisionDate)}
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
                  <p className="font-semibold text-neutral-900">{formatDate(application.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Last Updated</p>
                  <p className="font-semibold text-neutral-900">{formatDate(application.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Section - Enhanced for Credit Team */}
          {application.documents && application.documents.length > 0 && (
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
                          className="flex items-center justify-between p-4 border-2 border-neutral-200 rounded-lg hover:border-brand-primary hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            {/* File Icon */}
                            <div className="flex-shrink-0">
                              {isImage ? (
                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                                  <Image className="w-6 h-6 text-blue-600" />
                                </div>
                              ) : isPdf ? (
                                <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                                  <FileText className="w-6 h-6 text-red-600" />
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
              <div className="space-y-3">
                {Object.entries(application.form_data || {}).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-3 gap-2">
                    <p className="text-sm text-neutral-500 capitalize">{key.replace(/_/g, ' ')}</p>
                    <p className="col-span-2 text-sm text-neutral-900">{String(value)}</p>
                  </div>
                ))}
              </div>
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
                    // Get root query with fallback
                    const rootQuery = thread.rootQuery || {};
                    
                    // Calculate last activity timestamp
                    const allTimestamps = [
                      rootQuery.timestamp,
                      ...((thread.replies || []).map((r: any) => r.timestamp) || [])
                    ].filter(Boolean);
                    const lastActivity = allTimestamps.length > 0 
                      ? allTimestamps.reduce((latest: string, ts: string) => {
                          try {
                            return new Date(ts) > new Date(latest) ? ts : latest;
                          } catch {
                            return latest;
                          }
                        })
                      : null;
                    
                    // Check if credit raised query and no KAM reply yet
                    // More reliable detection: check targetUserRole and actionEventType
                    const isCreditQuery = rootQuery.targetUserRole === 'kam' && 
                                         (rootQuery.actionEventType === 'credit_query' ||
                                          rootQuery.actor?.toLowerCase().includes('credit') || 
                                          (userRole === 'credit_team' && rootQuery.targetUserRole === 'kam'));
                    const hasKAMReply = (thread.replies || []).some((r: any) => 
                      r.targetUserRole === 'credit_team' ||
                      r.actor?.toLowerCase().includes('kam')
                    ) || false;
                    const awaitingKAMResponse = isCreditQuery && !hasKAMReply && !thread.isResolved;
                    
                    return (
                    <div 
                      key={thread.rootQuery.id} 
                      className={`border rounded-lg p-4 ${
                        awaitingKAMResponse && userRole === 'credit_team' 
                          ? 'border-warning bg-warning/5' 
                          : 'border-neutral-200'
                      }`}
                    >
                      {/* Root Query */}
                      <div className="mb-4 pb-4 border-b border-neutral-200">
                      <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-medium text-neutral-900">
                                {rootQuery.actor || 'Unknown'}
                              </span>
                              {rootQuery.timestamp && (
                                <span className="text-xs text-neutral-500">
                                  {formatDate(rootQuery.timestamp)}
                                </span>
                              )}
                              {rootQuery.resolved ? (
                                <Badge variant="success" className="text-xs">Resolved</Badge>
                              ) : (
                                <Badge variant="warning" className="text-xs">Open</Badge>
                              )}
                              {awaitingKAMResponse && userRole === 'credit_team' && (
                                <Badge variant="warning" className="text-xs">Awaiting KAM Response</Badge>
                              )}
                              {!awaitingKAMResponse && !thread.isResolved && hasKAMReply && userRole === 'credit_team' && (
                                <Badge variant="info" className="text-xs">KAM Responded</Badge>
                              )}
                              {lastActivity && (
                                <span className="text-xs text-neutral-500">
                                  Last activity: {formatDate(lastActivity)}
                                </span>
                              )}
                        </div>
                            <p className="text-sm text-neutral-700 mb-2">{rootQuery.message || 'No message'}</p>
                            {rootQuery.targetUserRole && (
                              <p className="text-xs text-neutral-500">
                                To: {rootQuery.targetUserRole}
                              </p>
                            )}
                      </div>
                          {!thread.isResolved && (userRole === 'kam' || userRole === 'credit_team' || userRole === 'client') && rootQuery.id && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleResolveQuery(rootQuery.id)}
                              disabled={submitting}
                              loading={submitting}
                            >
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Replies */}
                      {thread.replies && thread.replies.length > 0 && (
                        <div className="ml-4 space-y-3 border-l-2 border-neutral-200 pl-4">
                          {thread.replies.map((reply: any) => (
                            <div key={reply.id} className="bg-neutral-50 rounded p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-neutral-900">
                                  {reply.actor}
                                </span>
                                <span className="text-xs text-neutral-500">
                                  {formatDate(reply.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm text-neutral-700">{reply.message}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Button */}
                      {!thread.isResolved && (
                        <div className="mt-4">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={MessageSquare}
                            onClick={() => {
                              setSelectedQuery(thread.rootQuery);
                              setShowQueryModal(true);
                            }}
                          >
                            Reply
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
              <div className="space-y-3">
                {statusHistory.map((item, index) => (
                  <div key={item.id} className="relative pl-6">
                    {index !== statusHistory.length - 1 && (
                      <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-neutral-200" />
                    )}
                    <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-brand-primary" />
                    <div>
                      <Badge variant={getStatusVariant(item.to_status)}>
                        {formatStatus(item.to_status)}
                      </Badge>
                      <p className="text-xs text-neutral-500 mt-1">{formatDate(item.created_at)}</p>
                      {item.notes && (
                        <p className="text-xs text-neutral-600 mt-1">{item.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
                          on {formatDate(application.lenderDecisionDate || application.lender_decision_date)}
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
          isOpen={showDecisionModal}
          onClose={() => {
            setShowDecisionModal(false);
            setDecisionStatus('');
            setDecisionRemarks('');
            setApprovedAmount('');
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
                onChange={(e) => setDecisionStatus(e.target.value)}
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

              <TextArea
                label={`Decision Remarks${decisionStatus === 'Rejected' ? ' (Required)' : ''}`}
                placeholder={
                  decisionStatus === 'Approved' 
                    ? 'Enter approval terms and conditions...'
                    : decisionStatus === 'Rejected'
                    ? 'Enter rejection reason (required)...'
                    : 'Enter clarification request...'
                }
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
                required={decisionStatus === 'Rejected'}
                rows={6}
              />
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
                if (decisionStatus === 'Rejected' && !decisionRemarks.trim()) {
                  alert('Remarks are required when rejecting an application');
                  return;
                }
                if (!id) return;

                setSubmitting(true);
                try {
                  const response = await apiService.recordNBFCDecision(id, {
                    lenderDecisionStatus: decisionStatus,
                    lenderDecisionRemarks: decisionRemarks.trim(),
                    approvedAmount: approvedAmount ? parseFloat(approvedAmount) : undefined,
                  });

                  if (response.success) {
                    setShowDecisionModal(false);
                    setDecisionStatus('');
                    setDecisionRemarks('');
                    setApprovedAmount('');
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
              disabled={!decisionStatus || (decisionStatus === 'Rejected' && !decisionRemarks.trim()) || submitting}
              loading={submitting}
            >
              Record Decision
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Raise Query Modal */}
      <Modal
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
                <p className="text-sm text-neutral-900">{selectedQuery.query_text}</p>
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
                  {formatStatus(application?.status)}
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
