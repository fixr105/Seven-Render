import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { useAuth } from '../auth/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchBar } from '../components/ui/SearchBar';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { TextArea } from '../components/ui/TextArea';
import { Plus, Eye, MessageSquare, RefreshCw, FileText, X } from 'lucide-react';
import { useApplications } from '../hooks/useApplications';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { apiService } from '../services/api';
import { getStatusDisplayNameForViewer, getStatusColor } from '../lib/statusUtils';

// Placeholder data removed - now using real data from database via useApplications hook

/** Map filter value to tag variant for colourful subtle filter tags */
const getFilterTagVariant = (filterValue: string): 'neutral' | 'success' | 'warning' | 'error' | 'info' => {
  switch (filterValue) {
    case 'approved':
    case 'disbursed':
      return 'success';
    case 'pending':
    case 'query':
    case 'awaiting_kam_response':
      return 'warning';
    case 'rejected':
      return 'error';
    case 'credit':
    case 'negotiation':
    case 'nbfc':
      return 'info';
    case 'all':
    case 'draft':
    default:
      return 'neutral';
  }
};

const FILTER_TAG_STYLES: Record<string, { base: string; active: string }> = {
  neutral: { base: 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200', active: 'bg-neutral-200 text-neutral-900 border-neutral-300 ring-1 ring-neutral-300' },
  success: { base: 'bg-success/10 text-success border-success/30 hover:bg-success/20', active: 'bg-success/20 text-success border-success/50 ring-1 ring-success/40' },
  warning: { base: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20', active: 'bg-warning/20 text-warning border-warning/50 ring-1 ring-warning/40' },
  error: { base: 'bg-error/10 text-error border-error/30 hover:bg-error/20', active: 'bg-error/20 text-error border-error/50 ring-1 ring-error/40' },
  info: { base: 'bg-info/10 text-info border-info/30 hover:bg-info/20', active: 'bg-info/20 text-info border-info/50 ring-1 ring-info/40' },
};

const URL_STATUS_TO_FILTER: Record<string, string> = {
  draft: 'draft',
  pending_kam_review: 'pending',
  under_kam_review: 'pending',
  forwarded_to_credit: 'credit',
  pending_credit_review: 'credit',
  kam_query_raised: 'query',
  query_with_client: 'query',
  credit_query_raised: 'query',
  credit_query_with_kam: 'query',
  in_negotiation: 'negotiation',
  sent_to_nbfc: 'nbfc',
  approved: 'approved',
  rejected: 'rejected',
  disbursed: 'disbursed',
};

/** Map filter value to URL param (for shareable links and back/forward). Keep in sync with FILTER_TO_RAW_STATUSES and URL_STATUS_TO_FILTER when adding statuses. */
const FILTER_TO_URL_PARAM: Record<string, string> = {
  all: '',
  draft: 'draft',
  pending: 'pending_kam_review',
  query: 'kam_query_raised',
  credit: 'forwarded_to_credit',
  negotiation: 'in_negotiation',
  nbfc: 'sent_to_nbfc',
  approved: 'approved',
  rejected: 'rejected',
  disbursed: 'disbursed',
  awaiting_kam_response: 'credit_query_with_kam',
};

/** Map filter tag value to raw backend status(es). "Pending KAM Review" = under_kam_review only; "Forwarded to Credit" = pending_credit_review. Align with statusUtils and backend statusStateMachine when adding statuses. */
const FILTER_TO_RAW_STATUSES: Record<string, string[]> = {
  draft: ['draft'],
  pending: ['under_kam_review'],
  query: ['kam_query_raised', 'query_with_client', 'credit_query_with_kam', 'credit_query_raised'],
  credit: ['pending_credit_review'],
  negotiation: ['in_negotiation'],
  nbfc: ['sent_to_nbfc'],
  approved: ['approved'],
  rejected: ['rejected'],
  disbursed: ['disbursed'],
};

export const Applications: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const userRole = user?.role || null;
  
  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return '';
  };
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const showUnmappedTab = userRole === 'credit_team' || userRole === 'admin' || userRole === 'kam';
  const [viewTab, setViewTab] = useState<'all' | 'unmapped'>('all');
  const unmappedView = showUnmappedTab && viewTab === 'unmapped';
  const { applications, loading, refetch } = useApplications({ unmapped: unmappedView });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [queryMessage, setQueryMessage] = useState('');
  const [queryCounts, setQueryCounts] = useState<Record<string, { unresolved: number; lastActivity: string | null }>>({});
  const [loadingQueryCounts, setLoadingQueryCounts] = useState(false);
  const [clientFilterDisplayName, setClientFilterDisplayName] = useState<string | null>(null);

  const clientIdFromUrl = searchParams.get('clientId');

  useEffect(() => {
    if (!clientIdFromUrl) {
      setClientFilterDisplayName(null);
      return;
    }
    if (userRole !== 'kam' && userRole !== 'credit_team') return;
    let cancelled = false;
    const resolve = async () => {
      if (userRole === 'kam') {
        const res = await apiService.listClients();
        if (cancelled) return;
        if (res.success && res.data && Array.isArray(res.data)) {
          const c = (res.data as any[]).find(
            (x: any) => (x.id || x['Client ID'] || '') === clientIdFromUrl
          );
          const name = c?.name ?? c?.['Client Name'] ?? c?.['Primary Contact Name'];
          if (name) setClientFilterDisplayName(String(name));
        }
      } else if (userRole === 'credit_team') {
        const res = await apiService.getCreditClient(clientIdFromUrl);
        if (cancelled) return;
        if (res.success && res.data) {
          const d = res.data as any;
          const name = d.name ?? d?.clientName ?? d?.['Client Name'] ?? d?.['Primary Contact Name'];
          if (name) setClientFilterDisplayName(String(name));
        }
      }
    };
    resolve();
    return () => { cancelled = true; };
  }, [clientIdFromUrl, userRole]);

  useEffect(() => {
    const param = searchParams.get('status');
    setStatusFilter(param && URL_STATUS_TO_FILTER[param] ? URL_STATUS_TO_FILTER[param] : 'all');
  }, [searchParams]);

  // Fetch query counts for applications (only for credit_team)
  useEffect(() => {
    if (userRole === 'credit_team' && applications.length > 0 && !loading && !loadingQueryCounts) {
      fetchQueryCounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications.length, userRole]); // Only depend on length and role to avoid infinite loops

  const fetchQueryCounts = async () => {
    if (loadingQueryCounts) return;
    
    setLoadingQueryCounts(true);
    try {
      // Fetch queries for visible applications (first 30 to avoid performance issues)
      const visibleApps = applications.slice(0, 30);
      const counts: Record<string, { unresolved: number; lastActivity: string | null }> = {};
      
      // Fetch queries in parallel for visible applications
      const queryPromises = visibleApps.map(async (app) => {
        try {
          const response = await apiService.getQueries(app.id);
          if (response.success && response.data && Array.isArray(response.data)) {
            const threads = response.data as any[];
            // Count unresolved queries (where isResolved is false)
            const unresolved = threads.filter((thread: any) => 
              thread.isResolved === false || thread.isResolved === undefined
            ).length;
            
            // Find last activity timestamp (most recent reply or root query)
            let lastActivity: string | null = null;
            threads.forEach((thread: any) => {
              const rootTime = thread.rootQuery?.timestamp;
              const replyTimes = (thread.replies || []).map((r: any) => r.timestamp).filter(Boolean) || [];
              const allTimes = [rootTime, ...replyTimes].filter(Boolean);
              if (allTimes.length > 0) {
                const maxTime = allTimes.reduce((max: string, time: string) => {
                  try {
                    return new Date(time) > new Date(max) ? time : max;
                  } catch {
                    return max;
                  }
                });
                if (!lastActivity || new Date(maxTime) > new Date(lastActivity)) {
                  lastActivity = maxTime;
                }
              }
            });
            
            counts[app.id] = { unresolved, lastActivity };
          } else {
            counts[app.id] = { unresolved: 0, lastActivity: null };
          }
        } catch (error) {
          console.error(`Error fetching queries for application ${app.id}:`, error);
          counts[app.id] = { unresolved: 0, lastActivity: null };
        }
      });
      
      await Promise.all(queryPromises);
      setQueryCounts(counts);
    } catch (error) {
      console.error('Error fetching query counts:', error);
    } finally {
      setLoadingQueryCounts(false);
    }
  };

  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Pending KAM Review' },
    { value: 'query', label: 'KAM Query Raised' },
    { value: 'credit', label: 'Forwarded to Credit' },
    { value: 'negotiation', label: 'In Negotiation' },
    { value: 'nbfc', label: 'Sent to NBFC' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'disbursed', label: 'Disbursed' },
    ...(userRole === 'credit_team' ? [{ value: 'awaiting_kam_response', label: 'Awaiting KAM Response' }] : []),
  ];

  // Convert database applications to display format
  const displayApplications = applications.map(app => {
    // Handle webhook data that might have different field structures
    const clientName = app.client?.company_name || 
                      (app as any).client || 
                      (app as any).client_name || 
                      (app as any).form_data?.client_identifier ||
                      'Unknown';
    
    const applicantName = app.applicant_name || 
                         (app as any).performed_by || 
                         (app as any).applicant || 
                         'N/A';
    
    const loanType = app.loan_product?.name || 
                    (app as any).loan_product || 
                    (app as any).loan_type || 
                    (app as any).category || 
                    (app as any).form_data?.category ||
                    'N/A';
    
    const amount = app.requested_loan_amount 
      ? `₹${((app.requested_loan_amount || 0) / 100000).toFixed(2)}L`
      : (app as any).requested_loan_amount 
        ? `₹${((app as any).requested_loan_amount / 100000).toFixed(2)}L`
        : 'N/A';
    
    const queryData = queryCounts[app.id] || { unresolved: 0, lastActivity: null };
    
    return {
      id: app.id || (app as any).id, // Use Airtable record ID for navigation (e.g., recCHVlPoZQYfeKlG)
      fileNumber: app.file_number || (app as any).file_number || (app as any).fileId || app.id, // For display
      clientName: String(clientName),
      applicantName: String(applicantName),
      loanType: String(loanType),
      amount: String(amount),
      status: getStatusDisplayNameForViewer(app.status, userRole || ''),
      lastUpdate: new Date(app.updated_at || app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      rawData: app, // Keep raw data for debugging
      hasUnresolvedQueries: queryData.unresolved > 0,
      unresolvedQueryCount: queryData.unresolved,
      lastQueryTimestamp: queryData.lastActivity,
      rawStatus: app.status, // Keep raw status for filtering
    };
  });

  const filteredData = displayApplications.filter(app => {
    if (clientIdFromUrl) {
      const appClientId = app.rawData?.client_id ?? (app.rawData as any)?.Client ?? (app.rawData as any)?.client;
      const idStr = appClientId != null ? String(appClientId) : '';
      if (idStr !== clientIdFromUrl) return false;
    }

    const matchesSearch = searchQuery === '' ||
      app.fileNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.loanType.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'awaiting_kam_response') {
      matchesStatus = app.rawStatus === 'credit_query_with_kam' ||
                     (app.hasUnresolvedQueries && app.rawStatus !== 'closed');
    } else {
      const rawStatuses = FILTER_TO_RAW_STATUSES[statusFilter];
      const raw = (app.rawStatus || '').toLowerCase();
      if (rawStatuses) {
        matchesStatus = rawStatuses.some(s => s.toLowerCase() === raw);
      } else {
        matchesStatus = app.status.toLowerCase().includes(statusFilter);
      }
    }

    return matchesSearch && matchesStatus;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleRaiseQuery = async () => {
    if (!selectedApplication || !queryMessage.trim()) return;
    try {
      let response;
      if (userRole === 'credit_team') {
        response = await apiService.raiseQueryToKAM(selectedApplication.id, queryMessage.trim());
      } else if (userRole === 'kam') {
        response = await apiService.raiseQueryToClient(selectedApplication.id, queryMessage.trim());
      } else {
        response = await apiService.createClientQuery(selectedApplication.id, queryMessage.trim());
      }
      if (response?.success) {
        setShowQueryModal(false);
        setQueryMessage('');
        setSelectedApplication(null);
        refetch();
      } else {
        alert(response?.error || 'Failed to raise query');
      }
    } catch (error) {
      console.error('Error raising query:', error);
      alert(error instanceof Error ? error.message : 'Failed to raise query');
    }
  };

  const columns: Column<typeof displayApplications[0]>[] = [
    { key: 'fileNumber', label: 'File ID', sortable: true },
    { key: 'clientName', label: 'Client', sortable: true },
    { key: 'applicantName', label: 'Applicant', sortable: true },
    { key: 'loanType', label: 'Loan Type', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right' },
    {
      key: 'status',
      label: 'Status',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <Badge variant={getStatusColor(row.rawStatus ?? '')}>{String(value)}</Badge>
          {userRole === 'credit_team' && row.unresolvedQueryCount > 0 && (
            <Badge variant="warning" className="text-xs">
              {row.unresolvedQueryCount} {row.unresolvedQueryCount === 1 ? 'query' : 'queries'}
            </Badge>
          )}
        </div>
      ),
    },
    { key: 'lastUpdate', label: 'Last Update', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Eye}
            onClick={(e) => {
              e.stopPropagation();
              const id = row.id ?? row.fileNumber;
              if (id && String(id) !== 'undefined') navigate(`/applications/${id}`);
            }}
          >
            View
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={MessageSquare}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedApplication(row);
              setShowQueryModal(true);
            }}
          >
            Query
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="Loan Applications"
      userRole={userRole?.replace('_', ' ').toUpperCase() || 'USER'}
      userName={getUserDisplayName()}
      notificationCount={unreadCount}
      notifications={notifications}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
    >
      {/* Loading State */}
      {loading && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full"></div>
              <div>
                <p className="text-sm text-neutral-600">Loading applications...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data Message */}
      {!loading && applications.length === 0 && (
        <Card className="mb-6 border-warning">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-warning mb-1">
                  {unmappedView ? 'No unmapped applications' : 'No applications found'}
                </p>
                <p className="text-xs text-neutral-600">
                  {unmappedView
                    ? 'Applications not linked to a client or KAM (e.g. input from the backend) will appear under the Unmapped tab.'
                    : 'There are no applications in the backend database.'}
                </p>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={refetch}
                className="ml-4"
              >
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View tabs: All | Unmapped (credit_team, admin, KAM only) */}
      {showUnmappedTab && (
        <div className="mb-4 flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          <button
            type="button"
            onClick={() => setViewTab('all')}
            aria-pressed={viewTab === 'all'}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              viewTab === 'all'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setViewTab('unmapped')}
            aria-pressed={viewTab === 'unmapped'}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              viewTab === 'unmapped'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Unmapped
          </button>
        </div>
      )}

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by File ID, Client, Applicant, or Loan Type..."
              />
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={refetch}
                disabled={loading}
                className={loading ? 'opacity-50 cursor-not-allowed' : ''}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
              <Button variant="primary" icon={Plus} onClick={() => navigate('/applications/new')}>
                New Application
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-neutral-200">
            <span className="text-sm font-medium text-neutral-600 mr-1">Status:</span>
            {statusOptions.map((opt) => {
              const variant = getFilterTagVariant(opt.value);
              const styles = FILTER_TAG_STYLES[variant];
              const isActive = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(opt.value);
                    const urlParam = FILTER_TO_URL_PARAM[opt.value];
                    const next = new URLSearchParams(searchParams);
                    if (urlParam) next.set('status', urlParam);
                    else next.delete('status');
                    setSearchParams(next, { replace: true });
                  }}
                  aria-pressed={isActive}
                  aria-label={`Filter by ${opt.label}`}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? styles.active : styles.base}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Client filter tile: show when filtered by client and allow clear */}
      {clientIdFromUrl && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="text-sm text-neutral-600">
            Client: <strong className="text-neutral-900">
              {filteredData.length > 0
                ? filteredData[0].clientName
                : (clientFilterDisplayName || clientIdFromUrl || 'Client filter active')}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => navigate('/applications', { replace: true })}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
            aria-label="Clear client filter"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Total</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{applications.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Pending</p>
            <p className="text-2xl font-bold text-warning mt-1">
              {applications.filter(a => a.status.includes('pending') || a.status.includes('query')).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Approved</p>
            <p className="text-2xl font-bold text-success mt-1">
              {applications.filter(a => a.status === 'approved').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Disbursed</p>
            <p className="text-2xl font-bold text-brand-secondary mt-1">
              {applications.filter(a => a.status === 'disbursed').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Applications Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>
            {unmappedView ? `Unmapped Applications (${filteredData.length})` : `All Applications (${filteredData.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-neutral-500">Loading applications...</div>
          ) : filteredData.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                {applications.length > 0 ? (
                  <>
                    <p className="text-neutral-600 font-medium mb-1">No applications match the current filters</p>
                    <p className="text-neutral-500 text-sm mb-4">Try clearing search and status filter.</p>
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        navigate('/applications', { replace: true });
                      }}
                    >
                      Clear filters
                    </Button>
                  </>
                ) : unmappedView ? (
                  <>
                    <p className="text-neutral-600 font-medium mb-1">No unmapped applications</p>
                    <p className="text-neutral-500 text-sm mb-4">
                      Applications not linked to a client (or for KAM, not matching any managed client) will appear here—e.g. records input from the backend.
                    </p>
                    <Button variant="tertiary" size="sm" onClick={refetch} className="mt-4">
                      Refresh
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-neutral-500">No applications found</p>
                    <Button variant="tertiary" size="sm" onClick={refetch} className="mt-4">
                      Refresh Data
                    </Button>
                  </>
                )}
              </div>
          ) : (
          <DataTable
            columns={columns}
            data={filteredData}
            keyExtractor={(row) => row.id}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={(row) => {
              const id = row.id ?? row.fileNumber;
              if (id && String(id) !== 'undefined') navigate(`/applications/${id}`);
            }}
            rowTestId="application-row"
            getRowClassName={(row) => {
              if (userRole === 'credit_team' && row.hasUnresolvedQueries) {
                return 'bg-warning/5 border-l-4 border-warning';
              }
              return '';
            }}
          />
          )}
        </CardContent>
      </Card>

      {/* Query Modal */}
      <Modal
        isOpen={showQueryModal}
        onClose={() => {
          setShowQueryModal(false);
          setQueryMessage('');
          setSelectedApplication(null);
        }}
        size="md"
      >
        <ModalHeader onClose={() => setShowQueryModal(false)}>
          Raise Query - File #{selectedApplication?.id}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-neutral-50 p-3 rounded">
              <p className="text-sm text-neutral-700">
                <span className="font-medium">Client:</span> {selectedApplication?.clientName}
              </p>
              <p className="text-sm text-neutral-700 mt-1">
                <span className="font-medium">Applicant:</span> {selectedApplication?.applicantName}
              </p>
              <p className="text-sm text-neutral-700 mt-1">
                <span className="font-medium">Loan Type:</span> {selectedApplication?.loanType}
              </p>
            </div>
            <TextArea
              label="Query Message"
              placeholder="Enter your query or request for additional information..."
              value={queryMessage}
              onChange={(e) => setQueryMessage(e.target.value)}
              required
              rows={6}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => {
              setShowQueryModal(false);
              setQueryMessage('');
              setSelectedApplication(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleRaiseQuery}
            disabled={!queryMessage.trim()}
          >
            Send Query
          </Button>
        </ModalFooter>
      </Modal>
    </MainLayout>
  );
};
