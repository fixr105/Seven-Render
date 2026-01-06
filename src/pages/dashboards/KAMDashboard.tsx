import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Users, FileText, Clock, ArrowRight, Plus, AlertCircle, TrendingUp } from 'lucide-react';
import { useApplications } from '../../hooks/useApplications';
import { apiService } from '../../services/api';
import { useAuthSafe } from '../../hooks/useAuthSafe';
import { useState, useEffect } from 'react';

interface ApplicationRow {
  id: string;
  fileNumber: string;
  clientName: string;
  loanType: string;
  amount: string;
  status: string;
  lastUpdate: string;
}

interface ClientStats {
  id: string;
  name: string;
  totalFiles: number;
  pendingReview: number;
  awaitingResponse: number;
}

export const KAMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { userRoleId } = useAuthSafe();
  const { applications, loading } = useApplications();
  const [clients, setClients] = useState<ClientStats[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  // Load clients on initial mount (when page is first loaded/refreshed)
  // This ensures data loads when user first visits the page
  // No automatic refetch on role changes - user must manually refresh
  useEffect(() => {
    if (userRoleId) {
      fetchClients();
    }
  }, []); // Empty dependency array - only runs once on mount (userRoleId checked inside)

  const fetchClients = async () => {
    if (!userRoleId) return;
    try {
      setLoadingClients(true);
      // Use API service to fetch clients
      const response = await apiService.listClients();
      
      if (response.success && response.data) {
        const clientsData = response.data as any[];
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
      } else {
        console.error('Error fetching clients:', response.error);
        setClients([]);
      }
    } catch (error) {
      console.error('Exception in fetchClients:', error);
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  };

  // Calculate stats
  const totalClients = clients.length;
  const pendingReview = applications.filter(a => a.status === 'pending_kam_review').length;
  const awaitingResponse = applications.filter(a => a.status === 'kam_query_raised').length;
  const forwarded = applications.filter(a => a.status === 'forwarded_to_credit').length;

  // Format table data
  const tableData: ApplicationRow[] = applications.slice(0, 5).map(app => ({
    id: app.id,
    fileNumber: app.file_number || `SF${app.id.slice(0, 8)}`,
    clientName: app.client?.company_name || '',
    loanType: app.loan_product?.name || '',
    amount: `₹${((app.requested_loan_amount || 0) / 100000).toFixed(2)}L`,
    status: app.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    lastUpdate: new Date(app.updated_at || app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
  }));

  const getStatusVariant = (status: string) => {
    if (status.toLowerCase().includes('approved') || status.toLowerCase().includes('forwarded')) return 'success';
    if (status.toLowerCase().includes('query') || status.toLowerCase().includes('pending')) return 'warning';
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
              <p className="text-sm text-neutral-500">Managed Clients</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{totalClients}</p>
              <p className="text-xs text-neutral-500 mt-1">Active accounts</p>
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
        <CardHeader>
          <CardTitle>Action Center</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => navigate('/clients')}
            >
              Onboard New Client
            </Button>
            {pendingReview > 0 && (
              <Button variant="secondary" onClick={() => navigate('/applications?status=pending_kam_review')}>
                Review New Files ({pendingReview})
              </Button>
            )}
            {awaitingResponse > 0 && (
              <Button variant="secondary" onClick={() => navigate('/applications?status=kam_query_raised')}>
                Files Awaiting Response ({awaitingResponse})
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/form-configuration')}>
              Configure Client Forms
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Client Overview */}
      {totalClients > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Client Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingClients ? (
              <div className="text-center py-4 text-neutral-500">Loading clients...</div>
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
              <p className="text-neutral-500 mb-4">No applications from your clients yet</p>
              <Button variant="primary" icon={Plus} onClick={() => navigate('/clients')}>
                Onboard Your First Client
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


