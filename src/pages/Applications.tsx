import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { PageHero } from '../components/layout/PageHero';
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
import { getStatusDisplayNameForViewer, getStatusColor, normalizeStatus } from '../lib/statusUtils';
import {
  buildStatusCatalogForApplications,
  statusOrderMapFromCatalog,
  type LoanProductWithStatuses,
} from '../lib/applicationsStatusCatalog';

const FILTER_TAG_STYLES: Record<string, { base: string; active: string }> = {
  neutral: { base: 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200', active: 'bg-neutral-200 text-neutral-900 border-neutral-300 ring-1 ring-neutral-300' },
  success: { base: 'bg-success/10 text-success border-success/30 hover:bg-success/20', active: 'bg-success/20 text-success border-success/50 ring-1 ring-success/40' },
  warning: { base: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20', active: 'bg-warning/20 text-warning border-warning/50 ring-1 ring-warning/40' },
  error: { base: 'bg-error/10 text-error border-error/30 hover:bg-error/20', active: 'bg-error/20 text-error border-error/50 ring-1 ring-error/40' },
  info: { base: 'bg-info/10 text-info border-info/30 hover:bg-info/20', active: 'bg-info/20 text-info border-info/50 ring-1 ring-info/40' },
};

function getStatusChipVariant(_key: string, index: number): keyof typeof FILTER_TAG_STYLES {
  const cycle: (keyof typeof FILTER_TAG_STYLES)[] = ['neutral', 'info', 'warning'];
  return cycle[index % cycle.length];
}

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
  const [loanProducts, setLoanProducts] = useState<LoanProductWithStatuses[]>([]);
  const [loadingLoanProducts, setLoadingLoanProducts] = useState(true);
  const [productFilterId, setProductFilterId] = useState('');
  const [selectedStatusKeys, setSelectedStatusKeys] = useState<string[]>([]);

  const statusInQuery = useMemo(
    () => (selectedStatusKeys.length > 0 ? [...selectedStatusKeys].sort().join(',') : undefined),
    [selectedStatusKeys]
  );

  const { applications, loading, refetch } = useApplications({
    unmapped: unmappedView,
    loanProductId: productFilterId || undefined,
    statusIn: statusInQuery,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [queryMessage, setQueryMessage] = useState('');
  const [queryCounts, setQueryCounts] = useState<Record<string, { unresolved: number; lastActivity: string | null }>>({});
  const [loadingQueryCounts, setLoadingQueryCounts] = useState(false);
  const [submittingQuery, setSubmittingQuery] = useState(false);
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
          const name = c?.clientName ?? c?.name ?? c?.['Client Name'] ?? c?.['Primary Contact Name'];
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
    let cancelled = false;
    (async () => {
      setLoadingLoanProducts(true);
      try {
        const res = await apiService.listLoanProducts(true);
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          setLoanProducts(res.data as LoanProductWithStatuses[]);
        } else {
          setLoanProducts([]);
        }
      } catch {
        if (!cancelled) setLoanProducts([]);
      } finally {
        if (!cancelled) setLoadingLoanProducts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchParams.has('productId')) {
      setProductFilterId(searchParams.get('productId') ?? '');
    }
    if (searchParams.has('statuses')) {
      const st = searchParams.get('statuses');
      setSelectedStatusKeys(
        st ? st.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : []
      );
    }
  }, [searchParams]);

  const updateFilterUrl = useCallback(
    (nextProductId: string, nextStatuses: string[]) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextProductId) next.set('productId', nextProductId);
          else next.delete('productId');
          if (nextStatuses.length > 0) next.set('statuses', nextStatuses.join(','));
          else next.delete('statuses');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

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

  const statusCatalog = useMemo(
    () => buildStatusCatalogForApplications(loanProducts, productFilterId || null, userRole),
    [loanProducts, productFilterId, userRole]
  );

  const statusOrderMap = useMemo(() => statusOrderMapFromCatalog(statusCatalog), [statusCatalog]);

  const statusLabelByKey = useMemo(
    () => new Map(statusCatalog.map((e) => [e.key, e.label])),
    [statusCatalog]
  );

  const displayApplications = useMemo(() => {
    return applications.map((app) => {
      const clientName =
        app.client?.company_name ||
        (app as any).client ||
        (app as any).client_name ||
        (app as any).form_data?.client_identifier ||
        'Unknown';

      const applicantName =
        app.applicant_name || (app as any).performed_by || (app as any).applicant || 'N/A';

      const loanType =
        app.loan_product?.name ||
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
      const nk = normalizeStatus(app.status);

      return {
        id: app.id || (app as any).id,
        fileNumber: app.file_number || (app as any).file_number || (app as any).fileId || app.id,
        clientName: String(clientName),
        applicantName: String(applicantName),
        loanType: String(loanType),
        amount: String(amount),
        status:
          statusLabelByKey.get(nk) ?? getStatusDisplayNameForViewer(app.status, userRole || ''),
        lastUpdate: new Date(app.updated_at || app.created_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        rawData: app,
        hasUnresolvedQueries: queryData.unresolved > 0,
        unresolvedQueryCount: queryData.unresolved,
        lastQueryTimestamp: queryData.lastActivity,
        rawStatus: app.status,
      };
    });
  }, [applications, queryCounts, statusLabelByKey, userRole]);

  const filteredData = useMemo(() => {
    return displayApplications.filter((app) => {
      if (clientIdFromUrl) {
        const appClientId =
          app.rawData?.client_id ?? (app.rawData as any)?.Client ?? (app.rawData as any)?.client;
        const idStr = appClientId != null ? String(appClientId) : '';
        if (idStr !== clientIdFromUrl) return false;
      }

      const matchesSearch =
        searchQuery === '' ||
        app.fileNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.loanType.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [displayApplications, clientIdFromUrl, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    const mult = sortDirection === 'asc' ? 1 : -1;
    const rows = [...filteredData];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'fileNumber':
          cmp = String(a.fileNumber).localeCompare(String(b.fileNumber));
          break;
        case 'clientName':
          cmp = String(a.clientName).localeCompare(String(b.clientName));
          break;
        case 'applicantName':
          cmp = String(a.applicantName).localeCompare(String(b.applicantName));
          break;
        case 'loanType':
          cmp = String(a.loanType).localeCompare(String(b.loanType));
          break;
        case 'amount':
          cmp = String(a.amount).localeCompare(String(b.amount), undefined, { numeric: true });
          break;
        case 'status': {
          const oa = statusOrderMap.get(normalizeStatus(a.rawStatus ?? '')) ?? 99999;
          const ob = statusOrderMap.get(normalizeStatus(b.rawStatus ?? '')) ?? 99999;
          cmp = oa - ob;
          if (cmp === 0) cmp = String(a.status).localeCompare(String(b.status));
          break;
        }
        case 'lastUpdate': {
          const ta = new Date((a.rawData as { updated_at?: string; created_at?: string })?.updated_at ?? 0).getTime();
          const tb = new Date((b.rawData as { updated_at?: string; created_at?: string })?.updated_at ?? 0).getTime();
          cmp = ta - tb;
          break;
        }
        default:
          return 0;
      }
      return cmp * mult;
    });
    return rows;
  }, [filteredData, sortColumn, sortDirection, statusOrderMap]);

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
    setSubmittingQuery(true);
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
    } finally {
      setSubmittingQuery(false);
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
      <PageHero title="Loan Applications" />
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
          <div className="flex flex-col gap-3 pt-3 mt-1 border-t border-neutral-200">
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="applications-product-filter" className="text-sm font-medium text-neutral-600">
                Loan product:
              </label>
              <select
                id="applications-product-filter"
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 min-w-[12rem]"
                value={productFilterId}
                disabled={loadingLoanProducts}
                onChange={(e) => {
                  const v = e.target.value;
                  setProductFilterId(v);
                  updateFilterUrl(v, selectedStatusKeys);
                }}
              >
                <option value="">All products</option>
                {loanProducts.map((p) => {
                  const id = String(p.productId ?? p.id ?? '');
                  const label = String(p.productName ?? p['Product Name'] ?? p.name ?? id);
                  return (
                    <option key={p.id ?? id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {loadingLoanProducts && (
                <span className="text-xs text-neutral-500">Loading products…</span>
              )}
            </div>
            {statusCatalog.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-neutral-600 mr-1">Status:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatusKeys([]);
                    updateFilterUrl(productFilterId, []);
                  }}
                  aria-pressed={selectedStatusKeys.length === 0}
                  aria-label="Show all statuses"
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedStatusKeys.length === 0
                      ? FILTER_TAG_STYLES.neutral.active
                      : FILTER_TAG_STYLES.neutral.base
                  }`}
                >
                  All
                </button>
                {statusCatalog.map((opt, idx) => {
                  const variant = getStatusChipVariant(opt.key, idx);
                  const styles = FILTER_TAG_STYLES[variant];
                  const isActive = selectedStatusKeys.includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setSelectedStatusKeys((prev) => {
                          const next = prev.includes(opt.key)
                            ? prev.filter((k) => k !== opt.key)
                            : [...prev, opt.key];
                          updateFilterUrl(productFilterId, next);
                          return next;
                        });
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Client filter tile: show when filtered by client and allow clear */}
      {clientIdFromUrl && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="text-sm text-neutral-600">
            Client: <strong className="text-neutral-900">
              {sortedData.length > 0
                ? sortedData[0].clientName
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
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-6">
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
      </div>

      {/* Applications Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>
            {unmappedView ? `Unmapped Applications (${sortedData.length})` : `All Applications (${sortedData.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-neutral-500">Loading applications...</div>
          ) : sortedData.length === 0 ? (
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
                        setProductFilterId('');
                        setSelectedStatusKeys([]);
                        setSearchParams((prev) => {
                          const n = new URLSearchParams(prev);
                          n.delete('productId');
                          n.delete('statuses');
                          return n;
                        }, { replace: true });
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
            data={sortedData}
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
            disabled={!queryMessage.trim() || submittingQuery}
            loading={submittingQuery}
          >
            Send Query
          </Button>
        </ModalFooter>
      </Modal>
    </MainLayout>
  );
};
