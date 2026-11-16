import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { StatusBadge, type DealerStatus } from '../../components/dealer-ui/StatusBadge';
import { useAuth } from '../../auth/AuthContext';
import { apiService, type LoanApplication } from '../../services/api';
import {
  buildDashboard,
  filterDashboardRows,
  type DashboardKpis,
  type DashboardRow,
} from '../../lib/dealerDashboard';

const FILTERS: DealerStatus[] = ['pending', 'in_progress', 'needs_action', 'done', 'blocked'];

const COLUMNS: Array<{ key: keyof DashboardRow; label: string }> = [
  { key: 'fileId', label: 'File ID' },
  { key: 'applicant', label: 'Applicant' },
  { key: 'amount', label: 'Amount' },
  { key: 'product', label: 'Product' },
  { key: 'status', label: 'Status' },
  { key: 'modifiedMs', label: 'Last updated' },
];

type SortKey = (typeof COLUMNS)[number]['key'];

function KpiCard({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-[12px] border border-sf-border bg-sf-surface p-4" data-testid={testId}>
      <p className="text-xs font-medium uppercase tracking-wide text-sf-quiet">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-sf-text">{value}</p>
    </div>
  );
}

function SkeletonBlock({ testId }: { testId: string }) {
  return <div className="h-24 animate-pulse rounded-[12px] bg-sf-border" data-testid={testId} />;
}

function toDashboardRecord(application: LoanApplication): Record<string, unknown> {
  const raw = application as LoanApplication & {
    formData?: unknown;
    lastUpdated?: string;
    Status?: string;
  };
  return {
    id: application.id,
    'File ID': application.fileId,
    Status: raw.Status || application.status,
    Modified: raw.lastUpdated || application.lastUpdated,
    'Form Data': raw.formData ?? {},
  };
}

export const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [query, setQuery] = useState('');
  const [badges, setBadges] = useState<DealerStatus[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('modifiedMs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user?.clientId) {
      const empty = buildDashboard([]);
      setError(false);
      setKpis(empty.kpis);
      setRows(empty.rows);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const response = await apiService.listApplications();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Could not load applications');
      }
      const built = buildDashboard(response.data.map(toDashboardRecord));
      setKpis(built.kpis);
      setRows(built.rows);
    } catch {
      setError(true);
      setKpis(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user?.clientId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const visibleRows = useMemo(() => {
    const filtered = filterDashboardRows(rows, query, badges);
    const sorted = [...filtered].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      if (typeof left === 'number' && typeof right === 'number') {
        return sortDir === 'asc' ? left - right : right - left;
      }
      const cmp = String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, query, badges, sortKey, sortDir]);

  const toggleBadge = (badge: DealerStatus) => {
    setBadges((current) =>
      current.includes(badge) ? current.filter((item) => item !== badge) : [...current, badge]
    );
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'modifiedMs' || key === 'amount' ? 'desc' : 'asc');
  };

  const openApplication = (id: string) => {
    if (!id) return;
    navigate(`/applications/${id}`);
  };

  return (
    <div data-testid="dealer-dashboard">
      {error && (
        <div className="mb-4 rounded-[12px] border border-sf-error/30 bg-sf-surface p-4" role="alert">
          <p className="text-sm font-medium text-sf-text">Could not load dashboard</p>
          <p className="mt-1 text-sm text-sf-quiet">Could not load applications. Check your connection.</p>
          <Button className="mt-3" variant="secondary" onClick={() => setReloadKey((n) => n + 1)}>
            Try again
          </Button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          FILTERS.map((badge) => <SkeletonBlock key={badge} testId="dashboard-kpi-skeleton" />)
        ) : (
          <>
            <KpiCard label="Total Applications" value={error ? '—' : String(kpis?.total ?? 0)} testId="kpi-total" />
            <KpiCard label="Active" value={error ? '—' : String(kpis?.active ?? 0)} testId="kpi-active" />
            <KpiCard
              label="Total Sanctioned"
              value={error ? '—' : kpis?.sanctionedLabel ?? '₹0'}
              testId="kpi-sanctioned"
            />
            <KpiCard
              label="Pending Action"
              value={error ? '—' : String(kpis?.pendingAction ?? 0)}
              testId="kpi-pending"
            />
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Button onClick={() => navigate('/applications/new')}>New Application</Button>
        <Button variant="secondary" className="border-sf-navy text-sf-navy" onClick={() => navigate('/calculator')}>
          Calculator
        </Button>
      </div>

      <div className="rounded-[12px] border border-sf-border bg-sf-surface">
        <div className="flex flex-col gap-3 border-b border-sf-border p-4">
          <input
            aria-label="Search applications"
            className="min-h-11 w-full rounded-lg border border-sf-border px-3 text-sm text-sf-text"
            placeholder="Search by file ID or applicant"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((badge) => {
              const selected = badges.includes(badge);
              return (
                <button
                  key={badge}
                  type="button"
                  aria-pressed={selected}
                  data-testid={`status-filter-${badge}`}
                  className={`rounded-full border px-3 py-1 ${
                    selected ? 'border-sf-navy bg-sf-navy-50' : 'border-sf-border bg-sf-surface'
                  }`}
                  onClick={() => toggleBadge(badge)}
                >
                  <StatusBadge status={badge} />
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2 p-4" data-testid="dashboard-table-skeleton">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-10 animate-pulse rounded bg-sf-border" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-sf-text">No applications yet. Start a new application.</p>
            <Button className="mt-4" onClick={() => navigate('/applications/new')}>
              New Application
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-sf-border text-xs uppercase tracking-wide text-sf-quiet">
                  {COLUMNS.map((column) => (
                    <th key={column.key} className="px-4 py-3 font-medium">
                      <button type="button" onClick={() => toggleSort(column.key)}>
                        {column.label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-sm text-sf-quiet" colSpan={6}>
                      No matching applications.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <tr
                      key={row.id || row.fileId}
                      data-testid={`application-row-${row.id}`}
                      className="cursor-pointer border-b border-sf-border last:border-0 hover:bg-sf-soft"
                      onClick={() => openApplication(row.id)}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="rounded bg-sf-soft px-2 py-1 font-mono text-xs text-sf-navy"
                          onClick={(event) => {
                            event.stopPropagation();
                            openApplication(row.id);
                          }}
                        >
                          {row.fileId}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sf-text">{row.applicant}</td>
                      <td className="px-4 py-3 text-sf-text">{row.amountLabel}</td>
                      <td className="px-4 py-3 text-sf-text">{row.product}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.badge} />
                      </td>
                      <td className="px-4 py-3 text-sf-quiet">{row.updatedLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
