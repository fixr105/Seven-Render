import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { FileText, Clock, DollarSign, AlertCircle, Send, Sparkles, AlertTriangle, BarChart3 } from 'lucide-react';
import { useApplications } from '../../hooks/useApplications';
import { useLedger } from '../../hooks/useLedger';
import { apiService } from '../../services/api';
import { RecentApplicationsSection } from '../../components/dashboard/RecentApplicationsSection';

interface SlaPastDueItem {
  fileId: string;
  applicationId?: string;
  sentAt: string;
  daysPastSLA: number;
}

export const CreditDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { applications, loading } = useApplications();
  const { payoutRequests } = useLedger();
  const [slaPastDue, setSlaPastDue] = useState<SlaPastDueItem[]>([]);
  const [slaLoading, setSlaLoading] = useState(true);
  const [pendingQueries, setPendingQueries] = useState<Array<{ id: string; fileId: string; applicationId?: string; message: string }>>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiService.getCreditSlaPastDue().then((res) => {
      if (cancelled) return;
      setSlaLoading(false);
      if (res.success && res.data?.items) setSlaPastDue(res.data.items);
    }).catch(() => { if (!cancelled) setSlaLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const fetchDashboard = () => {
    apiService.getCreditDashboard().then((res) => {
      setDashboardLoading(false);
      if (res.success && res.data?.pendingQueries) setPendingQueries(res.data.pendingQueries);
      else setPendingQueries([]);
    }).catch(() => setDashboardLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setDashboardLoading(true);
    apiService.getCreditDashboard().then((res) => {
      if (cancelled) return;
      setDashboardLoading(false);
      if (res.success && res.data?.pendingQueries) setPendingQueries(res.data.pendingQueries);
      else setPendingQueries([]);
    }).catch(() => { if (!cancelled) setDashboardLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Refetch dashboard when tab/window regains focus
  useEffect(() => {
    const handleFocus = () => fetchDashboard();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Calculate stats
  const totalApplications = applications.length;
  const pendingReview = applications.filter(a => 
    a.status === 'pending_credit_review' || a.status === 'credit_query_with_kam'
  ).length;
  const inNegotiation = applications.filter(a => a.status === 'in_negotiation').length;
  const sentToNBFC = applications.filter(a => a.status === 'sent_to_nbfc').length;
  const approved = applications.filter(a => a.status === 'approved' || a.status === 'disbursed').length;
  const pendingPayouts = payoutRequests.filter((p: any) => p.status === 'pending').length;

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card
          className={slaPastDue.length > 0 ? 'cursor-pointer hover:shadow-level-2 transition-shadow' : ''}
          onClick={() => slaPastDue.length > 0 && document.getElementById('sla-past-due')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Past SLA</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{slaPastDue.length}</p>
              <p className="text-xs text-warning mt-1">Need follow-up</p>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Total Applications</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{totalApplications}</p>
              <p className="text-xs text-neutral-500 mt-1">Platform-wide</p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-brand-primary" />
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
                Requires attention
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
              <p className="text-sm text-neutral-500">In Negotiation</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{inNegotiation}</p>
              <p className="text-xs text-info mt-1 flex items-center gap-1">
                <Send className="w-3 h-3" />
                {sentToNBFC} sent to lenders
                {slaPastDue.length > 0 && (
                  <Badge variant="error" className="ml-1">{slaPastDue.length} past SLA</Badge>
                )}
              </p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center">
              <Send className="w-6 h-6 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Payout Requests</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{pendingPayouts}</p>
              <p className="text-xs text-neutral-500 mt-1">
                {pendingPayouts > 0 ? `${pendingPayouts} pending approval` : 'None pending'}
              </p>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Past SLA – Follow up with NBFC */}
      {!slaLoading && slaPastDue.length > 0 && (
        <Card id="sla-past-due" className="mb-6 border-warning/30 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Follow up with NBFC (Past SLA)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-600 mb-3">
              {slaPastDue.length} file(s) sent to NBFC over 7 days ago — consider following up.
            </p>
            <ul className="space-y-2">
              {slaPastDue.map((item) => (
                <li key={item.fileId}>
                  <button
                    type="button"
                    onClick={() => {
                      const id = item.applicationId ?? item.fileId;
                      if (id && String(id) !== 'undefined') navigate(`/applications/${id}`);
                    }}
                    className="text-sm font-medium text-brand-primary hover:underline"
                  >
                    {item.fileId}
                  </button>
                  <span className="text-neutral-500 ml-2">
                    — {item.daysPastSLA} day(s) past SLA
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Pending Queries */}
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
              {pendingQueries.length} query{pendingQueries.length !== 1 ? 'ies' : ''} requiring your attention.
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

      {/* Action Center */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Action Center</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {pendingReview > 0 && (
              <Button variant="primary" onClick={() => navigate('/applications?status=pending_credit_review')} title="Review files forwarded to credit">
                Review Files ({pendingReview})
              </Button>
            )}
            {pendingPayouts > 0 && (
              <Button variant="secondary" onClick={() => navigate('/ledger')} title="Process payout requests">
                Process Payouts ({pendingPayouts})
              </Button>
            )}
            {inNegotiation > 0 && (
              <Button variant="secondary" onClick={() => navigate('/applications?status=in_negotiation')} title="Files in negotiation with NBFCs">
                Files in Negotiation ({inNegotiation})
              </Button>
            )}
            {slaPastDue.length > 0 && (
              <Button variant="secondary" onClick={() => navigate('/applications?status=sent_to_nbfc')} title="Follow up on files past SLA">
                Follow up Sent to NBFC ({slaPastDue.length} past SLA)
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/clients')} title="Manage clients">
              Manage Clients
            </Button>
            <Button variant="secondary" onClick={() => navigate('/form-configuration')} title="Configure document checklists per client">
              Configure Client Forms
            </Button>
            <Button variant="secondary" icon={BarChart3} onClick={() => navigate('/reports')} title="Generate daily summary report">
              Generate Report
            </Button>
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

      {/* Pipeline Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pipeline Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border border-neutral-200 rounded-lg">
              <p className="text-2xl font-bold text-neutral-900">{pendingReview}</p>
              <p className="text-sm text-neutral-500 mt-1">Pending Review</p>
            </div>
            <div className="text-center p-4 border border-neutral-200 rounded-lg">
              <p className="text-2xl font-bold text-neutral-900">{inNegotiation}</p>
              <p className="text-sm text-neutral-500 mt-1">In Negotiation</p>
            </div>
            <div className="text-center p-4 border border-neutral-200 rounded-lg">
              <p className="text-2xl font-bold text-neutral-900">{sentToNBFC}</p>
              <p className="text-sm text-neutral-500 mt-1">With Lenders</p>
            </div>
            <div className="text-center p-4 border border-neutral-200 rounded-lg">
              <p className="text-2xl font-bold text-success">{approved}</p>
              <p className="text-sm text-neutral-500 mt-1">Approved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Applications */}
      <RecentApplicationsSection
        role="credit"
        applications={applications}
        loading={loading}
        onViewAll={() => navigate('/applications')}
        onRowClick={(row) => {
          const id = row.id ?? row.applicationId ?? row.fileId;
          if (id && String(id) !== 'undefined') navigate(`/applications/${id}`);
        }}
      />
    </>
  );
};


