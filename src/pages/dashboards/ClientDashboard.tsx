import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, FileText, Clock, DollarSign, Package, RefreshCw, Sparkles, Wallet, FileEdit } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useApplications } from '../../hooks/useApplications';
import { useLedger } from '../../hooks/useLedger';
import { useNotifications } from '../../hooks/useNotifications';
import { apiService } from '../../services/api';
import { RecentApplicationsSection } from '../../components/dashboard/RecentApplicationsSection';

export const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { applications, loading, refetch: refetchApplications } = useApplications();
  const draftCount = useMemo(
    () => applications.filter((a) => a.status === 'draft').length,
    [applications]
  );
  const { balance, loading: ledgerLoading, refetch: refetchLedger } = useLedger();
  useNotifications();
  const [loanProducts, setLoanProducts] = useState<Array<{ id: string; name: string; description?: string }>>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [configuredProductIds, setConfiguredProductIds] = useState<Set<string>>(new Set());
  const [configuredProductsError, setConfiguredProductsError] = useState<string | null>(null);

  const fetchLoanProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const response = await apiService.listLoanProducts(true); // activeOnly = true

      if (response.success && response.data) {
        const products = response.data.map((product: { productId?: string; id?: string; productName?: string; 'Product Name'?: string; name?: string; description?: string; Description?: string }) => ({
          id: product.productId || product.id || '',
          name: product.productName || product['Product Name'] || product.name || '',
          description: product.description || product['Description'],
        }));
        setLoanProducts(products);
      } else if (response.error) {
        if (response.error.includes('401') || response.error.includes('403')) {
          refreshUser();
        }
      }
    } catch (_error) {
      // Fallback: leave products empty
    } finally {
      setLoadingProducts(false);
    }
  }, [refreshUser]);

  const fetchConfiguredProducts = useCallback(async () => {
    try {
      setConfiguredProductsError(null);
      const response = await apiService.getConfiguredProducts();

      if (response.success && response.data) {
        setConfiguredProductIds(new Set(response.data));
      } else if (response.error) {
        if (response.error.includes('401') || response.error.includes('403')) {
          refreshUser();
        }
        setConfiguredProductsError(response.error);
      }
    } catch (_error) {
      setConfiguredProductsError('Could not load your configured products.');
    }
  }, [refreshUser]);

  // Fetch on mount (including SPA navigation) and via Refresh.
  useEffect(() => {
    fetchLoanProducts();
    fetchConfiguredProducts();
  }, [fetchLoanProducts, fetchConfiguredProducts]);

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

  // Calculate stats
  const totalApplications = applications.length;
  const pendingReview = applications.filter(a => a.status === 'pending_kam_review' || a.status === 'kam_query_raised').length;

  const displayProducts = loanProducts.filter((p) => configuredProductIds.has(p.id));

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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

      {/* Available Loan Products - only show products configured for this client */}
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
          ) : displayProducts.length === 0 ? (
            <div className="text-center py-4 text-neutral-500">No loan products available</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-4 border rounded-lg transition-all border-neutral-200 hover:border-brand-primary/50 hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-semibold text-neutral-900">{product.name}</h4>
                  </div>
                  {product.description && (
                    <p className="text-sm line-clamp-2 text-neutral-600">{product.description}</p>
                  )}
                </div>
              ))}
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
            {draftCount > 0 && (
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


