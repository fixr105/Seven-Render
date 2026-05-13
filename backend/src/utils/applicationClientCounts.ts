import { deduplicateApplicationsByFileId } from './applicationDeduplication.js';
import { matchIds } from './idMatcher.js';

type ClientLike = {
  id?: unknown;
  'Client ID'?: unknown;
  ID?: unknown;
  [key: string]: unknown;
};

type ApplicationLike = {
  Client?: unknown;
  'Client ID'?: unknown;
  clientId?: unknown;
  [key: string]: unknown;
};

function collectClientIds(client: ClientLike): string[] {
  return [client.id, client['Client ID'], client.ID]
    .filter((value) => value != null && String(value).trim() !== '')
    .map((value) => String(value).trim());
}

function collectApplicationClientIds(application: ApplicationLike): string[] {
  const raw = application.Client ?? application['Client ID'] ?? application.clientId;
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((value) => collectApplicationClientIds({ Client: value }));
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return [obj.id, obj.ID, obj['Client ID'], obj.clientId]
      .filter((value) => value != null && String(value).trim() !== '')
      .map((value) => String(value).trim());
  }
  const value = String(raw).trim();
  return value ? [value] : [];
}

export function countApplicationsForClient(
  client: ClientLike,
  applications: ApplicationLike[]
): number {
  const clientIds = collectClientIds(client);
  if (clientIds.length === 0) return 0;

  return deduplicateApplicationsByFileId(applications).filter((application) => {
    const appClientIds = collectApplicationClientIds(application);
    return appClientIds.some((appClientId) =>
      clientIds.some((clientId) => matchIds(appClientId, clientId))
    );
  }).length;
}

export function buildApplicationCountByClientId(
  clients: ClientLike[],
  applications: ApplicationLike[]
): Map<string, number> {
  const counts = new Map<string, number>();
  clients.forEach((client) => {
    const count = countApplicationsForClient(client, applications);
    collectClientIds(client).forEach((clientId) => counts.set(clientId, count));
  });
  return counts;
}
