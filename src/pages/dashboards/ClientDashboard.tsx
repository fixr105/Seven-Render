import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Plus, FileText, Clock, IndianRupee, Package, RefreshCw, Sparkles, Wallet, FileEdit } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useApplications } from '../../hooks/useApplications';
import { useLedger } from '../../hooks/useLedger';
import { useNotifications } from '../../hooks/useNotifications';
import { apiService } from '../../services/api';
import { RecentApplicationsSection } from '../../components/dashboard/RecentApplicationsSection';
import { buildWizardResumePath } from '../../lib/b2cEvWizardResume';
import type { LoanApplication } from '../../hooks/useApplications';

type LoanProductCard = {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
};

function extractIconUrl(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = extractIconUrl(item);
      if (parsed) return parsed;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      extractIconUrl(record.url) ||
      extractIconUrl(record.URL) ||
      extractIconUrl(record.href) ||
      extractIconUrl(record.src)
    );
  }
  return undefined;
}

function applicationMix(apps: LoanApplication[]) {
  let draft = 0;
  let pipeline = 0;
  let terminal = 0;
  for (const a of apps) {
    const s = (a.status || '').toLowerCase();
    if (s === 'draft') draft += 1;
    else if (s.includes('disbursed') || s.includes('reject') || s.includes('withdraw') || s.includes('closed')) {
      terminal += 1;
    } else {
      pipeline += 1;
    }
  }
  return { draft, pipeline, terminal };
}

function BrandMixDonut({ draft, pipeline, terminal }: { draft: number; pipeline: number; terminal: number }) {
  const { t } = useTranslation();
  const total = draft + pipeline + terminal;
  if (total === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
        {t('pages.dashboards.noApplicationsYet')}
      </div>
    );
  }
  const a = (draft / total) * 360;
  const b = (pipeline / total) * 360;
  const c = (terminal / total) * 360;
  const background = `conic-gradient(from -90deg, #1A1F5F 0deg ${a}deg, rgba(26,31,95,0.5) ${a}deg ${a + b}deg, rgba(26,31,95,0.2) ${a + b}deg ${a + b + c}deg)`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-[180px] w-[180px]">
        <div
          className="h-full w-full rounded-full"
          style={{ background }}
          aria-hidden
        />
        <div className="absolute inset-[28%] rounded-full bg-white shadow-inner" />
      </div>
      <ul className="w-full space-y-2 text-xs text-neutral-600">
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-brand-primary" />
            {t('common.draft')}
          </span>
          <span className="font-medium text-neutral-900">{draft}</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-brand-primary/50" />
            {t('common.inProgress')}
          </span>
          <span className="font-medium text-neutral-900">{pipeline}</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-brand-primary/25" />
            {t('common.closedDisbursed')}
          </span>
          <span className="font-medium text-neutral-900">{terminal}</span>
        </li>
      </ul>
    </div>
  );
}

