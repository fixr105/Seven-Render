/**
 * KAM client access helpers — verify KAM manages a client before proxying client-context APIs.
 */

import type { AuthUser } from '../types/auth.js';
import { UserRole } from '../config/constants.js';
import { n8nClient } from '../services/airtable/n8nClient.js';
import { matchIds } from './idMatcher.js';

export class KamClientAccessError extends Error {
  constructor(
    message: string,
    readonly statusCode: 403 | 404 = 403
  ) {
    super(message);
    this.name = 'KamClientAccessError';
  }
}

export function resolveClientRecordByParam(
  clients: Record<string, unknown>[],
  id: string
): Record<string, unknown> | null {
  const trimmed = id.trim();
  if (!trimmed) return null;
  return (
    clients.find(
      (c) =>
        matchIds(c.id, trimmed) ||
        matchIds(c['Client ID'], trimmed) ||
        matchIds(c['ID'], trimmed)
    ) ?? null
  );
}

async function kamMatchesAssignedClient(
  kamId: string,
  assignedKAM: string
): Promise<boolean> {
  const assignedKAMStr = String(assignedKAM || '').trim();
  const kamIdStr = String(kamId || '').trim();
  if (!assignedKAMStr || !kamIdStr) return false;
  if (matchIds(assignedKAMStr, kamIdStr)) return true;

  const kamUsers = await n8nClient.fetchTable('KAM Users');
  const kamUser = kamUsers.find(
    (k: Record<string, unknown>) =>
      matchIds(k.id, kamId) || matchIds(k['KAM ID'], kamId)
  );
  if (!kamUser) return false;

  const kamUserEmail = String(kamUser.Email ?? kamUser['Email'] ?? '').trim();
  const kamUserKamId = String(kamUser['KAM ID'] ?? kamUser.id ?? '').trim();

  return (
    matchIds(assignedKAMStr, kamUserKamId) ||
    matchIds(assignedKAMStr, kamUserEmail) ||
    matchIds(assignedKAMStr, String(kamUser.id ?? '')) ||
    kamIdStr.includes(assignedKAMStr) ||
    assignedKAMStr.includes(kamIdStr)
  );
}

export async function assertKAMCanAccessClient(
  user: AuthUser,
  clientParamId: string
): Promise<Record<string, unknown>> {
  if (!user || user.role !== 'kam' || !user.kamId) {
    throw new KamClientAccessError('Forbidden', 403);
  }

  const clients = await n8nClient.fetchTable('Clients');
  const client = resolveClientRecordByParam(clients as Record<string, unknown>[], clientParamId);
  if (!client) {
    throw new KamClientAccessError('Client not found', 404);
  }

  const assignedKAM = String(client['Assigned KAM'] ?? '');
  const allowed = await kamMatchesAssignedClient(user.kamId, assignedKAM);
  if (!allowed) {
    throw new KamClientAccessError('Access denied: Client not managed by this KAM', 403);
  }

  return client;
}

export function resolveBusinessClientId(client: Record<string, unknown>): string {
  return String(client['Client ID'] ?? client.clientId ?? client.id ?? '').trim();
}

export function syntheticClientAuthUser(client: Record<string, unknown>): AuthUser {
  const clientId = resolveBusinessClientId(client);
  const email = String(
    client['Contact Email / Phone'] ??
      client['Contact Email/Phone'] ??
      client.contactEmail ??
      ''
  ).trim();
  return {
    id: String(client.id ?? clientId),
    email,
    role: UserRole.CLIENT,
    clientId,
    kamId: null,
    nbfcId: null,
    name: String(client['Client Name'] ?? client.clientName ?? ''),
  };
}
