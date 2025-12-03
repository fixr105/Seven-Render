import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FileText, Clock, DollarSign, CheckCircle, AlertCircle, Users, TrendingUp, Send } from 'lucide-react';
import { useApplications } from '../../hooks/useApplications';
import { useLedger } from '../../hooks/useLedger';

interface ApplicationRow {
  id: string;
  fileNumber: string;
  clientName: string;
  loanType: string;
  amount: string;
  status: string;
  lastUpdate: string;
}

export const CreditDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { applications, loading } = useApplications();
  const { payoutRequests } = useLedger();

  // Calculate stats
  const totalApplications = applications.length;
  const pendingReview = applications.filter(a => 
    a.status === 'forwarded_to_credit' || a.status === 'credit_query_raised'
  ).length;
  const inNegotiation = applications.filter(a => a.status === 'in_negotiation').length;
  const sentToNBFC = applications.filter(a => a.status === 'sent_to_nbfc').length;
  const approved = applications.filter(a => a.status === 'approved' || a.status === 'disbursed').length;
  const pendingPayouts = payoutRequests.filter((p: any) => p.status === 'pending').length;

  // Format table data
  const tableData: ApplicationRow[] = applications.slice(0, 5).map(app => ({
    id: app.id,
    fileNumber: app.file_number || `SF${app.id.slice(0, 8)}`,
    clientName: app.client?.company_name || 'Unknown',
    loanType: app.loan_product?.name || 'N/A',
    amount: `₹${((app.requested_loan_amount || 0) / 100000).toFixed(2)}L`,
    status: app.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    lastUpdate: new Date(app.updated_at || app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  }));

  const getStatusVariant = (status: string) => {
    if (status.toLowerCase().includes('approved') || status.toLowerCase().includes('disbursed')) return 'success';
    if (status.toLowerCase().includes('query') || status.toLowerCase().includes('pending')) return 'warning';
    if (status.toLowerCase().includes('rejected')) return 'error';
    if (status.toLowerCase().includes('negotiation') || status.toLowerCase().includes('sent')) return 'info';
    return 'neutral';
  };

  const columns: Column<ApplicationRow>[] = [
    { key: 'fileNumber', label: 'File ID', sortable: true },
    { key: 'clientName', label: 'Client', sortable: true },
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
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
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
              {pendingPayouts > 0 && (
                <p className="text-xs text-warning mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Needs approval
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-orange-600" />
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
            {pendingReview > 0 && (
              <Button variant="primary" onClick={() => navigate('/applications?status=forwarded_to_credit')}>
                Review Files ({pendingReview})
              </Button>
            )}
            {pendingPayouts > 0 && (
              <Button variant="secondary" onClick={() => navigate('/ledger')}>
                Process Payouts ({pendingPayouts})
              </Button>
            )}
            {inNegotiation > 0 && (
              <Button variant="secondary" onClick={() => navigate('/applications?status=in_negotiation')}>
                Files in Negotiation ({inNegotiation})
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/clients')}>
              Manage Clients
            </Button>
          </div>
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
              <p className="text-neutral-500">No applications yet</p>
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


