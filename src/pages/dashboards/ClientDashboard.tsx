import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Plus, FileText, Clock, CheckCircle, DollarSign, AlertCircle, TrendingUp } from 'lucide-react';
import { useApplications } from '../../hooks/useApplications';
import { useLedger } from '../../hooks/useLedger';
import { useNotifications } from '../../hooks/useNotifications';

interface ApplicationRow {
  id: string;
  fileNumber: string;
  loanType: string;
  amount: string;
  status: string;
  lastUpdate: string;
}

export const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { applications, loading } = useApplications();
  const { balance, loading: ledgerLoading } = useLedger();
  const { unreadCount } = useNotifications();

  // Calculate stats
  const totalApplications = applications.length;
  const drafts = applications.filter(a => a.status === 'draft').length;
  const pendingReview = applications.filter(a => a.status === 'pending_kam_review' || a.status === 'kam_query_raised').length;
  const approved = applications.filter(a => a.status === 'approved' || a.status === 'disbursed').length;
  const pendingQueries = applications.filter(a => a.status === 'kam_query_raised' || a.status === 'credit_query_raised').length;

  // Format table data
  const tableData: ApplicationRow[] = applications.slice(0, 5).map(app => ({
    id: app.id,
    fileNumber: app.file_number || `SF${app.id.slice(0, 8)}`,
    loanType: app.loan_product?.name || 'N/A',
    amount: `₹${((app.requested_loan_amount || 0) / 100000).toFixed(2)}L`,
    status: app.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    lastUpdate: new Date(app.updated_at || app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  }));

  const getStatusVariant = (status: string) => {
    if (status.toLowerCase().includes('approved') || status.toLowerCase().includes('disbursed')) return 'success';
    if (status.toLowerCase().includes('query') || status.toLowerCase().includes('pending')) return 'warning';
    if (status.toLowerCase().includes('rejected')) return 'error';
    return 'neutral';
  };

  const columns: Column<ApplicationRow>[] = [
    { key: 'fileNumber', label: 'File ID', sortable: true },
    { key: 'loanType', label: 'Loan Type', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, align: 'right' },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <Badge variant={getStatusVariant(value)}>{value}</Badge>,
    },
    { key: 'lastUpdate', label: 'Last Update', sortable: true },
  ];

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Total Applications</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{totalApplications}</p>
              <p className="text-xs text-neutral-500 mt-1">{drafts} drafts saved</p>
            </div>
            <div className="w-12 h-12 bg-[#332f78]/20 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-brand-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Pending Review</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{pendingReview}</p>
              {pendingQueries > 0 && (
                <p className="text-xs text-warning mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {pendingQueries} queries need response
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Approved</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{approved}</p>
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {totalApplications > 0 ? Math.round((approved / totalApplications) * 100) : 0}% approval rate
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex-1">
              <p className="text-sm text-neutral-500">Commission Balance</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                ₹{ledgerLoading ? '...' : (balance / 1000).toFixed(1)}K
              </p>
              {balance > 0 && (
                <Button
                  variant="tertiary"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => navigate('/ledger')}
                >
                  Request Payout
                </Button>
              )}
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-brand-secondary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Center */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Action Center</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => navigate('/applications/new')}
            >
              New Application
            </Button>
            {drafts > 0 && (
              <Button variant="secondary" onClick={() => navigate('/applications?status=draft')}>
                View Drafts ({drafts})
              </Button>
            )}
            {pendingQueries > 0 && (
              <Button variant="secondary" onClick={() => navigate('/applications?queries=true')}>
                Respond to Queries ({pendingQueries})
              </Button>
            )}
            {balance > 0 && (
              <Button variant="secondary" onClick={() => navigate('/ledger')}>
                Request Payout
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Queries Alert */}
      {pendingQueries > 0 && (
        <Card className="mb-6 border-warning bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-warning" />
              <div className="flex-1">
                <p className="font-semibold text-neutral-900">
                  {pendingQueries} {pendingQueries === 1 ? 'query requires' : 'queries require'} your response
                </p>
                <p className="text-sm text-neutral-600 mt-1">
                  Please review and respond to queries to keep your applications moving forward.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => navigate('/applications?queries=true')}>
                View Queries
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Recent Applications</CardTitle>
          <Button variant="tertiary" size="sm" onClick={() => navigate('/applications')}>
            View All
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-neutral-500">Loading applications...</div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 mb-4">No applications yet</p>
              <Button variant="primary" icon={Plus} onClick={() => navigate('/applications/new')}>
                Create Your First Application
              </Button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={tableData}
              keyExtractor={(row) => row.id}
              onRowClick={(row) => navigate(`/applications/${row.id}`)}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
};


