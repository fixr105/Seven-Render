import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { TextArea } from '../components/ui/TextArea';
import { Select } from '../components/ui/Select';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, ArrowLeft, MessageSquare, Clock, CheckCircle, XCircle, Send, Download, Edit } from 'lucide-react';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { supabase } from '../lib/supabase';

const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
  const statusLower = status.toLowerCase();
  if (['approved', 'disbursed'].includes(statusLower)) return 'success';
  if (['kam_query_raised', 'pending_kam_review', 'credit_query_raised'].includes(statusLower)) return 'warning';
  if (statusLower === 'rejected') return 'error';
  if (['forwarded_to_credit', 'in_negotiation', 'sent_to_nbfc'].includes(statusLower)) return 'info';
  return 'neutral';
};

const formatStatus = (status: string): string => {
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
  const { userRole, userRoleId } = useAuthSafe();
  const { unreadCount } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [queryMessage, setQueryMessage] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications' },
    ...(userRole === 'kam' || userRole === 'credit_team' ? [{ id: 'clients', label: 'Clients', icon: Users, path: '/clients' }] : []),
    ...(userRole === 'client' || userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  useEffect(() => {
    if (id) {
      fetchApplicationDetails();
      fetchQueries();
      fetchStatusHistory();

      const appSubscription = supabase
        .channel(`application_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_applications', filter: `id=eq.${id}` }, () => {
          fetchApplicationDetails();
        })
        .subscribe();

      const queriesSubscription = supabase
        .channel(`queries_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queries', filter: `application_id=eq.${id}` }, () => {
          fetchQueries();
        })
        .subscribe();

      const historySubscription = supabase
        .channel(`history_${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'status_history', filter: `application_id=eq.${id}` }, () => {
          fetchStatusHistory();
        })
        .subscribe();

      return () => {
        appSubscription.unsubscribe();
        queriesSubscription.unsubscribe();
        historySubscription.unsubscribe();
      };
    }
  }, [id]);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('loan_applications')
        .select(`
          *,
          client:dsa_clients(company_name, contact_person, email, phone),
          loan_product:loan_products(name, code, description),
          assigned_nbfc:nbfc_partners(name, contact_person),
          assigned_credit_analyst_user:user_roles!loan_applications_assigned_credit_analyst_fkey(id)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setApplication(data);
    } catch (error) {
      console.error('Error fetching application:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueries = async () => {
    try {
      const { data, error } = await supabase
        .from('queries')
        .select(`
          *,
          raised_by_user:user_roles!queries_raised_by_fkey(role)
        `)
        .eq('application_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQueries(data || []);
    } catch (error) {
      console.error('Error fetching queries:', error);
    }
  };

  const fetchStatusHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('status_history')
        .select('*')
        .eq('application_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStatusHistory(data || []);
    } catch (error) {
      console.error('Error fetching status history:', error);
    }
  };

  const handleRaiseQuery = async () => {
    if (!queryMessage.trim()) return;

    setSubmitting(true);
    try {
      const targetRole = userRole === 'client' ? 'kam' :
                        userRole === 'kam' ? 'credit_team' :
                        userRole === 'credit_team' ? 'kam' : 'credit_team';

      const { error } = await supabase
        .from('queries')
        .insert({
          application_id: id,
          raised_by: userRoleId,
          raised_to_role: targetRole,
          query_text: queryMessage,
          status: 'open',
        });

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        application_id: id,
        user_id: userRoleId,
        action_type: 'query_raised',
        message: `Query raised to ${targetRole}`,
        metadata: { query_text: queryMessage },
        visible_to_roles: [userRole!, targetRole],
      });

      setShowQueryModal(false);
      setQueryMessage('');
      fetchQueries();
    } catch (error) {
      console.error('Error raising query:', error);
      alert('Failed to raise query');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondToQuery = async () => {
    if (!selectedQuery || !responseMessage.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('queries')
        .update({
          response_text: responseMessage,
          responded_by: userRoleId,
          responded_at: new Date().toISOString(),
          status: 'responded',
        })
        .eq('id', selectedQuery.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        application_id: id,
        user_id: userRoleId,
        action_type: 'query_responded',
        message: 'Query response provided',
        metadata: { query_id: selectedQuery.id, response_text: responseMessage },
      });

      setSelectedQuery(null);
      setResponseMessage('');
      fetchQueries();
    } catch (error) {
      console.error('Error responding to query:', error);
      alert('Failed to respond to query');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveQuery = async (queryId: string) => {
    try {
      const { error } = await supabase
        .from('queries')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', queryId);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        application_id: id,
        user_id: userRoleId,
        action_type: 'query_resolved',
        message: 'Query marked as resolved',
        metadata: { query_id: queryId },
      });

      fetchQueries();
    } catch (error) {
      console.error('Error resolving query:', error);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;

    setSubmitting(true);
    try {
      const { error: historyError } = await supabase
        .from('status_history')
        .insert({
          application_id: id,
          from_status: application.status,
          to_status: newStatus,
          changed_by: userRoleId,
          notes: statusNotes || null,
        });

      if (historyError) throw historyError;

      const updates: any = { status: newStatus, updated_at: new Date().toISOString() };

      if (newStatus === 'pending_kam_review') {
        updates.submitted_at = new Date().toISOString();
      } else if (newStatus === 'forwarded_to_credit') {
        updates.forwarded_to_credit_at = new Date().toISOString();
      } else if (newStatus === 'sent_to_nbfc') {
        updates.sent_to_nbfc_at = new Date().toISOString();
      } else if (['approved', 'rejected', 'disbursed'].includes(newStatus)) {
        updates.decision_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('loan_applications')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        application_id: id,
        user_id: userRoleId,
        action_type: 'status_change',
        message: `Status changed to ${newStatus}`,
        metadata: { from_status: application.status, to_status: newStatus, notes: statusNotes },
      });

      setShowStatusModal(false);
      setNewStatus('');
      setStatusNotes('');
      fetchApplicationDetails();
      fetchStatusHistory();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
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
        userName="User"
        notificationCount={unreadCount}
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
        pageTitle="Application Not Found"
        userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
        userName="User"
        notificationCount={unreadCount}
      >
        <Card>
          <CardContent>
            <p className="text-center text-neutral-600">Application not found</p>
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
      pageTitle={`Application ${application.file_number}`}
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName="User"
      notificationCount={unreadCount}
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
                <Badge variant={getStatusVariant(application.status)}>
                  {formatStatus(application.status)}
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
                  <p className="font-semibold text-neutral-900">{application.applicant_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Loan Product</p>
                  <p className="font-semibold text-neutral-900">{application.loan_product?.name || 'N/A'}</p>
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
                {application.lender_decision_status && (
                  <div>
                    <p className="text-sm text-neutral-500">Lender Decision</p>
                    <p className="font-semibold text-neutral-900">{application.lender_decision_status}</p>
                    {application.lender_decision_date && (
                      <p className="text-xs text-neutral-500 mt-1">
                        {formatDate(application.lender_decision_date)}
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
              <CardTitle>Queries & Communication ({queries.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {queries.length === 0 ? (
                <p className="text-center text-neutral-500 py-8">No queries yet</p>
              ) : (
                <div className="space-y-4">
                  {queries.map((query) => (
                    <div key={query.id} className="border border-neutral-200 rounded p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">{query.raised_by_user?.role?.toUpperCase()}</Badge>
                          <span className="text-xs text-neutral-500">{formatDate(query.created_at)}</span>
                        </div>
                        <Badge variant={
                          query.status === 'resolved' ? 'success' :
                          query.status === 'responded' ? 'info' : 'warning'
                        }>
                          {query.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-neutral-900 mb-3">{query.query_text}</p>

                      {query.response_text && (
                        <div className="bg-neutral-50 rounded p-3 mb-2">
                          <p className="text-xs text-neutral-500 mb-1">Response:</p>
                          <p className="text-sm text-neutral-900">{query.response_text}</p>
                          {query.responded_at && (
                            <p className="text-xs text-neutral-500 mt-1">{formatDate(query.responded_at)}</p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 mt-2">
                        {!query.response_text && query.raised_to_role === userRole && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={Send}
                            onClick={() => {
                              setSelectedQuery(query);
                              setResponseMessage('');
                            }}
                          >
                            Respond
                          </Button>
                        )}
                        {query.status !== 'resolved' && (userRole === 'kam' || userRole === 'credit_team') && (
                          <Button
                            size="sm"
                            variant="tertiary"
                            icon={CheckCircle}
                            onClick={() => handleResolveQuery(query.id)}
                          >
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
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
                      <Badge variant={getStatusVariant(item.to_status)} size="sm">
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

          {/* AI Summary (if available) */}
          {application.ai_summary && Object.keys(application.ai_summary).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>AI Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(application.ai_summary).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs font-medium text-neutral-700 capitalize">{key.replace(/_/g, ' ')}</p>
                      <p className="text-sm text-neutral-600">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
                <Badge variant={getStatusVariant(application.status)}>
                  {formatStatus(application.status)}
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
