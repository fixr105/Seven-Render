import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Users,
  Clock,
  ArrowRight,
  Plus,
  AlertCircle,
  RefreshCw,
  Sparkles,
  FileText,
  TrendingUp,
  Percent,
} from 'lucide-react';
import { useApplications } from '../../hooks/useApplications';
import { apiService } from '../../services/api';
import { useState, useEffect } from 'react';
import { RecentApplicationsSection } from '../../components/dashboard/RecentApplicationsSection';
import type { DashboardSummary } from '../../services/api';

type ClientWithMetrics = NonNullable<DashboardSummary['clients']>[number];
type Summary = NonNullable<DashboardSummary['summary']>;

function getClientDisplayName(client: ClientWithMetrics): string {
  const name = (client.name ?? '').trim();
  if (name) return name;
  if (client.id) return `Client ${client.id.slice(-8)}`;
  return 'Unknown';
}

export const KAMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { applications, loading, refetch } = useApplications();
  const [dashboardData, setDashboardData] = useState<{
    clients: ClientWithMetrics[];
    summary: Summary | null;
    pendingQueries: Array<{ id: string; fileId: string; applicationId?: string; message: string }>;
  }>({ clients: [], summary: null, pendingQueries: [] });
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setDashboardLoading(true);
      setDashboardError(null);
      const res = await apiService.getKAMDashboard();
      if (res.success && res.data) {
        const data = res.data;
        setDashboardData({
          clients: data.clients ?? [],
          summary: data.summary ?? null,
          pendingQueries: data.pendingQuestionsFromCredit ?? [],
        });
      } else {
        setDashboardData({ clients: [], summary: null, pendingQueries: [] });
        setDashboardError(res.error ?? 'Failed to load dashboard');
      }
    } catch (e: any) {
      setDashboardData({ clients: [], summary: null, pendingQueries: [] });
      setDashboardError(e?.message ?? 'Failed to load dashboard');
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    const handleFocus = () => fetchDashboard();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const { clients, summary, pendingQueries } = dashboardData;
  const totalClients = summary?.totalClients ?? clients.length;
  const totalFiles = summary?.totalFiles ?? clients.reduce((s, c) => s + c.totalFiles, 0);
  const filesLast30Days = summary?.filesLast30Days ?? clients.reduce((s, c) => s + c.filesLast30Days, 0);
  const pendingReview = summary?.pendingReview ?? 0;
  const awaitingResponse = summary?.awaitingResponse ?? 0;
  const forwarded = summary?.forwarded ?? 0;
  const approvalRate = summary?.approvalRate ?? null;

  return (
    <>
      {/* Your clients – summary tiles (client-first) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Your clients</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{totalClients}</p>
              <p className="text-xs text-neutral-500 mt-1">Managed clients</p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-brand-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Total files</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{totalFiles}</p>
              <p className="text-xs text-neutral-500 mt-1">All time</p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-brand-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Files uploaded</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{filesLast30Days}</p>
              <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Last 30 days
              </p>
            </div>
            <div className="w-12 h-12 bg-info/10 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-info" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Performance</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                {approvalRate !== null ? `${approvalRate}%` : '—'}
              </p>
              <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                <Percent className="w-3 h-3" />
                Approval rate
              </p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
              <Percent className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

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
                    onClick={() => {
                      const id = q.applicationId ?? q.fileId;
                      if (id && String(id) !== 'undefined') navigate(`/applications/${id}`);
                    }}
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
              <p className="text-xs text-neutral-500 mt-1">{totalFiles} total files</p>
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
          <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={() => { refetch(); fetchDashboard(); }}>
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
          {dashboardLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-neutral-500">Loading clients...</p>
            </div>
          ) : dashboardError ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
              <p className="text-error font-medium mb-2">Error Loading Dashboard</p>
              <p className="text-neutral-600 text-sm mb-4">{dashboardError}</p>
              <Button variant="primary" onClick={fetchDashboard}>
                Retry
              </Button>
            </div>
          ) : clients.length === 0 ? (
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
              {clients.map((client) => {
                const displayName = getClientDisplayName(client);
                const initial = displayName.charAt(0).toUpperCase();
                const showInitial = /[A-Z0-9]/.test(initial) ? initial : '?';
                const hasFiles = client.totalFiles > 0;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => navigate(`/applications?clientId=${encodeURIComponent(client.id)}`)}
                    className="p-4 border border-neutral-200 rounded-lg hover:border-brand-primary transition-colors text-left w-full"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-10 h-10 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center text-lg font-semibold flex-shrink-0"
                        aria-hidden
                      >
                        {showInitial}
                      </div>
                      <h4 className="font-semibold text-neutral-900 truncate">{displayName}</h4>
                    </div>
                    {hasFiles ? (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Total files</span>
                          <span className="font-medium">{client.totalFiles}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Last 30 days</span>
                          <span className="font-medium">{client.filesLast30Days}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Pending review</span>
                          <Badge variant={client.pendingReview > 0 ? 'warning' : 'neutral'}>{client.pendingReview}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Awaiting response</span>
                          <Badge variant={client.awaitingResponse > 0 ? 'warning' : 'neutral'}>{client.awaitingResponse}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Forwarded to credit</span>
                          <span className="font-medium">{client.forwarded}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Approved / Rejected</span>
                          <span className="font-medium">
                            {client.approved} / {client.rejected}
                            {client.approvalRate !== null ? ` (${client.approvalRate}%)` : ''}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500 mb-2">No files yet</p>
                    )}
                    <p className="text-xs text-brand-primary font-medium mt-2 flex items-center gap-1">
                      View applications
                      <ArrowRight className="w-3.5 h-3.5" />
                    </p>
                  </button>
                );
              })}
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
        onRowClick={(row) => {
          const id = row.id ?? row.applicationId ?? row.fileId;
          if (id && String(id) !== 'undefined') navigate(`/applications/${id}`);
        }}
        onEmptyAction={() => navigate('/clients')}
      />
    </>
  );
};


