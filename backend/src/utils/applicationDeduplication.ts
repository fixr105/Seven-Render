/**
 * Application list deduplication by File ID.
 *
 * When the n8n workflow for POST /webhook/loanapplications creates new Airtable
 * rows instead of updating by File ID, the same File ID can appear in multiple records.
 * This helper keeps one record per File ID (the one with the latest "Last Updated").
 */

type RecordWithFileId = {
  id?: string;
  'File ID'?: string;
  fileId?: string;
  'Last Updated'?: string;
  lastUpdated?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

function getFileId(app: RecordWithFileId): string {
  const raw = app['File ID'] ?? app.fileId ?? '';
  return String(raw).trim().toLowerCase();
}

function getLastUpdated(app: RecordWithFileId): number {
  const raw = app['Last Updated'] ?? app.lastUpdated ?? app.updatedAt ?? '';
  if (!raw) return 0;
  const t = typeof raw === 'string' ? new Date(raw).getTime() : Number(raw);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Deduplicate application records by File ID, keeping the record with the
 * latest "Last Updated" per File ID. Preserves original order for records
 * that are not duplicates (first occurrence of each File ID wins order).
 */
export function deduplicateApplicationsByFileId<T extends RecordWithFileId>(applications: T[]): T[] {
  if (!Array.isArray(applications) || applications.length === 0) return applications;

  const byFileId = new Map<string, T>();

  for (const app of applications) {
    const fileId = getFileId(app);
    if (!fileId) {
      // No File ID: keep as-is (no dedupe key)
      continue;
    }
    const existing = byFileId.get(fileId);
    const appTime = getLastUpdated(app);
    if (!existing || getLastUpdated(existing) < appTime) {
      byFileId.set(fileId, app);
    }
  }

  // Preserve order: for each original app that has a File ID, emit the chosen record once
  const seen = new Set<string>();
  const result: T[] = [];
  for (const app of applications) {
    const fileId = getFileId(app);
    if (!fileId) {
      result.push(app);
      continue;
    }
    if (seen.has(fileId)) continue;
    seen.add(fileId);
    result.push(byFileId.get(fileId)!);
  }
  return result;
}
