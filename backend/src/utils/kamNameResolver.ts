/**
 * KAM Name Resolver
 * Resolves Assigned KAM IDs to KAM names from KAM Users table.
 * Used by Credit Clients list to display names instead of raw IDs.
 */

export interface KAMUserRecord {
  id?: string;
  'KAM ID'?: string;
  Name?: string;
  [key: string]: unknown;
}

export interface ClientRecord {
  'Assigned KAM'?: string;
  assignedKAM?: string;
  [key: string]: unknown;
}

/**
 * Build a map of KAM ID -> KAM name from KAM Users table.
 * Supports record id, KAM ID field, and common n8n/Airtable field name variants.
 */
export function buildKAMNameMap(kamUsers: KAMUserRecord[]): Map<string, string> {
  const kamById = new Map<string, string>();
  for (const k of kamUsers) {
    const name = (k.Name || k['Name'] || (k as any).name || '').trim();
    const kid = k.id || k['KAM ID'] || (k as any)['kam id'] || (k as any).kamId;
    if (kid && name) {
      const key = String(kid).trim();
      kamById.set(key, name);
    }
    const kamId = k['KAM ID'] || (k as any)['kam id'] || (k as any).kamId;
    if (kamId) {
      const key = String(kamId).trim();
      if (!kamById.has(key)) {
        kamById.set(key, (k.Name || k['Name'] || (k as any).name || '').trim());
      }
    }
  }
  return kamById;
}

/**
 * Resolve Assigned KAM ID to display name.
 * Returns the KAM name if found, otherwise returns the raw ID (or empty string).
 */
export function resolveKAMName(
  assignedKAM: string | undefined | null,
  kamNameMap: Map<string, string>
): string {
  if (!assignedKAM || !assignedKAM.trim()) {
    return '';
  }
  const name = kamNameMap.get(assignedKAM.trim());
  return (name && name.trim()) ? name.trim() : assignedKAM;
}
