import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Plus, FileText, Clock, CheckCircle, DollarSign, Package } from 'lucide-react';
import { useApplications } from '../../hooks/useApplications';
import { useLedger } from '../../hooks/useLedger';
import { useNotifications } from '../../hooks/useNotifications';
import { apiService } from '../../services/api';

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
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [configuredProductIds, setConfiguredProductIds] = useState<Set<string>>(new Set());

  // Load loan products and configured products on initial mount (when dashboard first loads)
  useEffect(() => {
    fetchLoanProducts();
    fetchConfiguredProducts();
  }, []);

  const fetchLoanProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await apiService.listLoanProducts(true); // activeOnly = true
      
      if (response.success && response.data) {
        const products = response.data.map((product: any) => ({
          id: product.productId || product.id,
          name: product.productName || product['Product Name'] || product.name,
          description: product.description || product['Description'],
        }));
        setLoanProducts(products);
        
        if (products.length === 0) {
          console.warn('No loan products available');
        }
      } else if (response.error) {
        console.error('Error fetching loan products:', response.error);
        // If 401/403, the API service already cleared the token
        // The auth context will handle redirect
      }
    } catch (error) {
      console.error('Exception fetching loan products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchConfiguredProducts = async () => {
    try {
      const response = await apiService.getConfiguredProducts();
      
      if (response.success && response.data) {
        setConfiguredProductIds(new Set(response.data));
        console.log('Configured products:', response.data);
      } else if (response.error) {
        console.error('Error fetching configured products:', response.error);
      }
    } catch (error) {
      console.error('Exception fetching configured products:', error);
    }
  };

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
              <p className="text-xs text-neutral-500 mt-1">
                {totalApplications > 0 ? Math.round((approved / totalApplications) * 100) : 0}% approval rate
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
              <p className="text-sm text-neutral-500">Commission Balance</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">
                ₹{ledgerLoading ? '0.0' : (balance / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Loan Products */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-primary" />
            Available Loan Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProducts ? (
            <div className="text-center py-4 text-neutral-500">Loading loan products...</div>
          ) : loanProducts.length === 0 ? (
            <div className="text-center py-4 text-neutral-500">No loan products available</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loanProducts.map((product) => {
                const isConfigured = configuredProductIds.has(product.id);
                return (
                  <div
                    key={product.id}
                    className={`p-4 border rounded-lg transition-all ${
                      isConfigured
                        ? 'border-neutral-200 hover:border-brand-primary/50 hover:shadow-md cursor-pointer'
                        : 'border-neutral-300 bg-neutral-100 opacity-50 cursor-not-allowed pointer-events-none'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className={`font-semibold ${isConfigured ? 'text-neutral-900' : 'text-neutral-500'}`}>
                        {product.name}
                      </h4>
                      {!isConfigured && (
                        <Badge variant="neutral" className="ml-2 flex-shrink-0">
                          Not Available
                        </Badge>
                      )}
                    </div>
                    {product.description && (
                      <p className={`text-sm line-clamp-2 ${isConfigured ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        {product.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Center */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Action Center</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => navigate('/applications/new')}
          >
            New Application
          </Button>
        </CardContent>
      </Card>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Recent Applications</CardTitle>
          <button
            onClick={() => navigate('/applications')}
            className="text-sm text-brand-primary hover:text-brand-primary/80 font-medium"
          >
            View All
          </button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-neutral-500">Loading applications...</div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 mb-6 text-lg">No applications yet</p>
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


