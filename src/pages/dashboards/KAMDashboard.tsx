import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Users, Clock, ArrowRight, Plus, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useApplications } from '../../hooks/useApplications';
import { apiService } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';
import { useState, useEffect } from 'react';
import { RecentApplicationsSection } from '../../components/dashboard/RecentApplicationsSection';

interface ClientStats {
  id: string;
  name: string;
  totalFiles: number;
  pendingReview: number;
  awaitingResponse: number;
}

export const KAMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRoleId = user?.kamId || user?.id || null;
  const { applications, loading, refetch } = useApplications();
  const [clients, setClients] = useState<ClientStats[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [pendingQueries, setPendingQueries] = useState<Array<{ id: string; fileId: string; applicationId?: string; message: string }>>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Fetch KAM dashboard (pending queries) on mount and refresh
  const fetchDashboard = async () => {
    try {
      setDashboardLoading(true);
      const res = await apiService.getKAMDashboard();
      if (res.success && res.data?.pendingQuestionsFromCredit) {
        setPendingQueries(res.data.pendingQuestionsFromCredit);
      } else {
        setPendingQueries([]);
      }
    } catch {
      setPendingQueries([]);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Refetch dashboard when tab/window regains focus (e.g. after KAM updates status and returns)
  useEffect(() => {
    const handleFocus = () => fetchDashboard();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Fetch on mount (including SPA navigation) and via Refresh when userRoleId is available.
  useEffect(() => {
    if (userRoleId) {
      fetchClients();
    } else {
      setLoadingClients(false);
      setClients([]);
      setClientsError('KAM ID not found. Please contact support.');
    }
  }, []);

  const fetchClients = async () => {
    if (!userRoleId) {
      setClientsError('KAM ID not found. Please contact support.');
      setLoadingClients(false);
      return;
    }
    try {
      setLoadingClients(true);
      setClientsError(null);
      // Use API service to fetch clients
      const response = await apiService.listClients();
      
      if (response.success && response.data) {
        const clientsData = response.data as any[];
        if (clientsData.length === 0) {
          setClients([]);
          setClientsError(null);
        } else {
          const clientStats = clientsData.map((client: any) => {
            const clientId = client.id || client['Client ID'];
            const clientApps = applications.filter(a => {
              const appClientId = a.client_id || (a as any).Client;
              return appClientId === clientId;
            });
            return {
              id: clientId,
              name: client.name || client['Client Name'] || client['Primary Contact Name'] || '',
              totalFiles: clientApps.length,
              pendingReview: clientApps.filter(a => a.status === 'pending_kam_review' || a.status === 'under_kam_review').length,
              awaitingResponse: clientApps.filter(a => a.status === 'kam_query_raised' || a.status === 'query_with_client').length,
            };
          });
          setClients(clientStats);
        }
      } else {
        const errorMessage = response.error || 'Failed to fetch clients. Please try again or contact support.';
        setClientsError(errorMessage);
        console.error('Error fetching clients:', response.error);
        setClients([]);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred. Please try again or contact support.';
      setClientsError(errorMessage);
      console.error('Exception in fetchClients:', error);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  };

  // Calculate stats
  const totalClients = clients.length;
  const pendingReview = applications.filter(a => a.status === 'under_kam_review').length;
  const awaitingResponse = applications.filter(a => a.status === 'query_with_client').length;
  const forwarded = applications.filter(a => a.status === 'pending_credit_review').length;

  return (
    <>
      {/* New files highlight */}
      {pendingReview > 0 && (
        <Card className="mb-6 border-warning/30 bg-warning/5">
          <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-neutral-800">
              You have {pendingReview} new file{pendingReview !== 1 ? 's' : ''} from clients awaiting your review.
            </p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/applications?status=pending_kam_review')}>
              Review new files
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Queries (from Client or Credit) */}
      {!dashboardLoading && pendingQueries.length > 0 && (
        <Card id="pending-queries" className="mb-6 border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              Pending Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600 mb-3">
              {pendingQueries.length} query{pendingQueries.length !== 1 ? 'ies' : ''} from clients or credit awaiting your response.
            </p>
            <ul className="space-y-2">
              {pendingQueries.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/applications/${q.applicationId || q.fileId}`)}
                    className="text-sm font-medium text-brand-primary hover:underline"
                  >
                    {q.fileId}
                  </button>
                  {q.message && (
                    <span className="text-neutral-500 ml-2">
                      — {String(q.message).slice(0, 80)}{String(q.message).length > 80 ? '…' : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Managed Clients</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{totalClients}</p>
              <p className="text-xs text-neutral-500 mt-1">{applications.length} total files</p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-brand-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Pending Review</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{pendingReview}</p>
              <p className="text-xs text-warning mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Needs your attention
              </p>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Awaiting Client</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{awaitingResponse}</p>
              <p className="text-xs text-info mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Queries raised
              </p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Forwarded to Credit</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{forwarded}</p>
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                In credit review
              </p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Center */}
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Action Center</CardTitle>
          <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={() => { refetch(); fetchClients(); fetchDashboard(); }}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => navigate('/clients')}
              title="Onboard a new client"
            >
              Onboard New Client
            </Button>
            {pendingReview > 0 && (
              <Button variant="secondary" onClick={() => navigate('/applications?status=pending_kam_review')} title="Review new files from clients">
                Review New Files ({pendingReview})
              </Button>
            )}
            {awaitingResponse > 0 && (
              <Button variant="secondary" onClick={() => navigate('/applications?status=kam_query_raised')} title="Files awaiting client response">
                Files Awaiting Response ({awaitingResponse})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI features hint */}
      <Card className="mb-6 border-brand-primary/20 bg-brand-primary/5">
        <CardContent className="py-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-brand-primary flex-shrink-0" />
          <p className="text-sm text-neutral-700">
            View or generate <strong>AI summaries</strong> on any application — open an application and use the AI File Summary section.
          </p>
          <Button variant="tertiary" size="sm" onClick={() => navigate('/applications')}>
            Applications
          </Button>
        </CardContent>
      </Card>

      {/* Client Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Client Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingClients ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-neutral-500">Loading clients...</p>
            </div>
          ) : clientsError ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
              <p className="text-error font-medium mb-2">Error Loading Clients</p>
              <p className="text-neutral-600 text-sm mb-4">{clientsError}</p>
              <Button variant="primary" onClick={fetchClients}>
                Retry
              </Button>
            </div>
          ) : totalClients === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-600 font-medium mb-2">No Clients Assigned</p>
              <p className="text-neutral-500 text-sm mb-4">
                You don't have any clients assigned to you yet. Please contact your administrator to get clients assigned.
              </p>
              <Button variant="primary" icon={Plus} onClick={() => navigate('/clients')}>
                Onboard Your First Client
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => (
                <div key={client.id} className="p-4 border border-neutral-200 rounded-lg hover:border-brand-primary transition-colors">
                  <h4 className="font-semibold text-neutral-900 mb-2">{client.name}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Total Files:</span>
                      <span className="font-medium">{client.totalFiles}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Pending Review:</span>
                      <Badge variant={client.pendingReview > 0 ? 'warning' : 'neutral'}>{client.pendingReview}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Awaiting Response:</span>
                      <Badge variant={client.awaitingResponse > 0 ? 'warning' : 'neutral'}>{client.awaitingResponse}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Applications */}
      <RecentApplicationsSection
        role="kam"
        applications={applications}
        loading={loading}
        onViewAll={() => navigate('/applications')}
        onRowClick={(row) => navigate(`/applications/${row.id}`)}
        onEmptyAction={() => navigate('/clients')}
      />
    </>
  );
};


