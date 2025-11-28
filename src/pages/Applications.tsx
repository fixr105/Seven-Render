import React, { useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, Column } from '../components/ui/DataTable';
import { SearchBar } from '../components/ui/SearchBar';
import { Select } from '../components/ui/Select';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { TextArea } from '../components/ui/TextArea';
import { Home, FileText, Users, DollarSign, BarChart3, Settings, Plus, Filter, Eye, MessageSquare } from 'lucide-react';

interface LoanApplication {
  id: string;
  clientName: string;
  loanType: string;
  amount: string;
  status: string;
  lastUpdate: string;
  applicantName: string;
}

const allApplications: LoanApplication[] = [
  { id: '12345', clientName: 'ABC Corp', applicantName: 'Rajesh Kumar', loanType: 'Home Loan', amount: '₹50,00,000', status: 'Pending KAM Review', lastUpdate: 'Oct 5, 2025' },
  { id: '12346', clientName: 'XYZ Pvt Ltd', applicantName: 'Priya Sharma', loanType: 'LAP', amount: '₹30,00,000', status: 'KAM Query Raised', lastUpdate: 'Oct 4, 2025' },
  { id: '12347', clientName: 'Tech Solutions', applicantName: 'Amit Patel', loanType: 'Business Loan', amount: '₹75,00,000', status: 'Forwarded to Credit', lastUpdate: 'Oct 3, 2025' },
  { id: '12348', clientName: 'Retail Mart', applicantName: 'Sunita Reddy', loanType: 'Working Capital', amount: '₹25,00,000', status: 'Approved', lastUpdate: 'Oct 2, 2025' },
  { id: '12349', clientName: 'ABC Corp', applicantName: 'Vikram Singh', loanType: 'Personal Loan', amount: '₹15,00,000', status: 'In Negotiation', lastUpdate: 'Oct 1, 2025' },
  { id: '12350', clientName: 'Global Enterprises', applicantName: 'Meena Gupta', loanType: 'Home Loan', amount: '₹60,00,000', status: 'Sent to NBFC', lastUpdate: 'Sep 30, 2025' },
  { id: '12351', clientName: 'Tech Solutions', applicantName: 'Arjun Malhotra', loanType: 'LAP', amount: '₹40,00,000', status: 'Rejected', lastUpdate: 'Sep 29, 2025' },
  { id: '12352', clientName: 'Retail Mart', applicantName: 'Kavita Joshi', loanType: 'Business Loan', amount: '₹55,00,000', status: 'Disbursed', lastUpdate: 'Sep 28, 2025' },
];

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

export const Applications: React.FC = () => {
  const [activeItem, setActiveItem] = useState('applications');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<LoanApplication | null>(null);
  const [queryMessage, setQueryMessage] = useState('');

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/dashboard' },
    { id: 'applications', label: 'Applications', icon: FileText, path: '/applications', badge: 5 },
    { id: 'clients', label: 'Clients', icon: Users, path: '/clients' },
    { id: 'ledger', label: 'Ledger', icon: DollarSign, path: '/ledger' },
    { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  ];

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

  const filteredData = allApplications.filter(app => {
    const matchesSearch = searchQuery === '' ||
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

  const handleRaiseQuery = () => {
    console.log('Raising query for application:', selectedApplication?.id, queryMessage);
    setShowQueryModal(false);
    setQueryMessage('');
    setSelectedApplication(null);
  };

  const columns: Column<LoanApplication>[] = [
    { key: 'id', label: 'File ID', sortable: true },
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
              console.log('View application:', row.id);
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
      onItemClick={setActiveItem}
      pageTitle="Loan Applications"
      userRole="Key Account Manager"
      userName="Anuj Kumar"
      notificationCount={3}
    >
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
            <Button variant="primary" icon={Plus}>
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
            <p className="text-2xl font-bold text-neutral-900 mt-1">{allApplications.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Pending</p>
            <p className="text-2xl font-bold text-warning mt-1">
              {allApplications.filter(a => a.status.includes('Pending')).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Approved</p>
            <p className="text-2xl font-bold text-success mt-1">
              {allApplications.filter(a => a.status === 'Approved').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-500">Disbursed</p>
            <p className="text-2xl font-bold text-brand-secondary mt-1">
              {allApplications.filter(a => a.status === 'Disbursed').length}
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
          <DataTable
            columns={columns}
            data={filteredData}
            keyExtractor={(row) => row.id}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
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
