import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { MainLayout } from '../components/layout/MainLayout';
import { useAuth } from '../auth/AuthContext';
import { useNavigation } from '../hooks/useNavigation';
import { useSidebarItems } from '../hooks/useSidebarItems';
import type { UserRole } from '../auth/types';
import { formatEngineSetupError } from '../lib/engineSetupError';
import { airtableGet, airtableWrite } from '../services/engineClient';
import { VKYC_LINKS_TABLE, mapVkycRecord, maskMobile, markLoanFileVkycDone, type VkycRow } from '../lib/vkycLinks';
import { StatusBadge, type DealerStatus } from '../components/dealer-ui/StatusBadge';

function vkycStatusWord(status: string): DealerStatus {
  const value = status.toLowerCase();
  if (/done|complete/.test(value)) return 'done';
  if (/fail|block|cancel/.test(value)) return 'blocked';
  if (/sent|request|progress/.test(value)) return 'in_progress';
  if (/action|upload/.test(value)) return 'needs_action';
  return 'pending';
}

const ALLOWED_ROLES: UserRole[] = ['kam', 'credit_team', 'admin'];
const PENDING_FORMULA = "OR({status} = 'Requested', {status} = 'Link Sent')";

function requestedSortKey(row: VkycRow): number {
  const t = Date.parse(row.requested_at);
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function formatRequested(value: string): string {
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toLocaleString('en-IN') : value || '—';
}

function isHttpsUrl(value: string): boolean {
  if (!/^https:\/\//i.test(value)) return false;
  try {
    return Boolean(new URL(value).hostname);
  } catch {
    return false;
  }
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export const VkycDeskPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const sidebarItems = useSidebarItems();
  const { activeItem, handleNavigation } = useNavigation(sidebarItems);

  const [rows, setRows] = useState<VkycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const allowed = Boolean(user?.role && ALLOWED_ROLES.includes(user.role));
  const operatorName = user?.name || user?.email || 'Officer';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await airtableGet({
        table: VKYC_LINKS_TABLE,
        filter_formula: PENDING_FORMULA,
        max: 200,
      });
      if (!mountedRef.current) return;
      const mapped = (res.records || [])
        .map(mapVkycRecord)
        .filter((r) => r.id && (r.status === 'Requested' || r.status === 'Link Sent'))
        .sort((a, b) => requestedSortKey(a) - requestedSortKey(b));
      setRows(mapped);
      setError('');
    } catch (err) {
      if (mountedRef.current) setError(errorText(err, 'Could not load VKYC requests.'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void refresh();
  }, [allowed, refresh]);

  const runUpdate = async (row: VkycRow, fields: Record<string, unknown>) => {
    setBusyId(row.id);
    setRowErrors((prev) => ({ ...prev, [row.id]: '' }));
    try {
      await airtableWrite({ table: VKYC_LINKS_TABLE, record_id: row.id, fields });
      await refresh();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [row.id]: formatEngineSetupError(err, VKYC_LINKS_TABLE) || errorText(err, 'Update failed.'),
      }));
    } finally {
      if (mountedRef.current) setBusyId(null);
    }
  };

  const sendLink = (row: VkycRow) => {
    const link = (links[row.id] ?? row.link ?? '').trim();
    if (!isHttpsUrl(link)) {
      setRowErrors((prev) => ({ ...prev, [row.id]: 'Meeting link must start with https://' }));
      return;
    }
    void runUpdate(row, {
      link,
      status: 'Link Sent',
      link_at: new Date().toISOString(),
    });
  };

  const markDone = (row: VkycRow) => {
    void (async () => {
      await runUpdate(row, {
        status: 'Done',
        done_at: new Date().toISOString(),
        done_by: operatorName,
      });
      try {
        await markLoanFileVkycDone(row.file_id);
      } catch (err) {
        setRowErrors((prev) => ({
          ...prev,
          [row.id]: errorText(err, 'Video KYC was marked done, but the file status did not update.'),
        }));
      }
    })();
  };

  const markFailed = (row: VkycRow) => {
    const reason = window.prompt('Reason for failure?');
    if (reason == null) return;
    const remarks = reason.trim();
    if (!remarks) {
      setRowErrors((prev) => ({ ...prev, [row.id]: 'A reason is required to mark as failed.' }));
      return;
    }
    void runUpdate(row, { status: 'Failed', remarks });
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-dealer-navy" aria-hidden />
      </div>
    );
  }

  if (!user || !allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <MainLayout
      sidebarItems={sidebarItems}
      activeItem={activeItem}
      onItemClick={handleNavigation}
      pageTitle="VKYC Desk"
      userRole={user.role.replace('_', ' ').toUpperCase()}
      userName={operatorName}
    >
      <div className="post-submit-engine min-h-[60vh] bg-dealer-surface px-4 py-8">
        <div className="mx-auto w-full max-w-[1000px]">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="sf-page-title">VKYC Desk</h1>
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-[12px] border border-dealer-border bg-dealer-surface px-4 py-2 text-sm font-semibold text-dealer-navy"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </div>

          {error ? (
            <p className="mb-4 text-sm text-dealer-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-[12px] border border-dealer-border bg-dealer-surface">
            <table className="w-full min-w-[40rem] text-left text-sm" data-testid="vkyc-desk-table">
              <thead className="border-b border-dealer-border bg-dealer-surface-soft text-xs uppercase text-dealer-text-quiet">
                <tr>
                  <th className="px-4 py-3">File ID</th>
                  <th className="px-4 py-3">Borrower</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-dealer-text-quiet">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm leading-5 text-dealer-text-quiet">
                      No pending video KYC requests.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const busy = busyId === row.id;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-dealer-border align-top last:border-b-0"
                        data-testid={`vkyc-row-${row.id}`}
                      >
                        <td className="px-4 py-3 font-medium text-dealer-text">{row.file_id}</td>
                        <td className="px-4 py-3">{row.borrower_name || '—'}</td>
                        <td className="px-4 py-3 tabular-nums">{maskMobile(row.mobile)}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-2">
                            <StatusBadge status={vkycStatusWord(row.status)} />
                            <span>{row.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatRequested(row.requested_at)}
                        </td>
                        <td className="min-w-[280px] px-4 py-3">
                          <div className="flex gap-2">
                            <input
                              type="url"
                              placeholder="https://meet…"
                              value={links[row.id] ?? row.link}
                              onChange={(e) =>
                                setLinks((prev) => ({ ...prev, [row.id]: e.target.value }))
                              }
                              disabled={busy}
                              className="w-full rounded-[12px] border border-dealer-border px-3 py-2 text-sm"
                              aria-label={`Meeting link for ${row.file_id}`}
                            />
                            <button
                              type="button"
                              onClick={() => sendLink(row)}
                              disabled={busy}
                              className="shrink-0 rounded-[12px] bg-dealer-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              Send link
                            </button>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => markDone(row)}
                              disabled={busy}
                              className="rounded-[12px] border border-dealer-border px-3 py-1.5 text-xs font-semibold text-dealer-success disabled:opacity-50"
                            >
                              Mark done
                            </button>
                            <button
                              type="button"
                              onClick={() => markFailed(row)}
                              disabled={busy}
                              className="rounded-[12px] border border-dealer-border px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                            >
                              Mark failed
                            </button>
                          </div>
                          {rowErrors[row.id] ? (
                            <p className="mt-2 text-xs text-dealer-error" role="alert">
                              {rowErrors[row.id]}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-dealer-text-quiet">Click Refresh to reload the list.</p>
        </div>
      </div>
    </MainLayout>
  );
};

export default VkycDeskPage;
