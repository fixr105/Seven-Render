/**
 * Resolve File Auditing Log rows by either Airtable record id or Log Entry ID.
 * form_data stores QUERY-* ids from createQuery, while GET webhooks often expose rec* as id.
 */

export function readAuditLogIdentifier(entry: Record<string, unknown>): string {
  const candidates = [
    entry.id,
    entry['Log Entry ID'],
    entry.logEntryId,
    entry['Log entry ID'],
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }
  return '';
}

export function findAuditLogEntryByIdentifier(
  auditLogs: Array<Record<string, unknown>>,
  identifier: string
): Record<string, unknown> | undefined {
  const needle = identifier.trim();
  if (!needle) return undefined;

  return auditLogs.find((entry) => {
    const candidates = [
      entry.id,
      entry['Log Entry ID'],
      entry.logEntryId,
      entry['Log entry ID'],
    ];
    return candidates.some((candidate) => String(candidate ?? '').trim() === needle);
  });
}

export function auditLogEntryMatchesFile(
  entry: Record<string, unknown>,
  fileId: string
): boolean {
  const expected = String(fileId ?? '').trim();
  if (!expected) return true;
  const candidates = [entry.File, entry.file, entry['File ID'], entry.fileId];
  return candidates.some((candidate) => String(candidate ?? '').trim() === expected);
}
