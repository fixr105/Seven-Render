import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Plus, FileText, Clock, CheckCircle, DollarSign, Package, RefreshCw, Sparkles, Wallet, FileEdit, AlertCircle, XCircle } from 'lucide-react';
import { useApplications } from '../../hooks/useApplications';
import { useLedger } from '../../hooks/useLedger';
import { useNotifications } from '../../hooks/useNotifications';
import { apiService } from '../../services/api';
import { RecentApplicationsSection } from '../../components/dashboard/RecentApplicationsSection';

export const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { applications, loading, refetch: refetchApplications } = useApplications();
  const { balance, loading: ledgerLoading, refetch: refetchLedger } = useLedger();
  useNotifications();
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [configuredProductIds, setConfiguredProductIds] = useState<Set<string>>(new Set());
  const [configuredProductsError, setConfiguredProductsError] = useState<string | null>(null);

  // Fetch on mount (including SPA navigation) and via Refresh.
  useEffect(() => {
    fetchLoanProducts();
    fetchConfiguredProducts();
  }, []);

  const refreshAll = () => {
    refetchApplications();
    refetchLedger();
    fetchLoanProducts();
    fetchConfiguredProducts();
  };

  const showAccountNotLinkedBanner =
    !loadingProducts &&
    (configuredProductsError != null ||
      (applications.length === 0 && configuredProductIds.size === 0 && loanProducts.length > 0));

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
          // No products configured
        }
      } else if (response.error) {
        // If 401/403, the API service already cleared the token
        // The auth context will handle redirect
      }
    } catch (_error) {
      // Fallback: leave products empty
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchConfiguredProducts = async () => {
    try {
      setConfiguredProductsError(null);
      const response = await apiService.getConfiguredProducts();
      
      if (response.success && response.data) {
        setConfiguredProductIds(new Set(response.data));
      } else if (response.error) {
        setConfiguredProductsError(response.error);
      }
    } catch (_error) {
      setConfiguredProductsError('Could not load your configured products.');
    }
  };

  // Calculate stats
  const totalApplications = applications.length;
  const drafts = applications.filter(a => a.status === 'draft').length;
  const pendingReview = applications.filter(a => a.status === 'pending_kam_review' || a.status === 'kam_query_raised').length;
  const actionRequired = applications.filter(a => a.status === 'kam_query_raised').length;
  const rejected = applications.filter(a => a.status === 'rejected').length;
  const approved = applications.filter(a => a.status === 'approved' || a.status === 'disbursed').length;

  return (
    <>
      {showAccountNotLinkedBanner && (
        <Card className="mb-6 border-warning bg-warning/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-neutral-900">
              Your account may not be linked to a client record.
            </p>
            <p className="text-sm text-neutral-600 mt-1">
              {configuredProductsError ||
                'To see applications and available loan products, your login email must match the Contact Email/Phone on your client record in the system. Please contact your KAM or administrator to link your account.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Total Applications</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{totalApplications}</p>
            </div>
            <div className="w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-brand-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-neutral-500">Drafts</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{drafts}</p>
              <p className="text-xs text-neutral-500 mt-1">saved</p>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
              <FileEdit className="w-6 h-6 text-warning" />
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
              <p className="text-sm text-neutral-500">Action required</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{actionRequired}</p>
              <p className="text-xs text-warning mt-1">Pending your response</p>
            </div>
            <div className="w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-warning" />
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
              <p className="text-sm text-neutral-500">Rejected</p>
              <p className="text-2xl font-bold text-neutral-900 mt-1">{rejected}</p>
            </div>
            <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-error" />
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
              {balance > 0 && (
                <Button variant="secondary" size="sm" className="mt-2" icon={Wallet} onClick={() => navigate('/ledger')}>
                  Request Payout
                </Button>
              )}
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
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Action Center</CardTitle>
          <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={refreshAll}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => navigate('/applications/new')}
              title="Create a new loan application"
            >
              New Application
            </Button>
            <Button
              variant="secondary"
              icon={DollarSign}
              onClick={() => navigate('/ledger')}
              title="Open your commission ledger"
            >
              View Ledger
            </Button>
            {drafts > 0 && (
              <Button
                variant="secondary"
                icon={FileEdit}
                onClick={() => navigate('/applications?status=draft')}
                title="View draft applications"
              >
                View drafts
              </Button>
            )}
            {balance > 0 && (
              <Button
                variant="secondary"
                icon={Wallet}
                onClick={() => navigate('/ledger')}
                title="Request a payout"
              >
                Request Payout
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

      {/* Recent Applications */}
      <RecentApplicationsSection
        role="client"
        applications={applications}
        loading={loading}
        onViewAll={() => navigate('/applications')}
        onRowClick={(row) => {
          const id = row.id ?? row.applicationId ?? row.fileId;
          if (id && String(id) !== 'undefined') navigate(`/applications/${id}`);
        }}
        onEmptyAction={() => navigate('/applications/new')}
      />
    </>
  );
};


