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
 * Supports both record id and KAM ID field for lookup.
 */
export function buildKAMNameMap(kamUsers: KAMUserRecord[]): Map<string, string> {
  const kamById = new Map<string, string>();
  for (const k of kamUsers) {
    const name = (k.Name || k['Name'] || '').trim();
    const kid = k.id || k['KAM ID'];
    if (kid) {
      kamById.set(String(kid), name);
    }
    const kamId = k['KAM ID'];
    if (kamId && String(kamId) !== String(kid)) {
      kamById.set(String(kamId), name);
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
