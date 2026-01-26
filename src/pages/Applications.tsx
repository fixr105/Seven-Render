import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { useAuthSafe } from '../hooks/useAuthSafe';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigation } from '../hooks/useNavigation';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchBar } from '../components/ui/SearchBar';
import { Select } from '../components/ui/Select';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { TextArea } from '../components/ui/TextArea';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Plus, Eye, MessageSquare, RefreshCw } from 'lucide-react';
import { useApplications } from '../hooks/useApplications';

// Placeholder data removed - now using real data from database via useApplications hook

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Approved':
    case 'Disbursed':
      return 'success';
    case 'KAM Query Raised':
    case 'Pending KAM Review':
      return 'warning';
    case 'Rejected':
      return 'error';
    case 'Forwarded to Credit':
    case 'In Negotiation':
    case 'Sent to NBFC':
      return 'info';
    default:
      return 'neutral';
  }
};

const URL_STATUS_TO_FILTER: Record<string, string> = {
  pending_kam_review: 'pending',
  forwarded_to_credit: 'credit',
  kam_query_raised: 'query',
  in_negotiation: 'negotiation',
  sent_to_nbfc: 'nbfc',
  approved: 'approved',
  rejected: 'rejected',
  disbursed: 'disbursed',
};

export const Applications: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userRole, user } = useAuthSafe();
  
  const getUserDisplayName = () => {
    if (user?.name) return user.name;
    if (user?.email) return user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return '';
  };
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  // Use backend API-driven applications hook (no webhook data)
  const { applications, loading, refetch } = useApplications();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any | null>(null);
  const [queryMessage, setQueryMessage] = useState('');

  useEffect(() => {
    const param = searchParams.get('status');
    setStatusFilter(param && URL_STATUS_TO_FILTER[param] ? URL_STATUS_TO_FILTER[param] : 'all');
  }, [searchParams]);

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications', badge: 5 },
    ...(userRole === 'kam' || userRole === 'credit_team' ? [{ id: 'clients', label: 'Clients', icon: Users, path: '/clients' }] : []),
    ...(userRole === 'client' || userRole === 'credit_team' ? [{ id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' }] : []),
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending KAM Review' },
    { value: 'query', label: 'KAM Query Raised' },
    { value: 'credit', label: 'Forwarded to Credit' },
    { value: 'negotiation', label: 'In Negotiation' },
    { value: 'nbfc', label: 'Sent to NBFC' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'disbursed', label: 'Disbursed' },
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
    
    return {
      id: app.id || (app as any).id, // Use Airtable record ID for navigation (e.g., recCHVlPoZQYfeKlG)
      fileNumber: app.file_number || (app as any).file_number || (app as any).fileId || app.id, // For display
      clientName: String(clientName),
      applicantName: String(applicantName),
      loanType: String(loanType),
      amount: String(amount),
      status: app.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      lastUpdate: new Date(app.updated_at || app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      rawData: app, // Keep raw data for debugging
    };
  });

  const filteredData = displayApplications.filter(app => {
    const matchesSearch = searchQuery === '' ||
      app.fileNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.loanType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || app.status.toLowerCase().includes(statusFilter);

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
    
    console.log('Raising query for application:', selectedApplication?.id, queryMessage);
    setShowQueryModal(false);
    setQueryMessage('');
    setSelectedApplication(null);
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
      render: (value) => <Badge variant={getStatusVariant(value)}>{value}</Badge>,
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
              navigate(`/applications/${row.id}`);
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
              const fullApp = applications.find(a => a.id === row.id);
              setSelectedApplication(fullApp || row);
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
                <p className="text-sm font-medium text-warning mb-1">No applications found</p>
                <p className="text-xs text-neutral-600">
                  There are no applications in the backend database.
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

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by File ID, Client, Applicant, or Loan Type..."
              />
            </div>
            <div className="w-full md:w-64">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
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
        </CardContent>
      </Card>

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
          <CardTitle>All Applications ({filteredData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-neutral-500">Loading applications...</div>
          ) : filteredData.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500">No applications found</p>
                <Button 
                  variant="tertiary" 
                  size="sm" 
                  onClick={refetch}
                  className="mt-4"
                >
                  Refresh Data
                </Button>
              </div>
          ) : (
          <DataTable
            columns={columns}
            data={filteredData}
            keyExtractor={(row) => row.id}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onRowClick={(row) => navigate(`/applications/${row.id}`)}
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
