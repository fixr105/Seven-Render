import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { FileText, Clock, CheckCircle, XCircle, Download, AlertCircle } from 'lucide-react';
import { useApplications } from '../../hooks/useApplications';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
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
  const { userRoleId } = useAuth();
  const [assignedApplications, setAssignedApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignedApplications();
  }, [userRoleId]);

  const fetchAssignedApplications = async () => {
    if (!userRoleId) return;
    try {
      setLoading(true);
      // Get NBFC partner ID
      const { data: nbfcData } = await supabase
        .from('nbfc_partners')
        .select('id')
        .eq('user_id', userRoleId)
        .maybeSingle();

      if (nbfcData) {
        // Get applications assigned to this NBFC
        const { data } = await supabase
          .from('loan_applications')
          .select('*, client:dsa_clients(company_name), loan_product:loan_products(name)')
          .eq('assigned_nbfc_id', nbfcData.id)
          .in('status', ['sent_to_nbfc', 'approved', 'rejected'])
          .order('created_at', { ascending: false });

        setAssignedApplications(data || []);
      }
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
    clientName: app.client?.company_name || 'Unknown',
    loanType: app.loan_product?.name || 'N/A',
    amount: `₹${((app.form_data?.requested_loan_amount || 0) / 100000).toFixed(2)}L`,
    status: app.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
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
                Sanctioned
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
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
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
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
          <CardTitle>Assigned Applications</CardTitle>
          <Badge variant="neutral">{assignedApplications.length} Total</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-neutral-500">Loading applications...</div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 mb-2">No applications assigned to you yet</p>
              <p className="text-sm text-neutral-400">Applications will appear here once assigned by the Credit Team</p>
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
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

