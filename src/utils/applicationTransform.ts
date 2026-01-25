/**
 * API → UI transforms for application and related shapes.
 * Handles "weird but valid" API responses (string, object, undefined) for robust UI mapping.
 */

/**
 * Map API `client` field to UI `{ company_name: string } | undefined`.
 * - client: "Acme" → { company_name: "Acme" }
 * - client: { name: "Acme" } or { ['Client Name']: "Acme" } → { company_name: "Acme" }
 * - client: undefined or null → undefined
 */
export function mapClientFromApi(client: unknown): { company_name: string } | undefined {
  if (client == null) {
    return undefined;
  }
  if (typeof client === 'string') {
    return { company_name: client };
  }
  if (typeof client === 'object' && client !== null) {
    const obj = client as Record<string, unknown>;
    const name = (obj.company_name ?? obj.name ?? obj['Client Name']) as string | undefined;
    return { company_name: name ?? '' };
  }
  return undefined;
}
