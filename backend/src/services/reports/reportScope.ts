/**
 * Who a report reader is allowed to see.
 * Credit and admin are unscoped. A KAM is limited to Clients whose Assigned KAM matches them.
 * A missing kamId or a failed lookup is an empty scope, never the full tables.
 */

import { UserRole } from '../../config/constants.js';
import type { AuthUser } from '../../types/auth.js';
import { matchIds } from '../../utils/idMatcher.js';
import { rbacFilterService } from '../rbac/rbacFilter.service.js';

export interface ReportScope {
  unscoped: boolean;
  clientIds: string[];
  clientNames: string[];
}

const EMPTY_SCOPE: ReportScope = { unscoped: false, clientIds: [], clientNames: [] };

export async function resolveReportScope(user: AuthUser | undefined | null): Promise<ReportScope> {
  if (!user) return EMPTY_SCOPE;
  if (user.role === UserRole.CREDIT || user.role === UserRole.ADMIN) {
    return { unscoped: true, clientIds: [], clientNames: [] };
  }
  if (user.role !== UserRole.KAM || !user.kamId) {
    return EMPTY_SCOPE;
  }
  try {
    const clientIds = await rbacFilterService.getKAMManagedClientIds(user.kamId);
    return { unscoped: false, clientIds, clientNames: [] };
  } catch (error) {
    console.error('[reportScope] Failed to resolve KAM clients:', error);
    return EMPTY_SCOPE;
  }
}

function readClient(entry: Record<string, unknown>): unknown {
  return entry['Client'] ?? entry.client ?? '';
}

/**
 * Keep ledger rows the caller may see.
 * A requested client id outside a KAM's set yields no rows.
 */
export function filterLedgerEntries(
  entries: any[],
  scope: Pick<ReportScope, 'unscoped' | 'clientIds'>,
  requestedClientId?: string
): any[] {
  const requested = requestedClientId?.trim() || undefined;
  if (!scope.unscoped) {
    if (scope.clientIds.length === 0) return [];
    if (requested && !scope.clientIds.some((id) => matchIds(id, requested))) {
      return [];
    }
  }
  return entries.filter((entry) => {
    const client = readClient(entry as Record<string, unknown>);
    if (requested && !matchIds(client, requested)) return false;
    if (!scope.unscoped && !scope.clientIds.some((id) => matchIds(client, id))) return false;
    return true;
  });
}

/**
 * Scope stored on a daily summary. A missing value is company-wide (`all`).
 * The summary marker is the fallback when Airtable drops the Scope column.
 */
export function readReportScope(report: Record<string, unknown>): string {
  const field = report.Scope ?? report.scope;
  if (typeof field === 'string' && field.trim()) {
    return field.trim().toLowerCase();
  }
  const content = String(report['Summary Content'] ?? report.summaryContent ?? '');
  const match = content.match(/\[\[scope:([^\]]+)\]\]/i);
  return match ? match[1].trim().toLowerCase() : 'all';
}

/** Company-wide rows are visible to every report reader. A KAM also sees their own scope. */
export function reportVisibleTo(report: Record<string, unknown>, user: AuthUser | undefined | null): boolean {
  const scope = readReportScope(report);
  if (!scope || scope === 'all') return true;
  if (!user) return false;
  if (user.role === UserRole.CREDIT || user.role === UserRole.ADMIN) return true;
  if (user.role !== UserRole.KAM) return false;
  const email = (user.email || '').trim().toLowerCase();
  return scope === `kam:${email}`;
}
