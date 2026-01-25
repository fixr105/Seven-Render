import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FileText, Clock, CheckCircle, XCircle, Download, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuthSafe } from '../../hooks/useAuthSafe';
import { apiService } from '../../services/api';
import { useState, useEffect } from 'react';

interface ApplicationRow {
  id: string;
  fileNumber: string;
  clientName: string;
  loanType: string;
  amount: string;
  status: string;
  sentDate: string;
}

export const NBFCDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userRoleId } = useAuthSafe();
  const [assignedApplications, setAssignedApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch on mount (including SPA navigation) and via Refresh when userRoleId is available.
  useEffect(() => {
    if (userRoleId) {
      fetchAssignedApplications();
    } else {
      setLoading(false);
      setAssignedApplications([]);
    }
  }, []);

  const fetchAssignedApplications = async () => {
    if (!userRoleId) return;
    try {
      setLoading(true);
      setFetchError(null);
      // Use API service to fetch NBFC applications
      const response = await apiService.listNBFCApplications();
      
      if (response.success && response.data) {
        // Transform API response to match expected format
        const transformed = (response.data as any[]).map((app: any) => ({
          id: app.id,
          file_number: app.fileId || app['File ID'] || `SF${app.id.slice(0, 8)}`,
          status: app.status || app.Status || 'sent_to_nbfc',
          created_at: app.creationDate || app['Creation Date'] || app.createdAt || new Date().toISOString(),
          client: app.client ? { company_name: app.client.name || app.client['Client Name'] } : undefined,
          loan_product: app.loanProduct ? { name: app.loanProduct.name || app.loanProduct['Product Name'] } : undefined,
          requested_loan_amount: app.requestedAmount || parseFloat(app['Requested Loan Amount'] || '0') || 0,
        }));
        
        setAssignedApplications(transformed);
      } else {
        console.error('Error fetching NBFC applications:', response.error);
        setAssignedApplications([]);
        setFetchError(response.error || 'Could not load applications. Please try again.');
      }
    } catch (error) {
      console.error('Exception in fetchAssignedApplications:', error);
      setAssignedApplications([]);
      setFetchError((error as Error)?.message || 'Could not load applications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const pendingDecision = assignedApplications.filter(a => a.status === 'sent_to_nbfc').length;
  const approved = assignedApplications.filter(a => a.status === 'approved').length;
  const rejected = assignedApplications.filter(a => a.status === 'rejected').length;

  // Format table data
  const tableData: ApplicationRow[] = assignedApplications.map(app => ({
    id: app.id,
    fileNumber: app.file_number || `SF${app.id.slice(0, 8)}`,
    clientName: app.client?.company_name || '',
    loanType: app.loan_product?.name || '',
    amount: `₹${((app.requested_loan_amount || 0) / 100000).toFixed(2)}L`,
    status: app.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    sentDate: new Date(app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  }));

  const getStatusVariant = (status: string) => {
    if (status.toLowerCase().includes('approved')) return 'success';
    if (status.toLowerCase().includes('rejected')) return 'error';
    return 'warning';
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
    { key: 'sentDate', label: 'Received', sortable: true },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex gap-2">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => navigate(`/applications/${row.id}`)}
          >
            Review
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Pending Decision</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{pendingDecision}</p>
              <p className="text-xs text-warning mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Awaiting review
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
              <p className="text-sm text-neutral-500">Approved</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{approved}</p>
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Sanctioned
              </p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Rejected</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{rejected}</p>
              <p className="text-xs text-neutral-500 mt-1">Declined</p>
            </div>
            <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-error" />
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
            {pendingDecision > 0 && (
              <Button
                variant="primary"
                onClick={() => {
                  const nextFile = assignedApplications.find(a => a.status === 'sent_to_nbfc');
                  if (nextFile) navigate(`/applications/${nextFile.id}`);
                }}
              >
                Review Next Application ({pendingDecision})
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/applications?status=sent_to_nbfc')}>
              View All Pending
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Applications */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Assigned Applications</CardTitle>
            <Badge variant="neutral">{assignedApplications.length} Total</Badge>
          </div>
          <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={fetchAssignedApplications}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
              <p className="text-error font-medium mb-2">Could not load applications</p>
              <p className="text-neutral-600 text-sm mb-4">{fetchError}</p>
              <Button variant="primary" onClick={fetchAssignedApplications}>
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-neutral-500">Loading applications...</div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 mb-2">No applications assigned to you yet</p>
              <p className="text-sm text-neutral-400">Applications will appear here once assigned by the Credit Team</p>
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-brand-primary/10 border border-brand-primary/30 rounded text-sm text-brand-primary">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                You have {pendingDecision} application{pendingDecision !== 1 ? 's' : ''} pending your decision. 
                Click "Review" to open and make a decision.
              </div>
              <DataTable
                columns={columns}
                data={tableData}
                keyExtractor={(row) => row.id}
                onRowClick={(row) => navigate(`/applications/${row.id}`)}
              />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
};


