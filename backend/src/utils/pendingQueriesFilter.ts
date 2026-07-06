/**
 * Shared filtering for unresolved query audit log entries on dashboards.
 */

type AuditLog = Record<string, unknown>;

export function isUnresolved(log: AuditLog): boolean {
  const r = String(log.Resolved ?? '').trim().toLowerCase();
  return r === 'false' || r === 'no' || r === '0' || r === '';
}

export function buildResolvedQueryIds(auditLogs: AuditLog[]): Set<string> {
  const resolvedQueryIds = new Set<string>();
  auditLogs.forEach((log) => {
    const actionType = (log['Action/Event Type'] || '').toString();
    const details = (log['Details/Message'] || '').toString();
    if (actionType === 'query_resolved' && details) {
      const parentMatch = details.match(/\[\[parent:([^\]]+)\]\]/);
      if (parentMatch) {
        resolvedQueryIds.add(parentMatch[1]);
      } else {
        const match = details.match(/Query ([^\s]+) resolved/i);
        if (match) resolvedQueryIds.add(match[1]);
      }
    }
  });
  return resolvedQueryIds;
}

function getActionType(log: AuditLog): string {
  return (log['Action/Event Type'] || '').toString().toLowerCase();
}

function getDetails(log: AuditLog): string {
  return (log['Details/Message'] || '').toString();
}

export function isActionableQuery(log: AuditLog): boolean {
  return (
    getActionType(log).includes('query') &&
    !getActionType(log).includes('query_resolved') &&
    !getActionType(log).includes('query_edited') &&
    !getDetails(log).includes('Reply to query') &&
    !getDetails(log).includes('Status changed from') &&
    !getDetails(log).includes('Edit of query')
  );
}

const normFileId = (v: unknown) => String(v ?? '').trim().toLowerCase();

export interface PendingQueryItem {
  id: string;
  fileId: unknown;
  applicationId: string;
  message: string;
}

export interface FilterPendingQueriesOptions {
  targetRole?: string;
  applications?: AuditLog[];
  resolvedQueryIds?: Set<string>;
}

export function filterPendingQueries(
  auditLogs: AuditLog[],
  options: FilterPendingQueriesOptions = {}
): PendingQueryItem[] {
  const resolvedQueryIds = options.resolvedQueryIds ?? buildResolvedQueryIds(auditLogs);
  const applications = options.applications ?? [];

  return auditLogs
    .filter((log) => {
      if (options.targetRole && log['Target User/Role'] !== options.targetRole) {
        return false;
      }
      if (!isUnresolved(log)) return false;
      if (!isActionableQuery(log)) return false;
      if (resolvedQueryIds.has(String(log.id))) return false;
      if (applications.length > 0) {
        return applications.some(
          (app) =>
            normFileId(app['File ID'] || app.fileId) ===
            normFileId(log.File || log['File ID'])
        );
      }
      return true;
    })
    .map((log) => {
      const logFileId = normFileId(log.File || log['File ID']);
      const app = applications.find(
        (a) => normFileId(a['File ID'] || a.fileId) === logFileId
      );
      const rawFileId = log.File || log['File ID'];
      return {
        id: String(log.id),
        fileId: rawFileId,
        applicationId: String(app?.id || app?.['Record ID'] || rawFileId || ''),
        message: (log['Details/Message'] || '').toString().trim().slice(0, 100),
      };
    });
}