export const ClientDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { applications, loading, refetch: refetchApplications } = useApplications();
  const draftCount = useMemo(
    () => applications.filter((a) => a.status === 'draft').length,
    [applications]
  );
  const mix = useMemo(() => applicationMix(applications), [applications]);

  const { balance, loading: ledgerLoading, refetch: refetchLedger, entries } = useLedger();
  useNotifications();
  const [loanProducts, setLoanProducts] = useState<LoanProductCard[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [configuredProductIds, setConfiguredProductIds] = useState<Set<string>>(new Set());
  const [configuredProductsError, setConfiguredProductsError] = useState<string | null>(null);

  const lastLedgerHint = useMemo(() => {
    if (!entries.length) return null;
    const last = entries[0] as Record<string, unknown>;
    const amt = Number(last['Payout Amount'] ?? last.payoutAmount ?? 0);
    const rawDate = String(last.Date ?? last.date ?? '');
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amt));
    const dateLabel =
      rawDate && !Number.isNaN(Date.parse(rawDate))
        ? new Date(rawDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : '';
    if (amt < 0) {
      return `Last transaction: ${formatted} withdrawn${dateLabel ? ` on ${dateLabel}` : ''}`;
    }
    if (amt > 0) {
      return `Last transaction: ${formatted} credited${dateLabel ? ` on ${dateLabel}` : ''}`;
    }
    return dateLabel ? `Last update on ${dateLabel}` : null;
  }, [entries]);

  const fetchLoanProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const response = await apiService.listLoanProducts(true); // activeOnly = true

      if (response.success && response.data) {
        const products = response.data.map((product: {
          productId?: string;
          id?: string;
          productName?: string;
          'Product Name'?: string;
          name?: string;
          description?: string;
          Description?: string;
          ICONS?: unknown;
          icons?: unknown;
          icon?: unknown;
          iconUrl?: string;
        }) => ({
          id: product.productId || product.id || '',
          name: product.productName || product['Product Name'] || product.name || '',
          description: product.description || product['Description'],
          iconUrl:
            product.iconUrl ||
            extractIconUrl(product.ICONS) ||
            extractIconUrl(product.icons) ||
            extractIconUrl(product.icon),
        }));
        setLoanProducts(products);
      } else if (response.error) {
        if (response.error.includes('401') || response.error.includes('403')) {
          void refreshUser({ silent: true });
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
          void refreshUser({ silent: true });
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
  const pendingReview = applications.filter((a) => a.status === 'under_kam_review').length;

  const displayProducts = loanProducts.filter((p) => configuredProductIds.has(p.id));

  const statIconWrap = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-primary/10';

  return (
    <>
      {showAccountNotLinkedBanner && (
        <Card className="mb-6 border-neutral-200 bg-neutral-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-neutral-900">
              {t('pages.dashboards.accountNotLinked')}
            </p>
            <p className="text-sm text-neutral-600 mt-1">
              {configuredProductsError || t('pages.dashboards.accountNotLinkedHint')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards — white surfaces, navy accents only */}
      <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex items-start justify-between p-6">
            <div className="min-w-0 pr-3">
              <p className="text-sm text-neutral-500">{t('pages.dashboards.totalApplications')}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
                {loading ? '…' : totalApplications}
              </p>
              <p className="mt-2 text-xs text-neutral-500">{t('pages.dashboards.recentActivity')}</p>
            </div>
            <div className={statIconWrap}>
              <FileText className="h-6 w-6 text-brand-primary" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardContent className="flex items-start justify-between p-6">
            <div className="min-w-0 pr-3">
              <p className="text-sm text-neutral-500">{t('pages.dashboards.pendingReview')}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
                {loading ? '…' : pendingReview}
              </p>
              <p className="mt-2 text-xs text-neutral-500">{t('pages.dashboards.readyForReview')}</p>
            </div>
            <div className={statIconWrap}>
              <Clock className="h-6 w-6 text-brand-primary" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm sm:col-span-2 lg:col-span-1">
          <CardContent className="flex items-start justify-between p-6">
            <div className="min-w-0 pr-3">
              <p className="text-sm text-neutral-500">{t('pages.dashboards.commissionBalance')}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
                {ledgerLoading ? (
                  <span className="text-sm font-normal text-neutral-400">{t('common.loading')}</span>
                ) : (
                  `₹${(balance / 1000).toFixed(1)}K`
                )}
              </p>
              {lastLedgerHint && (
                <p className="mt-2 text-xs text-neutral-500 line-clamp-2">{lastLedgerHint}</p>
              )}
              {balance > 0 && (
                <Button variant="secondary" size="sm" className="mt-3" icon={Wallet} onClick={() => navigate('/ledger')}>
                  {t('pages.dashboards.requestPayout')}
                </Button>
              )}
            </div>
            <div className={statIconWrap}>
              <IndianRupee className="h-6 w-6 text-brand-primary" aria-hidden />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Loan Products */}
      <Card className="mb-6 rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-brand-primary" aria-hidden />
            {t('pages.dashboards.availableLoanProducts')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProducts ? (
            <div className="py-4 text-center text-neutral-500">{t('pages.dashboards.loadingLoanProducts')}</div>
          ) : displayProducts.length === 0 ? (
            <div className="py-4 text-center text-neutral-500">{t('pages.dashboards.noLoanProducts')}</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayProducts.map((product) => (
                <div
                  key={product.id}
                  className="cursor-pointer rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-brand-primary/35 hover:shadow-md"
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-brand-primary/8 text-brand-primary">
                    {product.iconUrl ? (
                      <img
                        src={product.iconUrl}
                        alt={`${product.name} icon`}
                        className="h-10 w-10 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-7 w-7" aria-hidden />
                    )}
                  </div>
                  <h4 className="font-semibold text-neutral-900">{product.name}</h4>
                  {product.description && (
                    <p className="mt-1 line-clamp-3 text-sm text-neutral-600">{product.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Center — warm neutral strip, navy CTAs */}
      <div className="mb-6 overflow-hidden rounded-xl border border-neutral-200/90 bg-[#F5F4F0] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 px-4 py-3">
          <h3 className="text-base font-semibold text-neutral-900">{t('pages.dashboards.actionCenter')}</h3>
          <Button variant="tertiary" size="sm" icon={RefreshCw} onClick={refreshAll}>
            {t('common.refresh')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 px-4 py-4">
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => navigate('/applications/new')}
            title="Create a new loan application"
          >
            {t('pages.dashboards.startNewApplication')}
          </Button>
          <Button
            variant="secondary"
            icon={IndianRupee}
            onClick={() => navigate('/ledger')}
            title={t('pages.dashboards.viewFullLedger')}
          >
            {t('pages.dashboards.viewFullLedger')}
          </Button>
          {draftCount > 0 && (
            <Button
              variant="secondary"
              icon={FileEdit}
              onClick={() => navigate('/applications?status=draft')}
              title={t('pages.dashboards.viewDrafts')}
            >
              {t('pages.dashboards.viewDrafts')}
            </Button>
          )}
          {balance > 0 && (
            <Button
              variant="secondary"
              icon={Wallet}
              onClick={() => navigate('/ledger')}
              title={t('pages.dashboards.requestPayout')}
            >
              {t('pages.dashboards.requestPayout')}
            </Button>
          )}
        </div>
      </div>

      {/* AI features — restrained strip */}
      <div className="mb-6 overflow-hidden rounded-xl border border-brand-primary/15 bg-brand-primary/[0.06]">
        <div className="border-b border-brand-primary/10 bg-brand-primary/[0.08] px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-medium text-brand-primary">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            {t('pages.dashboards.aiInsights')}
          </div>
        </div>
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-700">
            {t('pages.dashboards.aiInsightsDescription')}
          </p>
          <Button variant="tertiary" size="sm" className="shrink-0" onClick={() => navigate('/applications')}>
            {t('nav.applications')}
          </Button>
        </div>
      </div>

      {/* Recent Applications + Analytics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentApplicationsSection
          className="lg:col-span-2 rounded-xl shadow-sm"
          role="client"
          applications={applications}
          loading={loading}
          statusPalette="brand"
          onViewAll={() => navigate('/applications')}
          onRowClick={(row) => {
            const id = row.id ?? row.applicationId ?? row.fileId;
            if (id && String(id) !== 'undefined') navigate(`/applications/${id}`);
          }}
          onEmptyAction={() => navigate('/applications/new')}
          onContinueEdit={(row) => {
            const id = row.id ?? row.applicationId ?? row.fileId;
            if (id && String(id) !== 'undefined') {
              navigate(buildWizardResumePath(String(id), row.formData));
            }
          }}
        />

        <Card className="rounded-xl shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('pages.dashboards.analyticsSnapshot')}</CardTitle>
          </CardHeader>
          <CardContent>
            <BrandMixDonut draft={mix.draft} pipeline={mix.pipeline} terminal={mix.terminal} />
          </CardContent>
        </Card>
      </div>
    </>
  );
};
